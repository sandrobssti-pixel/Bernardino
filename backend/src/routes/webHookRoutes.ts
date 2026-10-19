import { Router } from "express";
import * as WebHooksController from "../controllers/WebHookController";
import * as MetaWebhookController from "../controllers/MetaWebhookController";
import * as PaymentWebhookController from "../controllers/PaymentWebhookController";
const webHooksRoutes = Router();

webHooksRoutes.get("/", WebHooksController.index);
webHooksRoutes.post("/", WebHooksController.webHook);
webHooksRoutes.post("/wuzapi", WebHooksController.webHookWuzapi);
webHooksRoutes.get("/meta/:metaConnectionId", MetaWebhookController.verify);
webHooksRoutes.post("/meta/:metaConnectionId", MetaWebhookController.receive);
// Notificação de pagamento (Mercado Pago) — uma URL por empresa, configurada
// no painel deles ("Suas integrações" > aplicação > Webhooks). Aceita
// GET também porque o Mercado Pago às vezes testa a URL com um GET simples
// ao salvar a configuração no painel.
webHooksRoutes.post("/mercadopago/:companyId", PaymentWebhookController.mercadoPago);
webHooksRoutes.get("/mercadopago/:companyId", PaymentWebhookController.mercadoPago);
// Webhook do Asaas (Fase 2) — mesmo padrão, uma URL por empresa.
webHooksRoutes.post("/asaas/:companyId", PaymentWebhookController.asaas);
export default webHooksRoutes;
