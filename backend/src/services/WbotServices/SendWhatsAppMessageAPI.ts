import type { WAMessage } from "baileys";
import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

import formatBody from "../../helpers/Mustache";
import Contact from "../../models/Contact";
import { getWbot } from "../../libs/wbot";
import { dynamicImport } from "../../utils/dynamicImport";

let baileysMod: typeof import("baileys") | null = null;
async function getBaileys() {
  if (!baileysMod) baileysMod = await dynamicImport("baileys");
  return baileysMod;
}

interface Request {
  body: string;
  whatsappId: number;
  contact: Contact;
  quotedMsg?: Message;
  msdelay?: number;
}

const safeParseJson = (value: string | null | undefined): any => {
  if (!value || typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const resolveQuotedMessageProviderId = (chatMessage: Message, parsedKey: any): string => {
  const parsedId = String(parsedKey?.id || "").trim();
  if (parsedId) return parsedId;

  const explicitMessageId = String(chatMessage.messageId || "").trim();
  if (explicitMessageId) return explicitMessageId;

  const wid = String(chatMessage.wid || "").trim();
  if (!wid) return "";

  const wuzapiMatch = wid.match(/^wuzapi:[^:]+:(.+)$/i);
  if (wuzapiMatch?.[1]) return String(wuzapiMatch[1]).trim();

  return wid;
};

const buildQuotedOptions = async (
  quotedMsg: Message | undefined,
  targetJid: string,
  isGroup: boolean
) => {
  if (!quotedMsg?.id) return {};

  const chatMessage = await Message.findOne({
    where: { id: quotedMsg.id }
  });
  if (!chatMessage) return {};

  const parsed = safeParseJson(chatMessage.dataJson);
  const parsedKey = parsed?.key || {};
  const parsedMessage = parsed?.message;

  const quotedKey = {
    ...parsedKey,
    id: resolveQuotedMessageProviderId(chatMessage, parsedKey),
    remoteJid: targetJid || parsedKey?.remoteJid || chatMessage.remoteJid || undefined,
    participant: isGroup
      ? (parsedKey?.participant || chatMessage.participant || undefined)
      : undefined,
    fromMe:
      typeof parsedKey?.fromMe === "boolean"
        ? parsedKey.fromMe
        : Boolean(chatMessage.fromMe)
  };

  const fallbackMessage =
    parsedMessage ||
    (chatMessage.body ? { conversation: chatMessage.body } : undefined);

  if (!quotedKey.id || !fallbackMessage) return {};

  return {
    quoted: {
      ...(parsed && typeof parsed === "object" ? parsed : {}),
      key: quotedKey,
      message: fallbackMessage
    }
  };
};

const SendWhatsAppMessage = async ({
  body,
  whatsappId,
  contact,
  quotedMsg,
  msdelay
}: Request): Promise<WAMessage> => {
  let options = {};
  const wbot = await getWbot(whatsappId);
  const { delay } = await getBaileys();
  const number = `${contact.number}@${contact.isGroup ? "g.us" : "s.whatsapp.net"}`;

  options = await buildQuotedOptions(quotedMsg, number, Boolean(contact.isGroup));

  try {
    await delay(msdelay)
    const sentMessage = await wbot.sendMessage(
      number,
      {
        text: body
      },
      {
        ...options
      }
    );

    return sentMessage;
  } catch (err) {
    Sentry.captureException(err);
    console.log(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
