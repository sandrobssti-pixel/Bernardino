import express from "express";
import isAuth from "../middleware/isAuth";

import * as WhatsAppController from "../controllers/WhatsAppController";
import * as WebchatSessionsController from "../controllers/WebchatSessionsController";

import multer from "multer";
import uploadConfig from "../config/upload";
import { mediaUpload } from "../services/WhatsappService/uploadMediaAttachment";
import { deleteMedia } from "../services/WhatsappService/uploadMediaAttachment";
import { webchatAvatarUpload } from "../services/WhatsappService/uploadMediaAttachment";

const upload = multer(uploadConfig);


const whatsappRoutes = express.Router();

whatsappRoutes.get("/whatsapp/", isAuth, WhatsAppController.index);
whatsappRoutes.get("/whatsapp/filter", isAuth, WhatsAppController.indexFilter);
whatsappRoutes.get("/whatsapp/all", isAuth, WhatsAppController.listAll);

whatsappRoutes.post("/whatsapp/", isAuth, WhatsAppController.store);
whatsappRoutes.post(
  "/whatsapp/:whatsappId/templates/sync",
  isAuth,
  WhatsAppController.syncOfficialTemplates
);
whatsappRoutes.post(
  "/whatsapp/:whatsappId/test-connection",
  isAuth,
  WhatsAppController.testOfficialConnection
);
whatsappRoutes.post(
  "/whatsapp/:whatsappId/register-number",
  isAuth,
  WhatsAppController.registerOfficialNumber
);
whatsappRoutes.get(
  "/whatsapp/:whatsappId/templates",
  isAuth,
  WhatsAppController.listOfficialTemplates
);
whatsappRoutes.get(
  "/whatsapp/:whatsappId/templates/:templateId",
  isAuth,
  WhatsAppController.showOfficialTemplate
);
whatsappRoutes.post(
  "/whatsapp/:sourceWhatsappId/migrate/:targetWhatsappId",
  isAuth,
  WhatsAppController.migrateOwnership
);
whatsappRoutes.post("/facebook/", isAuth, WhatsAppController.storeFacebook);
whatsappRoutes.get("/whatsapp/:whatsappId", isAuth, WhatsAppController.show);
whatsappRoutes.put("/whatsapp/:whatsappId", isAuth, WhatsAppController.update);
whatsappRoutes.delete("/whatsapp/:whatsappId", isAuth, WhatsAppController.remove);
whatsappRoutes.post("/closedimported/:whatsappId", isAuth, WhatsAppController.closedTickets);

//restart
whatsappRoutes.post("/whatsapp-restart/", isAuth, WhatsAppController.restart);
whatsappRoutes.post("/whatsapp/:whatsappId/media-upload", isAuth, upload.array("file"), mediaUpload);

whatsappRoutes.delete("/whatsapp/:whatsappId/media-upload", isAuth, deleteMedia);

whatsappRoutes.post(
  "/whatsapp/:whatsappId/webchat-avatar-upload",
  isAuth,
  upload.array("file"),
  webchatAvatarUpload
);

whatsappRoutes.get(
  "/whatsapp/:whatsappId/webchat-sessions",
  isAuth,
  WebchatSessionsController.index
);

whatsappRoutes.put(
  "/whatsapp/:whatsappId/webchat-active",
  isAuth,
  WhatsAppController.toggleWebchatActive
);


whatsappRoutes.delete("/whatsapp-admin/:whatsappId", isAuth, WhatsAppController.remove);

whatsappRoutes.put("/whatsapp-admin/:whatsappId", isAuth, WhatsAppController.updateAdmin);

whatsappRoutes.get("/whatsapp-admin/:whatsappId", isAuth, WhatsAppController.showAdmin);

export default whatsappRoutes;
