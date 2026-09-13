import axios from "axios";
import BillingIntegration from "../../models/BillingIntegration";
import { BillingLookupInput, BillingLookupResult, BillingProvider } from "./types";
import { isValidCpfCnpj, sanitizeDigits } from "./utils";

const DEFAULT_ASAAS_BASE_URL = process.env.ASAAS_BASE_URL || "https://api.asaas.com/v3";
const OPEN_STATUSES = new Set(["PENDING", "OVERDUE"]);
const ASAAS_OPEN_STATUS_PRIORITY = ["OVERDUE", "PENDING"] as const;

const buildHeaders = (integration: BillingIntegration) => {
  const credentials = (integration.credentials || {}) as Record<string, unknown>;
  return {
    "Content-Type": "application/json",
    access_token: String(credentials.apiKey || "").trim()
  };
};

const resolveBaseUrl = (integration: BillingIntegration): string => {
  const credentials = (integration.credentials || {}) as Record<string, unknown>;
  return String(credentials.baseUrl || DEFAULT_ASAAS_BASE_URL).trim().replace(/\/+$/, "");
};

class AsaasBillingProvider implements BillingProvider {
  async lookupOpenBilling(input: BillingLookupInput): Promise<BillingLookupResult> {
    const apiKey = String((input.integration.credentials as any)?.apiKey || "").trim();
    if (!apiKey) {
      return {
        status: "integration_error",
        message: "API Key do Asaas não configurada."
      };
    }

    if (input.identifierType === "cpfCnpj" && !isValidCpfCnpj(input.identifierValue)) {
      return {
        status: "invalid_document",
        message: "CPF/CNPJ inválido."
      };
    }

    try {
      const customers = await this.findCustomers(input);
      if (!customers.length) {
        return {
          status: "customer_not_found",
          message: "Cliente não encontrado no Asaas."
        };
      }

      const customerWithBilling = await this.findCustomerWithOpenBilling(
        input.integration,
        customers
      );
      const customer = customerWithBilling?.customer || customers[0];
      const billing = customerWithBilling?.billing || null;

      if (!billing) {
        return {
          status: "no_open_billing",
          customer: {
            id: String(customer.id || ""),
            name: String(customer.name || ""),
            document: String(customer.cpfCnpj || ""),
            email: String(customer.email || ""),
            phone: String(customer.mobilePhone || customer.phone || "")
          },
          message: "Nenhuma cobrança em aberto encontrada."
        };
      }

      const pix = await this.findPixInfo(input.integration, billing.id);

      return {
        status: "success",
        customer: {
          id: String(customer.id || ""),
          name: String(customer.name || ""),
          document: String(customer.cpfCnpj || ""),
          email: String(customer.email || ""),
          phone: String(customer.mobilePhone || customer.phone || "")
        },
        billing: {
          providerReference: String(billing.id || ""),
          amount: Number(billing.value || 0),
          dueDate: String(billing.dueDate || ""),
          invoiceUrl: String(billing.invoiceUrl || billing.bankSlipUrl || ""),
          billetUrl: String(billing.bankSlipUrl || billing.invoiceUrl || ""),
          digitableLine: String(
            billing.identificationField ||
              billing.digitableLine ||
              ""
          ),
          pixCode: String(pix?.payload || ""),
          pixQrCodeUrl: String(pix?.encodedImage || "")
        },
        raw: {
          customer,
          billing,
          pix
        }
      };
    } catch (error: any) {
      return {
        status: "integration_error",
        message: String(
          error?.response?.data?.errors?.[0]?.description ||
            error?.response?.data?.message ||
            error?.message ||
            "Erro ao consultar Asaas."
        )
      };
    }
  }

