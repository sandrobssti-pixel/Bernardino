import axios from "axios";
import BillingIntegration from "../../models/BillingIntegration";
import { BillingLookupInput, BillingLookupResult, BillingProvider } from "./types";
import logger from "../../utils/logger";
import { isValidCpfCnpj, sanitizeDigits, toArray } from "./utils";

const normalizeText = (value?: string): string =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const resolveBaseUrl = (integration: BillingIntegration): string =>
  String((integration.credentials as any)?.baseUrl || "").trim().replace(/\/+$/, "");

const buildCredentials = (integration: BillingIntegration) => {
  const credentials = (integration.credentials || {}) as Record<string, unknown>;
  return {
    app: String(credentials.app || "").trim(),
    token: String(credentials.apiKey || "").trim()
  };
};

const buildFormPayload = (
  integration: BillingIntegration,
  payload: Record<string, unknown>
): URLSearchParams => {
  const credentials = buildCredentials(integration);
  const params = new URLSearchParams();

  params.append("app", credentials.app);
  params.append("token", credentials.token);

  Object.entries(payload).forEach(([key, value]) => {
    if (typeof value === "undefined" || value === null) return;
    const normalizedValue = String(value).trim();
    if (!normalizedValue) return;
    params.append(key, normalizedValue);
  });

  return params;
};

const postForm = async (
  integration: BillingIntegration,
  path: string,
  payload: Record<string, unknown>
) =>
  axios.post(
    `${resolveBaseUrl(integration)}${path}`,
    buildFormPayload(integration, payload),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );

