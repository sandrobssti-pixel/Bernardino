import axios from "axios";
import BillingIntegration from "../../models/BillingIntegration";
import { BillingLookupInput, BillingLookupResult, BillingProvider } from "./types";
import { isValidCpfCnpj, sanitizeDigits, toArray } from "./utils";

const DEFAULT_ATLAZ_BASE_URL = "https://app.atlaz.com.br/api/v2";

const resolveBaseUrl = (integration: BillingIntegration): string => {
  const credentials = (integration.credentials || {}) as Record<string, unknown>;
  return String(credentials.baseUrl || DEFAULT_ATLAZ_BASE_URL).trim().replace(/\/+$/, "");
};

const resolveToken = (integration: BillingIntegration): string =>
  String((integration.credentials as any)?.apiKey || "").trim();

const isSuccess = (data: any): boolean => String(data?.success) === "true";

const normalizeText = (value?: string): string =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const hasAuthOrConfigMessage = (value?: string): boolean => {
  const text = normalizeText(value);
  return (
    text.includes("token") ||
    text.includes("autentic") ||
    text.includes("nao autorizado") ||
    text.includes("forbidden") ||
    text.includes("permissao") ||
    text.includes("credencial")
  );
};

const sortFaturasByDueDate = (faturas: any[]): any[] =>
  [...faturas].sort((a, b) =>
    String(a?.data_vencimento || "").localeCompare(String(b?.data_vencimento || ""))
  );

class AtlazBillingProvider implements BillingProvider {
  async lookupOpenBilling(input: BillingLookupInput): Promise<BillingLookupResult> {
    const token = resolveToken(input.integration);
    if (!token) {
      return {
        status: "integration_error",
        message: "Token da integração Atlaz não configurado."
      };
    }

    if (input.identifierType === "cpfCnpj" && !isValidCpfCnpj(input.identifierValue)) {
      return {
        status: "invalid_document",
        message: "CPF/CNPJ inválido."
      };
    }

    if (input.identifierType === "email") {
      return {
        status: "integration_error",
        message:
          "Atlaz não suporta consulta por e-mail. Utilize CPF/CNPJ, telefone ou código do assinante."
      };
    }

    try {
      const assinante = await this.findAssinante(input);
      if (!assinante) {
        return {
          status: "customer_not_found",
          message: "Cliente não encontrado na integração Atlaz."
        };
      }

      const customer = this.mapCustomer(assinante);
      const fatura = await this.findOpenFatura(input.integration, assinante.id_assinante);

      if (!fatura) {
        return {
          status: "no_open_billing",
          customer,
          message: "Nenhuma cobrança em aberto encontrada."
        };
      }

      return {
        status: "success",
        customer,
        billing: this.mapBilling(fatura),
        raw: { assinante, fatura }
      };
    } catch (error: any) {
      return {
        status: "integration_error",
        message: String(
          error?.response?.data?.msg ||
            error?.response?.data?.message ||
            error?.message ||
            "Erro ao consultar integração Atlaz."
        )
      };
    }
  }

  private async findAssinante(input: BillingLookupInput): Promise<any | null> {
    const baseUrl = resolveBaseUrl(input.integration);
    const token = resolveToken(input.integration);
    const identifier = String(input.identifierValue || "").trim();

    const params: Record<string, unknown> = { token };

    if (input.identifierType === "cpfCnpj") {
      params.cpf_cnpj = sanitizeDigits(identifier);
    } else if (input.identifierType === "phone") {
      params.telefone = sanitizeDigits(identifier);
      params.testar_com_e_sem_nono_digito = true;
    } else {
      const idAssinante = Number(sanitizeDigits(identifier));
      if (!idAssinante) return null;
      params.id_assinante = idAssinante;
    }

    const response = await axios.get(`${baseUrl}/consultacliente`, { params });
    const data = response?.data || {};
    const message = String(data?.msg || "");

    if (!isSuccess(data)) {
      if (hasAuthOrConfigMessage(message)) {
        throw new Error(message || "Credenciais inválidas na integração Atlaz.");
      }
      return null;
    }

    return data?.assinante || null;
  }

  private async findOpenFatura(
    integration: BillingIntegration,
    idAssinante: number | string
  ): Promise<any | null> {
    const baseUrl = resolveBaseUrl(integration);
    const token = resolveToken(integration);

    const response = await axios.get(`${baseUrl}/faturas`, {
      params: {
        token,
        id_assinante: idAssinante,
        apenas_nao_pagas: 1,
        retornar_pix: 1
      }
    });

    const data = response?.data || {};
    const message = String(data?.msg || "");

    if (!isSuccess(data)) {
      if (hasAuthOrConfigMessage(message)) {
        throw new Error(
          message || "Credenciais inválidas ao consultar faturas na integração Atlaz."
        );
      }
      return null;
    }

    const faturas = toArray(data?.faturas);
    if (!faturas.length) return null;

    return sortFaturasByDueDate(faturas)[0];
  }

  private mapCustomer(assinante: any) {
    return {
      id: String(assinante?.id_assinante || ""),
      name: String(assinante?.nome || ""),
      document: String(assinante?.cpf_cnpj || ""),
      email: String(assinante?.email || ""),
      phone: String(assinante?.telefone || "")
    };
  }

  private mapBilling(fatura: any) {
    return {
      providerReference: String(fatura?.id || ""),
      amount: Number(fatura?.valor_com_juros || fatura?.valor || 0),
      dueDate: String(fatura?.data_vencimento || ""),
      invoiceUrl: String(fatura?.link || ""),
      billetUrl: String(fatura?.link || ""),
      pdfUrl: String(fatura?.link || ""),
      digitableLine: String(fatura?.linha_digitavel || ""),
      pixCode: String(fatura?.pix_brcode || ""),
      pixQrCodeUrl: String(fatura?.pix_qrcode_link || "")
    };
  }
}

export default AtlazBillingProvider;
