import "./bootstrap";
import "reflect-metadata";
import "express-async-errors";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import * as Sentry from "@sentry/node";
import { config as dotenvConfig } from "dotenv";
import bodyParser from 'body-parser';

import "./database";
import uploadConfig from "./config/upload";
import AppError from "./errors/AppError";
import routes from "./routes";
import logger from "./utils/logger";
import Whatsapp from "./models/Whatsapp";
import { messageQueue, sendScheduledMessages } from "./queues";
import BullQueue from "./libs/queue"
import { REDIS_URI_MSG_CONN } from "./config/redis";
import BullBoard from 'bull-board';
import basicAuth from 'basic-auth';

// Função de middleware para autenticação básica
export const isBullAuth = (req, res, next) => {
  const user = basicAuth(req);

  if (!user || user.name !== process.env.BULL_USER || user.pass !== process.env.BULL_PASS) {
    res.set('WWW-Authenticate', 'Basic realm="example"');
    return res.status(401).send('Authentication required.');
  }
  next();
};

// Carregar variáveis de ambiente
dotenvConfig();

// Inicializar Sentry
Sentry.init({ dsn: process.env.SENTRY_DSN });

const app = express();

// Configuração de filas
app.set("queues", {
  messageQueue,
  sendScheduledMessages
});

const allowedOrigins = [process.env.FRONTEND_URL];

// A pagina bridge.html usada pela extensao "Multi Web API" fica hospedada
// num dominio central proprio (nao no FRONTEND_URL de cada tenant), pra que
// a extensao nao precise de host_permissions amplas para falar com qualquer
// dominio de cliente. Por isso essa rota especifica libera CORS so pra esse
// dominio, em vez de herdar o allowlist restrito do resto da aplicacao.
const CREDENTIALS_IMPORT_PATH = "/public/whatsapp/credentials-import";
const CREDENTIALS_IMPORT_ORIGIN =
  process.env.WA_CONNECT_ORIGIN || "https://connect.zapchatpro.com.br";

// O widget de webchat é embutido em sites de clientes finais (domínios
// arbitrários, não conhecidos em build-time), por isso essa rota pública
// resolve o CORS dinamicamente a partir dos domínios cadastrados na conexão
// (webchatAllowedDomains). Lista vazia = permite qualquer origem, já que o
// cliente final costuma testar o widget em vários domínios antes de decidir
// onde publicar definitivamente.
const WEBCHAT_PUBLIC_PATH_REGEX = /^\/webchat\/public\/([^/]+)\//;

const resolveWebchatCorsOrigin = async (
  widgetId: string,
  requestOrigin: string | undefined
): Promise<string | boolean> => {
  try {
    const whatsapp = await Whatsapp.findOne({
      where: { webchatWidgetId: widgetId, channel: "webchat" },
      attributes: ["id", "webchatAllowedDomains"]
    });

    if (!whatsapp) return false;

    const allowedDomains = String(whatsapp.webchatAllowedDomains || "")
      .split(",")
      .map(domain => domain.trim())
      .filter(Boolean);

    if (allowedDomains.length === 0) return true;
    if (!requestOrigin) return false;

    return allowedDomains.some(domain => {
      try {
        return new URL(requestOrigin).hostname === domain;
      } catch {
        return false;
      }
    });
  } catch (error) {
    logger.error("Erro ao resolver CORS do webchat:", error);
    return false;
  }
};

// Configuração do BullBoard
if (String(process.env.BULL_BOARD).toLocaleLowerCase() === 'true' && REDIS_URI_MSG_CONN !== '') {
  BullBoard.setQueues(BullQueue.queues.map(queue => queue && queue.bull));
  app.use('/admin/queues', isBullAuth, BullBoard.UI);
}

// Middlewares
// app.use(helmet({
//   contentSecurityPolicy: {
//     directives: {
//       defaultSrc: ["'self'", "http://localhost:8080"],
//       imgSrc: ["'self'", "data:", "http://localhost:8080"],
//       scriptSrc: ["'self'", "http://localhost:8080"],
//       styleSrc: ["'self'", "'unsafe-inline'", "http://localhost:8080"],
//       connectSrc: ["'self'", "http://localhost:8080"]
//     }
//   },
//   crossOriginResourcePolicy: false, // Permite recursos de diferentes origens
//   crossOriginEmbedderPolicy: false, // Permite incorporação de diferentes origens
//   crossOriginOpenerPolicy: false, // Permite abertura de diferentes origens
//   // crossOriginResourcePolicy: {
//   //   policy: "cross-origin" // Permite carregamento de recursos de diferentes origens
//   // }
// }));

app.use(compression()); // Compressão HTTP
app.use(bodyParser.json({ limit: '5mb' })); // Aumentar o limite de carga para 5 MB
app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === CREDENTIALS_IMPORT_PATH) {
    return cors({ origin: CREDENTIALS_IMPORT_ORIGIN })(req, res, next);
  }

  const webchatMatch = req.path.match(WEBCHAT_PUBLIC_PATH_REGEX);
  if (webchatMatch) {
    const widgetId = webchatMatch[1];
    const requestOrigin = req.headers.origin as string | undefined;

    return resolveWebchatCorsOrigin(widgetId, requestOrigin)
      .then(allowed => cors({ origin: allowed })(req, res, next))
      .catch(() => cors({ origin: false })(req, res, next));
  }

  return cors({ credentials: true, origin: allowedOrigins })(req, res, next);
});
app.use(cookieParser());
app.use(express.json());
app.use(Sentry.Handlers.requestHandler());
app.use("/public", express.static(uploadConfig.directory));

// Rotas
app.use(routes);

// Manipulador de erros do Sentry
app.use(Sentry.Handlers.errorHandler());

// Middleware de tratamento de erros
app.use(async (err: Error, req: Request, res: Response, _: NextFunction) => {
  if (err instanceof AppError) {
    logger.warn(err);
    return res.status(err.statusCode).json({ error: err.message });
  }

  logger.error(err);
  return res.status(500).json({ error: "Internal server error" });
});

export default app;
