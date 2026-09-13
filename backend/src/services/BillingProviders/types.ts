import BillingIntegration from "../../models/BillingIntegration";

export type BillingLookupIdentifierType =
  | "cpfCnpj"
  | "phone"
  | "email"
  | "externalCode";

export type BillingLookupStatus =
  | "success"
  | "customer_not_found"
  | "no_open_billing"
  | "invalid_document"
  | "integration_error";

export interface BillingLookupInput {
  companyId: number;
  identifierType: BillingLookupIdentifierType;
  identifierValue: string;
  integration: BillingIntegration;
  ticketId?: number;
  contactId?: number;
}

export interface BillingLookupResult {
  status: BillingLookupStatus;
  customer?: {
    id?: string;
    name?: string;
    document?: string;
    email?: string;
    phone?: string;
  };
  billing?: {
    providerReference?: string;
    amount?: number;
    dueDate?: string;
    invoiceUrl?: string;
    billetUrl?: string;
    pdfUrl?: string;
    digitableLine?: string;
    pixCode?: string;
    pixQrCodeUrl?: string;
  };
  message?: string;
  raw?: unknown;
}

export interface BillingProvider {
  lookupOpenBilling(input: BillingLookupInput): Promise<BillingLookupResult>;
}
