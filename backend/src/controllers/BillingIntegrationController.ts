import { Request, Response } from "express";
import CreateBillingIntegrationService from "../services/BillingIntegrationServices/CreateBillingIntegrationService";
import DeleteBillingIntegrationService from "../services/BillingIntegrationServices/DeleteBillingIntegrationService";
import ListBillingIntegrationService from "../services/BillingIntegrationServices/ListBillingIntegrationService";
import ShowBillingIntegrationService from "../services/BillingIntegrationServices/ShowBillingIntegrationService";
import ShowBillingIntegrationRawService from "../services/BillingIntegrationServices/ShowBillingIntegrationRawService";
import UpdateBillingIntegrationService from "../services/BillingIntegrationServices/UpdateBillingIntegrationService";
import BillingGatewayService from "../services/BillingProviders/BillingGatewayService";
import { sanitizeBillingIntegration } from "../services/BillingIntegrationServices/utils";

type IndexQuery = {
  searchParam?: string;
  pageNumber?: string;
  activeOnly?: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber, activeOnly } = req.query as IndexQuery;
  const { companyId } = req.user;

  const result = await ListBillingIntegrationService({
    companyId,
    searchParam,
    pageNumber,
    activeOnly: String(activeOnly || "").toLowerCase() === "true"
  });

  return res.status(200).json(result);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const integration = await CreateBillingIntegrationService({
    companyId,
    ...req.body
  });

  return res.status(200).json(integration);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { integrationId } = req.params;

  const integration = await ShowBillingIntegrationService(integrationId, companyId);
  return res.status(200).json(integration);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { integrationId } = req.params;

  const integration = await UpdateBillingIntegrationService({
    companyId,
    integrationId,
    integrationData: req.body
  });

  return res.status(200).json(integration);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { integrationId } = req.params;

  await DeleteBillingIntegrationService(integrationId, companyId);
  return res.status(200).send();
};

export const test = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { integrationId } = req.body;
  const integration = await ShowBillingIntegrationRawService(integrationId, companyId);
  const result = await BillingGatewayService.testIntegration(integration);

  return res.status(200).json({
    integration: sanitizeBillingIntegration(integration),
    result
  });
};
