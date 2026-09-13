import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { buildVcardFromContacts, IMessageReceived } from "./ReceivedWhatsApp";

const verifyMessageOficial = async (
  message: IMessageReceived,
  ticket: Ticket,
  contact: Contact,
  companyId: number,
  fileName: string | null,
  fromNumber: string,
  data: any,
  quoteMessageId?: string
) => {
  let quotedMsgId: number | null = null;

  if (quoteMessageId) {
    const quotedMessage = await Message.findOne({
      where: {
        wid: quoteMessageId,
        companyId
      }
    });
    quotedMsgId = quotedMessage?.id || null;
  }

  const createdAtISO = new Date(
    Math.floor((Number(message.timestamp) || Math.floor(Date.now() / 1000)) * 1000)
  ).toISOString();

  const isContactMessage = message.type === "contacts";
  const vcardBody = isContactMessage
    ? buildVcardFromContacts(message.contacts)
    : "";

  const messageData = {
    wid: message.idMessage,
    ticketId: ticket.id,
    contactId: contact.id,
    body: isContactMessage ? vcardBody : message.text || "",
    fromMe: false,
    mediaType: isContactMessage ? "contactMessage" : message.type || "conversation",
    mediaUrl: fileName,
    read: false,
    quotedMsgId,
    ack: 0,
    channel: "whatsapp_oficial",
    remoteJid: `${fromNumber}@s.whatsapp.net`,
    participant: null,
    dataJson: JSON.stringify(data),
    ticketTrakingId: null,
    isPrivate: false,
    createdAt: createdAtISO,
    ticketImported: null,
    isForwarded: false
  };

  await CreateMessageService({ messageData, companyId });
};

export default verifyMessageOficial;