const resolveAbsoluteUrl = (baseUrl: string, value?: string): string => {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";
  if (/^https?:\/\//i.test(rawValue)) return rawValue;

  try {
    return new URL(rawValue, `${baseUrl}/`).toString();
  } catch {
    return rawValue;
  }
};

const extractContractId = (contract: any): string =>
  String(contract?.contratoId || contract?.contrato || "").trim();

const extractContractPhones = (contract: any): string[] => {
  const phones = [
    ...toArray(contract?.telefones),
    ...toArray(contract?.telefones_cargos).map(item => item?.contato)
  ];

  return phones
    .map(item => String(item || "").trim())
    .filter(Boolean);
};

const extractContractEmails = (contract: any): string[] =>
  toArray(contract?.emails)
    .map(item => String(item || "").trim())
    .filter(Boolean);

const hasOpenBillingMessage = (value?: string): boolean => {
  const text = normalizeText(value);
  return (
    text.includes("sem fatura") ||
    text.includes("sem cobranca") ||
    text.includes("sem titulo") ||
    text.includes("nao ha fatura") ||
    text.includes("nao possui fatura") ||
    text.includes("nao possui titulo") ||
    text.includes("nao possui titulos") ||
    text.includes("nenhuma fatura") ||
    text.includes("nenhum titulo") ||
    text.includes("nao foram encontradas faturas") ||
    text.includes("nao existem titulos") ||
    text.includes("nao ha titulos") ||
    text.includes("sem debito") ||
    text.includes("sem debitos")
  );
};

const hasAuthOrConfigMessage = (value?: string): boolean => {
  const text = normalizeText(value);
  return (
    text.includes("token") ||
    text.includes("app") ||
    text.includes("autentic") ||
    text.includes("nao autorizado") ||
    text.includes("não autorizado") ||
    text.includes("forbidden") ||
    text.includes("permissao") ||
    text.includes("credencial")
  );
};

interface SgpLookupSuccess {
  status: "success";
  payload: any;
  title: any;
  titleDetails?: any | null;
}

interface SgpLookupNoOpenBilling {
  status: "no_open_billing";
  payload: any;
}

type SgpLookupResponse = SgpLookupSuccess | SgpLookupNoOpenBilling;

class SgpBillingProvider implements BillingProvider {
  async lookupOpenBilling(input: BillingLookupInput): Promise<BillingLookupResult> {
    const baseUrl = resolveBaseUrl(input.integration);
    const credentials = buildCredentials(input.integration);

    if (!baseUrl) {
      return {
        status: "integration_error",
        message: "Base URL da integração SGP não configurada."
      };
    }

    if (!credentials.app) {
      return {
        status: "integration_error",
        message: "App da integração SGP / TSMX não configurado."
      };
    }

    if (!credentials.token) {
      return {
        status: "integration_error",
        message: "Token da integração SGP / TSMX não configurado."
      };
    }

    if (input.identifierType === "cpfCnpj" && !isValidCpfCnpj(input.identifierValue)) {
      return {
        status: "invalid_document",
        message: "CPF/CNPJ inválido."
      };
    }

    try {
      const contracts = await this.findContracts(input);
      if (!contracts.length) {
        return {
          status: "customer_not_found",
          message: "Cliente não encontrado na integração SGP."
        };
      }

      const orderedContracts = this.sortContracts(contracts);
      const fallbackCustomer = this.mapCustomer(orderedContracts[0]);
      const attempts: any[] = [];

      for (const contract of orderedContracts) {
        const secondCopy = await this.findSecondCopy(input.integration, contract);
        attempts.push({
          contractId: extractContractId(contract),
          response: secondCopy.payload
        });

        if (secondCopy.status === "success") {
          return {
            status: "success",
            customer: this.mapCustomer(contract),
            billing: this.mapBilling(
              secondCopy.payload,
              secondCopy.title,
              secondCopy.titleDetails,
              input.integration
            ),
            raw: {
              contract,
              secondCopy: secondCopy.payload,
              titleDetails: secondCopy.titleDetails,
              attempts
            }
          };
        }
      }

      return {
        status: "no_open_billing",
        customer: fallbackCustomer,
        raw: {
          contracts: orderedContracts,
          attempts
        }
      };
    } catch (error: any) {
      return {
        status: "integration_error",
        message: String(
          error?.response?.data?.msg ||
            error?.response?.data?.message ||
            error?.message ||
            "Erro ao consultar integração SGP."
        )
      };
    }
  }

  private async findContracts(input: BillingLookupInput): Promise<any[]> {
    const identifier = String(input.identifierValue || "").trim();
    const payload: Record<string, unknown> = {};

    if (input.identifierType === "cpfCnpj") {
      payload.cpfcnpj = sanitizeDigits(identifier);
    } else if (input.identifierType === "phone") {
      payload.telefone = identifier;
    } else if (input.identifierType === "email") {
      payload.email = identifier;
    } else {
      payload.contrato = identifier;
    }

    const response = await postForm(input.integration, "/api/ura/consultacliente/", payload);
    const data = response?.data || {};
    const message = String(data?.msg || data?.message || "");

    logger.info("[BILLING][SGP] Resposta consultacliente", {
      httpStatus: response?.status,
      dataStatus: data?.status,
      msg: message,
      hasContratos: Array.isArray(data?.contratos),
      contratosCount: Array.isArray(data?.contratos) ? data.contratos.length : 0
    });

    if (hasAuthOrConfigMessage(message) && !Array.isArray(data?.contratos)) {
      throw new Error(message || "Credenciais inválidas na integração SGP.");
    }

    const contracts = toArray(data?.contratos);

    if (!contracts.length) return [];

    if (input.identifierType === "cpfCnpj") {
      const document = sanitizeDigits(identifier);
      return contracts.filter(
        contract => sanitizeDigits(contract?.cpfCnpj || contract?.cpfcnpj) === document
      );
    }

    if (input.identifierType === "phone") {
      const phone = sanitizeDigits(identifier);
      return contracts.filter(contract =>
        extractContractPhones(contract).some(item => sanitizeDigits(item) === phone)
      );
    }

    if (input.identifierType === "email") {
      const email = identifier.toLowerCase();
      return contracts.filter(contract =>
        extractContractEmails(contract).some(item => item.toLowerCase() === email)
      );
    }

    return contracts.filter(contract => extractContractId(contract) === identifier);
  }

  private sortContracts(contracts: any[]): any[] {
    return [...contracts].sort((a, b) => {
      const openA = Number(a?.contratoValorAberto || 0);
      const openB = Number(b?.contratoValorAberto || 0);
      if (openA !== openB) return openB - openA;
      return extractContractId(a).localeCompare(extractContractId(b));
    });
  }

  private async findSecondCopy(
    integration: BillingIntegration,
    contract: any
  ): Promise<SgpLookupResponse> {
    const contractId = extractContractId(contract);
    const contractDocument = sanitizeDigits(contract?.cpfCnpj || contract?.cpfcnpj);
    const response = await postForm(integration, "/api/ura/fatura2via/", {
      contrato: contractId,
      cpfcnpj: contractDocument,
      nao_gerar_os: "1"
    });

    const data = response?.data || {};
    const links = toArray(data?.links);
    const primaryLink = links[0] || null;
    const message = String(data?.msg || "");
    const hasSuccessStatus = String(data?.status || "") === "1";

    logger.info("[BILLING][SGP] Resposta fatura2via", {
      contractId,
      hasSuccessStatus,
      linksCount: links.length,
      hasTopLevelLink: Boolean(data?.link),
      message,
      status: data?.status
    });

    if (data?.link || links.length) {
      const title = {
        fatura: data?.fatura || primaryLink?.fatura,
        valor: data?.valor || primaryLink?.valor,
        vencimento: data?.vencimento || primaryLink?.vencimento,
        link: data?.link || primaryLink?.link,
        linhadigitavel: data?.linhadigitavel || primaryLink?.linhadigitavel,
        valor_original: data?.valor_original || primaryLink?.valor_original,
        vencimento_original: data?.vencimento_original || primaryLink?.vencimento_original,
        codigopix: data?.codigopix || data?.codigoPix || primaryLink?.codigopix || primaryLink?.codigoPix
      };

      const titleDetails = await this.findTitleDetails(integration, contractId, title.fatura);

      return {
        status: "success",
        payload: data,
        title,
        titleDetails
      };
    }

    if (!links.length && !data?.link) {
      if (hasAuthOrConfigMessage(message)) {
        throw new Error(message || "Credenciais inválidas ao consultar segunda via no SGP.");
      }

      if (hasOpenBillingMessage(message) || !message) {
        return { status: "no_open_billing", payload: data };
      }

      logger.warn("[BILLING][SGP] Resposta fatura2via sem link e sem mensagem reconhecida", {
        contractId,
        msg: message
      });

      return { status: "no_open_billing", payload: data };
    }

    return { status: "no_open_billing", payload: data };
  }

  private async findTitleDetails(
    integration: BillingIntegration,
    contractId: string,
    titleId?: string | number
  ): Promise<any | null> {
    if (!contractId) return null;

    try {
      const response = await postForm(integration, "/api/ura/clientes/", {
        contrato: contractId,
        status: "aberto",
        limit: "1"
      });

      const customer = toArray(response?.data?.clientes)[0];
      const titles = toArray(customer?.titulos);
      if (!titles.length) return null;

      if (!titleId) return titles[0];

      return (
        titles.find(item => String(item?.id || item?.numeroDocumento || "") === String(titleId)) ||
        titles[0]
      );
    } catch {
      return null;
    }
  }

  private mapCustomer(contract: any) {
    const emails = extractContractEmails(contract);
    const phones = extractContractPhones(contract);

    return {
      id: String(contract?.clienteId || contract?.cliente_id || ""),
      name: String(contract?.razaoSocial || contract?.nome || ""),
      document: String(contract?.cpfCnpj || contract?.cpfcnpj || ""),
      email: emails[0] || "",
      phone: phones[0] || ""
    };
  }

  private mapBilling(
    payload: any,
    title: any,
    titleDetails: any,
    integration: BillingIntegration
  ) {
    const baseUrl = resolveBaseUrl(integration);
    const invoiceUrl = resolveAbsoluteUrl(baseUrl, title?.link);
    const pdfUrl = invoiceUrl
      ? invoiceUrl.includes("?")
        ? `${invoiceUrl}&format=pdf`
        : `${invoiceUrl}?format=pdf`
      : "";

    return {
      providerReference: String(
        title?.fatura || titleDetails?.id || titleDetails?.numeroDocumento || ""
      ),
      amount: Number(title?.valor || titleDetails?.valorCorrigido || titleDetails?.valor || 0),
      dueDate: String(title?.vencimento || titleDetails?.dataVencimento || ""),
      invoiceUrl,
      billetUrl: invoiceUrl,
      pdfUrl,
      digitableLine: String(
        title?.linhadigitavel ||
          titleDetails?.linhaDigitavel ||
          titleDetails?.codigoBarras ||
          payload?.linhadigitavel ||
          ""
      ),
      pixCode: String(
        title?.codigopix ||
          payload?.codigopix ||
          titleDetails?.codigoPix ||
          ""
      ),
      pixQrCodeUrl: ""
    };
  }
}

export default SgpBillingProvider;
