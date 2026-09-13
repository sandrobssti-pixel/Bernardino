import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import Tag from "../../models/Tag";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import SendWebPushNotificationService from "../PushNotificationServices/SendWebPushNotificationService";

export interface MessageData {
  wid: string;
  messageId?: string;
  ticketId: number;
  body: string;
  contactId?: number;
  fromMe?: boolean;
  read?: boolean;
  mediaType?: string;
  mediaUrl?: string;
  quotedMsgId?: number | string | null;
  ack?: number;
  queueId?: number;
  channel?: string;
  ticketTrakingId?: number;
  isPrivate?: boolean;
  ticketImported?: any;
  isForwarded?: boolean;
  remoteJid?: string;
  dataJson?: string;
  participant?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}
interface Request {
  messageData: MessageData;
  companyId: number;
}

const CreateMessageService = async ({
  messageData,
  companyId
}: Request): Promise<Message> => {
  await Message.upsert({ ...messageData, companyId });

  const message = await Message.findOne({
    where: {
      wid: messageData.wid,
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
          },
          {
            model: Tag,
            as: "tags",
            attributes: ["id", "name", "color"]
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

  if (!message) {
    throw new Error("ERR_CREATING_MESSAGE");
  }

  if (message.ticket?.queueId != null && message.queueId == null) {
    await message.update({ queueId: message.ticket.queueId });
  }

  if (message.isPrivate) {
    await message.update({ wid: `PVT${message.id}` });
  }

  const io = getIO();

  if (!messageData?.ticketImported) {
    const payload = {
      action: "create",
      message,
      ticket: message.ticket,
      contact: message.ticket.contact
    };

    // Emissão ampla para atender diferentes listeners do frontend
    io.of(String(companyId)).emit(`company-${companyId}-appMessage`, payload);
    io.of(String(companyId)).to(String(message.ticketId)).emit("appMessage", payload);
    io.of(String(companyId)).to(`company-${companyId}`).emit("appMessage", payload);

    if (!message.fromMe && !message.isPrivate && !message.ticket?.isGroup) {
      const contactName = message.ticket?.contact?.name || "Novo contato";
      const bodyPreview = String(message.body || "").slice(0, 140);
      const url = message.ticket?.uuid ? `/tickets/${message.ticket.uuid}` : "/tickets";

      await SendWebPushNotificationService({
        companyId,
        title: `Nova mensagem de ${contactName}`,
        body: bodyPreview || "Você recebeu uma nova mensagem.",
        url,
        tag: `ticket-${message.ticketId}`,
        ticket: {
          queueId: message.ticket?.queueId ?? null,
          userId: message.ticket?.userId ?? null
        }
      });
    }
  }

  return message;
};

export default CreateMessageService;
