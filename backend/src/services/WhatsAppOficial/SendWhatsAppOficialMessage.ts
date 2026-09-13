import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import formatBody from "../../helpers/Mustache";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import logger from "../../utils/logger";
import {
  IMetaMessageReaction,
  IMetaMessageTemplate,
  IMetaMessageinteractive,
  IReturnMessageMeta,
  ISendMessageOficial
} from "../../libs/whatsAppOficial/IWhatsAppOficial.interfaces";
import { sendMessageWhatsAppOficial } from "../../libs/whatsAppOficial/whatsAppOficial.service";
import CreateMessageService from "../MessageServices/CreateMessageService";
import cacheLayer from "../../libs/cache";

interface Request {
  body: string;
  ticket: Ticket;
  type:
    | "text"
    | "reaction"
    | "audio"
    | "document"
    | "image"
    | "sticker"
    | "video"
    | "location"
    | "contacts"
    | "interactive"
    | "template";
  quotedMsg?: Message;
  media?: Express.Multer.File;
  vCard?: Contact;
  template?: IMetaMessageTemplate;
  interative?: IMetaMessageinteractive;
  bodyToSave?: string;
}

const mediaTypeByInput = (type: string): string => {
  if (type === "text") return "conversation";
  if (type === "interactive") return "interactive";
  if (type === "template") return "template";
  if (type === "contacts") return "contactMessage";
  return type;
};

const resolveTypeFromMedia = (media?: Express.Multer.File):
  | "audio"
  | "document"
  | "image"
  | "video"
  | null => {
  if (!media?.mimetype) return null;
  const [kind] = media.mimetype.split("/");
  if (kind === "audio") return "audio";
  if (kind === "image") return "image";
  if (kind === "video") return "video";
  return "document";
};

const normalizeReactionEmoji = (value: string): string =>
  String(value || "").trim();

// Meta permitirá identificação por username (não numérico) além de telefone.
// O prefixo "+"/conversão numérica só se aplica quando o valor for um telefone puro.
const isNumericContactId = (value: unknown): boolean =>
  /^\d+$/.test(String(value ?? "").trim());

const toMetaRecipientId = (value: unknown): string => {
  const raw = String(value ?? "").trim();
  return isNumericContactId(raw) ? `+${raw}` : raw;
};

const SendWhatsAppOficialMessage = async ({
  body,
  ticket,
  media,
  type,
  vCard,
  template,
  interative,
  quotedMsg,
  bodyToSave
}: Request): Promise<IReturnMessageMeta> => {
  const pathMedia = media ? media.path : null;
  const contact = await Contact.findByPk(ticket.contactId);

  if (!contact) {
    throw new AppError("ERR_CONTACT_NOT_FOUND", 404);
  }

  const bodyMsg = body ? formatBody(body, ticket) : "";
  const selectedType = media ? resolveTypeFromMedia(media) || type : type;
  const persistedBody =
    selectedType === "interactive" || selectedType === "template"
      ? bodyToSave || bodyMsg
      : bodyMsg;

  const options: ISendMessageOficial = {
    type: selectedType,
    to: toMetaRecipientId(contact.number),
    quotedId: selectedType === "reaction" ? undefined : quotedMsg?.wid
  };

  if (media) {
    options.fileName = media.originalname.replace("/", "-");
  }

  switch (selectedType) {
    case "video":
      options.body_video = { caption: bodyMsg };
      break;
    case "audio":
      break;
    case "reaction": {
      const reactionTargetId = String(quotedMsg?.wid || "").trim();
      const emoji = normalizeReactionEmoji(bodyMsg || body);

      if (!reactionTargetId) {
        throw new AppError("ERR_REACTION_MESSAGE_ID_NOT_FOUND", 400);
      }

      if (!emoji) {
        throw new AppError("ERR_REACTION_TEXT_REQUIRED", 400);
      }

      options.body_reaction = {
        message_id: reactionTargetId,
        emoji
      } as IMetaMessageReaction;
      break;
    }
    case "document":
      options.body_document = { caption: bodyMsg };
      break;
    case "image":
      options.body_image = { caption: bodyMsg };
      break;
    case "interactive":
      options.body_interactive = interative;
      break;
    case "contacts": {
      if (!vCard) break;
      const firstName = vCard?.name?.split(" ")[0];
      const lastName = String(vCard?.name || "").replace(firstName || "", "").trim();
      options.body_contacts = {
        name: {
          first_name: firstName,
          last_name: lastName,
          formatted_name: `${firstName || ""} ${lastName || ""}`.trim()
        },
        phones: [
          {
            phone: toMetaRecipientId(vCard.number),
            wa_id: isNumericContactId(vCard.number)
              ? +vCard.number
              : String(vCard.number ?? ""),
            type: "CELL"
          }
        ],
        emails: [{ email: vCard.email }]
      };
      break;
    }
    case "template":
      options.body_template = template;
      break;
    case "text":
    default:
      options.body_text = { body: bodyMsg };
      break;
  }

  try {
    const sendMessage = await sendMessageWhatsAppOficial(pathMedia, ticket.whatsapp.token, options);

    const wid =
      sendMessage?.idMessageWhatsApp?.[0] ||
      sendMessage?.messages?.[0]?.id ||
      `ofc-${Date.now()}`;

    await ticket.update({
      lastMessage: persistedBody || media?.originalname || "",
      imported: null,
      unreadMessages: 0
    });
    if (ticket.contactId) {
      // Mesma lógica do listener de recebimento: zera o cache de "não lidas"
      // ao enviar mensagem, para não acumular sobre um valor antigo.
      await cacheLayer.set(`contacts:${ticket.contactId}:unreads`, "0");
    }

    const messageData = {
      wid,
      ticketId: ticket.id,
      contactId: contact.id,
      body: persistedBody,
      fromMe: true,
      mediaType: mediaTypeByInput(selectedType),
      mediaUrl: media ? media.filename : null,
      read: true,
      quotedMsgId: quotedMsg?.id || null,
      ack: 2,
      channel: "whatsapp_oficial",
      remoteJid: `${contact.number}@s.whatsapp.net`,
      participant: null,
      dataJson: JSON.stringify(body || ""),
      ticketTrakingId: null,
      isPrivate: false,
      createdAt: new Date().toISOString(),
      ticketImported: ticket.imported,
      isForwarded: false,
      originalName: media ? media.filename : null
    };

    await CreateMessageService({ messageData, companyId: ticket.companyId });

    return sendMessage;
  } catch (err: any) {
    Sentry.captureException(err);

    const apiErrorData = err?.response?.data;
    logger.error(
      `SendWhatsAppOficialMessage -> error: ${err?.message} | apiResponse: ${
        apiErrorData ? JSON.stringify(apiErrorData) : "N/A"
      }`
    );

    const apiErrorMessage =
      apiErrorData?.message ||
      apiErrorData?.error?.message ||
      apiErrorData?.error_data?.details ||
      apiErrorData?.errors?.[0]?.detail;

    throw new AppError(apiErrorMessage || "ERR_SENDING_WAPP_MSG", 500);
  }
};

export default SendWhatsAppOficialMessage;
