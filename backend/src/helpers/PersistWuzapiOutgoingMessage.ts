import Message from "../models/Message";
import Ticket from "../models/Ticket";
import CreateMessageService from "../services/MessageServices/CreateMessageService";

const generateRandomCode = (length: number = 11): string => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }
  return code;
};

// Conexões WuzAPI não têm um "eco" próprio de mensagem enviada (como o
// messages.upsert do Baileys) que crie a Message no banco automaticamente,
// então o envio manual (MessageController) sempre criava a Message aqui
// mesmo antes de emitir o socket. Extraído para ser reusado também pelo
// job de follow-up do flowbuilder, que enviava a mensagem via WuzAPI mas
// nunca persistia a Message — por isso ela não aparecia no chat ao vivo.
const persistWuzapiOutgoingMessage = async ({
  ticket,
  sentMessage,
  senderId,
  senderName,
  body,
  mediaType,
  media,
  quotedMsg,
  isForwarded = false
}: {
  ticket: Ticket;
  sentMessage: any;
  senderId?: number;
  senderName?: string;
  body: string;
  mediaType?: string;
  media?: Express.Multer.File;
  quotedMsg?: Message;
  isForwarded?: boolean;
}): Promise<void> => {
  const wid =
    String(sentMessage?.key?.id || sentMessage?.id || "").trim() ||
    `WUZOUT${Date.now()}${generateRandomCode(6)}`;

  const existing = await Message.findOne({
    where: {
      wid,
      companyId: ticket.companyId
    }
  });
  if (existing) return;

  const messageId = String(sentMessage?.key?.id || sentMessage?.id || "").trim() || wid;
  const remoteJid =
    String(sentMessage?.key?.remoteJid || (ticket as any)?.contact?.remoteJid || "").trim() ||
    undefined;

  const dataJson = JSON.stringify({
    key: {
      id: messageId,
      fromMe: true,
      remoteJid
    },
    message: sentMessage?.message || { conversation: String(body || "") },
    __sentByUserId: senderId,
    __sentByUserName: senderName,
    isForwarded: !!isForwarded
  });

  const messageData: any = {
    wid,
    messageId,
    ticketId: ticket.id,
    quotedMsgId: quotedMsg?.id || null,
    body: body || "",
    fromMe: true,
    read: true,
    ack: 2,
    isForwarded: !!isForwarded,
    remoteJid,
    dataJson,
    channel: "whatsapp"
  };

  if (mediaType) {
    messageData.mediaType = mediaType;
  }

  if (media) {
    messageData.mediaUrl = media.filename;
    messageData.mediaType = mediaType || String(media.mimetype || "document").split("/")[0];
  }

  await CreateMessageService({
    companyId: ticket.companyId,
    messageData
  });
};

export default persistWuzapiOutgoingMessage;
