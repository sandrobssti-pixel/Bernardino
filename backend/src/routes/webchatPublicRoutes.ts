import { Router } from "express";
import * as WebchatPublicController from "../controllers/WebchatPublicController";
import { webchatRateLimit } from "../middleware/webchatRateLimit";

// Rotas públicas do widget de webchat — chamadas diretamente pelo navegador
// de um visitante anônimo em um site de terceiro, por isso NÃO usam
// isAuth/tokenAuth (não existe usuário logado do lado do visitante). A
// identificação é feita pelo "widgetId" (público, exposto no <script> do
// site) e o CORS dinâmico por domínio é aplicado em app.ts.
const webchatPublicRoutes = Router();

// Limites calibrados para o comportamento real do widget.js: polling de
// mensagens a cada 3s (POLL_INTERVAL_MS), sessão criada uma vez por visitante
// e envio de mensagem só sob ação humana — por isso config/session têm
// limites mais apertados que o polling de mensagens.
webchatPublicRoutes.get(
  "/webchat/public/:widgetId/config",
  webchatRateLimit({ windowMs: 60_000, max: 30, routeName: "config" }),
  WebchatPublicController.config
);

webchatPublicRoutes.post(
  "/webchat/public/:widgetId/session",
  webchatRateLimit({ windowMs: 60_000, max: 15, routeName: "session" }),
  WebchatPublicController.startSession
);

webchatPublicRoutes.post(
  "/webchat/public/:widgetId/messages",
  webchatRateLimit({ windowMs: 60_000, max: 30, routeName: "send-message" }),
  WebchatPublicController.sendMessage
);

webchatPublicRoutes.get(
  "/webchat/public/:widgetId/messages",
  webchatRateLimit({ windowMs: 60_000, max: 60, routeName: "list-messages" }),
  WebchatPublicController.listMessages
);

export default webchatPublicRoutes;
