import type { WASocket, WAMessage } from "baileys";
import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import GetWbotMessage from "../../helpers/GetWbotMessage";
import Message from "../../models/Message";
// import OldMessage from "../../models/OldMessage";
import Ticket from "../../models/Ticket";

import formatBody from "../../helpers/Mustache";

interface Request {
  messageId: string;
  body: string;
}

const EditWhatsAppMessage = async ({
  messageId,
  body,
}: Request): Promise<{ ticket: Ticket, message: Message }> => {

  const message = await Message.findByPk(messageId, {
    include: [
      {
        model: Ticket,
        as: "ticket",
        include: ["contact"]
      }
    ]
  });

  if (!message) {
    throw new AppError("No message found with this ID.");
  }

  const { ticket } = message;

  const wbot = await GetTicketWbot(ticket);

  const msg = JSON.parse(message.dataJson);

  try {
    await wbot.sendMessage(message.remoteJid, {
      text: body,
      edit: msg.key,
    }, {});


    const previousBody = String(message.body || "");
    let currentDataJson: any = {};
    try {
      currentDataJson = message.dataJson ? JSON.parse(message.dataJson) : {};
    } catch {
      currentDataJson = {};
    }
    const editedAt = new Date().toISOString();
    const editHistory = Array.isArray(currentDataJson?.__editHistory)
      ? currentDataJson.__editHistory
      : [];
    editHistory.push({
      editedAt,
      oldBody: previousBody,
      newBody: body,
      provider: String((ticket as any)?.whatsapp?.provider || "baileys")
    });

    await message.update({
      body,
      isEdited: true,
      dataJson: JSON.stringify({
        ...currentDataJson,
        __lastEditedOldBody: previousBody,
        __lastEditedNewBody: body,
        __lastEditedAt: editedAt,
        __editHistory: editHistory
      })
    });

    await ticket.update({ lastMessage: body });
    await ticket.reload();
    
    return { ticket: message.ticket, message: message };
  } catch (err) {
    console.log(err);
    throw new AppError("ERR_EDITING_WAPP_MSG");
  }

};

export default EditWhatsAppMessage;
