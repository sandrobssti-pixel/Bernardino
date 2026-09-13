// src/services/WbotServices/SendWhatsAppMedia.ts
import type { AnyMessageContent, WAMessage } from "baileys";
import * as Sentry from "@sentry/node";
import fs, { unlinkSync } from "fs";
import { exec } from "child_process";
import path from "path";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";

import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import mime from "mime-types";
import Contact from "../../models/Contact";
import { getWbot } from "../../libs/wbot";
import CreateMessageService from "../MessageServices/CreateMessageService";
import formatBody from "../../helpers/Mustache";
import buildHiddenMentionAll from "../../helpers/BuildHiddenMentionAll";

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  companyId?: number;
  body?: string;
  quotedMsg?: Message;
  isPrivate?: boolean;
  isForwarded?: boolean;
  hiddenMentionAll?: boolean;
  isSticker?: boolean;
}

const normalizeJid = (value?: string | null): string => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || !raw.includes("@")) return "";
  const [left, domain] = raw.split("@");
  const primary = String(left || "").split(":")[0] || "";
  if (!primary || !domain) return "";
  return `${primary}@${domain}`;
};

const resolveContactTargetJid = ({
  contact,
  ticket,
  wbot
}: {
  contact: Contact | null;
  ticket: Ticket;
  wbot: any;
}): string => {
  const isWuzapi = String((wbot as any)?.provider || "").toLowerCase() === "wuzapi";

  const jidCandidates = [
    normalizeJid((contact as any)?.jid),
    normalizeJid((ticket as any)?.jid),
    normalizeJid(contact?.remoteJid)
  ].filter(Boolean);
  if (isWuzapi && !ticket.isGroup) {
    // For media, prefer PN JID first. Wuzapi client already has LID fallback
    // when provider responds "no lid found", and PN JID is more stable across
    // recipient devices (mobile + web).
    const nonLidJids = jidCandidates.filter(jid => !jid.endsWith("@lid"));
    if (nonLidJids.length > 0) return nonLidJids[0];

    const lidCandidates = [
      normalizeJid((contact as any)?.lid),
      normalizeJid((ticket as any)?.lid),
      normalizeJid(contact?.remoteJid)
    ].filter(jid => jid.endsWith("@lid"));

    if (lidCandidates.length > 0) return lidCandidates[0];
  }

  if (jidCandidates.length > 0) return jidCandidates[0];

  const number = String(contact?.number || "").replace(/\D/g, "");
  if (!number) return "";
  return `${number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;
};

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

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
    parsedMessage || (chatMessage.body ? { conversation: chatMessage.body } : undefined);

  if (!quotedKey.id || !fallbackMessage) return {};

  return {
    quoted: {
      ...(parsed && typeof parsed === "object" ? parsed : {}),
      key: quotedKey,
      message: fallbackMessage
    }
  };
};

// Garante pasta da empresa
const ensureCompanyFolder = (companyId: string) => {
  const dir = path.join(publicFolder, `company${companyId}`);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

// Heurística: alguns recipientes (ex.: .mpeg, .webm) podem vir como "video/*" mas serem usados como áudio.
// Aqui decidimos extrair o áudio e mandar como PTT nesses casos.
const looksLikeAudioContainer = (ext: string, mimetype: string) => {
  const e = ext.toLowerCase();
  const mt = (mimetype || "").toLowerCase();
  if (mt.startsWith("audio/")) return true;

  // Trata .mpeg/.mpg (muito comum o usuário enviar “Arquivo MPEG (.mpeg)” achando que é áudio)
  if (e === ".mpeg" || e === ".mpg") return true;

  // Gravações web via navegador costumam vir em webm (com áudio Opus). Se quiser sempre PTT, trate como áudio:
  if (e === ".webm" && mt.includes("webm")) return true;

  // Outros formatos de áudio comuns:
  if ([".mp3", ".m4a", ".aac", ".wav", ".oga", ".ogg"].includes(e)) return true;

  return false;
};

// AAC em contêiner M4A é o formato enviado pelo WuzAPI e é reproduzido de
// forma consistente pelos clientes iOS e Android.
const processAudioToM4A = async (inputPath: string, companyId: string): Promise<string> => {
  const dir = ensureCompanyFolder(companyId);
  const outputPath = path.join(dir, `${Date.now()}.m4a`);

  const cmd =
    `"${ffmpegPath.path}" -y -i "${inputPath}" ` +
    `-vn -ar 44100 -ac 2 -c:a aac -b:a 128k -movflags +faststart "${outputPath}"`;

  return new Promise((resolve, reject) => {
    exec(cmd, (error) => (error ? reject(error) : resolve(outputPath)));
  });
};

const parseClockToSeconds = (clock: string): number => {
  const parts = String(clock || "").split(":");
  if (parts.length !== 3) return 0;
  const hours = Number(parts[0]) || 0;
  const minutes = Number(parts[1]) || 0;
  const seconds = Number(parts[2]) || 0;
  const total = hours * 3600 + minutes * 60 + seconds;
  return Number.isFinite(total) ? total : 0;
};

const getAudioDurationSeconds = async (audioPath: string): Promise<number> => {
  const cmd = `"${ffmpegPath.path}" -i "${audioPath}" -f null -`;
  return new Promise(resolve => {
    exec(cmd, (error, stdout, stderr) => {
      const output = `${stdout || ""}\n${stderr || ""}`;

      // Prefer final progress clock (closest to what Baileys populates as audio seconds).
      const progressMatches = Array.from(output.matchAll(/time=(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/g));
      if (progressMatches.length > 0) {
        const lastClock = progressMatches[progressMatches.length - 1]?.[1] || "";
        const parsed = parseClockToSeconds(lastClock);
        if (parsed > 0) {
          resolve(Math.max(1, Math.round(parsed)));
          return;
        }
      }

      const durationMatch = output.match(/Duration:\s*(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/);
      if (durationMatch?.[1]) {
        const parsed = parseClockToSeconds(durationMatch[1]);
        if (parsed > 0) {
          resolve(Math.max(1, Math.round(parsed)));
          return;
        }
      }

      // If probing fails, do not block sending.
      if (error) {
        console.log(`Audio duration probe fallback (sending anyway): ${String(error)}`);
      }
      resolve(0);
    });
  });
};

// Também usado por filas/rotas externas
export const getMessageOptions = async (
  fileName: string,
  pathMedia: string,
  companyId?: string,
  body: string = " "
): Promise<AnyMessageContent | null> => {
  const mimeType = mime.lookup(pathMedia) || "";
  const ext = path.extname(pathMedia || fileName || "").toLowerCase();

  try {
    let options: AnyMessageContent;

    if (looksLikeAudioContainer(ext, mimeType)) {
      const converted = await processAudioToM4A(pathMedia, companyId || "0");
      const seconds = await getAudioDurationSeconds(converted);
      options = {
        audio: fs.readFileSync(converted),
        mimetype: "audio/mp4",
        ptt: true,
        seconds
      };
      // opcional: apagar o convertido se não quiser manter
      // unlinkSync(converted);
    } else if (mimeType.startsWith("video/")) {
      options = {
        video: fs.readFileSync(pathMedia),
        caption: body || undefined,
        fileName
      };
    } else if (
      mimeType.startsWith("application/") ||
      mimeType.startsWith("text/") ||
      mimeType === "application/pdf"
    ) {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: body || undefined,
        fileName,
        mimetype: mimeType
      };
    } else {
      // imagem (png/jpg/webp/gif…)
      options = {
        image: fs.readFileSync(pathMedia),
        caption: body || undefined
      };
    }

    return options;
  } catch (e) {
    Sentry.captureException(e);
    console.log(e);
    return null;
  }
};

const SendWhatsAppMedia = async ({
  media,
  ticket,
  body = "",
  quotedMsg,
  isPrivate = false,
  isForwarded = false,
  hiddenMentionAll = false,
  isSticker = false
}: Request): Promise<WAMessage> => {
  try {
    const wbot = await getWbot(ticket.whatsappId);
    const companyId = ticket.companyId.toString();

    const pathMedia = media.path;
    const mimeType = media.mimetype || "";
    const ext = path.extname(media.originalname || pathMedia || "").toLowerCase();
    let options: AnyMessageContent;
    const bodyMedia = ticket ? formatBody(body, ticket) : body;

    if (isSticker) {
      // Figurinhas não têm legenda no WhatsApp
      options = {
        sticker: fs.readFileSync(pathMedia),
        contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded }
      };
    } else if (looksLikeAudioContainer(ext, mimeType)) {
      // Mantém o mesmo AAC/M4A já compatível com iOS no canal WuzAPI.
      const converted = await processAudioToM4A(pathMedia, companyId);
      const seconds = await getAudioDurationSeconds(converted);
      options = {
        audio: fs.readFileSync(converted),
        mimetype: "audio/mp4",
        ptt: true,
        seconds,
        // caption em PTT geralmente não aparece; opcional manter fora
        contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded }
      };
      // limpa arquivo convertido
      unlinkSync(converted);
    } else if (mimeType.startsWith("video/")) {
      options = {
        video: fs.readFileSync(pathMedia),
        caption: bodyMedia || undefined,
        fileName: media.originalname.replace("/", "-"),
        contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded }
      };
    } else if (
      mimeType.startsWith("application/") ||
      mimeType.startsWith("text/") ||
      mimeType === "application/pdf"
    ) {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: bodyMedia || undefined,
        fileName: media.originalname.replace("/", "-"),
        mimetype: mimeType,
        contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded }
      };
    } else {
      // imagem
      if (mimeType.includes("gif")) {
        options = {
          image: fs.readFileSync(pathMedia),
          caption: bodyMedia || undefined,
          mimetype: "image/gif",
          gifPlayback: true,
          contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded }
        };
      } else {
        options = {
          image: fs.readFileSync(pathMedia),
          caption: bodyMedia || undefined,
          contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded }
        };
      }
    }

    // Apenas registrar no banco (mensagem privada)
if (isPrivate === true) {
  const baseType = isSticker ? "sticker" : media.mimetype?.split("/")[0] ?? "document";

  const messageData = {
    wid: `PVT${companyId}${ticket.id}${(body || "").substring(0, 6)}`,
    ticketId: ticket.id,
    contactId: undefined,
    body: bodyMedia,
    fromMe: true,
    mediaUrl: media.filename,
    mediaType: baseType,
    read: true,
    quotedMsgId: null,
    ack: 1,
    remoteJid: null,
    participant: null,
    dataJson: null,
    ticketTrakingId: null,
    isPrivate
  };

  await CreateMessageService({ messageData, companyId: ticket.companyId });

  // Retorna um stub apenas para satisfazer a assinatura (quem chama não usa esse retorno)
  return {} as unknown as WAMessage;
}


    // Descobre o JID do contato
    const contactNumber = await Contact.findByPk(ticket.contactId);
    const number = resolveContactTargetJid({
      contact: contactNumber,
      ticket,
      wbot
    });
    if (!number) {
      throw new AppError("ERR_WAPP_INVALID_CONTACT", 400);
    }

    const sendOptions: any = await buildQuotedOptions(
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
        sendOptions.mentionedJid = mentionedJid;
        sendOptions.nonJidMentions = 1;
      }
    }

    const mentions = Array.isArray(sendOptions?.mentionedJid)
      ? sendOptions.mentionedJid
      : [];
    const mentionAll = hiddenMentionAll && ticket.isGroup;
    const baseContextInfo = {
      ...(options as any)?.contextInfo,
      ...(mentions.length > 0 ? { mentionedJid: mentions } : {}),
      ...(mentionAll ? { nonJidMentions: 1 } : {})
    };
    const payloadWithMentions = {
      ...options,
      mentions,
      mentionAll,
      contextInfo: baseContextInfo
    };

    // Envia
    const sentMessage = await wbot.sendMessage(number, payloadWithMentions, sendOptions);

    const isAudioMedia = looksLikeAudioContainer(ext, mimeType);
    const normalizedBody = String(bodyMedia || "").trim();
    const normalizedOriginalName = String(
      media.originalname || media.filename || ""
    ).trim();
    const isDocumentMedia =
      mimeType.startsWith("application/") ||
      mimeType.startsWith("text/") ||
      mimeType === "application/pdf";

    const summaryMessage = normalizedBody
      ? normalizedBody
      : isSticker
      ? "Figurinha"
      : isAudioMedia
      ? "Áudio"
      : mimeType.startsWith("video/")
      ? "Vídeo"
      : isDocumentMedia
      ? normalizedOriginalName
        ? `Documento: ${normalizedOriginalName}`
        : "Documento"
      : mimeType.startsWith("image/") || mimeType.includes("gif")
      ? "Imagem"
      : normalizedOriginalName || "Mídia";

    await ticket.update({
      lastMessage: summaryMessage,
      imported: null
    });

    return sentMessage;
  } catch (err) {
    console.log(`ERRO AO ENVIAR MIDIA ${ticket.id} media ${media.originalname}`);
    Sentry.captureException(err);
    console.log(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMedia;
