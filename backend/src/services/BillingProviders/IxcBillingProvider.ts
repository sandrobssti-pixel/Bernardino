import axios from "axios";
import BillingIntegration from "../../models/BillingIntegration";
import { BillingLookupInput, BillingLookupResult, BillingProvider } from "./types";
import logger from "../../utils/logger";
import { isValidCpfCnpj, sanitizeDigits, toArray } from "./utils";

// Documentação oficial da API do IXC Soft (webservice genérico por tabela):
// https://wikiapiprovedor.ixcsoft.com.br/
// A API é sempre POST em {baseUrl}/webservice/v1/{tabela}, com o header
// "ixcsoft: listar" definindo a operação e autenticação via
// "Authorization: Basic <token gerado no painel do IXC>".
const OPEN_BILLING_STATUS = "A"; // status "A" = título em aberto na tabela fn_areceber

const resolveBaseUrl = (integration: BillingIntegration): string => {
  const credentials = (integration.credentials || {}) as Record<string, unknown>;
  const raw = String(credentials.baseUrl || "").trim().replace(/\/+$/, "");
  return raw.replace(/\/webservice(\/v1)?$/i, "");
};

const buildAuthHeader = (integration: BillingIntegration): string => {
  const credentials = (integration.credentials || {}) as Record<string, unknown>;
  const token = String(credentials.token || credentials.apiKey || "").trim();
  if (!token) return "";
  return /^Basic\s+/i.test(token) ? token : `Basic ${token}`;
};

const queryTable = async (
  integration: BillingIntegration,
  table: string,
  filters: Array<{ field: string; oper: string; value: string }>,
  options: { rp?: number; sortname?: string; sortorder?: string } = {}
): Promise<any[]> => {
  const baseUrl = resolveBaseUrl(integration);
  const authorization = buildAuthHeader(integration);

  const payload: Record<string, unknown> = {
    qtype: filters[0]?.field,
    query: filters[0]?.value,
    oper: filters[0]?.oper || "=",
    page: "1",
    rp: String(options.rp || 20)
  };

  if (options.sortname) payload.sortname = options.sortname;
  if (options.sortorder) payload.sortorder = options.sortorder;

  if (filters.length > 1) {
    payload.grid_param = JSON.stringify(
      filters.map(filter => ({
        TB: filter.field,
        OP: filter.oper || "=",
        P: filter.value
      }))
    );
  }

  const response = await axios.post(`${baseUrl}/webservice/v1/${table}`, payload, {
    headers: {
      "Content-Type": "application/json",
      ixcsoft: "listar",
      Authorization: authorization
    },
    timeout: 20000
  });

  const data = response?.data || {};
  return toArray(data?.registros);
};

const hasAuthMessage = (value?: string): boolean => {
  const text = String(value || "").toLowerCase();
  return (
    text.includes("token") ||
    text.includes("autoriza") ||
    text.includes("autentic") ||
    text.includes("permiss") ||
    text.includes("forbidden") ||
    text.includes("unauthorized")
  );
};

class IxcBillingProvider implements BillingProvider {
  async lookupOpenBilling(input: BillingLookupInput): Promise<BillingLookupResult> {
    const baseUrl = resolveBaseUrl(input.integration);
    const authorization = buildAuthHeader(input.integration);

    if (!baseUrl) {
      return {
        status: "integration_error",
        message: "URL da integração IXC não configurada."
      };
    }

    if (!authorization) {
      return {
        status: "integration_error",
        message: "Token da integração IXC não configurado."
      };
    }

    if (input.identifierType === "cpfCnpj" && !isValidCpfCnpj(input.identifierValue)) {
      return {
        status: "invalid_document",
        message: "CPF/CNPJ inválido."
      };
    }

    try {
      const customer = await this.findCustomer(input);
      if (!customer) {
        return {
          status: "customer_not_found",
          message: "Cliente não encontrado no IXC."
        };
      }

      const mappedCustomer = this.mapCustomer(customer);
      const openTitle = await this.findOpenTitle(input.integration, mappedCustomer.id);

      if (!openTitle) {
        return {
          status: "no_open_billing",
          customer: mappedCustomer,
          message: "Nenhuma cobrança em aberto encontrada."
        };
      }

      const pdfInfo = await this.findBoletoPdf(input.integration, openTitle.id);

      return {
        status: "success",
        customer: mappedCustomer,
        billing: this.mapBilling(openTitle, pdfInfo),
        raw: { customer, openTitle, pdfInfo }
      };
    } catch (error: any) {
      const message = String(
        error?.response?.data?.msg ||
          error?.response?.data?.message ||
          error?.message ||
          "Erro ao consultar integração IXC."
      );

      logger.warn("[BILLING][IXC] Erro ao consultar integração", {
        message,
        httpStatus: error?.response?.status
      });

      return { status: "integration_error", message };
    }
  }

