import { Router } from "express";
import * as WebHooksController from "../controllers/WebHookController";
import * as MetaWebhookController from "../controllers/MetaWebhookController";
const webHooksRoutes = Router();

webHooksRoutes.get("/", WebHooksController.index);
webHooksRoutes.post("/", WebHooksController.webHook);
webHooksRoutes.post("/wuzapi", WebHooksController.webHookWuzapi);
webHooksRoutes.get("/meta/:metaConnectionId", MetaWebhookController.verify);
webHooksRoutes.post("/meta/:metaConnectionId", MetaWebhookController.receive);
export default webHooksRoutes;