  private async findCustomers(input: BillingLookupInput): Promise<any[]> {
    const baseUrl = resolveBaseUrl(input.integration);
    const headers = buildHeaders(input.integration);
    const rawIdentifier = String(input.identifierValue || "").trim();
    const identifier = input.identifierType === "cpfCnpj"
      ? sanitizeDigits(rawIdentifier)
      : rawIdentifier;

    const params: Record<string, unknown> = {
      limit: 100
    };

    if (input.identifierType === "cpfCnpj") params.cpfCnpj = identifier;
    if (input.identifierType === "email") params.email = identifier;
    if (input.identifierType === "externalCode") params.externalReference = identifier;
    if (input.identifierType === "phone") params.mobilePhone = sanitizeDigits(identifier);

    const response = await axios.get(`${baseUrl}/customers`, {
      headers,
      params
    });

    const customers = Array.isArray(response?.data?.data) ? response.data.data : [];
    if (!customers.length) return [];

    if (input.identifierType === "phone") {
      const normalizedPhone = sanitizeDigits(identifier);
      return customers.filter((item: any) =>
          [item.mobilePhone, item.phone]
            .map((phone: string) => sanitizeDigits(phone))
            .includes(normalizedPhone)
        );
    }

    if (input.identifierType === "cpfCnpj") {
      return customers.filter(
        (item: any) => sanitizeDigits(item.cpfCnpj) === identifier
      );
    }

    if (input.identifierType === "email") {
      return customers.filter(
          (item: any) =>
            String(item.email || "").trim().toLowerCase() === identifier.toLowerCase()
        );
    }

    if (input.identifierType === "externalCode") {
      return customers.filter(
          (item: any) => String(item.externalReference || "").trim() === identifier
        );
    }

    return customers;
  }

  private async findCustomerWithOpenBilling(
    integration: BillingIntegration,
    customers: any[]
  ): Promise<{ customer: any; billing: any } | null> {
    for (const customer of customers) {
      const billing = await this.findOpenBilling(integration, String(customer?.id || ""));
      if (billing) {
        return { customer, billing };
      }
    }

    return null;
  }

  private async findOpenBilling(
    integration: BillingIntegration,
    customerId: string
  ): Promise<any | null> {
    for (const status of ASAAS_OPEN_STATUS_PRIORITY) {
      const payments = await this.fetchPayments(integration, customerId, status);
      const sortedPayments = this.sortPaymentsByDueDate(payments);

      if (sortedPayments.length > 0) {
        return sortedPayments[0];
      }
    }

    // Fallback defensivo para cobranças abertas que, por algum motivo,
    // não venham corretamente filtradas pela API.
    const payments = await this.fetchPayments(integration, customerId);
    const openPayments = payments.filter((item: any) =>
      OPEN_STATUSES.has(String(item.status || "").toUpperCase())
    );
    const sortedOpenPayments = this.sortPaymentsByDueDate(openPayments);

    return sortedOpenPayments[0] || null;
  }

  private async fetchPayments(
    integration: BillingIntegration,
    customerId: string,
    status?: string
  ): Promise<any[]> {
    const baseUrl = resolveBaseUrl(integration);
    const headers = buildHeaders(integration);
    const payments: any[] = [];
    const limit = 100;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await axios.get(`${baseUrl}/payments`, {
        headers,
        params: {
          customer: customerId,
          status,
          limit,
          offset
        }
      });

      const pageItems = Array.isArray(response?.data?.data) ? response.data.data : [];
      payments.push(...pageItems);

      const totalCount = Number(response?.data?.totalCount || 0);
      offset += pageItems.length;
      hasMore = pageItems.length === limit && offset < totalCount;
    }

    return payments;
  }

  private sortPaymentsByDueDate(payments: any[]): any[] {
    return [...payments].sort((a: any, b: any) =>
      String(a?.dueDate || "").localeCompare(String(b?.dueDate || ""))
    );
  }

  private async findPixInfo(
    integration: BillingIntegration,
    paymentId?: string
  ): Promise<any | null> {
    if (!paymentId) return null;

    try {
      const baseUrl = resolveBaseUrl(integration);
      const headers = buildHeaders(integration);
      const response = await axios.get(`${baseUrl}/payments/${paymentId}/pixQrCode`, {
        headers
      });
      return response?.data || null;
    } catch {
      return null;
    }
  }
}

export default AsaasBillingProvider;
