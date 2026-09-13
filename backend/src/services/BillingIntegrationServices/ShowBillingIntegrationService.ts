import AppError from "../../errors/AppError";
import BillingIntegration from "../../models/BillingIntegration";
import { sanitizeBillingIntegration } from "./utils";

const ShowBillingIntegrationService = async (
  integrationId: string | number,
  companyId: number
): Promise<BillingIntegration> => {
  const integration = await BillingIntegration.findOne({
    where: {
      id: integrationId,
      companyId
    }
  });

  if (!integration) {
    throw new AppError("ERR_BILLING_INTEGRATION_NOT_FOUND", 404);
  }

  return sanitizeBillingIntegration(integration) as BillingIntegration;
};

export default ShowBillingIntegrationService;
