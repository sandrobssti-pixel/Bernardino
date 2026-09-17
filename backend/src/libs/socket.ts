import { Server as SocketIO } from "socket.io";
import { Server } from "http";
import AppError from "../errors/AppError";
import logger from "../utils/logger";
import { instrument } from "@socket.io/admin-ui";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { ReceibedWhatsAppService } from "../services/WhatsAppOficial/ReceivedWhatsApp";
import User from "../models/User";
import EnsureSupervisorPanelAccess from "../services/SupervisorPanelService/EnsureSupervisorPanelAccess";

// Define namespaces permitidos
// Mantém compatibilidade com clientes antigos (/123) e novos (/workspace-123)
const ALLOWED_NAMESPACES = /^\/(workspace-\d+|\d+)$/;

// Esquemas de validação
const userIdSchema = z.union([z.string(), z.number()]).optional();
const ticketIdSchema = z.union([z.string(), z.number()]).transform(String);
const statusSchema = z.enum(["open", "closed", "pending", "ia"]);
const jwtPayloadSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  userId: z.union([z.string(), z.number()]).optional(),
  companyId: z.union([z.string(), z.number()]).optional(),
  profile: z.string().optional(),
  iat: z.number().optional(),
  exp: z.number().optional(),
}).passthrough();

// Origens CORS permitidas
const ALLOWED_ORIGINS = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())
  : ["http://localhost:3000"];

// Ajuste da classe AppError para compatibilidade com Error
class SocketCompatibleAppError extends Error {
  constructor(public message: string, public statusCode: number) {
    super(message);
    this.name = "AppError";
    // Garante que a stack trace seja capturada
    Error.captureStackTrace?.(this, SocketCompatibleAppError);
  }
}

let io: SocketIO;

