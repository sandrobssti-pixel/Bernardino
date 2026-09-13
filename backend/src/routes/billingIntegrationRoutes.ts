import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as BillingIntegrationController from "../controllers/BillingIntegrationController";

const billingIntegrationRoutes = Router();

billingIntegrationRoutes.get(
  "/billing-integrations",
  isAuth,
  BillingIntegrationController.index
);
billingIntegrationRoutes.post(
  "/billing-integrations",
  isAuth,
  BillingIntegrationController.store
);
billingIntegrationRoutes.get(
  "/billing-integrations/:integrationId",
  isAuth,
  BillingIntegrationController.show
);
billingIntegrationRoutes.put(
  "/billing-integrations/:integrationId",
  isAuth,
  BillingIntegrationController.update
);
billingIntegrationRoutes.delete(
  "/billing-integrations/:integrationId",
  isAuth,
  BillingIntegrationController.remove
);
billingIntegrationRoutes.post(
  "/billing-integrations/test",
  isAuth,
  BillingIntegrationController.test
);

export default billingIntegrationRoutes;
