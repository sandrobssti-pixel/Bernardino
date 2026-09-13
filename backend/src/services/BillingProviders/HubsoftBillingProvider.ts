import axios from "axios";
import BillingIntegration from "../../models/BillingIntegration";
import { BillingLookupInput, BillingLookupResult, BillingProvider } from "./types";
import logger from "../../utils/logger";
import { getNestedValue, isValidCpfCnpj, sanitizeDigits, toArray } from "./utils";

// Documentação oficial da API do Hubsoft:
// https://docs.hubsoft.com.br/ (fonte: https://github.com/hubsoftbrasil/api)
// Autenticação via OAuth2 (grant_type "password") em {baseUrl}/oauth/token,
// gerando um access_token Bearer válido por 30 dias. As consultas usam:
//   GET {baseUrl}/api/v1/integracao/cliente             -> dados do cliente
//   GET {baseUrl}/api/v1/integracao/cliente/financeiro   -> faturas do cliente
const OAUTH_TOKEN_PATH = "/oauth/token";
const CUSTOMER_PATH = "/api/v1/integracao/cliente";
const FINANCE_PATH = "/api/v1/integracao/cliente/financeiro";

interface HubsoftCredentials {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}

const resolveBaseUrl = (integration: BillingIntegration): string => {
  const credentials = (integration.credentials || {}) as Record<string, unknown>;
  return String(credentials.baseUrl || "").trim().replace(/\/+$/, "");
};

const resolveCredentials = (integration: BillingIntegration): HubsoftCredentials => {
  const credentials = (integration.credentials || {}) as Record<string, unknown>;
  return {
    baseUrl: resolveBaseUrl(integration),
    clientId: String(credentials.clientId || "").trim(),
    clientSecret: String(credentials.clientSecret || "").trim(),
    username: String(credentials.username || "").trim(),
    password: String(credentials.password || "").trim()
  };
};

const missingCredentialMessage = (credentials: HubsoftCredentials): string | null => {
  if (!credentials.baseUrl) return "URL da integração Hubsoft não configurada.";
  if (!credentials.clientId || !credentials.clientSecret) {
    return "Client ID/Client Secret da integração Hubsoft não configurados.";
  }
  if (!credentials.username || !credentials.password) {
    return "Usuário/senha da integração Hubsoft não configurados.";
  }
  return null;
};

const getAccessToken = async (credentials: HubsoftCredentials): Promise<string> => {
  const response = await axios.post(
    `${credentials.baseUrl}${OAUTH_TOKEN_PATH}`,
    {
      grant_type: "password",
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      username: credentials.username,
      password: credentials.password
    },
    {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      timeout: 20000
    }
  );

  const token = String(response?.data?.access_token || "").trim();
  if (!token) {
    throw new Error("Não foi possível autenticar na integração Hubsoft.");
  }
  return token;
};

const hasAuthOrConfigMessage = (value?: string): boolean => {
  const text = String(value || "").toLowerCase();
  return (
    text.includes("token") ||
    text.includes("autoriza") ||
    text.includes("autentic") ||
    text.includes("credencial") ||
    text.includes("forbidden") ||
    text.includes("unauthorized") ||
    text.includes("unauthenticated")
  );
};