  private async findCustomer(input: BillingLookupInput): Promise<any | null> {
    const identifier = String(input.identifierValue || "").trim();
    let field = "cliente.id";
    let value = identifier;

    if (input.identifierType === "cpfCnpj") {
      field = "cliente.cnpj_cpf";
      value = sanitizeDigits(identifier);
    } else if (input.identifierType === "phone") {
      field = "cliente.telefone_celular";
      value = sanitizeDigits(identifier);
    } else if (input.identifierType === "email") {
      field = "cliente.email";
      value = identifier;
    }

    let registros: any[];
    try {
      registros = await queryTable(input.integration, "cliente", [
        { field, oper: "=", value }
      ]);
    } catch (error: any) {
      const message = String(error?.response?.data?.msg || error?.message || "");
      if (hasAuthMessage(message)) throw error;
      throw error;
    }

    if (!registros.length) return null;

    if (input.identifierType === "email") {
      return (
        registros.find(
          item => String(item?.email || "").trim().toLowerCase() === value.toLowerCase()
        ) || registros[0]
      );
    }

    return registros[0];
  }

  private async findOpenTitle(
    integration: BillingIntegration,
    customerId?: string
  ): Promise<any | null> {
    if (!customerId) return null;

    const registros = await queryTable(
      integration,
      "fn_areceber",
      [
        { field: "fn_areceber.id_cliente", oper: "=", value: customerId },
        { field: "fn_areceber.status", oper: "=", value: OPEN_BILLING_STATUS }
      ],
      { rp: 50, sortname: "fn_areceber.data_vencimento", sortorder: "asc" }
    );

    const openTitles = registros.filter(
      item => String(item?.status || "").toUpperCase() === OPEN_BILLING_STATUS
    );

    return openTitles[0] || null;
  }

  private async findBoletoPdf(
    integration: BillingIntegration,
    titleId?: string
  ): Promise<{ pdfBase64?: string; linkBoleto?: string } | null> {
    if (!titleId) return null;

    const baseUrl = resolveBaseUrl(integration);
    const authorization = buildAuthHeader(integration);

    try {
      const response = await axios.post(
        `${baseUrl}/webservice/v1/get_boleto`,
        {
          idsFaturas: titleId,
          juros: "N",
          multa: "N",
          nossoNumero: "N",
          linkBoleto: "S",
          base64: "S"
        },
        {
          headers: {
            "Content-Type": "application/json",
            ixcsoft: "gerar_boleto",
            Authorization: authorization
          },
          timeout: 20000
        }
      );

      const data = response?.data || {};
      return {
        pdfBase64: data?.pdf || data?.boleto || undefined,
        linkBoleto: data?.link || data?.url || undefined
      };
    } catch (error: any) {
      logger.warn("[BILLING][IXC] Falha ao gerar 2ª via de boleto, seguindo sem PDF/link", {
        titleId,
        message: error?.message
      });
      return null;
    }
  }

  private mapCustomer(customer: any) {
    return {
      id: String(customer?.id || ""),
      name: String(customer?.razao || customer?.fantasia || ""),
      document: String(customer?.cnpj_cpf || ""),
      email: String(customer?.email || ""),
      phone: String(customer?.telefone_celular || customer?.telefone_comercial || "")
    };
  }

  private mapBilling(
    title: any,
    pdfInfo: { pdfBase64?: string; linkBoleto?: string } | null
  ) {
    // Observação: diferente do Asaas/SGP, a API padrão do IXC não expõe uma
    // URL HTTP pública e estável para o PDF do boleto — o retorno normal é o
    // conteúdo em base64. Por isso "pdfUrl" só é preenchido quando o IXC
    // retornar um link explícito; sem link, o botão "Enviar boleto em PDF"
    // não terá o que baixar (comportamento seguro, não quebra o fluxo).
    return {
      providerReference: String(title?.id || ""),
      amount: Number(title?.valor || 0),
      dueDate: String(title?.data_vencimento || ""),
      invoiceUrl: String(pdfInfo?.linkBoleto || ""),
      billetUrl: String(pdfInfo?.linkBoleto || ""),
      pdfUrl: String(pdfInfo?.linkBoleto || ""),
      digitableLine: String(title?.linha_digitavel || ""),
      pixCode: "",
      pixQrCodeUrl: ""
    };
  }
}

export default IxcBillingProvider;
