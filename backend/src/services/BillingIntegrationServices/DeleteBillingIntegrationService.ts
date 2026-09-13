import ShowBillingIntegrationRawService from "./ShowBillingIntegrationRawService";

const DeleteBillingIntegrationService = async (
  integrationId: string,
  companyId: number
): Promise<void> => {
  const integration = await ShowBillingIntegrationRawService(integrationId, companyId);
  await integration.destroy();
};

export default DeleteBillingIntegrationService;
