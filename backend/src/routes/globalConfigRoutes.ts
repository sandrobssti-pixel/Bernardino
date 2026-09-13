import { Router } from "express";
import multer from "multer";

import isAuth from "../middleware/isAuth";
import * as GlobalConfigController from "../controllers/GlobalConfigController";
import uploadConfig from "../config/upload";

const globalConfigRoutes = Router();
const upload = multer(uploadConfig);

// 🔹 ROTA PÚBLICA: /global-config/public-branding
globalConfigRoutes.get(
  "/public-branding",
  GlobalConfigController.publicBranding
);

// GET /global-config (pro painel, protegida)
globalConfigRoutes.get(
  "/",
  isAuth,
  GlobalConfigController.index 
);

globalConfigRoutes.get(
  "/dashboard-summary",
  isAuth,
  GlobalConfigController.dashboardSummary
);

globalConfigRoutes.get(
  "/financial-summary",
  isAuth,
  GlobalConfigController.financialSummary
);

globalConfigRoutes.get(
  "/financial-invoices",
  isAuth,
  GlobalConfigController.financialInvoices
);

globalConfigRoutes.get(
  "/financial-companies",
  isAuth,
  GlobalConfigController.financialCompanies
);

// PUT /global-config (pro painel, protegida)
globalConfigRoutes.put(
  "/",
  isAuth,
  GlobalConfigController.update
);

globalConfigRoutes.post(
  "/test-welcome-email",
  isAuth,
  GlobalConfigController.sendWelcomeEmailTest
);

globalConfigRoutes.post(
  "/test-billing-due-email",
  isAuth,
  GlobalConfigController.sendBillingDueEmailTest
);

globalConfigRoutes.post(
  "/test-billing-due-whatsapp",
  isAuth,
  GlobalConfigController.sendBillingDueWhatsappTest
);

// POST /global-config/upload  (upload de logo/capa do login)
globalConfigRoutes.post(
  "/upload",
  isAuth,
  upload.single("file"),
  GlobalConfigController.uploadBrandingImage
);

globalConfigRoutes.post(
  "/upload/remove",
  isAuth,
  GlobalConfigController.removeBrandingImage
);

export default globalConfigRoutes;
