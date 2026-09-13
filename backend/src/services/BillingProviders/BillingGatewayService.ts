import AppError from "../../errors/AppError";
import BillingIntegration from "../../models/BillingIntegration";
import ShowBillingIntegrationRawService from "../BillingIntegrationServices/ShowBillingIntegrationRawService";
import AsaasBillingProvider from "./AsaasBillingProvider";
import AtlazBillingProvider from "./AtlazBillingProvider";
import HubsoftBillingProvider from "./HubsoftBillingProvider";
import IxcBillingProvider from "./IxcBillingProvider";
import SgpBillingProvider from "./SgpBillingProvider";
import {
  BillingLookupIdentifierType,
  BillingLookupInput,
  BillingLookupResult,
  BillingProvider
} from "./types";

const resolveProvider = (providerName: string): BillingProvider => {
  const provider = String(providerName || "").trim().toLowerCase();

  if (provider === "asaas") return new AsaasBillingProvider();
  if (provider === "sgp") return new SgpBillingProvider();
  if (provider === "atlaz") return new AtlazBillingProvider();
  if (provider === "ixc") return new IxcBillingProvider();
  if (provider === "hubsoft") return new HubsoftBillingProvider();

  throw new AppError(`Provider de cobrança não suportado: ${providerName}`, 400);
};

interface Request {
  companyId: number;
  integrationId: number;
  identifierType: BillingLookupIdentifierType;
  identifierValue: string;
  ticketId?: number;
  contactId?: number;
}

class BillingGatewayService {
  static async lookupOpenBilling({
    companyId,
    integrationId,
    identifierType,
    identifierValue,
    ticketId,
    contactId
  }: Request): Promise<BillingLookupResult> {
    let integration: BillingIntegration;

    try {
      integration = await ShowBillingIntegrationRawService(integrationId, companyId);
    } catch (err: any) {
      return {
        status: "integration_error",
        message: String(err?.message || `Integração de cobrança #${integrationId} não encontrada.`)
      };
    }

    if (!integration.isActive) {
      return {
        status: "integration_error",
        message: "Integração de cobrança inativa."
      };
    }

    const provider = resolveProvider(integration.provider);

    return provider.lookupOpenBilling({
      companyId,
      integration,
      identifierType,
      identifierValue,
      ticketId,
      contactId
    } as BillingLookupInput);
  }

  static async testIntegration(integration: BillingIntegration): Promise<BillingLookupResult> {
    const provider = resolveProvider(integration.provider);

    return provider.lookupOpenBilling({
      companyId: integration.companyId,
      integration,
      identifierType: "externalCode",
      identifierValue: "__codex_test__"
    });
  }
}

export default BillingGatewayService;
