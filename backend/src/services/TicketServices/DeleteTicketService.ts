import Ticket from "../../models/Ticket";
import AppError from "../../errors/AppError";

const DeleteTicketService = async (id: string, userId: string, companyId: number): Promise<Ticket> => {
  const ticketId = Number(id);
  const ticket = await Ticket.findOne({
    where: {
      id: Number.isFinite(ticketId) ? ticketId : (id as any),
      companyId
    }
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  const destroyed = await Ticket.destroy({
    where: { id: ticket.id, companyId }
  });

  if (!destroyed) {
    throw new AppError("ERR_DELETE_TICKET_FAILED", 500);
  }

  return ticket;
};

export default DeleteTicketService;
