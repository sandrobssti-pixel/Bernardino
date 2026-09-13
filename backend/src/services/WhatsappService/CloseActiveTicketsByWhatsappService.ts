import { Op } from "sequelize";

import Ticket from "../../models/Ticket";
import UpdateTicketService from "../TicketServices/UpdateTicketService";

interface Request {
  companyId: number;
  whatsappIds: Array<number | string>;
}

const CloseActiveTicketsByWhatsappService = async ({
  companyId,
  whatsappIds
}: Request): Promise<void> => {
  const normalizedWhatsappIds = [...new Set(
    whatsappIds
      .map(id => Number(id))
      .filter(id => Number.isFinite(id))
  )];

  if (normalizedWhatsappIds.length === 0) {
    return;
  }

  const tickets = await Ticket.findAll({
    attributes: ["id", "companyId"],
    where: {
      companyId,
      whatsappId: { [Op.in]: normalizedWhatsappIds },
      status: { [Op.in]: ["open", "pending"] }
    },
    order: [["id", "ASC"]]
  });

  for (const ticket of tickets) {
    await UpdateTicketService({
      ticketData: {
        status: "closed",
        sendFarewellMessage: false,
        amountUsedBotQueues: 0
      },
      ticketId: ticket.id,
      companyId: ticket.companyId
    });
  }
};

export default CloseActiveTicketsByWhatsappService;
