import type { proto } from "baileys";
import cacheLayer from "../libs/cache";
import { getIO } from "../libs/socket";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import logger from "../utils/logger";
import GetTicketWbot from "./GetTicketWbot";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import { setReadMessageWhatsAppOficial } from "../libs/whatsAppOficial/whatsAppOficial.service";
import { wuzapiMarkMessagesAsRead } from "../services/WuzapiServices/wuzapiClient";

const SetTicketMessagesAsRead = async (ticket: Ticket): Promise<void> => {

  if (ticket.whatsappId) {
    // console.log("SETTING MESSAGES AS READ", ticket.whatsappId)
    const whatsapp = await ShowWhatsAppService(
      ticket.whatsappId,


      ticket.companyId
    );

    if (["open", "group"].includes(ticket.status) && whatsapp && whatsapp.status === 'CONNECTED' && ticket.unreadMessages > 0) {
      try {
        const isWuzapi =
          String((whatsapp as any)?.provider || "").toLowerCase() === "wuzapi";
        // No Baileys marcamos mensagem por mensagem via key.
        // No WuzAPI alguns registros não possuem dataJson/key no formato do Baileys,
        // então apenas atualizamos o estado interno no banco.
        const getJsonMessage = await Message.findAll({
          where: {
            ticketId: ticket.id,
            fromMe: false,
            read: false
          },
          order: [["createdAt", "DESC"]]
        });

        if (ticket.channel === "whatsapp_oficial" && getJsonMessage.length > 0) {
          for (const message of getJsonMessage) {
            if (!message?.wid) continue;
            try {
              await setReadMessageWhatsAppOficial(whatsapp.token, message.wid);
            } catch {
              // Não bloqueia marcação local caso API oficial falhe.
            }
          }
        } else if (isWuzapi && getJsonMessage.length > 0) {
          try {
            await wuzapiMarkMessagesAsRead(whatsapp as any, getJsonMessage);
          } catch {
            // Mantém consistência local mesmo se o read remoto falhar.
          }
        } else if (!isWuzapi && getJsonMessage.length > 0) {
          try {
            const wbot = await GetTicketWbot(ticket);
            for (const message of getJsonMessage) {
              const raw = String((message as any).dataJson || "").trim();
              if (!raw) continue;

              let msg: proto.IWebMessageInfo | null = null;
              try {
                msg = JSON.parse(raw);
              } catch {
                continue;
              }

              if (
                msg?.key &&
                msg.key.fromMe === false &&
                !ticket.isBot &&
                (ticket.userId || ticket.isGroup)
              ) {
                await wbot.readMessages([msg.key]);
              }
            }
          } catch {
            // Não bloqueia marcação local caso o envio de "lida" ao WhatsApp falhe.
          }
        }

        await Message.update(
          { read: true },
          {
            where: {
              ticketId: ticket.id,
              read: false
            }
          }
        );

        await ticket.update({ unreadMessages: 0 });
        await cacheLayer.set(`contacts:${ticket.contactId}:unreads`, "0");

        const io = getIO();

        io.of(ticket.companyId.toString())
          // .to(ticket.status).to("notification")
          .emit(`company-${ticket.companyId}-ticket`, {
            action: "updateUnread",
            ticketId: ticket.id
          });

      } catch (err) {
        logger.warn(
          `Could not mark messages as read. Maybe whatsapp session disconnected? Err: ${err}`
        );
      }

    }
  }

};

export default SetTicketMessagesAsRead;
