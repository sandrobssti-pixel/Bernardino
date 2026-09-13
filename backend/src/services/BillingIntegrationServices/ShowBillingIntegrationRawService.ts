import AppError from "../../errors/AppError";
import BillingIntegration from "../../models/BillingIntegration";

const ShowBillingIntegrationRawService = async (
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

  return integration;
};

export default ShowBillingIntegrationRawService;
