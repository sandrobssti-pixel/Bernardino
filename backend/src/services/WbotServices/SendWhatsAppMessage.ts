import type { proto, WAMessage, WAMessageContent, WASocket } from "baileys";
import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import { isNil } from "lodash";
import fs from "fs";

import formatBody from "../../helpers/Mustache";
import { dynamicImport } from "../../utils/dynamicImport";
import buildHiddenMentionAll from "../../helpers/BuildHiddenMentionAll";

let baileysMod: typeof import("baileys") | null = null;
async function getBaileys() {
  if (!baileysMod) baileysMod = await dynamicImport("baileys");
  return baileysMod;
}

// TODO: remover apos diagnostico do bug de envio em sessoes importadas via extensao.
const logSendDebug = (ticket: Ticket, number: string, sentMessage: any) => {
  try {
    console.log("[SEND-DEBUG]", JSON.stringify({
      whatsappId: ticket.whatsappId,
      ticketId: ticket.id,
      number,
      messageId: sentMessage?.key?.id,
      fromMe: sentMessage?.key?.fromMe,
      status: sentMessage?.status,
      messageTimestamp: sentMessage?.messageTimestamp,
    }));
  } catch (e) {
    console.log("[SEND-DEBUG] failed to log sentMessage", e);
  }
};

// TODO: remover apos diagnostico do bug de envio em sessoes importadas via extensao.
const logSendError = (ticket: Ticket, number: string, err: any) => {
  try {
    console.log("[SEND-DEBUG-ERROR]", JSON.stringify({
      whatsappId: ticket.whatsappId,
      ticketId: ticket.id,
      number,
      message: err?.message,
      statusCode: err?.output?.statusCode,
      boomData: err?.data,
      name: err?.name
    }));
  } catch (e) {
    console.log("[SEND-DEBUG-ERROR] failed to log err", e, err);
  }
};

interface TemplateButton {
  index: number;
  urlButton?: {
    displayText: string;
    url: string;
  };
  callButton?: {
    displayText: string;
    phoneNumber: string;
  };
  quickReplyButton?: {
    displayText: string;
    id: string;
  };
}

interface Request {
  body?: string;
  ticket: Ticket;
  quotedMsg?: Message;
  msdelay?: number;
  vCard?: Contact;
  isForwarded?: boolean;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  } | null;
  templateButtons?: TemplateButton[];
  messageTitle?: string;
  imageUrl?: string;
  hiddenMentionAll?: boolean;
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

const normalizeJid = (value?: string | null): string => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || !raw.includes("@")) return "";
  const [left, domain] = raw.split("@");
  const primary = String(left || "").split(":")[0] || "";
  if (!primary || !domain) return "";
  return `${primary}@${domain}`;
};

const addBrNinthDigitVariants = (n: string): string[] => {
  const variants = new Set<string>();
  variants.add(n);

  if (!n.startsWith("55")) return Array.from(variants);

  if (n.length === 13) {
    const ddi = n.substring(0, 2);
    const ddd = n.substring(2, 4);
    const firstLocalDigit = n.substring(4, 5);
    const local8 = n.slice(-8);
    if (firstLocalDigit === "9") {
      variants.add(`${ddi}${ddd}${local8}`);
    }
  } else if (n.length === 12) {
    const ddi = n.substring(0, 2);
    const ddd = n.substring(2, 4);
    const local8 = n.slice(-8);
    variants.add(`${ddi}${ddd}9${local8}`);
  }

  return Array.from(variants);
};

const resolveNumberViaCheck = async (
  wbot: any,
  number: string
): Promise<{ jid: string; verified: boolean }> => {
  if (typeof wbot?.onWhatsApp !== "function") return { jid: "", verified: false };

  const candidates = addBrNinthDigitVariants(number);
  let verified = false;

  for (const candidate of candidates) {
    try {
      const [result] = (await wbot.onWhatsApp(
        `${candidate}@s.whatsapp.net`
      )) || [];
      verified = true;
      if (result?.exists && result?.jid) {
        return { jid: normalizeJid(String(result.jid)) || "", verified: true };
      }
    } catch {
      // checagem indisponivel (ex: falha de rede com a API) para essa variante,
      // segue tentando as demais sem marcar como verificado
    }
  }

  return { jid: "", verified };
};

