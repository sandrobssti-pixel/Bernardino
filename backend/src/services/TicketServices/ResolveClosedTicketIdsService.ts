import { Op, Filterable, literal } from "sequelize";
import { startOfDay, endOfDay, parseISO } from "date-fns";

import Ticket from "../../models/Ticket";
import User from "../../models/User";
import AppError from "../../errors/AppError";

interface Request {
  companyId: number;
  user: User;
  queueIds: number[];
  showAll?: string;
  whatsappIds?: number[];
  dateStart?: string;
  dateEnd?: string;
  limit?: number;
  requireDateRange?: boolean;
}

const ResolveClosedTicketIdsService = async ({
  companyId,
  user,
  queueIds,
  showAll = "false",
  whatsappIds = [],
  dateStart,
  dateEnd,
  limit,
  requireDateRange = false
}: Request): Promise<number[]> => {
  const showTicketAllQueues = user.allHistoric === "enabled";
  const showTicketWithoutQueue = user.allTicket === "enable";

  let whereCondition: Filterable["where"] = {
    companyId,
    status: "closed"
  };

  if (!showTicketAllQueues) {
    if (showAll === "false" && user.profile === "admin") {
      whereCondition = {
        ...whereCondition,
        queueId: { [Op.in]: queueIds },
        userId: user.id
      };
    } else {
      whereCondition = {
        ...whereCondition,
        queueId:
          showAll === "true" || showTicketWithoutQueue
            ? { [Op.or]: [queueIds, null] }
            : { [Op.in]: queueIds }
      };
    }
  } else if (showAll === "false" && (user.profile === "admin" || user.allUserChat === "enabled")) {
    whereCondition = {
      ...whereCondition,
      queueId: { [Op.in]: queueIds },
      userId: user.id
    };
  } else {
    whereCondition = {
      ...whereCondition,
      queueId:
        showAll === "true" || showTicketWithoutQueue
          ? { [Op.or]: [queueIds, null] }
          : { [Op.in]: queueIds }
    };
  }

  if (Array.isArray(whatsappIds) && whatsappIds.length > 0) {
    whereCondition = {
      ...whereCondition,
      whatsappId: { [Op.in]: whatsappIds }
    };
  }

  if (requireDateRange) {
    if (!dateStart || !dateEnd) {
      throw new AppError("ERR_BULK_DELETE_DATE_REQUIRED", 400);
    }

    const parsedStart = parseISO(dateStart);
    const parsedEnd = parseISO(dateEnd);

    if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
      throw new AppError("ERR_BULK_DELETE_DATE_INVALID", 400);
    }

    whereCondition = {
      ...whereCondition,
      closedAt: {
        [Op.gte]: startOfDay(parsedStart),
        [Op.lte]: endOfDay(parsedEnd)
      }
    };
  } else if (dateStart || dateEnd) {
    const closedAt: any = {};

    if (dateStart) {
      const parsedStart = parseISO(dateStart);
      if (!Number.isNaN(parsedStart.getTime())) {
        closedAt[Op.gte] = startOfDay(parsedStart);
      }
    }

    if (dateEnd) {
      const parsedEnd = parseISO(dateEnd);
      if (!Number.isNaN(parsedEnd.getTime())) {
        closedAt[Op.lte] = endOfDay(parsedEnd);
      }
    }

    if (Object.keys(closedAt).length > 0) {
      whereCondition = {
        ...whereCondition,
        closedAt
      };
    }
  }

  const latestTickets = await Ticket.findAll({
    attributes: ["companyId", "contactId", "whatsappId", [literal('MAX("id")'), "id"]],
    where: whereCondition,
    group: ["companyId", "contactId", "whatsappId"]
  });

  const latestIds = latestTickets
    .map(ticket => Number(ticket.getDataValue("id")))
    .filter(id => Number.isFinite(id));

  if (latestIds.length === 0) {
    return [];
  }

  const latestClosedTickets = await Ticket.findAll({
    attributes: ["id"],
    where: {
      companyId,
      id: { [Op.in]: latestIds }
    },
    order: [
      ["closedAt", "DESC"],
      ["updatedAt", "DESC"],
      ["id", "DESC"]
    ],
    ...(limit && limit > 0 ? { limit } : {})
  });

  return latestClosedTickets
    .map(ticket => Number(ticket.id))
    .filter(id => Number.isFinite(id));
};

export default ResolveClosedTicketIdsService;
