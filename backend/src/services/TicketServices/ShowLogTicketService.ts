import LogTicket from "../../models/LogTicket";
import User from "../../models/User";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";

interface Request {
  ticketId: string | number;
  companyId: string | number;
}

const ShowLogTicketService = async ({
  ticketId,
  companyId
}: Request): Promise<LogTicket[]> => {
  const logs = await LogTicket.findAll({
    where: {
      ticketId
    },
    include: [
      {
        model: Ticket,
        as: "ticket",
        attributes: ["id", "companyId"],
        where: { companyId },
        required: true
      },
      {
        model: User,
        as: "user",
        attributes: ["id", "name"]
      },
      {
        model: Queue,
        as: "queue",
        attributes: ["id", "name"]
      }
    ],
    order: [["createdAt", "ASC"]]
  });

  return logs;
};

export default ShowLogTicketService;
