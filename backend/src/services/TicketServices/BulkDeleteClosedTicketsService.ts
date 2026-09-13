import { Op } from "sequelize";

import Ticket from "../../models/Ticket";
import ShowUserService from "../UserServices/ShowUserService";
import ResolveClosedTicketIdsService from "./ResolveClosedTicketIdsService";

interface Request {
  companyId: number;
  userId: number;
  queueIds: number[];
  showAll?: string;
  whatsappIds?: number[];
  dateStart?: string;
  dateEnd?: string;
  limit?: number;
}

interface Response {
  deletedIds: number[];
  deletedCount: number;
}

const BulkDeleteClosedTicketsService = async ({
  companyId,
  userId,
  queueIds,
  showAll = "false",
  whatsappIds = [],
  dateStart,
  dateEnd,
  limit
}: Request): Promise<Response> => {
  const user = await ShowUserService(userId, companyId);

  const deletedIds = await ResolveClosedTicketIdsService({
    companyId,
    user,
    queueIds,
    showAll,
    whatsappIds,
    dateStart,
    dateEnd,
    limit,
    requireDateRange: true
  });

  if (deletedIds.length === 0) {
    return {
      deletedIds: [],
      deletedCount: 0
    };
  }

  const deletedCount = await Ticket.destroy({
    where: {
      companyId,
      id: { [Op.in]: deletedIds }
    }
  });

  return {
    deletedIds,
    deletedCount
  };
};

export default BulkDeleteClosedTicketsService;
