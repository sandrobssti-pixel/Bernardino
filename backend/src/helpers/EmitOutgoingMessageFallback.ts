import { getIO } from "../libs/socket";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";
import Queue from "../models/Queue";
import Whatsapp from "../models/Whatsapp";
import User from "../models/User";

// Envelope de mensagens outbound (SendWhatsAppMessage) confia no eco do
// Baileys (fromMe=true) pra criar a Message no banco e avisar o front via
// socket. Esse eco às vezes demora ou não dispara a tempo — por isso o
// envio manual de mensagens (MessageController) já espera a Message
// aparecer e reemite o evento como reforço. Extraído aqui pra ser reusado
// por qualquer envio automático (ex.: follow-up do flowbuilder) que também
// precise aparecer ao vivo na tela de atendimento, não só no resumo do ticket.
const emitOutgoingMessageFallback = async ({
  companyId,
  wid
}: {
  companyId: number;
  wid?: string;
}): Promise<void> => {
  if (!wid) return;

  const maxAttempts = 8;
  const delayMs = 250;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const message = await Message.findOne({
      where: {
        wid,
        companyId
      },
      include: [
        "contact",
        {
          model: Ticket,
          as: "ticket",
          include: [
            {
              model: Contact,
              attributes: [
                "id",
                "name",
                "number",
                "email",
                "profilePicUrl",
                "acceptAudioMessage",
                "active",
                "urlPicture",
                "companyId"
              ],
              include: ["extraInfo", "tags"]
            },
            {
              model: Queue,
              attributes: ["id", "name", "color"]
            },
            {
              model: Whatsapp,
              attributes: ["id", "name", "color", "groupAsTicket", "channel", "provider"]
            },
            {
              model: User,
              attributes: ["id", "name"]
            }
          ]
        },
        {
          model: Message,
          as: "quotedMsg",
          include: ["contact"]
        }
      ]
    });

    if (message) {
      const io = getIO();
      io.of(String(companyId)).emit(`company-${companyId}-appMessage`, {
        action: "create",
        message,
        ticket: message.ticket,
        contact: message.ticket?.contact
      });
      return;
    }

    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
};

export default emitOutgoingMessageFallback;
