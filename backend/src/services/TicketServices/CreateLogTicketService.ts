// import AppError from "../../errors/AppError";
// import socketEmit from "../../helpers/socketEmit";
import LogTicket from "../../models/LogTicket";
import { Op } from "sequelize";

type logType =
  | "access"
  | "create"
  | "closed"
  | "transfered"
  | "receivedTransfer"
  | "open"
  | "reopen"
  | "pending"
  | "nps"
  | "lgpd"
  | "queue"
  | "userDefine"
  | "delete"
  | "chatBot"
  | "autoClose"
  | "retriesLimitQueue"
  | "retriesLimitUserDefine"
  | "redirect";

interface Request {
  type: logType;
  ticketId: number | string;
  userId?: number | string;
  queueId?: number | string;
}

const toPositiveIntOrNull = (value?: number | string): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.trunc(parsed);
};

const CreateLogTicketService = async ({
  type,
  userId,
  ticketId,
  queueId
}: Request): Promise<void> => {
  const normalizedQueueId = toPositiveIntOrNull(queueId);

  // Evita ruído de logs automáticos repetidos em curtos intervalos
  // (ex.: jobs concorrentes/redirecionamento executando em paralelo).
  if (type === "redirect") {
    const dedupeWindowMs = 2 * 60 * 1000; // 2 minutos
    const recentSince = new Date(Date.now() - dedupeWindowMs);

    const recentDuplicate = await LogTicket.findOne({
      where: {
        type: "redirect",
        ticketId,
        queueId: normalizedQueueId,
        createdAt: {
          [Op.gte]: recentSince
        }
      },
      order: [["createdAt", "DESC"]]
    });

    if (recentDuplicate) {
      return;
    }
  }

  await LogTicket.create({
    userId,
    ticketId,
    type,
    queueId: normalizedQueueId
  });

  // socketEmit({
  //   companyId,
  //   type: "ticket:update",
  //   payload: ticket
  // });
};

export default CreateLogTicketService;
