import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as WhatsAppCredentialImportController from "../controllers/WhatsAppCredentialImportController";

const whatsappCredentialImportRoutes = Router();

whatsappCredentialImportRoutes.post(
  "/whatsapp/:whatsappId/credentials-import-token",
  isAuth,
  WhatsAppCredentialImportController.createToken
);

whatsappCredentialImportRoutes.post(
  "/whatsapp/:whatsappId/credentials-import",
  isAuth,
  WhatsAppCredentialImportController.importManual
);

whatsappCredentialImportRoutes.post(
  "/public/whatsapp/credentials-import",
  WhatsAppCredentialImportController.importPublic
);

export default whatsappCredentialImportRoutes;