const firstNestedValue = (source: any, paths: string[]): string => {
  for (const path of paths) {
    const value = getNestedValue(source, path);
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
};

class HubsoftBillingProvider implements BillingProvider {
  async lookupOpenBilling(input: BillingLookupInput): Promise<BillingLookupResult> {
    const credentials = resolveCredentials(input.integration);
    const missingMessage = missingCredentialMessage(credentials);

    if (missingMessage) {
      return { status: "integration_error", message: missingMessage };
    }

    if (input.identifierType === "cpfCnpj" && !isValidCpfCnpj(input.identifierValue)) {
      return {
        status: "invalid_document",
        message: "CPF/CNPJ inválido."
      };
    }

    if (input.identifierType === "phone") {
      return {
        status: "integration_error",
        message:
          "Hubsoft não suporta consulta por telefone. Utilize CPF/CNPJ, e-mail ou código externo (código do cliente)."
      };
    }

    try {
      const accessToken = await getAccessToken(credentials);

      let customer: any = null;
      if (input.identifierType === "externalCode") {
        customer = await this.findCustomer(credentials, accessToken, "codigo_cliente", String(input.identifierValue || "").trim());
      } else if (input.identifierType === "email") {
        customer = await this.findCustomer(credentials, accessToken, "email_principal", String(input.identifierValue || "").trim());
      } else {
        customer = await this.findCustomer(
          credentials,
          accessToken,
          "cpf_cnpj",
          sanitizeDigits(input.identifierValue)
        );
      }

      if (!customer) {
        return {
          status: "customer_not_found",
          message: "Cliente não encontrado no Hubsoft."
        };
      }

      const mappedCustomer = this.mapCustomer(customer);
      const invoice = await this.findOpenInvoice(credentials, accessToken, mappedCustomer);

      if (!invoice) {
        return {
          status: "no_open_billing",
          customer: mappedCustomer,
          message: "Nenhuma cobrança em aberto encontrada."
        };
      }

      return {
        status: "success",
        customer: mappedCustomer,
        billing: this.mapBilling(invoice),
        raw: { customer, invoice }
      };
    } catch (error: any) {
      const message = String(
        error?.response?.data?.msg ||
          error?.response?.data?.message ||
          error?.message ||
          "Erro ao consultar integração Hubsoft."
      );

      logger.warn("[BILLING][HUBSOFT] Erro ao consultar integração", {
        message,
        httpStatus: error?.response?.status
      });

      if (error?.response?.status === 401 || hasAuthOrConfigMessage(message)) {
        return {
          status: "integration_error",
          message: message || "Falha de autenticação na integração Hubsoft."
        };
      }

      return { status: "integration_error", message };
    }
  }

  private async findCustomer(
    credentials: HubsoftCredentials,
    accessToken: string,
    busca: string,
    termoBusca: string
  ): Promise<any | null> {
    if (!termoBusca) return null;

    const response = await axios.get(`${credentials.baseUrl}${CUSTOMER_PATH}`, {
      params: { busca, termo_busca: termoBusca, limit: 1 },
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      timeout: 20000
    });

    const clientes = toArray(response?.data?.clientes);
    return clientes[0] || null;
  }

  private async findOpenInvoice(
    credentials: HubsoftCredentials,
    accessToken: string,
    customer: { id?: string; document?: string }
  ): Promise<any | null> {
    const termoBusca = customer.document || customer.id;
    if (!termoBusca) return null;

    const response = await axios.get(`${credentials.baseUrl}${FINANCE_PATH}`, {
      params: {
        busca: customer.document ? "cpf_cnpj" : "id_cliente",
        termo_busca: termoBusca,
        apenas_pendente: "sim",
        order_by: "data_vencimento",
        order_type: "asc",
        tipo_resultado: "detalhado",
        limit: 10
      },
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      timeout: 20000
    });

    const faturas = toArray(
      response?.data?.faturas || response?.data?.faturas_pendentes || response?.data?.dados
    );

    return faturas[0] || null;
  }

  private mapCustomer(customer: any) {
    return {
      id: firstNestedValue(customer, ["id_cliente", "id"]),
      name: firstNestedValue(customer, ["nome_razaosocial", "nome"]),
      document: firstNestedValue(customer, ["cpf_cnpj"]),
      email: firstNestedValue(customer, [
        "email_principal",
        "emails.0.email",
        "email"
      ]),
      phone: firstNestedValue(customer, [
        "telefone_principal",
        "telefones.0.numero",
        "telefone"
      ])
    };
  }

  private mapBilling(invoice: any) {
    return {
      providerReference: firstNestedValue(invoice, ["id_fatura", "id"]),
      amount: Number(getNestedValue(invoice, "valor") || 0),
      dueDate: firstNestedValue(invoice, ["data_vencimento"]),
      invoiceUrl: firstNestedValue(invoice, ["link_pdf", "link_boleto", "link"]),
      billetUrl: firstNestedValue(invoice, ["link_pdf", "link_boleto", "link"]),
      pdfUrl: firstNestedValue(invoice, ["link_pdf", "link_boleto", "link"]),
      digitableLine: firstNestedValue(invoice, ["linha_digitavel", "codigo_barras"]),
      pixCode: firstNestedValue(invoice, ["pix_copia_cola", "pix_qrcode"]),
      pixQrCodeUrl: firstNestedValue(invoice, ["pix_qrcode_link", "pix_qrcode_url"])
    };
  }
}

export default HubsoftBillingProvider;
