import { Request, Response } from "express";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";

// Listagem simples de "sessões" (visitantes/tickets) de uma conexão webchat,
// para a aba Sessões do modal de conexão. Deliberadamente não reaproveita
// ListTicketsService (usada pela tela de atendimento) — essa tem uma lógica
// de permissão/fila complexa voltada ao atendente logado, enquanto aqui é só
// uma listagem administrativa somente-leitura por conexão.
export const index = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  await ShowWhatsAppService(whatsappId, companyId);

  const tickets = await Ticket.findAll({
    where: { whatsappId, companyId },
    include: [
      {
        model: Contact,
        attributes: ["id", "name", "number"]
      }
    ],
    order: [["updatedAt", "DESC"]],
    limit: 100
  });

  const sessions = tickets.map(ticket => ({
    ticketId: ticket.id,
    ticketUuid: ticket.uuid,
    contactName: ticket.contact?.name || "Visitante",
    contactNumber: ticket.contact?.number || "",
    status: ticket.status,
    updatedAt: ticket.updatedAt
  }));

  return res.status(200).json({ sessions });
};
