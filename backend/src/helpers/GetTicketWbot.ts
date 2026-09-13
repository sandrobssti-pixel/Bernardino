import type { WASocket } from "baileys";
import { tryGetWbot } from "../libs/wbot";
import GetDefaultWhatsApp from "./GetDefaultWhatsApp";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import AppError from "../errors/AppError";

type Session = WASocket & {
  id?: number;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const GetTicketWbot = async (ticket: Ticket): Promise<Session> => {
  // Se o ticket ainda não tem whatsappId, define o padrão da empresa
  if (!ticket.whatsappId) {
    const defaultWhatsapp = await GetDefaultWhatsApp(
      ticket.whatsappId,
      ticket.companyId
    );

    await ticket.$set("whatsapp", defaultWhatsapp);
  }

  // 🔒 Blindagem: garante que o whatsapp usado é da MESMA empresa do ticket
  const whatsapp = await Whatsapp.findOne({
    where: {
      id: ticket.whatsappId,
      companyId: ticket.companyId
    }
  });

  if (!whatsapp) {
    // Se cair aqui, temos um ticket apontando para um WhatsApp de outra empresa
    throw new AppError("ERR_WHATSAPP_NOT_FOUND_FOR_COMPANY");
  }

  let wbot = tryGetWbot(ticket.whatsappId, ticket.companyId) as Session | null;

  const isWuzapi =
    String((whatsapp as any)?.provider || "").toLowerCase() === "wuzapi";

  if (!wbot && isWuzapi) {
    try {
      const { StartWhatsAppSession } = await import(
        "../services/WbotServices/StartWhatsAppSession"
      );
      await StartWhatsAppSession(whatsapp, ticket.companyId);
      for (let i = 0; i < 5; i++) {
        await sleep(300);
        wbot = tryGetWbot(ticket.whatsappId, ticket.companyId) as Session | null;
        if (wbot) break;
      }
    } catch {}
  }

  if (!wbot) {
    // Mantém o erro de compatibilidade esperado por outros fluxos.
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }

  return wbot;
};

export default GetTicketWbot;