const resolveContactTargetJid = async ({
  contact,
  ticket,
  wbot
}: {
  contact: Contact | null;
  ticket: Ticket;
  wbot: any;
}): Promise<string> => {
  // Prioriza um @lid ja conhecido para esse contato/ticket independente do
  // provider — sessoes Baileys com identidade LID (ex: importadas via
  // extensao) tambem precisam responder no mesmo @lid em que a mensagem foi
  // recebida, senao o Baileys trata como um peer diferente e a resposta cai
  // fora do ticket original.
  if (!ticket.isGroup) {
    const lidCandidates = [
      normalizeJid((contact as any)?.lid),
      normalizeJid((ticket as any)?.lid),
      normalizeJid(contact?.remoteJid)
    ].filter(jid => jid.endsWith("@lid"));

    if (lidCandidates.length > 0) {
      return lidCandidates[0];
    }
  }

  const jidCandidates = [
    normalizeJid((contact as any)?.jid),
    normalizeJid((ticket as any)?.jid),
    normalizeJid(contact?.remoteJid)
  ].filter(Boolean);

  if (jidCandidates.length > 0) {
    return jidCandidates[0];
  }

  const number = String(contact?.number || "").replace(/\D/g, "");
  if (!number) return "";

  if (!ticket.isGroup) {
    const { jid: resolved, verified } = await resolveNumberViaCheck(wbot, number);
    if (resolved) return resolved;
    if (verified) {
      // A checagem rodou com sucesso e confirmou que o numero nao existe no
      // WhatsApp — nao envia "as cegas" para um JID que nunca vai entregar.
      throw new AppError("ERR_WAPP_INVALID_CONTACT", 400);
    }
  }

  return `${number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;
};

const buildQuotedOptions = async (
  quotedMsg: Message | undefined,
  targetJid: string,
  isGroup: boolean,
  currentTicketId?: number
) => {
  if (!quotedMsg?.id) return {};

  const chatMessage = await Message.findOne({
    where: { id: quotedMsg.id }
  });
  if (!chatMessage) return {};
  if (
    typeof currentTicketId === "number" &&
    Number.isFinite(currentTicketId) &&
    Number(chatMessage.ticketId) !== Number(currentTicketId)
  ) {
    return {};
  }

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
  ticket,
  quotedMsg,
  msdelay,
  vCard,
  isForwarded = false,
  location,
  templateButtons,
  messageTitle,
  imageUrl,
  hiddenMentionAll = false,
}: Request): Promise<WAMessage | proto.WebMessageInfo> => {
  let options: any = {};
  const wbot = await GetTicketWbot(ticket);
  const { delay } = await getBaileys();
  const contactNumber = await Contact.findByPk(ticket.contactId);
  const isWuzapiProvider =
    String((wbot as any)?.provider || "").toLowerCase() === "wuzapi";

  const number = await resolveContactTargetJid({
    contact: contactNumber,
    ticket,
    wbot
  });

  if (!number) {
    throw new AppError("ERR_WAPP_INVALID_CONTACT", 400);
  }

  options = await buildQuotedOptions(
    quotedMsg,
    number,
    Boolean(ticket.isGroup),
    Number(ticket.id)
  );

  if (hiddenMentionAll && ticket.isGroup) {
    const mentionedJid = await buildHiddenMentionAll({
      ticket,
      wbot,
      groupJid: number
    });

    if (mentionedJid.length > 0) {
      options.mentionedJid = mentionedJid;
      options.nonJidMentions = 1;
    }
  }

  const mentions = Array.isArray(options?.mentionedJid)
    ? options.mentionedJid
    : [];
  const mentionAll = hiddenMentionAll && ticket.isGroup;
  const contextInfoWithMentions = {
    ...(mentions.length > 0 ? { mentionedJid: mentions } : {}),
    ...(mentionAll ? { nonJidMentions: 1 } : {}),
    forwardingScore: isForwarded ? 2 : 0,
    isForwarded: !!isForwarded
  };

  if (!isNil(vCard)) {
    const rawName = String(vCard?.name || "").trim();
    const displayName = rawName || "Contato";
    const firstName = displayName.split(" ")[0];
    const lastName = String(displayName).replace(firstName, "");
    const numberContact = String(vCard?.number || "").replace(/\D/g, "");

    if (!numberContact) {
      throw new AppError("ERR_WAPP_INVALID_CONTACT", 400);
    }

    const vcard =
      `BEGIN:VCARD\n` +
      `VERSION:3.0\n` +
      `N:${lastName};${firstName};;;\n` +
      `FN:${displayName}\n` +
      `TEL;type=CELL;waid=${numberContact}:+${numberContact}\n` +
      `END:VCARD`;

    try {
      await delay(msdelay);
      const sentMessage = await wbot.sendMessage(
        number,
        {
          contacts: {
            displayName: `${displayName}`,
            contacts: [{ vcard }],
          },
          mentions,
          mentionAll,
          contextInfo: {
            ...(mentions.length > 0 ? { mentionedJid: mentions } : {}),
            ...(mentionAll ? { nonJidMentions: 1 } : {})
          }
        },
        options
      );
      logSendDebug(ticket, number, sentMessage);
      await ticket.update({
        lastMessage: formatBody(vcard, ticket),
        imported: null,
      });
      return sentMessage as WAMessage;
    } catch (err) {
      Sentry.captureException(err);
      console.log(err);
      logSendError(ticket, number, err);
      throw new AppError("ERR_SENDING_WAPP_MSG");
    }
  }

  if (location) {
    try {
      await delay(msdelay);

      const lat = Number(location.latitude);
      const lng = Number(location.longitude);
      const mapLink = `https://maps.google.com/maps?q=${lat}%2C${lng}&z=17`;
      const locationLabel = location.name || location.address || "Localização";

      if (isWuzapiProvider) {
        const fallbackText = [locationLabel, location.address, mapLink]
          .filter(Boolean)
          .join("\n");

        const sentMessage = await wbot.sendMessage(
          number,
          {
            text: fallbackText,
            mentions,
            mentionAll,
            contextInfo: {
              ...(mentions.length > 0 ? { mentionedJid: mentions } : {}),
              ...(mentionAll ? { nonJidMentions: 1 } : {})
            }
          },
          options
        );
        logSendDebug(ticket, number, sentMessage);

        await ticket.update({
          lastMessage: `${locationLabel}: ${mapLink}`,
          imported: null
        });
        return sentMessage as WAMessage;
      }

      const sentMessage = await wbot.sendMessage(
        number,
        {
          location: {
            degreesLatitude: lat,
            degreesLongitude: lng,
            name: location.name || undefined,
            address: location.address || undefined
          },
          mentions,
          mentionAll,
          contextInfo: {
            ...(mentions.length > 0 ? { mentionedJid: mentions } : {}),
            ...(mentionAll ? { nonJidMentions: 1 } : {})
          }
        },
        options
      );
      logSendDebug(ticket, number, sentMessage);

      await ticket.update({
        lastMessage: `${locationLabel}: ${mapLink}`,
        imported: null
      });
      return sentMessage as WAMessage;
    } catch (err) {
      Sentry.captureException(err);
      console.log(err);
      logSendError(ticket, number, err);
      throw new AppError("ERR_SENDING_WAPP_MSG");
    }
  }

  // ✅ ENVIO DE MENSAGEM COM BOTÕES
  if (templateButtons && templateButtons.length > 0) {
    try {
      await delay(msdelay);

      const formattedBody = formatBody(body || "", ticket);
      const footer = messageTitle || "";
      let mediaMessage: any = null;

      if (imageUrl) {
        if (fs.existsSync(imageUrl)) {
          const imageBuffer = fs.readFileSync(imageUrl);
          mediaMessage = {
            image: imageBuffer,
            caption: formattedBody,
            footer,
            templateButtons,
            headerType: 4,
            mentions,
            mentionAll,
            contextInfo: {
              ...(mentions.length > 0 ? { mentionedJid: mentions } : {}),
              ...(mentionAll ? { nonJidMentions: 1 } : {})
            }
          };
        } else if (imageUrl.startsWith("http")) {
          mediaMessage = {
            image: { url: imageUrl },
            caption: formattedBody,
            footer,
            templateButtons,
            headerType: 4,
            mentions,
            mentionAll,
            contextInfo: {
              ...(mentions.length > 0 ? { mentionedJid: mentions } : {}),
              ...(mentionAll ? { nonJidMentions: 1 } : {})
            }
          };
        }
      }

      const messageData = mediaMessage || {
        text: formattedBody,
        footer,
        templateButtons,
        headerType: 1,
        mentions,
        mentionAll,
        contextInfo: {
          ...(mentions.length > 0 ? { mentionedJid: mentions } : {}),
          ...(mentionAll ? { nonJidMentions: 1 } : {})
        }
      };

      const sentMessage = await wbot.sendMessage(
        number,
        messageData as any,
        options
      );
      logSendDebug(ticket, number, sentMessage);

      await ticket.update({ lastMessage: formattedBody, imported: null });
      return sentMessage as WAMessage;
    } catch (err) {
      console.log(
        `Erro ao enviar mensagem com botões na company ${ticket.companyId}: `,
        err
      );
      Sentry.captureException(err);
      logSendError(ticket, number, err);
      throw new AppError("ERR_SENDING_WAPP_BUTTON_MSG");
    }
  }

  if (body) {
    try {
      await delay(msdelay);
      const sentMessage = await wbot.sendMessage(
        number,
        {
          text: formatBody(body, ticket),
          mentions,
          mentionAll,
          contextInfo: contextInfoWithMentions,
        },
        options
      );
      logSendDebug(ticket, number, sentMessage);
      await ticket.update({
        lastMessage: formatBody(body, ticket),
        imported: null,
      });
      return sentMessage as WAMessage;
    } catch (err) {
      Sentry.captureException(err);
      console.log(err);
      logSendError(ticket, number, err);
      throw new AppError("ERR_SENDING_WAPP_MSG");
    }
  }

  throw new AppError("ERR_NO_MESSAGE_CONTENT_PROVIDED");
};

export default SendWhatsAppMessage;
