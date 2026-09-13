import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import CreateMessageService from "../MessageServices/CreateMessageService";

// Webchat não tem API externa para "enviar" — toda resposta do sistema
// (bot/flow) é apenas persistida como mensagem fromMe:true, e o widget a
// recebe via polling (ver webchatMessageListener.ts / WebchatPublicController.ts).
const buildWid = (ticketId: number): string =>
  `webchat-out-${ticketId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const sendWebchatText = async (
  ticket: Ticket,
  companyId: number,
  body: string
): Promise<Message> => {
  const messageData = {
    wid: buildWid(ticket.id),
    ticketId: ticket.id,
    contactId: undefined,
    body,
    fromMe: true,
    read: true,
    ack: 3,
    channel: "webchat"
  };

  return CreateMessageService({ messageData, companyId });
};

export const sendWebchatMedia = async (
  ticket: Ticket,
  companyId: number,
  mediaUrl: string,
  mediaType: string,
  body?: string
): Promise<Message> => {
  const messageData = {
    wid: buildWid(ticket.id),
    ticketId: ticket.id,
    contactId: undefined,
    body: body || mediaType,
    fromMe: true,
    read: true,
    ack: 3,
    channel: "webchat",
    mediaUrl,
    mediaType
  };

  return CreateMessageService({ messageData, companyId });
};