const parseNamespaceCompanyId = (namespaceName: string): number | null => {
  const raw = String(namespaceName || "").replace(/^\//, "");
  if (!raw) return null;

  const normalized = raw.startsWith("workspace-")
    ? raw.replace("workspace-", "")
    : raw;

  const companyId = Number(normalized);
  return Number.isInteger(companyId) && companyId > 0 ? companyId : null;
};

export const initIO = (httpServer: Server): SocketIO => {
  io = new SocketIO(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn(`Origem não autorizada: ${origin}`);
          callback(new SocketCompatibleAppError("Violação da política CORS", 403));
        }
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
    maxHttpBufferSize: 25 * 1024 * 1024, // 25MB - comporta vídeo (limite Meta de 16MB) recebido em base64 via API Oficial
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // Middleware de autenticação JWT
  io.use((socket, next) => {
    const rawToken = socket.handshake.query.token as string;
    const token = String(rawToken || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      logger.warn("Tentativa de conexão sem token");
      return next(new SocketCompatibleAppError("Token ausente", 401));
    }

    const tokenApiOficial = String(process.env.TOKEN_API_OFICIAL || "").trim();
    const tokenAdminApiOficial = String(process.env.TOKEN_ADMIN || "").trim();
    if (
      (tokenApiOficial && token === tokenApiOficial) ||
      (tokenAdminApiOficial && token === tokenAdminApiOficial)
    ) {
      socket.data.isOfficialApi = true;
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret");
      const validatedPayload = jwtPayloadSchema.parse(decoded);
      socket.data.user = validatedPayload;
      socket.data.isOfficialApi = false;
      next();
    } catch (err) {
      logger.warn("Token inválido");
      return next(new SocketCompatibleAppError("Token inválido", 401));
    }
  });

  // Admin UI apenas em desenvolvimento
  const isAdminEnabled = process.env.SOCKET_ADMIN === "true" && process.env.NODE_ENV !== "production";
  if (isAdminEnabled && process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
    try {
      instrument(io, {
        auth: {
          type: "basic",
          username: process.env.ADMIN_USERNAME,
          password: process.env.ADMIN_PASSWORD,
        },
        mode: "development",
        readonly: true,
      });
      logger.info("Socket.IO Admin UI inicializado em modo de desenvolvimento");
    } catch (error) {
      logger.error("Falha ao inicializar Socket.IO Admin UI", error);
    }
  } else if (isAdminEnabled) {
    logger.warn("Credenciais de administrador ausentes, Admin UI não inicializado");
  }

  // Namespaces dinâmicos com validação
  const workspaces = io.of((name, auth, next) => {
    if (ALLOWED_NAMESPACES.test(name)) {
      next(null, true);
    } else {
      logger.warn(`Tentativa de conexão a namespace inválido: ${name}`);
      next(new SocketCompatibleAppError("Namespace inválido", 403), false);
    }
  });

  workspaces.use((socket, next) => {
    const rawToken = socket.handshake.query.token as string;
    const token = String(rawToken || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return next(new SocketCompatibleAppError("Token ausente", 401));
    }
    const tokenApiOficial = String(process.env.TOKEN_API_OFICIAL || "").trim();
    const tokenAdminApiOficial = String(process.env.TOKEN_ADMIN || "").trim();
    if (
      (tokenApiOficial && token === tokenApiOficial) ||
      (tokenAdminApiOficial && token === tokenAdminApiOficial)
    ) {
      socket.data.isOfficialApi = true;
      return next();
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret");
      const validatedPayload = jwtPayloadSchema.parse(decoded);
      socket.data.user = validatedPayload;
      socket.data.isOfficialApi = false;
      next();
    } catch (err) {
      return next(new SocketCompatibleAppError("Token inválido", 401));
    }
  });

  workspaces.on("connection", (socket) => {
    const clientIp = socket.handshake.address;

    // Valida userId
    let userId: string | undefined;
    try {
      const parsedUserId = userIdSchema.parse(socket.handshake.query.userId);
      userId = parsedUserId !== undefined ? String(parsedUserId) : undefined;
    } catch (error) {
      socket.disconnect(true);
      logger.warn(`userId inválido de ${clientIp}`);
      return;
    }

    logger.info(`Cliente conectado ao namespace ${socket.nsp.name} (IP: ${clientIp})`);

    // Painel Vigia: sala pessoal (mensagens/alertas dirigidos a este
    // usuário) e, se autorizado, a sala "supervisors" (alertas de SLA da
    // empresa toda). Ver docs/MANUAL_TECNICO.md.
    if (!socket.data.isOfficialApi && userId) {
      socket.join(`user-${userId}`);
      User.findByPk(userId)
        .then(user => {
          if (!user) return;
          return EnsureSupervisorPanelAccess(user as any).then(allowed => {
            if (allowed) socket.join("supervisors");
          });
        })
        .catch(err => {
          logger.warn(`Falha ao verificar acesso ao Painel Vigia pro socket: ${err.message}`);
        });
    }

    socket.on("joinChatBox", (ticketId: string, callback?: (error?: string) => void) => {
      try {
        const validatedTicketId = ticketIdSchema.parse(ticketId);
        socket.join(validatedTicketId);
        logger.info(`Cliente entrou no canal de ticket ${validatedTicketId} no namespace ${socket.nsp.name}`);
        callback?.();
      } catch (error) {
        logger.warn(`ticketId inválido: ${ticketId}`);
        callback?.("ID de ticket inválido");
      }
    });

    socket.on("joinNotification", (callback?: (error?: string) => void) => {
      socket.join("notification");
      logger.info(`Cliente entrou no canal de notificações no namespace ${socket.nsp.name}`);
      callback?.();
    });

    socket.on("leaveNotification", (callback?: (error?: string) => void) => {
      socket.leave("notification");
      logger.info(`Cliente saiu do canal de notificações no namespace ${socket.nsp.name}`);
      callback?.();
    });

    socket.on("joinTickets", (status: string, callback?: (error?: string) => void) => {
      try {
        const validatedStatus = statusSchema.parse(status);
        socket.join(validatedStatus);
        logger.info(`Cliente entrou no canal ${validatedStatus} no namespace ${socket.nsp.name}`);
        callback?.();
      } catch (error) {
        logger.warn(`Status inválido: ${status}`);
        callback?.("Status inválido");
      }
    });

    socket.on("joinTicketsLeave", (status: string, callback?: (error?: string) => void) => {
      try {
        const validatedStatus = statusSchema.parse(status);
        socket.leave(validatedStatus);
        logger.info(`Cliente saiu do canal ${validatedStatus} no namespace ${socket.nsp.name}`);
        callback?.();
      } catch (error) {
        logger.warn(`Status inválido: ${status}`);
        callback?.("Status inválido");
      }
    });

    socket.on("leaveTickets", (status: string, callback?: (error?: string) => void) => {
      try {
        const validatedStatus = statusSchema.parse(status);
        socket.leave(validatedStatus);
        logger.info(`Cliente saiu do canal ${validatedStatus} (alias leaveTickets) no namespace ${socket.nsp.name}`);
        callback?.();
      } catch (error) {
        logger.warn(`Status inválido no alias leaveTickets: ${status}`);
        callback?.("Status inválido");
      }
    });

    socket.on("joinChatBoxLeave", (ticketId: string, callback?: (error?: string) => void) => {
      try {
        const validatedTicketId = ticketIdSchema.parse(ticketId);
        socket.leave(validatedTicketId);
        logger.info(`Cliente saiu do canal de ticket ${validatedTicketId} no namespace ${socket.nsp.name}`);
        callback?.();
      } catch (error) {
        logger.warn(`ticketId inválido: ${ticketId}`);
        callback?.("ID de ticket inválido");
      }
    });

    socket.on("leaveChatBox", (ticketId: string, callback?: (error?: string) => void) => {
      try {
        const validatedTicketId = ticketIdSchema.parse(ticketId);
        socket.leave(validatedTicketId);
        logger.info(`Cliente saiu do canal de ticket ${validatedTicketId} (alias leaveChatBox) no namespace ${socket.nsp.name}`);
        callback?.();
      } catch (error) {
        logger.warn(`ticketId inválido no alias leaveChatBox: ${ticketId}`);
        callback?.("ID de ticket inválido");
      }
    });

    socket.on("typing:update", (payload: any, callback?: (error?: string) => void) => {
      try {
        const ticketId = ticketIdSchema.parse(payload?.ticketId);
        const isTyping = Boolean(payload?.isTyping);
        const userIdRaw = socket.data?.user?.id ?? socket.data?.user?.userId;
        const userId = userIdRaw !== undefined ? Number(userIdRaw) : null;

        const companyId = parseNamespaceCompanyId(socket.nsp.name);
        if (!companyId) {
          callback?.("Namespace inválido");
          return;
        }

        const typingPayload = {
          ticketId,
          isTyping,
          userId,
          companyId,
          at: new Date().toISOString()
        };

        socket.to(ticketId).emit(`company-${companyId}-typing`, typingPayload);
        socket.nsp.emit(`company-${companyId}-typing`, typingPayload);
        callback?.();
      } catch (error) {
        logger.warn(`payload typing inválido: ${JSON.stringify(payload || {})}`);
        callback?.("Payload inválido");
      }
    });

    socket.on("receivedMessageWhatsAppOficial", (payload: any, callback?: (result: any) => void) => {
      // Confirma recebimento para evitar timeout no emissor e processa em background.
      callback?.({ ok: true });
      console.log("[OFICIAL DEBUG] evento recebido", {
        namespace: socket.nsp.name,
        isOfficialApi: !!socket.data?.isOfficialApi,
        payloadCompanyId: payload?.companyId,
        tokenPrefix: String(payload?.token || "").slice(0, 6),
        hasFrom: !!payload?.fromNumber,
        hasMessageId: !!payload?.message?.idMessage
      });
      (async () => {
        try {
          if (!socket.data?.isOfficialApi) {
            logger.warn(
              `[WHATSAPP OFICIAL] Evento bloqueado: conexão sem permissão oficial | namespace=${socket.nsp.name}`
            );
            return;
          }

          const payloadCompanyId = Number(payload?.companyId);
          const namespaceCompanyId = parseNamespaceCompanyId(socket.nsp.name);
          if (
            !Number.isInteger(payloadCompanyId) ||
            payloadCompanyId <= 0 ||
            !namespaceCompanyId ||
            payloadCompanyId !== namespaceCompanyId
          ) {
            logger.warn(
              `[WHATSAPP OFICIAL] Payload inválido/bloqueado | namespace=${socket.nsp.name} | payloadCompanyId=${String(
                payload?.companyId || ""
              )}`
            );
            return;
          }

          if (!payload?.token || !payload?.fromNumber || !payload?.message?.idMessage) {
            logger.warn(
              `[WHATSAPP OFICIAL] Payload incompleto/bloqueado | namespace=${socket.nsp.name} | payloadCompanyId=${payloadCompanyId}`
            );
            return;
          }

          logger.info(
            `[WHATSAPP OFICIAL] Evento recebido via socket | namespace=${socket.nsp.name} | companyId=${String(
              payload?.companyId || ""
            )} | messageId=${String(payload?.message?.idMessage || "")} | from=${String(
              payload?.fromNumber || ""
            )} | type=${String(payload?.message?.type || "")} | tokenPrefix=${String(
              payload?.token || ""
            ).slice(0, 6)} | isOfficialApi=${String(!!socket.data?.isOfficialApi)}`
          );
          const receiver = new ReceibedWhatsAppService();
          console.log("[OFICIAL DEBUG] antes receiver.getMessage");
          await receiver.getMessage(payload);
          console.log("[OFICIAL DEBUG] depois receiver.getMessage");
          logger.info(
            `[WHATSAPP OFICIAL] Evento processado via socket | namespace=${socket.nsp.name} | companyId=${String(
              payload?.companyId || ""
            )}`
          );
        } catch (error: any) {
          console.error("[OFICIAL DEBUG] erro handler", error);
          logger.error(`Erro no evento receivedMessageWhatsAppOficial: ${error?.message || error}`);
        }
      })();
    });

    socket.on("readMessageWhatsAppOficial", (payload: any, callback?: (result: any) => void) => {
      callback?.({ ok: true });
      (async () => {
        try {
          if (!socket.data?.isOfficialApi) {
            logger.warn(
              `[WHATSAPP OFICIAL] Read bloqueado: conexão sem permissão oficial | namespace=${socket.nsp.name}`
            );
            return;
          }

          const payloadCompanyId = Number(payload?.companyId);
          const namespaceCompanyId = parseNamespaceCompanyId(socket.nsp.name);
          if (
            !Number.isInteger(payloadCompanyId) ||
            payloadCompanyId <= 0 ||
            !namespaceCompanyId ||
            payloadCompanyId !== namespaceCompanyId
          ) {
            logger.warn(
              `[WHATSAPP OFICIAL] Read bloqueado por companyId inválido | namespace=${socket.nsp.name} | payloadCompanyId=${String(
                payload?.companyId || ""
              )}`
            );
            return;
          }

          if (!payload?.token || !payload?.messageId) {
            logger.warn(
              `[WHATSAPP OFICIAL] Read bloqueado por payload incompleto | namespace=${socket.nsp.name} | payloadCompanyId=${payloadCompanyId}`
            );
            return;
          }

          const receiver = new ReceibedWhatsAppService();
          await receiver.readMessage(payload);
        } catch (error: any) {
          logger.error(`Erro no evento readMessageWhatsAppOficial: ${error?.message || error}`);
        }
      })();
    });

    socket.on("disconnect", () => {
      logger.info(`Cliente desconectado do namespace ${socket.nsp.name} (IP: ${clientIp})`);
    });

    socket.on("error", (error) => {
      logger.error(`Erro no socket do namespace ${socket.nsp.name}: ${error.message}`);
    });
  });

  return io;
};

export const getIO = (): SocketIO => {
  if (!io) {
    throw new SocketCompatibleAppError("Socket IO não inicializado", 500);
  }
  return io;
};
