import { Op } from "sequelize";
import { createHash } from "crypto";
import cacheLayer from "../../libs/cache";
import CompaniesSettings from "../../models/CompaniesSettings";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import Tag from "../../models/Tag";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import WhatsappQueue from "../../models/WhatsappQueue";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import { getIO } from "../../libs/socket";
import { tryGetWbot, upsertWbotSession } from "../../libs/wbot";
import logger from "../../utils/logger";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import { IOpenAi } from "../../@types/openai";
import { handleOpenAi } from "../IntegrationsServices/OpenAiService";
import CreateMessageService from "../MessageServices/CreateMessageService";
import ShowPromptService from "../PromptServices/ShowPromptService";
import ShowQueueIntegrationService from "../QueueIntegrationServices/ShowQueueIntegrationService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import HandleNpsReplyService from "../TicketServices/HandleNpsReplyService";
import VerifyCurrentSchedule from "../CompanyService/VerifyCurrentSchedule";
import {
  handleMessageIntegration,
  verifyQueue
} from "../WbotServices/wbotMessageListener";
import { ActionsWebhookService } from "../WebhookService/ActionsWebhookService";
import importWuzapiHistoryService from "./ImportWuzapiHistoryService";
import {
  createWuzapiSessionAdapter,
  resolveWuzapiAvatarUrlByCandidates,
  syncWuzapiRuntimeWebhookSubscription,
  wuzapiRequest
} from "./wuzapiClient";
import {
  extractInteractiveMessageBody,
  extractInteractiveCard
} from "./wuzapiInteractive";
import { extractWuzapiMedia, persistWuzapiMedia } from "./wuzapiMedia";
import formatBody from "../../helpers/Mustache";


const normalizeDigits = (value: string): string =>
  String(value || "")
    .split("@")[0]
    .split(":")[0]
    .replace(/\D/g, "");

const isPhoneDomainJid = (value: string): boolean => {
  const normalized = normalizeJid(String(value || ""));
  return (
    normalized.endsWith("@s.whatsapp.net") ||
    normalized.endsWith("@c.us")
  );
};

const isLidJid = (value: string): boolean =>
  normalizeJid(String(value || "")).endsWith("@lid");

const WUZAPI_DEBUG_FROMME = ["1", "true", "yes", "on"].includes(
  String(process.env.WUZAPI_DEBUG_FROMME || "").trim().toLowerCase()
);
const WUZAPI_DEBUG_TYPING = ["1", "true", "yes", "on"].includes(
  String(process.env.WUZAPI_DEBUG_TYPING || "true").trim().toLowerCase()
);

const FLOW_NODE_TYPES_EXPECTING_INPUT = new Set([
  "menu",
  "question",
  "openai",
  "typebot"
]);

const resolveDirectPhone = ({
  isFromMe,
  accountDigits,
  candidates
}: {
  isFromMe: boolean;
  accountDigits: string;
  candidates: Array<string | null | undefined>;
}): string => {
  const ranked = candidates
    .map(value => String(value || "").trim())
    .filter(Boolean);

  for (const candidate of ranked) {
    if (isLidJid(candidate)) continue;
    if (!isPhoneDomainJid(candidate)) continue;
    const digits = normalizeDigits(candidate);
    if (!digits) continue;
    if (isFromMe && accountDigits && digits === accountDigits) continue;
    return digits;
  }

  for (const candidate of ranked) {
    if (isLidJid(candidate)) continue;
    const digits = normalizeDigits(candidate);
    if (!digits) continue;
    if (isFromMe && accountDigits && digits === accountDigits) continue;

    const hasAt = candidate.includes("@");
    if (hasAt && !isPhoneDomainJid(candidate)) continue;
    if (!hasAt) {
      const looksLikeRawPhone = /^[+\d\s().-]+$/.test(candidate);
      if (!looksLikeRawPhone) continue;
    }

    if (digits.length < 10 || digits.length > 15) continue;
    return digits;
  }

  return "";
};

const extractOutboundTargetCandidates = (
  info: any,
  event: any,
  body: any,
  messageCandidate: any
): string[] => {
  const candidates = [
    info?.Receiver,
    info?.receiver,
    info?.Recipient,
    info?.recipient,
    info?.RecipientAlt,
    info?.recipientAlt,
    info?.To,
    info?.to,
    info?.Phone,
    info?.phone,
    info?.DeviceSentMeta?.DestinationJID,
    info?.deviceSentMeta?.destinationJid,
    info?.deviceSentMeta?.destinationJID,
    event?.Receiver,
    event?.receiver,
    event?.Recipient,
    event?.recipient,
    event?.RecipientAlt,
    event?.recipientAlt,
    event?.To,
    event?.to,
    event?.Phone,
    event?.phone,
    event?.Info?.RecipientAlt,
    event?.Info?.recipientAlt,
    event?.Message?.deviceSentMessage?.destinationJID,
    event?.message?.deviceSentMessage?.destinationJID,
    event?.RawMessage?.deviceSentMessage?.destinationJID,
    event?.rawMessage?.deviceSentMessage?.destinationJID,
    body?.receiver,
    body?.recipient,
    body?.recipientAlt,
    body?.to,
    body?.phone,
    body?.chat_jid,
    body?.chatJid,
    body?.event?.Info?.RecipientAlt,
    body?.event?.Info?.recipientAlt,
    body?.event?.Message?.deviceSentMessage?.destinationJID,
    body?.event?.message?.deviceSentMessage?.destinationJID,
    body?.event?.RawMessage?.deviceSentMessage?.destinationJID,
    body?.event?.rawMessage?.deviceSentMessage?.destinationJID,
    messageCandidate?.key?.remoteJid,
    messageCandidate?.key?.participant,
    messageCandidate?.deviceSentMessage?.destinationJID,
    messageCandidate?.message?.deviceSentMessage?.destinationJID,
    messageCandidate?.Message?.deviceSentMessage?.destinationJID
  ];

  return Array.from(
    new Set(
      candidates
        .map(value => String(value || "").trim())
        .filter(Boolean)
    )
  );
};

const ACTIVE_TICKET_STATUSES = ["open", "pending", "group", "nps", "lgpd"];

const normalizeGroupNumber = (value: string): string => {
  const normalizedJid = normalizeJid(String(value || ""));
  if (!isGroupJid(normalizedJid)) return "";
  return String(normalizedJid || "")
    .split("@")[0]
    .split(":")[0]
    .replace(/[^\d-]/g, "");
};
const GROUP_NAME_CACHE_TTL_MS = 10 * 60 * 1000;
const groupNameCache = new Map<string, { name: string; expiresAt: number }>();

const isGroupJid = (value: string): boolean =>
  String(value || "")
    .toLowerCase()
    .endsWith("@g.us");

const isBroadcastJid = (value: string): boolean => {
  const jid = String(value || "").trim().toLowerCase();
  if (!jid) return false;
  if (jid === "status@broadcast") return true;
  return jid.endsWith("@broadcast");
};

const normalizeJid = (value: string): string => {
  const raw = String(value || "").trim();
  if (!raw || !raw.includes("@")) return raw;
  const [left, ...domainParts] = raw.split("@");
  const domainRaw = domainParts.join("@");
  const primaryId = (left || "").split(":")[0] || left || "";
  const cleanDomain = String(domainRaw || "")
    .toLowerCase()
    .split(":")[0]
    .split("/")[0]
    .trim();
  if (!cleanDomain) return primaryId;
  return `${primaryId}@${cleanDomain}`;
};

const resolveCallRemoteJid = (
  body: any,
  event: any,
  info: any,
  whatsapp: Whatsapp
): string => {
  const accountDigits = normalizeDigits(String((whatsapp as any)?.number || ""));
  const instanceDigits = normalizeDigits(
    String(
      body?.instanceName || body?.instance || body?.InstanceName || body?.Instance || ""
    )
  );
  const ownDigits = new Set(
    [accountDigits, instanceDigits].map(value => String(value || "").trim()).filter(Boolean)
  );
  const candidates = [
    info?.Chat,
    info?.chat,
    info?.Peer,
    info?.peer,
    info?.From,
    info?.from,
    info?.Sender,
    info?.sender,
    info?.MessageSource?.Chat,
    info?.messageSource?.chat,
    info?.MessageSource?.Sender,
    info?.messageSource?.sender,
    event?.Chat,
    event?.chat,
    event?.Peer,
    event?.peer,
    event?.From,
    event?.from,
    event?.FromJID,
    event?.fromJid,
    event?.CallFrom,
    event?.callFrom,
    event?.Caller,
    event?.caller,
    event?.Creator,
    event?.creator,
    event?.Sender,
    event?.sender,
    event?.MessageSource?.Chat,
    event?.messageSource?.chat,
    event?.MessageSource?.Sender,
    event?.messageSource?.sender,
    body?.call_from,
    body?.callFrom,
    body?.data?.call_from,
    body?.data?.callFrom,
    body?.Data?.call_from,
    body?.Data?.callFrom,
    body?.data?.sender,
    body?.Data?.sender,
    body?.data?.chat,
    body?.Data?.chat,
    body?.from,
    body?.sender,
    body?.peer
  ];

  for (const candidateRaw of candidates) {
    const candidate = String(candidateRaw || "").trim();
    if (!candidate) continue;
    const candidateLower = candidate.toLowerCase();
    if (candidateLower.includes("@call")) continue;
    if (isBroadcastJid(candidate) || isGroupJid(candidate) || isLidJid(candidate)) continue;

    if (candidate.includes("@")) {
      const jid = normalizeJid(candidate);
      const digits = normalizeDigits(jid);
      if (!digits) continue;
      if (ownDigits.has(digits)) continue;
      if (digits.length < 10 || digits.length > 15) continue;
      return jid;
    }

    const digits = normalizeDigits(candidate);
    if (!digits) continue;
    if (ownDigits.has(digits)) continue;
    if (digits.length < 10 || digits.length > 15) continue;
    return `${digits}@s.whatsapp.net`;
  }

  const scanSources = [body, event, info];
  for (const source of scanSources) {
    try {
      const serialized = JSON.stringify(source || {});
      const jidMatches = serialized.match(/\d{10,15}@(?:s\.whatsapp\.net|c\.us)/gi) || [];
      for (const jidRaw of jidMatches) {
        const jid = normalizeJid(jidRaw);
        const digits = normalizeDigits(jid);
        if (!digits || ownDigits.has(digits)) continue;
        return jid;
      }
    } catch {
      // noop
    }
  }

  return "";
};

const resolveCallId = (body: any, event: any, info: any): string =>
  firstNonEmpty(
    event?.CallID,
    event?.callId,
    event?.call_id,
    event?.ID,
    event?.id,
    info?.CallID,
    info?.callId,
    info?.call_id,
    body?.call_id,
    body?.callId,
    body?.data?.call_id,
    body?.data?.callId,
    body?.Data?.call_id,
    body?.Data?.callId,
    body?.id
  );

const buildWuzapiCallCacheKey = (whatsappId: number, callId: string): string =>
  `wuzapi:call-pending:${whatsappId}:${String(callId || "").trim()}`;

const buildWuzapiCallLastCacheKey = (whatsappId: number): string =>
  `wuzapi:call-pending:last:${whatsappId}`;

const buildWuzapiCallEndDedupeKey = ({
  whatsappId,
  callId,
  remoteJid,
  body,
  event,
  info
}: {
  whatsappId: number;
  callId: string;
  remoteJid: string;
  body: any;
  event: any;
  info: any;
}): string => {
  if (callId) return `wuzapi:call-end:dedupe:${whatsappId}:${callId}`;

  const tsRaw =
    Number(event?.Timestamp || event?.timestamp || body?.timestamp || info?.Timestamp || 0) ||
    Math.floor(Date.now() / 1000);
  const tsBucket = Math.floor(tsRaw / 30);
  const remoteToken = normalizeDigits(remoteJid) || normalizeJid(remoteJid) || "unknown";
  return `wuzapi:call-end:dedupe:${whatsappId}:${remoteToken}:${tsBucket}`;
};

const cachePendingCall = async ({
  whatsappId,
  callId,
  remoteJid
}: {
  whatsappId: number;
  callId: string;
  remoteJid: string;
}): Promise<void> => {
  const payload = JSON.stringify({ remoteJid, callId, at: Date.now() });
  const redis = cacheLayer.getRedisInstance();
  const ttlSeconds = 15 * 60;

  try {
    await redis.set(buildWuzapiCallLastCacheKey(whatsappId), payload, "EX", ttlSeconds);
    if (callId) {
      await redis.set(buildWuzapiCallCacheKey(whatsappId, callId), payload, "EX", ttlSeconds);
    }
  } catch {
    // best-effort
  }
};

const recoverPendingCallRemoteJid = async ({
  whatsappId,
  callId
}: {
  whatsappId: number;
  callId: string;
}): Promise<string> => {
  const redis = cacheLayer.getRedisInstance();
  const keys = [
    callId ? buildWuzapiCallCacheKey(whatsappId, callId) : "",
    buildWuzapiCallLastCacheKey(whatsappId)
  ].filter(Boolean);

  for (const key of keys) {
    try {
      const raw = await redis.get(key);
      if (!raw) continue;
      const parsed = JSON.parse(String(raw || "{}"));
      const jid = normalizeJid(String(parsed?.remoteJid || "").trim());
      if (jid) return jid;
    } catch {
      // ignore and continue
    }
  }

  return "";
};

const parseLidJid = (
  peerId?: string
): { lid: string | null; jid: string | null } => {
  const normalized = normalizeJid(String(peerId || "").trim().toLowerCase());
  if (!normalized) return { lid: null, jid: null };

  if (normalized.endsWith("@lid")) {
    return { lid: normalized, jid: null };
  }

  if (
    normalized.endsWith("@s.whatsapp.net") ||
    normalized.endsWith("@c.us") ||
    normalized.endsWith("@g.us")
  ) {
    return { lid: null, jid: normalized };
  }

  if (!normalized.includes("@")) {
    return { lid: null, jid: `${normalized}@s.whatsapp.net` };
  }

  return { lid: null, jid: normalized };
};

const mergeLidJidCandidates = (
  ...candidates: Array<string | null | undefined>
): { lid: string | null; jid: string | null } => {
  let lid: string | null = null;
  let jid: string | null = null;

  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = parseLidJid(candidate);
    if (!lid && parsed.lid) lid = parsed.lid;
    if (!jid && parsed.jid) jid = parsed.jid;
    if (lid && jid) break;
  }

  return { lid, jid };
};

const resolveIsFromMe = (
  info: any,
  event: any,
  body: any,
  whatsapp: Whatsapp,
  senderJid: string,
  senderAltJid: string,
  chatJid: string
): boolean => {
  const fromInfo = info?.IsFromMe ?? info?.isFromMe ?? info?.FromMe;
  if (typeof fromInfo === "boolean") return fromInfo;

  const fromEvent =
    event?.fromMe ??
    event?.from_me ??
    event?.isFromMe ??
    event?.IsFromMe ??
    body?.fromMe ??
    body?.from_me ??
    body?.isFromMe ??
    body?.IsFromMe;
  if (typeof fromEvent === "boolean") return fromEvent;

  const senderCandidates = [senderJid, senderAltJid, chatJid].map((value) =>
    normalizeJid(value || "")
  );
  if (senderCandidates.some((value) => String(value || "").toLowerCase() === "me")) {
    return true;
  }

  const accountDigits = normalizeDigits(String(whatsapp.number || ""));
  if (!accountDigits) return false;

  const accountJid = normalizeJid(`${accountDigits}@s.whatsapp.net`);
  return senderCandidates.some((candidate) => {
    if (!candidate) return false;
    const candidateDigits = normalizeDigits(candidate);
    return candidateDigits === accountDigits || candidate === accountJid;
  });
};

const parsePayload = (body: any): any => {
  if (body && typeof body === "object" && body.jsonData) {
    try {
      const parsed = JSON.parse(String(body.jsonData));
      return {
        ...parsed,
        instanceName: body.instanceName || parsed.instanceName,
        userID: body.userID || parsed.userID
      };
    } catch {
      return body;
    }
  }
  return body;
};

const resolveEventType = (body: any): string => {
  const eventLiteral =
    typeof body?.event === "string"
      ? body.event
      : typeof body?.Event === "string"
      ? body.Event
      : "";

  const nestedEventLiteral =
    typeof body?.data?.event === "string"
      ? body.data.event
      : typeof body?.Data?.event === "string"
      ? body.Data.event
      : typeof body?.data?.Event === "string"
      ? body.data.Event
      : typeof body?.Data?.Event === "string"
      ? body.Data.Event
      : "";

  return String(
    body?.type ||
      body?.Type ||
      body?.eventType ||
      body?.EventType ||
      eventLiteral ||
      nestedEventLiteral ||
      body?.data?.type ||
      body?.data?.Type ||
      body?.data?.eventType ||
      body?.data?.EventType ||
      body?.Data?.type ||
      body?.Data?.Type ||
      body?.Data?.eventType ||
      body?.Data?.EventType ||
      ""
  ).trim();
};

const resolveEventPayload = (body: any): any => {
  if (body?.event && typeof body.event === "object") return body.event;
  if (body?.Event && typeof body.Event === "object") return body.Event;
  if (body?.data && typeof body.data === "object") return body.data;
  if (body?.Data && typeof body.Data === "object") return body.Data;
  return {};
};

const extractWhatsappIdFromInstanceName = (instanceName: string): number | null => {
  const match = String(instanceName || "").match(/^wpp-(\d+)-(\d+)$/i);
  if (!match) return null;
  const id = Number(match[2]);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const extractMessagePayload = (event: any): any => {
  const candidates = [
    event?.Message,
    event?.message,
    event?.RawMessage,
    event?.rawMessage,
    event?.Data,
    event?.data,
    event?.event?.Message,
    event?.event?.message,
    event?.event?.RawMessage,
    event?.event?.rawMessage,
    event?.event?.Data,
    event?.event?.data,
    event?.Event?.Message,
    event?.Event?.message,
    event?.Event?.RawMessage,
    event?.Event?.rawMessage,
    event?.Event?.Data,
    event?.Event?.data,
    event
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate?.message) return candidate.message;
    if (candidate?.Message) return candidate.Message;
    if (candidate?.rawMessage?.message) return candidate.rawMessage.message;
    if (candidate?.RawMessage?.message) return candidate.RawMessage.message;
    if (candidate?.data?.message) return candidate.data.message;
    if (candidate?.Data?.message) return candidate.Data.message;
    return candidate;
  }

  return {};
};

const unwrapMessagePayload = (payload: any): any => {
  let current = payload;

  for (let i = 0; i < 6; i += 1) {
    if (!current || typeof current !== "object") break;

    const next =
      current?.deviceSentMessage?.message ||
      current?.ephemeralMessage?.message ||
      current?.viewOnceMessage?.message ||
      current?.viewOnceMessageV2?.message ||
      current?.viewOnceMessageV2Extension?.message ||
      current?.documentWithCaptionMessage?.message ||
      current?.editedMessage?.message ||
      current?.message ||
      current?.Message;

    if (!next || next === current) break;
    current = next;
  }

  return current || payload;
};

const firstNonEmpty = (...candidates: any[]): string => {
  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }
  return "";
};

const collectMessageContextInfoCandidates = (
  messagePayload: any,
  event: any,
  body: any
): any[] =>
  [
    messagePayload?.extendedTextMessage?.contextInfo,
    messagePayload?.imageMessage?.contextInfo,
    messagePayload?.videoMessage?.contextInfo,
    messagePayload?.audioMessage?.contextInfo,
    messagePayload?.documentMessage?.contextInfo,
    messagePayload?.stickerMessage?.contextInfo,
    messagePayload?.contactMessage?.contextInfo,
    messagePayload?.locationMessage?.contextInfo,
    messagePayload?.buttonsResponseMessage?.contextInfo,
    messagePayload?.listResponseMessage?.contextInfo,
    messagePayload?.messageContextInfo,
    event?.Message?.extendedTextMessage?.contextInfo,
    event?.message?.extendedTextMessage?.contextInfo,
    event?.extendedTextMessage?.contextInfo,
    event?.messageContextInfo,
    body?.Message?.extendedTextMessage?.contextInfo,
    body?.message?.extendedTextMessage?.contextInfo,
    body?.extendedTextMessage?.contextInfo,
    body?.messageContextInfo,
    body?.contextInfo,
    messagePayload?.contextInfo,
    event?.contextInfo
  ].filter(Boolean);

const extractTextCaptionFallback = (messagePayload: any, event: any, body: any): string =>
  firstNonEmpty(
    messagePayload?.conversation,
    messagePayload?.extendedTextMessage?.text,
    messagePayload?.imageMessage?.caption,
    messagePayload?.videoMessage?.caption,
    messagePayload?.documentMessage?.caption,
    messagePayload?.documentWithCaptionMessage?.message?.documentMessage?.caption,
    event?.Body,
    event?.body,
    messagePayload?.text,
    messagePayload?.caption,
    body?.Body,
    body?.body,
    body?.text,
    body?.caption
  );

const sanitizeAdFragment = (value: any): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object") return undefined;

  const sanitized: Record<string, unknown> = {};
  const assign = (key: string, candidate: any) => {
    if (candidate === undefined || candidate === null) return;

    if (typeof candidate === "string") {
      const normalized = candidate.trim();
      if (normalized) sanitized[key] = normalized;
      return;
    }

    if (typeof candidate === "number" || typeof candidate === "boolean") {
      sanitized[key] = candidate;
    }
  };

  assign("title", value?.title);
  assign("body", value?.body);
  assign("sourceUrl", value?.sourceUrl || value?.source_url || value?.url);
  assign("sourceType", value?.sourceType || value?.source_type);
  assign("sourceId", value?.sourceId || value?.source_id);
  assign("headline", value?.headline);
  assign("mediaType", value?.mediaType || value?.media_type);
  assign("thumbnailUrl", value?.thumbnailUrl || value?.thumbnail_url);
  assign("thumbnail", value?.thumbnail);
  assign("mediaUrl", value?.mediaUrl || value?.media_url);
  assign("showAdAttribution", value?.showAdAttribution);
  assign("renderLargerThumbnail", value?.renderLargerThumbnail);

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

const extractWuzapiAdMetadata = (messagePayload: any, event: any, body: any) => {
  const contextCandidates = collectMessageContextInfoCandidates(messagePayload, event, body);

  // Um mesmo webhook pode trazer o contexto de anúncio espalhado em vários
  // candidatos (um com externalAdReply, outro com referral). Consolidamos os
  // campos de todos os candidatos para não perder, por exemplo, a sourceUrl.
  let mergedExternalAdReply: Record<string, unknown> | undefined;
  let mergedReferral: Record<string, unknown> | undefined;
  let ctwaClidPresent = false;

  const mergeFragment = (
    base: Record<string, unknown> | undefined,
    incoming: Record<string, unknown> | undefined
  ): Record<string, unknown> | undefined => {
    if (!incoming) return base;
    if (!base) return { ...incoming };
    const result = { ...base };
    for (const [key, value] of Object.entries(incoming)) {
      if (result[key] === undefined || result[key] === null || result[key] === "") {
        result[key] = value;
      }
    }
    return result;
  };

  for (const contextInfo of contextCandidates) {
    mergedExternalAdReply = mergeFragment(
      mergedExternalAdReply,
      sanitizeAdFragment(contextInfo?.externalAdReply)
    );
    mergedReferral = mergeFragment(
      mergedReferral,
      sanitizeAdFragment(contextInfo?.referral)
    );
    if (firstNonEmpty(contextInfo?.ctwaClid, contextInfo?.ctwaCLID)) {
      ctwaClidPresent = true;
    }
  }

  const hasAdContext = Boolean(
    mergedExternalAdReply || mergedReferral || ctwaClidPresent
  );

  return {
    hasAdContext,
    isClickToWhatsapp: hasAdContext,
    externalAdReply: mergedExternalAdReply,
    referral: mergedReferral,
    ctwaClidPresent
  };
};

const buildWuzapiCtwaFallbackBody = (adMetadata: {
  externalAdReply?: Record<string, unknown>;
  referral?: Record<string, unknown>;
}): string => {
  const adTitle = firstNonEmpty(
    adMetadata?.externalAdReply?.title,
    adMetadata?.referral?.headline,
    adMetadata?.referral?.title
  );

  if (adTitle) {
    return `[CTWA] Mensagem recebida via anúncio Click to WhatsApp.\nAnúncio: ${adTitle}`;
  }

  return "[CTWA] Mensagem recebida via anúncio Click to WhatsApp.";
};

// Monta o corpo no formato consumido pelo componente AdMetaPreview do frontend
// (image | sourceUrl | title | body), espelhando o comportamento do Baileys
// para que o card de pré-visualização de anúncio também apareça no WuzAPI.
const buildWuzapiAdMetaPreviewBody = (adMetadata: {
  externalAdReply?: Record<string, unknown>;
  referral?: Record<string, unknown>;
}): string => {
  const ad = adMetadata?.externalAdReply || {};
  const ref = adMetadata?.referral || {};

  const sanitizePart = (value: unknown): string =>
    String(value || "")
      .replace(/[\r\n]+/g, " ")
      .replace(/\|/g, "/")
      .trim();

  const normalizeUrl = (value: unknown): string => {
    const raw = sanitizePart(value);
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(raw)) return `https://${raw}`;
    return "";
  };

  const sourceUrl = normalizeUrl(
    firstNonEmpty(
      ad?.sourceUrl,
      ad?.source_url,
      ad?.url,
      ad?.mediaUrl,
      ref?.sourceUrl,
      ref?.source_url,
      ref?.url
    )
  );
  const title = sanitizePart(firstNonEmpty(ad?.title, ref?.headline, ref?.title));
  const bodyText = sanitizePart(firstNonEmpty(ad?.body, ref?.body));

  const rawThumb = firstNonEmpty(ad?.thumbnail, ref?.thumbnail);
  const thumbUrl = firstNonEmpty(
    ad?.thumbnailUrl,
    ad?.mediaUrl,
    ref?.thumbnailUrl,
    ref?.mediaUrl
  );

  let image = "";
  if (rawThumb) {
    const thumbStr = String(rawThumb).trim();
    image = thumbStr.startsWith("data:")
      ? thumbStr
      : `data:image/png;base64, ${thumbStr}`;
  } else if (thumbUrl) {
    image = String(thumbUrl).trim();
  }

  // Sempre renderiza o card quando há qualquer conteúdo de anúncio, espelhando
  // o Baileys. Se não vier sourceUrl, o botão "Visualizar" fica sem destino
  // (desabilitado no frontend), mas o card continua aparecendo.
  if (!image && !sourceUrl && !title && !bodyText) return "";

  return [image, sourceUrl, title, bodyText]
    .map(part => String(part || "").trim())
    .join(" | ");
};

const extractMessageIdFromWebhook = (body: any, event: any, info: any, messagePayload: any): string =>
  firstNonEmpty(
    info?.ID,
    info?.id,
    info?.MessageID,
    info?.messageId,
    event?.ID,
    event?.id,
    event?.MessageID,
    event?.messageId,
    body?.ID,
    body?.id,
    body?.MessageID,
    body?.messageId,
    messagePayload?.key?.id,
    messagePayload?.key?.ID,
    messagePayload?.id,
    messagePayload?.ID,
    messagePayload?.messageId,
    messagePayload?.MessageID,
    messagePayload?.messageContextInfo?.stanzaId
  );

const extractMessageTimestampFromWebhook = (body: any, event: any, info: any, messagePayload: any): string =>
  firstNonEmpty(
    info?.Timestamp,
    info?.timestamp,
    event?.Timestamp,
    event?.timestamp,
    body?.Timestamp,
    body?.timestamp,
    messagePayload?.messageTimestamp,
    messagePayload?.timestamp
  );

const buildAvatarLookupCandidates = (...values: Array<string | null | undefined>): string[] => {
  const result: string[] = [];

  for (const value of values) {
    const raw = String(value || "").trim();
    if (!raw) continue;

    const normalizedJid = normalizeJid(raw);
    if (normalizedJid.includes("@")) {
      if (normalizedJid.endsWith("@lid")) continue;
      if (normalizedJid.endsWith("@g.us")) {
        result.push(normalizedJid);
        const groupNumber = normalizeGroupNumber(normalizedJid);
        if (groupNumber) result.push(groupNumber);
        continue;
      }
      if (
        normalizedJid.endsWith("@s.whatsapp.net") ||
        normalizedJid.endsWith("@c.us")
      ) {
        result.push(normalizedJid);
        const phone = normalizeDigits(normalizedJid);
        if (phone) result.push(phone);
        continue;
      }
    }

    const phone = normalizeDigits(raw);
    if (phone) result.push(phone);
  }

  return Array.from(new Set(result));
};

const resolveWuzapiAvatarUrl = async (
  whatsapp: Whatsapp,
  ...phoneOrJids: Array<string | null | undefined>
): Promise<string> => {
  const candidates = buildAvatarLookupCandidates(...phoneOrJids);
  if (!candidates.length) return "";
  return resolveWuzapiAvatarUrlByCandidates(whatsapp, candidates);
};

const extractPollBody = (pollNode: any): string => {
  if (!pollNode || typeof pollNode !== "object") return "";

  const title = String(pollNode?.name || pollNode?.title || "").trim();
  const optionsRaw = Array.isArray(pollNode?.options)
    ? pollNode.options
    : Array.isArray(pollNode?.Options)
      ? pollNode.Options
      : [];
  const options = optionsRaw
    .map((option: any) =>
      String(option?.optionName || option?.OptionName || option?.name || option || "").trim()
    )
    .filter(Boolean);

  const lines: string[] = ["*Enquete*"];
  if (title) lines.push(title);
  if (options.length > 0) lines.push("", ...options.map(option => `- ${option}`));
  return lines.join("\n").trim();
};

const extractEventBody = (eventNode: any): string => {
  if (!eventNode || typeof eventNode !== "object") return "";

  const title = String(eventNode?.name || eventNode?.title || "").trim();
  const description = String(eventNode?.description || eventNode?.desc || "").trim();
  const location = String(eventNode?.location?.name || eventNode?.location || "").trim();
  const startTs = Number(
    eventNode?.startTime ||
      eventNode?.startTimestamp ||
      eventNode?.start_time ||
      eventNode?.timestamp ||
      0
  );

  const lines: string[] = ["*Evento*"];
  if (title) lines.push(`Nome: ${title}`);
  if (description) lines.push(`Descrição: ${description}`);
  if (location) lines.push(`Local: ${location}`);
  if (Number.isFinite(startTs) && startTs > 0) {
    const date = new Date(startTs * 1000);
    if (!Number.isNaN(date.getTime())) {
      lines.push(`Data: ${date.toLocaleString("pt-BR")}`);
    }
  }

  return lines.join("\n").trim();
};

const extractLocationBody = (locationNode: any): string => {
  if (!locationNode || typeof locationNode !== "object") return ":location:";

  const name = String(locationNode?.name || "").trim();
  const address = String(locationNode?.address || "").trim();
  const lat = Number(locationNode?.degreesLatitude);
  const lng = Number(locationNode?.degreesLongitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const mapLink = hasCoords ? `https://maps.google.com/maps?q=${lat}%2C${lng}&z=17` : "";

  const lines = [name, address, mapLink].map(value => String(value || "").trim()).filter(Boolean);
  if (lines.length) return lines.join("\n");

  return ":location:";
};

const extractMessageBody = (messagePayload: any): { body: string; mediaType?: string } => {
  const payload = unwrapMessagePayload(messagePayload);

  const interactiveBody = extractInteractiveMessageBody(payload);
  if (interactiveBody) {
    const mediaType =
      payload?.interactiveResponseMessage
        ? "interactiveResponseMessage"
        : payload?.buttonsResponseMessage
          ? "buttonsResponseMessage"
          : payload?.listResponseMessage
            ? "listResponseMessage"
            : payload?.templateButtonReplyMessage
              ? "templateButtonReplyMessage"
              : payload?.interactiveMessage
                ? "interactiveMessage"
                : payload?.listMessage
                  ? "listMessage"
                  : payload?.buttonsMessage
                    ? "buttonsMessage"
                    : "interactiveMessage";

    return { body: interactiveBody, mediaType };
  }

  if (payload?.reactionMessage) {
    return {
      body: String(payload?.reactionMessage?.text || "").trim(),
      mediaType: "reactionMessage"
    };
  }

  const media = extractWuzapiMedia(payload);
  if (media) {
    return { body: media.body, mediaType: media.mediaType };
  }

  const conversation = payload?.conversation;
  if (conversation) return { body: String(conversation) };

  const extended = payload?.extendedTextMessage?.text;
  if (extended) return { body: String(extended) };

  const pollBody = extractPollBody(
    payload?.pollCreationMessageV3 ||
      payload?.pollCreationMessage ||
      payload?.pollMessage
  );
  if (pollBody) {
    return {
      body: pollBody,
      mediaType: "pollCreationMessageV3"
    };
  }

  const eventBody = extractEventBody(payload?.eventMessage);
  if (eventBody) {
    return {
      body: eventBody,
      mediaType: "eventMessage"
    };
  }

  if (payload?.contactMessage) {
    const vcard = String(payload?.contactMessage?.vcard || "").trim();
    if (vcard) {
      return {
        body: vcard,
        mediaType: "contactMessage"
      };
    }
    return {
      body: String(payload?.contactMessage?.displayName || ":contact:"),
      mediaType: "contactMessage"
    };
  }

  if (payload?.locationMessage) {
    return {
      body: extractLocationBody(payload?.locationMessage),
      mediaType: "location"
    };
  }

  return { body: "" };
};

const normalizeWuzapiReactionTargetId = (value: string): string => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const withoutMePrefix = raw.startsWith("me:") ? raw.slice(3) : raw;
  const prefixedWidMatch = withoutMePrefix.match(/^wuzapi:[^:]+:(.+)$/i);
  if (prefixedWidMatch?.[1]) return String(prefixedWidMatch[1]).trim();

  return withoutMePrefix;
};

const extractReactionTargetId = (messagePayload: any, event: any, body: any): string =>
  firstNonEmpty(
    messagePayload?.reactionMessage?.key?.id,
    messagePayload?.reactionMessage?.key?.ID,
    messagePayload?.reactionMessage?.keyId,
    messagePayload?.reactionMessage?.stanzaId,
    messagePayload?.messageContextInfo?.stanzaId,
    event?.reactionMessage?.key?.id,
    event?.reactionMessage?.key?.ID,
    event?.reactionMessage?.stanzaId,
    body?.reactionMessage?.key?.id,
    body?.reactionMessage?.key?.ID,
    body?.reactionMessage?.stanzaId
  );

const extractContextStanzaId = (contextInfo: any): string =>
  firstNonEmpty(
    contextInfo?.stanzaId,
    contextInfo?.stanzaID,
    contextInfo?.StanzaId,
    contextInfo?.StanzaID
  );

const parseLooseBoolean = (value: any): boolean | null => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "sim"].includes(normalized)) return true;
    if (["false", "0", "no", "nao", "não"].includes(normalized)) return false;
  }
  return null;
};

const extractContextIsForwarded = (contextInfo: any): boolean | null =>
  parseLooseBoolean(
    firstNonEmpty(
      contextInfo?.isForwarded,
      contextInfo?.IsForwarded,
      contextInfo?.isforwarded,
      contextInfo?.Isforwarded,
      contextInfo?.forwarded,
      contextInfo?.Forwarded
    )
  );

const extractIsForwarded = (messagePayload: any, event: any, body: any): boolean | null => {
  const contextCandidates = collectMessageContextInfoCandidates(messagePayload, event, body);

  for (const contextInfo of contextCandidates) {
    const isForwarded = extractContextIsForwarded(contextInfo);
    if (isForwarded !== null) return isForwarded;
  }

  return parseLooseBoolean(
    firstNonEmpty(
      messagePayload?.isForwarded,
      messagePayload?.IsForwarded,
      event?.isForwarded,
      event?.IsForwarded,
      body?.isForwarded,
      body?.IsForwarded
    )
  );
};

const extractQuotedTargetId = (messagePayload: any, event: any, body: any): string => {
  const contextCandidates = collectMessageContextInfoCandidates(messagePayload, event, body);

  for (const contextInfo of contextCandidates) {
    const stanzaId = extractContextStanzaId(contextInfo);
    if (stanzaId) return stanzaId;
  }

  return firstNonEmpty(
    messagePayload?.quotedMessageID,
    messagePayload?.quotedMessageId,
    messagePayload?.quoted_message_id,
    event?.quotedMessageID,
    event?.quotedMessageId,
    event?.quoted_message_id,
    body?.quotedMessageID,
    body?.quotedMessageId,
    body?.quoted_message_id
  );
};

const isWuzapiEditedMessageEvent = (messagePayload: any, body: any, event: any): boolean => {
  return Boolean(
    messagePayload?.protocolMessage?.editedMessage ||
      messagePayload?.editedMessage?.message?.protocolMessage?.editedMessage ||
      body?.message?.protocolMessage?.editedMessage ||
      body?.protocolMessage?.editedMessage ||
      event?.message?.protocolMessage?.editedMessage
  );
};

const isWuzapiDeletedMessageEvent = (messagePayload: any, body: any, event: any): boolean => {
  const protocolCandidates = [
    messagePayload?.protocolMessage,
    messagePayload?.editedMessage?.message?.protocolMessage,
    body?.message?.protocolMessage,
    body?.protocolMessage,
    event?.message?.protocolMessage,
    event?.protocolMessage
  ].filter(Boolean);

  return protocolCandidates.some((protocolMessage: any) => {
    if (!protocolMessage || protocolMessage?.editedMessage) return false;

    const normalizedType = String(
      protocolMessage?.type ?? protocolMessage?.Type ?? protocolMessage?.protocolType ?? ""
    )
      .trim()
      .toLowerCase();

    if (normalizedType === "0" || normalizedType === "revoke") return true;
    return Boolean(protocolMessage?.key?.id || protocolMessage?.key?.ID);
  });
};

const extractWuzapiEditedTargetId = (messagePayload: any, body: any, event: any): string =>
  normalizeWuzapiReactionTargetId(
    firstNonEmpty(
    messagePayload?.protocolMessage?.key?.id,
    messagePayload?.protocolMessage?.key?.ID,
    messagePayload?.editedMessage?.message?.protocolMessage?.key?.id,
    messagePayload?.editedMessage?.message?.protocolMessage?.key?.ID,
    body?.message?.protocolMessage?.key?.id,
    body?.protocolMessage?.key?.id,
    event?.message?.protocolMessage?.key?.id
    )
  );

const extractWuzapiDeletedTargetId = (messagePayload: any, body: any, event: any): string =>
  normalizeWuzapiReactionTargetId(
    firstNonEmpty(
      messagePayload?.protocolMessage?.key?.id,
      messagePayload?.protocolMessage?.key?.ID,
      messagePayload?.editedMessage?.message?.protocolMessage?.key?.id,
      messagePayload?.editedMessage?.message?.protocolMessage?.key?.ID,
      body?.message?.protocolMessage?.key?.id,
      body?.message?.protocolMessage?.key?.ID,
      body?.protocolMessage?.key?.id,
      body?.protocolMessage?.key?.ID,
      event?.message?.protocolMessage?.key?.id,
      event?.message?.protocolMessage?.key?.ID,
      event?.protocolMessage?.key?.id,
      event?.protocolMessage?.key?.ID
    )
  );

const extractWuzapiEditedBody = (messagePayload: any, body: any, event: any): string => {
  const candidates = [
    messagePayload?.protocolMessage?.editedMessage,
    messagePayload?.editedMessage?.message?.protocolMessage?.editedMessage,
    body?.message?.protocolMessage?.editedMessage,
    body?.protocolMessage?.editedMessage,
    event?.message?.protocolMessage?.editedMessage
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const extracted = extractMessageBody(candidate);
    const value = String(extracted?.body || "").trim();
    if (value) return value;
  }

  return "";
};

const buildQuotedLookupCandidates = (targetId: string, remoteJid: string) => {
  const normalizedTargetId = normalizeWuzapiReactionTargetId(targetId);
  const messageIdCandidates = Array.from(
    new Set(
      [
        String(targetId || "").trim(),
        normalizedTargetId,
        normalizedTargetId ? `me:${normalizedTargetId}` : ""
      ].filter(Boolean)
    )
  );

  const widCandidates = Array.from(
    new Set(
      [
        ...messageIdCandidates,
        ...messageIdCandidates.map(id => `wuzapi:${remoteJid}:${id}`)
      ].filter(Boolean)
    )
  );

  return { messageIdCandidates, widCandidates };
};

const findQuotedMessage = async ({
  companyId,
  ticketId,
  remoteJid,
  targetId
}: {
  companyId: number;
  ticketId: number;
  remoteJid: string;
  targetId: string;
}): Promise<Message | null> => {
  if (!targetId) return null;

  const { messageIdCandidates, widCandidates } = buildQuotedLookupCandidates(
    targetId,
    remoteJid
  );
  const lookupOr: any[] = [];

  if (messageIdCandidates.length > 0) {
    lookupOr.push({
      messageId: {
        [Op.in]: messageIdCandidates
      }
    });
  }
  if (widCandidates.length > 0) {
    lookupOr.push({
      wid: {
        [Op.in]: widCandidates
      }
    });
  }

  if (!lookupOr.length) return null;

  const inTicket = await Message.findOne({
    where: {
      companyId,
      ticketId,
      [Op.or]: lookupOr
    },
    order: [["id", "DESC"]]
  });
  if (inTicket) return inTicket;

  if (!remoteJid) return null;

  return Message.findOne({
    where: {
      companyId,
      remoteJid,
      [Op.or]: lookupOr
    },
    order: [["id", "DESC"]]
  });
};

const getMediaSummaryLabel = (mediaType?: string): string => {
  const normalized = String(mediaType || "").trim().toLowerCase();
  if (!normalized) return "Mídia";
  if (normalized === "audio") return "Áudio";
  if (normalized === "video") return "Vídeo";
  if (normalized === "image") return "Imagem";
  if (normalized === "document") return "Documento";
  if (normalized === "sticker") return "Figurinha";
  if (normalized === "location") return "Localização";
  if (normalized === "contact" || normalized === "contactmessage") return "Contato";
  if (normalized === "pollcreationmessagev3" || normalized === "pollcreationmessage") {
    return "Enquete";
  }
  if (normalized === "eventmessage") return "Evento";
  return normalized;
};

const extractContactNameFromWebhook = (body: any, event: any, info: any): string => {
  const candidates = [
    info?.PushName,
    info?.pushName,
    info?.SenderName,
    info?.senderName,
    event?.pushName,
    event?.PushName,
    event?.senderName,
    body?.pushName,
    body?.PushName
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }

  return "";
};

const extractGroupNameFromWebhook = (
  body: any,
  event: any,
  info: any,
  fallback: string
): string => {
  const candidates = [
    info?.ChatName,
    info?.chatName,
    info?.GroupName,
    info?.groupName,
    event?.ChatName,
    event?.chatName,
    event?.GroupName,
    event?.groupName,
    event?.Subject,
    event?.subject,
    body?.chatName,
    body?.groupName,
    body?.subject
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }

  return String(fallback || "").trim();
};

const resolveWuzapiGroupName = async (
  whatsapp: Whatsapp,
  groupJid: string
): Promise<string> => {
  const normalized = normalizeJid(groupJid);
  if (!isGroupJid(normalized)) return "";

  const cached = groupNameCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.name;
  }

  try {
    const data = await wuzapiRequest(whatsapp, "GET", "/group/info", undefined, {
      params: { groupJID: normalized }
    });

    const candidates = [
      data?.Name,
      data?.name,
      data?.Subject,
      data?.subject,
      data?.GroupName,
      data?.groupName,
      data?.Group?.Name,
      data?.Group?.Subject
    ];

    for (const candidate of candidates) {
      const value = String(candidate || "").trim();
      if (value) {
        groupNameCache.set(normalized, {
          name: value,
          expiresAt: Date.now() + GROUP_NAME_CACHE_TTL_MS
        });
        return value;
      }
    }
  } catch {
    // Falha em metadata de grupo não deve interromper processamento da mensagem.
  }

  return "";
};

const isChatKeyUniqueConstraintError = (error: any): boolean =>
  error?.name === "SequelizeUniqueConstraintError" &&
  (error?.parent?.constraint === "contacts_company_whats_chatkey_uq" ||
    String(error?.parent?.detail || "").includes("COALESCE(lid, jid)"));

const findContactByChatKey = async (
  companyId: number,
  whatsappId: number,
  ids: { lid: string | null; jid: string | null }
): Promise<Contact | null> => {
  const orKeys: any[] = [];
  if (ids?.lid) orKeys.push({ lid: String(ids.lid).toLowerCase() });
  if (ids?.jid) orKeys.push({ jid: String(ids.jid).toLowerCase() });
  if (orKeys.length === 0) return null;

  return Contact.findOne({
    where: {
      companyId,
      whatsappId,
      [Op.or]: orKeys
    }
  });
};

const syncContactIdentitySafe = async (
  contact: Contact,
  companyId: number,
  whatsappId: number,
  ids: { lid: string | null; jid: string | null },
  remoteJidHint?: string
): Promise<Contact> => {
  const patch: Record<string, string> = {};
  if (ids?.lid && (contact as any)?.lid !== ids.lid) {
    patch.lid = String(ids.lid).toLowerCase();
  }
  if (ids?.jid && (contact as any)?.jid !== ids.jid) {
    patch.jid = String(ids.jid).toLowerCase();
  }

  if (Object.keys(patch).length === 0) return contact;

  try {
    await contact.update(patch);
    return contact;
  } catch (error: any) {
    if (!isChatKeyUniqueConstraintError(error)) {
      throw error;
    }

    const existing = await findContactByChatKey(companyId, whatsappId, ids);
    if (!existing) {
      throw error;
    }

    const existingPatch: Record<string, string> = {};
    const normalizedHint = normalizeJid(String(remoteJidHint || ""));
    if (
      normalizedHint &&
      (!String((existing as any)?.remoteJid || "").trim() ||
        String((existing as any)?.remoteJid || "").trim() !== normalizedHint)
    ) {
      existingPatch.remoteJid = normalizedHint;
    }
    if (
      String(contact?.name || "").trim() &&
      (String(existing?.name || "").trim() === String(existing?.number || "").trim() ||
        String(existing?.name || "").trim() === "")
    ) {
      existingPatch.name = String(contact?.name || "").trim();
    }
    if (Object.keys(existingPatch).length > 0) {
      await existing.update(existingPatch);
    }
    return existing;
  }
};

const resolveQueueIdsForWhatsapp = async (whatsappId: number): Promise<number[]> => {
  const links = await WhatsappQueue.findAll({
    where: { whatsappId },
    attributes: ["queueId"]
  });

  return Array.from(
    new Set(
      links
        .map(link => Number((link as any).queueId))
        .filter(id => Number.isInteger(id) && id > 0)
    )
  );
};

const normalizeReceiptStateValue = (value: any): string =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");

const resolveReceiptAck = (body: any, event: any, info: any): number | null => {
  const normalizedState = normalizeReceiptStateValue(
    firstNonEmpty(
      body?.state,
      body?.State,
      event?.state,
      event?.State,
      info?.state,
      info?.State
    )
  );
  if (normalizedState === "read" || normalizedState === "readself") return 3;
  if (normalizedState === "delivered") return 2;

  const normalizedType = normalizeReceiptStateValue(
    firstNonEmpty(
      event?.Type,
      event?.type,
      body?.Type,
      body?.type,
      info?.Type,
      info?.type
    )
  );
  if (normalizedType.includes("read")) return 3;
  if (normalizedType.includes("deliver")) return 2;

  return null;
};

const extractReceiptMessageIds = (body: any, event: any, info: any): string[] => {
  const result = new Set<string>();
  const candidates = [
    event?.MessageIDs,
    event?.messageIDs,
    event?.messageIds,
    event?.messageids,
    body?.MessageIDs,
    body?.messageIDs,
    body?.messageIds,
    body?.messageids,
    info?.MessageIDs,
    info?.messageIDs,
    info?.messageIds,
    info?.messageids,
    event?.ID,
    event?.id,
    body?.ID,
    body?.id,
    info?.ID,
    info?.id
  ];

  const pushCandidate = (value: any): void => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach(pushCandidate);
      return;
    }
    if (typeof value === "object") {
      pushCandidate(
        value?.id ||
          value?.ID ||
          value?.messageId ||
          value?.MessageID ||
          value?.messageID
      );
      return;
    }

    const raw = String(value).trim();
    if (!raw) return;

    if (raw.startsWith("[") && raw.endsWith("]")) {
      try {
        const parsed = JSON.parse(raw);
        pushCandidate(parsed);
        return;
      } catch {
        // segue fluxo normal quando não for JSON válido
      }
    }

    raw
      .split(",")
      .map(part => part.trim())
      .filter(Boolean)
      .forEach(part => result.add(normalizeWuzapiReactionTargetId(part)));
  };

  candidates.forEach(pushCandidate);
  return Array.from(result);
};

const loadMessageForRealtimeUpdate = async (messageId: number): Promise<Message | null> =>
  Message.findByPk(messageId, {
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

const emitRealtimeAckUpdate = (message: Message): void => {
  const companyId = Number((message as any)?.companyId || 0);
  const ticketId = Number((message as any)?.ticketId || 0);
  if (!companyId || !ticketId) return;

  const payload = {
    action: "update",
    message,
    ticket: (message as any)?.ticket,
    contact: (message as any)?.ticket?.contact
  };

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-appMessage`, payload);
  io.of(String(companyId)).to(String(ticketId)).emit("appMessage", payload);
  io.of(String(companyId)).to(`company-${companyId}`).emit("appMessage", payload);
};

const emitRealtimeMessageUpdate = (message: Message): void => {
  const companyId = Number((message as any)?.companyId || 0);
  if (!companyId) return;

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-appMessage`, {
    action: "update",
    message
  });
};

const emitCompanyTypingUpdate = ({
  companyId,
  ticketId,
  isTyping,
  isOnline
}: {
  companyId: number;
  ticketId: number;
  isTyping: boolean;
  isOnline?: boolean;
}): void => {
  const io = getIO();
  const payload: Record<string, any> = {
    ticketId,
    isTyping,
    userId: null,
    companyId,
    at: new Date().toISOString()
  };
  if (isOnline !== undefined) payload.isOnline = isOnline;
  io.of(String(companyId)).emit(`company-${companyId}-typing`, payload);
};

const resolveWuzapiTypingState = (body: any, event: any, info: any): boolean | null => {
  const typeHints = [
    body?.type,
    body?.Type,
    body?.event,
    body?.Event,
    body?.eventType,
    body?.EventType,
    event?.type,
    event?.Type,
    event?.event,
    event?.Event
  ]
    .map(value => String(value || "").toLowerCase())
    .join(" ");

  const stateRaw = String(
    info?.State ||
      info?.state ||
      event?.State ||
      event?.state ||
      body?.state ||
      body?.State ||
      body?.data?.state ||
      body?.Data?.state ||
      body?.presence ||
      body?.Presence ||
      body?.data?.presence ||
      body?.Data?.presence ||
      event?.presence ||
      event?.Presence ||
      info?.presence ||
      info?.Presence ||
      ""
  )
    .trim()
    .toLowerCase();

  if (!stateRaw && !typeHints.includes("presence") && !typeHints.includes("notify")) return null;

  if (["composing", "recording", "typing", "typing_on", "typingon"].includes(stateRaw)) {
    return true;
  }

  if (
    ["paused", "available", "unavailable", "typing_off", "typingoff", "idle"].includes(stateRaw)
  ) {
    return false;
  }

  if (!stateRaw && typeHints.includes("typing_on")) return true;
  if (!stateRaw && typeHints.includes("typing_off")) return false;
  return null;
};

const handleWuzapiWebhook = async (inputBody: any): Promise<void> => {
  const body = parsePayload(inputBody);
  const eventType = resolveEventType(body);
  const normalizedEventType = eventType.toLowerCase().replace(/[^a-z]/g, "");

  const instanceName = String(
    body?.instanceName || body?.instance || body?.InstanceName || body?.Instance || ""
  );
  const whatsappId = extractWhatsappIdFromInstanceName(instanceName);
  if (!whatsappId) {
    logger.warn(`[WUZAPI_WEBHOOK] instanceName inválido: ${instanceName || "vazio"}`);
    return;
  }

  const whatsapp = await Whatsapp.findOne({
    where: {
      id: whatsappId,
      provider: "wuzapi",
      channel: "whatsapp"
    }
  });

  if (!whatsapp) {
    logger.warn(`[WUZAPI_WEBHOOK] conexão não encontrada para id=${whatsappId}`);
    return;
  }

  // Mantém subscriptions do webhook em runtime para sessões já conectadas
  // que ficaram com eventos antigos no cache do WuzAPI.
  void syncWuzapiRuntimeWebhookSubscription(whatsapp).catch((error: any) => {
    logger.warn(
      `[WUZAPI_WEBHOOK_RUNTIME_SYNC] falha ao sincronizar em runtime (whatsappId=${whatsapp.id}): ${String(
        error?.message || error
      )}`
    );
  });

  const isConnectedEvent =
    normalizedEventType === "connected" || normalizedEventType === "pairsuccess";

  if (isConnectedEvent) {
    const event = body?.event || body?.Event || {};
    const info = event?.Info || event?.info || {};

    const rawNumberCandidate =
      String(info?.Sender || info?.sender || "") ||
      String(info?.Chat || info?.chat || "") ||
      String(event?.Jid || event?.jid || "");
    const normalizedNumber = normalizeDigits(rawNumberCandidate);

    await whatsapp.update({
      status: "CONNECTED",
      qrcode: "",
      retries: 0,
      number: normalizedNumber || whatsapp.number || ""
    });

    const refreshed = (await Whatsapp.findByPk(whatsapp.id)) || whatsapp;
    const io = getIO();
    io.of(String(refreshed.companyId)).emit(
      `company-${refreshed.companyId}-whatsappSession`,
      {
        action: "update",
        session: refreshed
      }
    );
    io.of(String(refreshed.companyId)).emit(`company-${refreshed.companyId}-whatsapp`, {
      action: "update",
      whatsapp: refreshed
    });

    const adapter = createWuzapiSessionAdapter(refreshed, refreshed.companyId);
    upsertWbotSession(adapter, refreshed.id, refreshed.companyId);

    void importWuzapiHistoryService(refreshed.id);
    return;
  }

  const event = resolveEventPayload(body);
  const info = event?.Info || event?.info || {};
  const isReadReceiptEvent =
    normalizedEventType === "readreceipt" || normalizedEventType === "receipt";

  if (isReadReceiptEvent) {
    const targetAck = resolveReceiptAck(body, event, info);
    const receiptMessageIds = extractReceiptMessageIds(body, event, info);

    if (targetAck == null) {
      logger.info(
        `[WUZAPI_WEBHOOK] receipt sem mapeamento de ack | state=${String(
          body?.state || event?.state || "n/a"
        )} | type=${eventType || "sem-type"}`
      );
      return;
    }

    if (!receiptMessageIds.length) {
      logger.info(
        `[WUZAPI_WEBHOOK] receipt sem messageIds | ack=${targetAck} | type=${eventType || "sem-type"}`
      );
      return;
    }

    let updated = 0;
    for (const rawMessageId of receiptMessageIds) {
      const normalizedMessageId = normalizeWuzapiReactionTargetId(rawMessageId);
      if (!normalizedMessageId) continue;

      const idCandidates = Array.from(
        new Set(
          [
            rawMessageId,
            normalizedMessageId,
            `me:${normalizedMessageId}`
          ].filter(Boolean)
        )
      );

      const message = await Message.findOne({
        where: {
          companyId: whatsapp.companyId,
          fromMe: true,
          [Op.or]: [
            { messageId: { [Op.in]: idCandidates } },
            { wid: { [Op.in]: idCandidates } },
            { wid: { [Op.like]: `%:${normalizedMessageId}` } }
          ]
        },
        order: [["id", "DESC"]]
      });

      if (!message) continue;

      const currentAck = Number((message as any)?.ack || 0);
      const nextAck = Math.max(currentAck, targetAck);
      if (nextAck === currentAck) continue;

      await message.update({ ack: nextAck });
      updated += 1;

      const fullMessage = await loadMessageForRealtimeUpdate(Number(message.id));
      if (fullMessage) {
        emitRealtimeAckUpdate(fullMessage);
      }
    }

    logger.info(
      `[WUZAPI_WEBHOOK] receipt processado | ack=${targetAck} | ids=${receiptMessageIds.length} | atualizadas=${updated}`
    );
    return;
  }

  if (normalizedEventType === "calloffer") {
    const callId = resolveCallId(body, event, info);
    const remoteJid = resolveCallRemoteJid(body, event, info, whatsapp);
    if (remoteJid) {
      await cachePendingCall({
        whatsappId: whatsapp.id,
        callId,
        remoteJid
      });
    }
    return;
  }

  if (normalizedEventType === "callterminate" || normalizedEventType === "calloffernotice") {
    const settings = await CompaniesSettings.findOne({
      where: {
        companyId: whatsapp.companyId
      }
    });

    if (String((settings as any)?.acceptCallWhatsapp || "").trim() !== "enabled") {
      return;
    }

    const callReplyText = String((settings as any)?.AcceptCallWhatsappMessage || "").trim();

    const callId = resolveCallId(body, event, info);
    let remoteJid = resolveCallRemoteJid(body, event, info, whatsapp);
    if (!remoteJid) {
      remoteJid = await recoverPendingCallRemoteJid({
        whatsappId: whatsapp.id,
        callId
      });
    }
    if (!remoteJid) {
      logger.warn(
        `[WUZAPI_WEBHOOK] Call end sem remoteJid válido | whatsappId=${whatsapp.id}`
      );
      return;
    }

    const callEndDedupeKey = buildWuzapiCallEndDedupeKey({
      whatsappId: whatsapp.id,
      callId,
      remoteJid,
      body,
      event,
      info
    });
    try {
      const lockResult = await cacheLayer
        .getRedisInstance()
        .set(callEndDedupeKey, "1", "EX", 180, "NX");
      if (!lockResult) {
        logger.info(
          `[WUZAPI_WEBHOOK] call end dedupe aplicado | whatsappId=${whatsapp.id} | key=${callEndDedupeKey}`
        );
        return;
      }
    } catch {
      // fallback sem lock quando Redis indisponível
    }

    let wbot = tryGetWbot(whatsapp.id, whatsapp.companyId) as any;
    if (!wbot) {
      wbot = createWuzapiSessionAdapter(whatsapp, whatsapp.companyId);
      upsertWbotSession(wbot, whatsapp.id, whatsapp.companyId);
    }

    if (callReplyText) {
      try {
        await wbot.sendMessage(remoteJid, {
          text: `\u200e ${callReplyText}`
        });
      } catch (error) {
        logger.warn(
          `[WUZAPI_WEBHOOK] falha ao enviar resposta automática de chamada | whatsappId=${whatsapp.id} | remoteJid=${remoteJid} | erro=${String(error)}`
        );
      }
    }

    const number = normalizeDigits(remoteJid);
    const contact = await Contact.findOne({
      where: {
        companyId: whatsapp.companyId,
        number
      }
    });

    if (!contact) {
      logger.info(
        `[WUZAPI_WEBHOOK] CallTerminate sem contato local para registrar call_log | whatsappId=${whatsapp.id} | remoteJid=${remoteJid}`
      );
      return;
    }

    const [ticket] = await Ticket.findOrCreate({
      where: {
        contactId: contact.id,
        whatsappId: whatsapp.id,
        status: {
          [Op.in]: ["open", "pending", "nps", "lgpd"]
        },
        companyId: whatsapp.companyId
      },
      defaults: {
        companyId: whatsapp.companyId,
        contactId: contact.id,
        whatsappId: whatsapp.id,
        isGroup: Boolean((contact as any)?.isGroup),
        status: "pending"
      }
    });

    if (!ticket) {
      return;
    }

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const bodyCallLog = `Chamada de voz/vídeo perdida às ${hours}:${minutes}`;
    const callToken =
      callId ||
      createHash("sha1")
        .update(
          JSON.stringify({
            remoteJid,
            type: normalizedEventType,
            timestamp:
              event?.Timestamp ||
              event?.timestamp ||
              body?.timestamp ||
              body?.event?.timestamp ||
              now.getTime()
          })
        )
        .digest("hex")
        .slice(0, 18);
    const callWid = `wuzapi-call:${remoteJid}:${callToken}`;

    const alreadyLogged = await Message.findOne({
      where: {
        companyId: whatsapp.companyId,
        wid: callWid
      }
    });
    if (alreadyLogged) {
      return;
    }

    await ticket.update({
      lastMessage: bodyCallLog
    });

    if (ticket.status === "closed") {
      await ticket.update({
        status: "pending"
      });
    }

    await CreateMessageService({
      companyId: whatsapp.companyId,
      messageData: {
        wid: callWid,
        messageId: callId || undefined,
        ticketId: ticket.id,
        contactId: contact.id,
        body: bodyCallLog,
        fromMe: false,
        read: true,
        ack: 1,
        mediaType: "call_log",
        quotedMsgId: null,
        remoteJid,
        channel: "whatsapp",
        dataJson: JSON.stringify(body)
      }
    });

    logger.info(
      `[WUZAPI_WEBHOOK] chamada perdida registrada | whatsappId=${whatsapp.id} | remoteJid=${remoteJid} | respostaAutomatica=${callReplyText ? "enviada" : "não configurada"}`
    );
    return;
  }

  const wuzapiStateRaw = String(
    info?.State || info?.state || event?.State || event?.state ||
    body?.state || body?.State || body?.presence || body?.Presence ||
    body?.data?.state || body?.Data?.state || body?.data?.presence || body?.Data?.presence || ""
  ).trim().toLowerCase();
  const typingState = resolveWuzapiTypingState(body, event, info);
  if (WUZAPI_DEBUG_TYPING) {
    logger.info(
      `[WUZAPI_TYPING][IN] whatsappId=${whatsapp.id} | eventType=${eventType || "sem-type"} | normalized=${normalizedEventType || "n/a"} | typingState=${String(
        typingState
      )} | stateRaw=${String(
        info?.State ||
          info?.state ||
          event?.State ||
          event?.state ||
          body?.state ||
          body?.State ||
          body?.presence ||
          body?.Presence ||
          body?.data?.state ||
          body?.Data?.state ||
          body?.data?.presence ||
          body?.Data?.presence ||
          ""
      )}`
    );
  }
  if (typingState !== null) {
    const remoteJidCandidate = normalizeJid(
      firstNonEmpty(
        info?.Sender,
        info?.SenderAlt,
        info?.sender,
        info?.senderAlt,
        info?.Chat,
        info?.chat,
        event?.Sender,
        event?.SenderAlt,
        event?.sender,
        event?.senderAlt,
        event?.Chat,
        event?.chat,
        body?.recipient,
        body?.recipientAlt,
        body?.sender,
        body?.from,
        body?.chat,
        body?.chat_jid,
        body?.chatJid,
        body?.data?.sender,
        body?.data?.senderAlt,
        body?.data?.chat,
        body?.Data?.sender,
        body?.Data?.senderAlt,
        body?.Data?.chat
      )
    );
    if (WUZAPI_DEBUG_TYPING) {
      logger.info(
        `[WUZAPI_TYPING][JID] whatsappId=${whatsapp.id} | remoteJidCandidate=${remoteJidCandidate || "vazio"}`
      );
    }

    if (remoteJidCandidate && !isGroupJid(remoteJidCandidate) && !isBroadcastJid(remoteJidCandidate)) {
      const remoteDigits = normalizeDigits(remoteJidCandidate);
      const selfDigits = normalizeDigits(String((whatsapp as any)?.number || ""));
      if (WUZAPI_DEBUG_TYPING) {
        logger.info(
          `[WUZAPI_TYPING][DIGITS] whatsappId=${whatsapp.id} | remoteDigits=${remoteDigits || "vazio"} | selfDigits=${selfDigits || "vazio"}`
        );
      }

      if (remoteDigits && (!selfDigits || remoteDigits !== selfDigits)) {
        const contact = await Contact.findOne({
          where: {
            companyId: whatsapp.companyId,
            [Op.or]: [{ remoteJid: remoteJidCandidate }, { number: remoteDigits }]
          },
          order: [["updatedAt", "DESC"]]
        });
        if (WUZAPI_DEBUG_TYPING) {
          logger.info(
            `[WUZAPI_TYPING][CONTACT] whatsappId=${whatsapp.id} | found=${contact ? "yes" : "no"} | contactId=${String(
              contact?.id || ""
            )} | number=${String(contact?.number || "")}`
          );
        }

        if (contact) {
          const ticket = await Ticket.findOne({
            where: {
              companyId: whatsapp.companyId,
              whatsappId: whatsapp.id,
              contactId: contact.id,
              status: { [Op.in]: ["open", "pending", "group"] }
            },
            order: [["updatedAt", "DESC"]]
          });
          if (WUZAPI_DEBUG_TYPING) {
            logger.info(
              `[WUZAPI_TYPING][TICKET] whatsappId=${whatsapp.id} | found=${ticket ? "yes" : "no"} | ticketId=${String(
                ticket?.id || ""
              )} | status=${String(ticket?.status || "")}`
            );
          }

          if (ticket) {
            emitCompanyTypingUpdate({
              companyId: whatsapp.companyId,
              ticketId: ticket.id,
              isTyping: typingState,
              isOnline: wuzapiStateRaw !== "unavailable"
            });
            if (WUZAPI_DEBUG_TYPING) {
              logger.info(
                `[WUZAPI_TYPING][EMIT] companyId=${whatsapp.companyId} | ticketId=${ticket.id} | isTyping=${typingState}`
              );
            }
          }
        }
      } else if (WUZAPI_DEBUG_TYPING) {
        logger.info(
          `[WUZAPI_TYPING][SKIP] whatsappId=${whatsapp.id} | motivo=remoteDigits-vazio-ou-self`
        );
      }
    } else if (WUZAPI_DEBUG_TYPING) {
      logger.info(
        `[WUZAPI_TYPING][SKIP] whatsappId=${whatsapp.id} | motivo=jid-invalido-grupo-broadcast`
      );
    }
    return;
  }

  const messageCandidateFromEvent = extractMessagePayload(event);
  const messageCandidateFromBody = extractMessagePayload(body);
  const messageCandidate =
    messageCandidateFromEvent &&
    typeof messageCandidateFromEvent === "object" &&
    Object.keys(messageCandidateFromEvent).length > 0
      ? messageCandidateFromEvent
      : messageCandidateFromBody;
  const hasMessagePayload = Boolean(
    messageCandidate &&
      typeof messageCandidate === "object" &&
      Object.keys(messageCandidate).length > 0
  );
  const acceptedMessageTypes = new Set([
    "message",
    "notify",
    "messages",
    "messagesupsert",
    "msg",
    "chat",
    "messagesent",
    "msgsent",
    "outgoing",
    "append",
    "self",
    "incoming",
    "incomingmessage",
    "newmessage",
    "conversation"
  ]);
  const looksLikeMessageType =
    normalizedEventType.includes("message") ||
    normalizedEventType.includes("msg") ||
    normalizedEventType.includes("notify") ||
    normalizedEventType.includes("chat");
  const isMessageEvent =
    acceptedMessageTypes.has(normalizedEventType) ||
    looksLikeMessageType ||
    hasMessagePayload;

  if (!isMessageEvent) {
    logger.info(
      `[WUZAPI_WEBHOOK] ignorado | type=${eventType || "sem-type"} | normalized=${normalizedEventType || "n/a"} | hasMessagePayload=${hasMessagePayload}`
    );
    return;
  }

  const senderJidRaw = String(
    info?.Sender ||
      info?.sender ||
      info?.MessageSource?.Sender ||
      info?.messageSource?.sender ||
      event?.Sender ||
      event?.sender ||
      event?.MessageSource?.Sender ||
      event?.messageSource?.sender ||
      body?.sender ||
      body?.data?.sender ||
      body?.Data?.sender ||
      body?.data?.Sender ||
      body?.Data?.Sender ||
      body?.MessageSource?.Sender ||
      body?.messageSource?.sender ||
      ""
  );
  const senderAltJidRaw = String(
    info?.SenderAlt ||
      info?.senderAlt ||
      event?.SenderAlt ||
      event?.senderAlt ||
      body?.senderAlt ||
      body?.data?.senderAlt ||
      body?.Data?.senderAlt ||
      body?.data?.SenderAlt ||
      body?.Data?.SenderAlt ||
      ""
  );
  const chatJidRaw = String(
    info?.Chat ||
      info?.chat ||
      info?.MessageSource?.Chat ||
      info?.messageSource?.chat ||
      event?.Chat ||
      event?.chat ||
      event?.MessageSource?.Chat ||
      event?.messageSource?.chat ||
      body?.chat_jid ||
      body?.chatJid ||
      body?.chat ||
      body?.data?.chat_jid ||
      body?.Data?.chat_jid ||
      body?.data?.chatJid ||
      body?.Data?.chatJid ||
      body?.data?.chat ||
      body?.Data?.chat ||
      body?.data?.Chat ||
      body?.Data?.Chat ||
      body?.MessageSource?.Chat ||
      body?.messageSource?.chat ||
      senderAltJidRaw ||
      senderJidRaw
  );
  const senderJid = normalizeJid(senderJidRaw);
  const senderAltJid = normalizeJid(senderAltJidRaw);
  const chatJid = normalizeJid(chatJidRaw);
  const remoteJid = normalizeJid(chatJid || senderAltJid || senderJid);
  const isFromMe = resolveIsFromMe(
    info,
    event,
    body,
    whatsapp,
    senderJidRaw,
    senderAltJidRaw,
    chatJidRaw
  );
  const isGroupChat = isGroupJid(remoteJid);
  if (isGroupChat && !Boolean((whatsapp as any)?.allowGroup)) {
    logger.info(
      `[WUZAPI_WEBHOOK] grupo ignorado (allowGroup=false) | whatsappId=${whatsapp.id} | remoteJid=${remoteJid || "n/a"}`
    );
    return;
  }
  const accountJid = whatsapp.number
    ? normalizeJid(`${normalizeDigits(String(whatsapp.number || ""))}@s.whatsapp.net`)
    : "";
  const participantJid = normalizeJid(
    String(
      isGroupChat
        ? (senderJidRaw.toLowerCase() === "me"
            ? accountJid
            : senderAltJid || senderJid || accountJid)
        : (isFromMe ? remoteJid : (senderAltJid || senderJid || remoteJid))
    )
  );

  // Status e outros broadcasts nunca devem gerar ticket/bot.
  if (
    isBroadcastJid(remoteJid) ||
    isBroadcastJid(chatJid) ||
    isBroadcastJid(senderJid) ||
    isBroadcastJid(senderAltJid) ||
    isBroadcastJid(participantJid)
  ) {
    logger.info(
      `[WUZAPI_WEBHOOK] ignorado broadcast/status | type=${eventType || "sem-type"} | remoteJid=${remoteJid || "n/a"}`
    );
    return;
  }

  const senderDigits = normalizeDigits(senderJid || senderJidRaw);
  const accountDigits = normalizeDigits(String(whatsapp.number || ""));
  const outboundTargetCandidates = extractOutboundTargetCandidates(
    info,
    event,
    body,
    messageCandidate
  );
  const senderLooksLikeAccount =
    Boolean(senderDigits && accountDigits && senderDigits === accountDigits) ||
    senderJidRaw.toLowerCase() === "me";

  const contactJid = normalizeJid(
    isGroupChat
      ? (participantJid || remoteJid)
      : (isFromMe || senderLooksLikeAccount ? remoteJid : participantJid || remoteJid)
  );
  const participantNumber = normalizeDigits(participantJid);
  const contactIds = mergeLidJidCandidates(
    contactJid,
    remoteJid,
    participantJid,
    isFromMe && !isGroupChat ? null : senderAltJid,
    isFromMe && !isGroupChat ? null : senderJid
  );
  const directNumber = resolveDirectPhone({
    isFromMe,
    accountDigits,
    candidates: isFromMe
      ? [
          ...outboundTargetCandidates,
          chatJid,
          contactJid,
          remoteJid,
          participantJid,
          senderJid,
          senderJidRaw,
          chatJidRaw,
          senderAltJid,
          senderAltJidRaw
        ]
      : [
          contactJid,
          participantJid,
          senderJid,
          chatJid,
          remoteJid,
          senderJidRaw,
          chatJidRaw,
          senderAltJid,
          senderAltJidRaw
        ]
  });
  let number = isGroupChat ? participantNumber : directNumber;

  if (WUZAPI_DEBUG_FROMME && isFromMe && !isGroupChat) {
    logger.info(
      `[WUZAPI_WEBHOOK][DEBUG_FROMME] whatsappId=${whatsapp.id} | directNumber=${directNumber || "vazio"} | remoteJid=${remoteJid || "vazio"} | chat=${chatJidRaw || "vazio"} | sender=${senderJidRaw || "vazio"} | recipientAlt=${String(
        info?.RecipientAlt || event?.RecipientAlt || body?.recipientAlt || ""
      ) || "vazio"} | candidates=${JSON.stringify(outboundTargetCandidates)}`
    );
  }

  if (!number && !isGroupChat) {
    const existingByChat = await findContactByChatKey(
      whatsapp.companyId,
      whatsapp.id,
      contactIds
    );
    const fallbackNumber = normalizeDigits(String(existingByChat?.number || ""));
    if (fallbackNumber) {
      number = fallbackNumber;
    }
  }

  if (!number && isFromMe && !isGroupChat) {
    const looseOutboundCandidates = [
      ...outboundTargetCandidates,
      contactJid,
      remoteJid,
      participantJid,
      chatJid,
      chatJidRaw,
      senderAltJid,
      senderAltJidRaw,
      senderJid,
      senderJidRaw
    ];

    for (const candidate of looseOutboundCandidates) {
      const normalizedCandidate = String(candidate || "").trim();
      if (!normalizedCandidate) continue;
      if (isGroupJid(normalizedCandidate)) continue;
      if (isLidJid(normalizedCandidate)) continue;

      // No fallback outbound, só aceita candidato claramente de telefone:
      // - jid de telefone (@s.whatsapp.net / @c.us), ou
      // - número puro em formato textual simples.
      if (
        normalizedCandidate.includes("@") &&
        !isPhoneDomainJid(normalizedCandidate) &&
        !/@s\.whatsapp\.net\b/i.test(normalizedCandidate) &&
        !/@c\.us\b/i.test(normalizedCandidate)
      ) {
        continue;
      }

      const candidateDigits = normalizeDigits(normalizedCandidate);
      if (!candidateDigits) continue;
      if (accountDigits && candidateDigits === accountDigits) continue;
      if (candidateDigits.length < 10 || candidateDigits.length > 15) continue;

      number = candidateDigits;
      logger.info(
        `[WUZAPI_WEBHOOK] fallback outbound fromMe aplicado | whatsappId=${whatsapp.id} | candidate=${normalizedCandidate} | number=${number}`
      );
      break;
    }
  }

  if (!number) {
    if (isFromMe && !isGroupChat) {
      logger.warn(
        `[WUZAPI_WEBHOOK] número ausente em fromMe; acionando import de histórico | whatsappId=${whatsapp.id} | sender=${senderJidRaw} | chat=${chatJidRaw}`
      );
      void importWuzapiHistoryService(whatsapp.id);
    }

    logger.warn(
      `[WUZAPI_WEBHOOK] número inválido (sender=${senderJidRaw}, senderAlt=${senderAltJidRaw}, chat=${chatJidRaw})`
    );
    return;
  }

  const messagePayload = hasMessagePayload ? messageCandidate : extractMessagePayload(body);
  const normalizedMessagePayload = unwrapMessagePayload(messagePayload);
  const isEditedEvent = isWuzapiEditedMessageEvent(normalizedMessagePayload, body, event);
  const isDeletedEvent = isWuzapiDeletedMessageEvent(normalizedMessagePayload, body, event);
  const isForwarded = extractIsForwarded(normalizedMessagePayload, event, body);
  const adMetadata = extractWuzapiAdMetadata(normalizedMessagePayload, event, body);
  const editedBodyFromProtocol = isEditedEvent
    ? extractWuzapiEditedBody(normalizedMessagePayload, body, event)
    : "";
  // eslint-disable-next-line prefer-const
  let { body: messageBody, mediaType } = extractMessageBody(normalizedMessagePayload);
  const extractedMedia = extractWuzapiMedia(normalizedMessagePayload, body);
  const fallbackBody = extractTextCaptionFallback(normalizedMessagePayload, event, body);
  const fallbackPlaceholders = new Set([
    ":image:",
    ":audio:",
    ":video:",
    ":document:",
    ":sticker:"
  ]);

  let finalBody = String(messageBody || editedBodyFromProtocol || fallbackBody || "").trim();
  if (mediaType && mediaType !== "reactionMessage") {
    const normalizedFinalBody = finalBody.toLowerCase();
    const isEmptyOrPlaceholder = !finalBody || fallbackPlaceholders.has(normalizedFinalBody);
    if (isEmptyOrPlaceholder) {
      // Para imagem/vídeo/figurinha sem legenda, preserva corpo vazio para não
      // renderizar texto abaixo da mídia no chat.
      finalBody =
        mediaType === "image" ||
        mediaType === "video" ||
        mediaType === "sticker" ||
        mediaType === "document"
          ? ""
          : getMediaSummaryLabel(mediaType);
    }
  }

  // Card de pré-visualização de anúncio (CTWA): quando a mensagem chegou por um
  // anúncio Click to WhatsApp e não é uma mídia real, renderiza o mesmo card
  // "adMetaPreview" já usado no Baileys em vez de um texto solto.
  if (
    !isEditedEvent &&
    !isDeletedEvent &&
    adMetadata.hasAdContext &&
    adMetadata.externalAdReply &&
    (!mediaType ||
      mediaType === "conversation" ||
      mediaType === "extendedTextMessage")
  ) {
    const adPreviewBody = buildWuzapiAdMetaPreviewBody(adMetadata);
    if (adPreviewBody) {
      finalBody = adPreviewBody;
      mediaType = "adMetaPreview";
      logger.info(
        `[WUZAPI_WEBHOOK] card de anúncio (adMetaPreview) aplicado | whatsappId=${whatsapp.id} | remoteJid=${remoteJid}`
      );
    }
  }

  if (!finalBody && !mediaType && adMetadata.hasAdContext) {
    finalBody = buildWuzapiCtwaFallbackBody(adMetadata);
    logger.info(
      `[WUZAPI_WEBHOOK] fallback CTWA aplicado | whatsappId=${whatsapp.id} | remoteJid=${remoteJid} | externalAdReply=${adMetadata.externalAdReply ? "yes" : "no"} | referral=${adMetadata.referral ? "yes" : "no"} | ctwaClid=${adMetadata.ctwaClidPresent ? "yes" : "no"}`
    );
  }

  if (isDeletedEvent) {
    const targetMessageId = extractWuzapiDeletedTargetId(normalizedMessagePayload, body, event);
    if (!targetMessageId) {
      logger.info(
        `[WUZAPI_WEBHOOK] delete sem targetId | whatsappId=${whatsapp.id} | remoteJid=${remoteJid || "n/a"}`
      );
      return;
    }

    const idCandidates = Array.from(
      new Set(
        [
          targetMessageId,
          normalizeWuzapiReactionTargetId(targetMessageId),
          `me:${normalizeWuzapiReactionTargetId(targetMessageId)}`
        ].filter(Boolean)
      )
    );

    const messageToUpdate = await Message.findOne({
      where: {
        companyId: whatsapp.companyId,
        [Op.or]: [
          { messageId: { [Op.in]: idCandidates } },
          { wid: { [Op.in]: idCandidates } },
          { wid: { [Op.like]: `%:${normalizeWuzapiReactionTargetId(targetMessageId)}` } }
        ]
      },
      order: [["id", "DESC"]]
    });

    if (!messageToUpdate) {
      logger.info(
        `[WUZAPI_WEBHOOK] delete alvo não encontrado | whatsappId=${whatsapp.id} | targetId=${targetMessageId}`
      );
      return;
    }

    const settings = await CompaniesSettings.findOne({
      where: {
        companyId: whatsapp.companyId
      }
    });

    const shouldObfuscateBody =
      String((settings as any)?.lgpdDeleteMessage || "").trim() === "enabled" &&
      String((settings as any)?.enableLGPD || "").trim() === "enabled";

    const messagePatch: Record<string, any> = {
      isDeleted: true
    };

    if (shouldObfuscateBody) {
      messagePatch.body = "🚫 _Mensagem Apagada_";
    }

    await messageToUpdate.update(messagePatch);

    const ticketToUpdate = await Ticket.findByPk(messageToUpdate.ticketId);
    if (ticketToUpdate) {
      await ticketToUpdate.update({
        lastMessage: "🚫 _Mensagem Apagada_"
      });
    }

    const fullMessage = await loadMessageForRealtimeUpdate(Number(messageToUpdate.id));
    if (fullMessage) {
      emitRealtimeMessageUpdate(fullMessage);
    } else {
      emitRealtimeMessageUpdate(messageToUpdate);
    }

    if (ticketToUpdate) {
      const io = getIO();
      io.of(String(whatsapp.companyId)).emit(`company-${whatsapp.companyId}-ticket`, {
        action: "update",
        ticket: ticketToUpdate
      });
    }

    return;
  }

  if (!finalBody && !mediaType) {
    return;
  }

  const ticketLastMessage =
    mediaType === "document"
      ? extractedMedia?.fileName
        ? `Documento: ${String(extractedMedia.fileName).trim()}`
        : "Documento"
      : finalBody || (mediaType ? getMediaSummaryLabel(mediaType) : "");

  const messageIdRaw = extractMessageIdFromWebhook(body, event, info, messagePayload);
  const fallbackTimestamp = extractMessageTimestampFromWebhook(
    body,
    event,
    info,
    messagePayload
  );
  const fallbackFingerprint = createHash("sha1")
    .update(
      JSON.stringify({
        remoteJid,
        participantJid: participantJid || "",
        fromMe: isFromMe,
        messageType: mediaType || "text",
        body: finalBody,
        timestamp: fallbackTimestamp || "",
        payloadId: String(messagePayload?.key?.id || messagePayload?.id || "").trim()
      })
    )
    .digest("hex")
    .slice(0, 24);
  const messageWid = messageIdRaw
    ? `wuzapi:${remoteJid}:${messageIdRaw}`
    : `wuzapi-fallback:${remoteJid}:${fallbackFingerprint}`;
  const messageLookupConditions: any[] = [
    {
      wid: messageWid
    }
  ];
  if (messageIdRaw) {
    messageLookupConditions.push({ messageId: messageIdRaw });
  }

  const alreadyExists = await Message.findOne({
    where: {
      companyId: whatsapp.companyId,
      remoteJid,
      [Op.or]: messageLookupConditions
    }
  });
  if (alreadyExists) return;

  // Evita condição de corrida quando a mesma mensagem chega em dois webhooks quase simultâneos.
  const dedupeToken = messageIdRaw || messageWid;
  const dedupeKey = `wuzapi:msg-lock:${whatsapp.companyId}:${whatsapp.id}:${dedupeToken}`;
  try {
    const lockResult = await cacheLayer
      .getRedisInstance()
      .set(dedupeKey, "1", "EX", 20, "NX");

    if (!lockResult) {
      // Outro worker/request já está processando exatamente esta mensagem.
      // Aqui precisamos ENCERRAR para evitar corrida e gravação duplicada.
      return;
    }
  } catch {
    // Se Redis falhar, seguimos com dedupe por banco.
  }

  // Alguns payloads chegam duplicados com remoteJid alternado (@lid vs @s.whatsapp.net).
  // Em chats 1:1 mantemos dedupe global por messageId na conexão.
  // Em grupos, restringimos ao remoteJid para evitar colisão entre grupos distintos.
  if (messageIdRaw) {
    const duplicatedMessageWhere: any = {
      companyId: whatsapp.companyId,
      messageId: messageIdRaw
    };
    if (isGroupChat) {
      duplicatedMessageWhere.remoteJid = remoteJid;
    }

    const duplicatedByMessageId = await Message.findOne({
      where: duplicatedMessageWhere
    });
    if (duplicatedByMessageId) return;
  }

  const mediaFileName =
    extractedMedia && mediaType
      ? await persistWuzapiMedia(whatsapp.companyId, extractedMedia, whatsapp)
      : null;
  const pushName = extractContactNameFromWebhook(body, event, info);

  let wbot = tryGetWbot(whatsapp.id, whatsapp.companyId) as any;
  if (!wbot) {
    wbot = createWuzapiSessionAdapter(whatsapp, whatsapp.companyId);
    upsertWbotSession(wbot, whatsapp.id, whatsapp.companyId);
  }
  const profilePicUrl = await resolveWuzapiAvatarUrl(
    whatsapp,
    number ? `${number}@s.whatsapp.net` : "",
    contactJid,
    participantJid,
    senderJid,
    senderJidRaw,
    remoteJid,
    senderAltJid
  );
  const inferredContactName =
    isFromMe && !isGroupChat
      ? number
      : (pushName || number);

  let contact = await CreateOrUpdateContactService({
    name: inferredContactName,
    number,
    profilePicUrl,
    isGroup: false,
    companyId: whatsapp.companyId,
    channel: "whatsapp",
    remoteJid: number ? `${number}@s.whatsapp.net` : (contactJid || remoteJid),
    whatsappId: whatsapp.id,
    wbot
  });
  contact = await syncContactIdentitySafe(
    contact,
    whatsapp.companyId,
    whatsapp.id,
    contactIds,
    contactJid || remoteJid
  );

  if (
    !isFromMe &&
    pushName &&
    contact &&
    pushName !== contact.name &&
    (String(contact.name || "").trim() === String(contact.number || "").trim() ||
      String(contact.name || "").trim() === "")
  ) {
    await contact.update({ name: pushName });
  }

  let groupContact;
  if (isGroupChat) {
    const groupNumber = normalizeGroupNumber(remoteJid);
    if (!groupNumber) return;
    const groupProfilePicUrl = await resolveWuzapiAvatarUrl(
      whatsapp,
      remoteJid,
      groupNumber
    );
    const groupIds = mergeLidJidCandidates(remoteJid);
    const groupNameFromWebhook = extractGroupNameFromWebhook(body, event, info, "");
    const groupNameFromApi = groupNameFromWebhook
      ? ""
      : await resolveWuzapiGroupName(whatsapp, remoteJid);
    const groupName = groupNameFromWebhook || groupNameFromApi || remoteJid;
    groupContact = await CreateOrUpdateContactService({
      name: groupName || groupNumber,
      number: groupNumber,
      profilePicUrl: groupProfilePicUrl,
      isGroup: true,
      companyId: whatsapp.companyId,
      channel: "whatsapp",
      remoteJid,
      whatsappId: whatsapp.id,
      wbot
    });
    const currentGroupName = String((groupContact as any)?.name || "").trim();
    const isWeakGroupName =
      !currentGroupName ||
      currentGroupName === remoteJid ||
      currentGroupName === groupNumber ||
      currentGroupName.endsWith("@g.us");
    if (groupName && groupName !== currentGroupName && isWeakGroupName) {
      await groupContact.update({ name: groupName });
    }
    groupContact = await syncContactIdentitySafe(
      groupContact,
      whatsapp.companyId,
      whatsapp.id,
      groupIds,
      remoteJid
    );
  }

  const settings = await CompaniesSettings.findOne({
    where: {
      companyId: whatsapp.companyId
    }
  });
  const effectiveSettings = {
    sendGreetingMessageOneQueues:
      String((settings as any)?.sendGreetingMessageOneQueues || "").trim() ||
      "enabled",
    sendQueuePosition:
      String((settings as any)?.sendQueuePosition || "").trim() || "disabled",
    sendQueuePositionMessage:
      String((settings as any)?.sendQueuePositionMessage || "").trim() || "",
    settingsUserRandom:
      String((settings as any)?.settingsUserRandom || "").trim() ||
      String((settings as any)?.userRandom || "").trim() ||
      "disabled"
  };

  let ticket: Ticket | null = null;
  let unreadMessages = 0;

  if (isFromMe) {
    await cacheLayer.set(`contacts:${contact.id}:unreads`, "0");
  } else {
    const unreads = await cacheLayer.get(`contacts:${contact.id}:unreads`);
    unreadMessages = Number(unreads || 0) + 1;
    await cacheLayer.set(`contacts:${contact.id}:unreads`, String(unreadMessages));
  }

  if (isFromMe && !isGroupChat) {
    const chatKeyOr: any[] = [];
    if (contactIds?.lid) {
      chatKeyOr.push({ lid: String(contactIds.lid).toLowerCase() });
    }
    if (contactIds?.jid) {
      chatKeyOr.push({ jid: String(contactIds.jid).toLowerCase() });
    }

    if (chatKeyOr.length > 0) {
      ticket = await Ticket.findOne({
        where: {
          companyId: whatsapp.companyId,
          whatsappId: whatsapp.id,
          isGroup: false,
          status: {
            [Op.in]: ACTIVE_TICKET_STATUSES
          },
          [Op.or]: chatKeyOr
        },
        order: [["updatedAt", "DESC"]]
      });
    }

    if (!ticket) {
      ticket = await Ticket.findOne({
        where: {
          companyId: whatsapp.companyId,
          whatsappId: whatsapp.id,
          isGroup: false,
          status: {
            [Op.in]: ACTIVE_TICKET_STATUSES
          }
        },
        include: [
          {
            model: Contact,
            as: "contact",
            required: true,
            where: {
              number
            }
          }
        ],
        order: [["updatedAt", "DESC"]]
      });
    }

    if (ticket) {
      const syncPatch: any = {};
      if (ticket.contactId !== contact.id) syncPatch.contactId = contact.id;
      if (!ticket.lid && contactIds?.lid) syncPatch.lid = String(contactIds.lid).toLowerCase();
      if (!ticket.jid && contactIds?.jid) syncPatch.jid = String(contactIds.jid).toLowerCase();
      if (Object.keys(syncPatch).length > 0) {
        await ticket.update(syncPatch);
      }
    }
  }

  if (!ticket) {
    ticket = await FindOrCreateTicketService(
      contact,
      whatsapp,
      unreadMessages,
      whatsapp.companyId,
      0,
      0,
      groupContact,
      "whatsapp",
      false,
      false,
      settings || ({} as any)
    );
  }

  await ticket.update({
    lastMessage: ticketLastMessage
  });

  if (isEditedEvent) {
    const targetMessageId = extractWuzapiEditedTargetId(normalizedMessagePayload, body, event);
    if (targetMessageId) {
      const editedTargetWid = `wuzapi:${remoteJid}:${targetMessageId}`;
      const messageToUpdate = await Message.findOne({
        where: {
          companyId: whatsapp.companyId,
          ticketId: ticket.id,
          [Op.or]: [{ wid: editedTargetWid }, { messageId: targetMessageId }]
        }
      });

      if (messageToUpdate) {
        const previousBody = String(messageToUpdate.body || "");
        let currentDataJson: any = {};
        try {
          currentDataJson = messageToUpdate.dataJson ? JSON.parse(messageToUpdate.dataJson) : {};
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
          newBody: finalBody,
          provider: "wuzapi"
        });

        await messageToUpdate.update({
          isEdited: true,
          body: finalBody,
          dataJson: JSON.stringify({
            ...currentDataJson,
            __lastEditedOldBody: previousBody,
            __lastEditedNewBody: finalBody,
            __lastEditedAt: editedAt,
            __editHistory: editHistory
          })
        });

        await ticket.update({ lastMessage: finalBody || ticketLastMessage });

        const io = getIO();
        io.of(String(whatsapp.companyId)).emit(`company-${whatsapp.companyId}-appMessage`, {
          action: "update",
          message: messageToUpdate
        });
        io.of(String(whatsapp.companyId)).emit(`company-${whatsapp.companyId}-ticket`, {
          action: "update",
          ticket
        });
      }
    }

    return;
  }

  let quotedMsgId: number | undefined;
  if (mediaType === "reactionMessage") {
    const reactionTargetId = extractReactionTargetId(messagePayload, event, body);
    const quotedMsg = await findQuotedMessage({
      companyId: whatsapp.companyId,
      ticketId: ticket.id,
      remoteJid,
      targetId: reactionTargetId
    });
    if (quotedMsg?.id) {
      quotedMsgId = Number(quotedMsg.id);
    }
  } else {
    const quotedTargetId = extractQuotedTargetId(messagePayload, event, body);
    if (quotedTargetId) {
      const quotedMsg = await findQuotedMessage({
        companyId: whatsapp.companyId,
        ticketId: ticket.id,
        remoteJid,
        targetId: quotedTargetId
      });
      if (quotedMsg?.id) {
        quotedMsgId = Number(quotedMsg.id);
      }
    }
  }

  const enrichedDataJson = (() => {
    try {
      const interactiveCard = extractInteractiveCard(normalizedMessagePayload);
      const metadataPatch = {
        __mediaOriginalName: extractedMedia?.fileName || "",
        ...(interactiveCard ? { __interactiveCard: interactiveCard } : {}),
        ...(adMetadata.hasAdContext
          ? {
              __wuzapiAdMetadata: {
                isClickToWhatsapp: adMetadata.isClickToWhatsapp,
                ctwaClidPresent: adMetadata.ctwaClidPresent,
                externalAdReply: adMetadata.externalAdReply,
                referral: adMetadata.referral
              }
            }
          : {})
      };

      if (body && typeof body === "object" && !Array.isArray(body)) {
        return JSON.stringify({
          ...body,
          ...metadataPatch
        });
      }

      return JSON.stringify({
        payload: body,
        ...metadataPatch
      });
    } catch {
      return JSON.stringify(body);
    }
  })();

  const persistedIncomingMessage = await CreateMessageService({
    companyId: whatsapp.companyId,
    messageData: {
      wid: messageWid,
      messageId: messageIdRaw || undefined,
      ticketId: ticket.id,
      contactId: contact.id,
      body: finalBody,
      fromMe: isFromMe,
      read: isFromMe,
      ack: isFromMe ? 2 : 1,
      mediaType,
      quotedMsgId,
      mediaUrl: mediaFileName || undefined,
      isForwarded: isForwarded ?? false,
      remoteJid,
      participant: isGroupChat ? (participantJid || undefined) : undefined,
      dataJson: enrichedDataJson,
      channel: "whatsapp"
    }
  });

  // Se o ticket estiver aguardando avaliação (NPS), tenta processar a resposta do cliente
  // antes de seguir com roteamento normal.
  if (!isFromMe && ticket.status === "nps") {
    const npsHandled = await HandleNpsReplyService({
      ticket,
      companyId: ticket.companyId,
      text: String(finalBody || "")
    });

    if (npsHandled) {
      return;
    }
  }

  const shouldWarnAudioNotAccepted =
    !isFromMe &&
    !isGroupChat &&
    String(mediaType || "").toLowerCase() === "audio" &&
    (!contact?.acceptAudioMessage ||
      String((settings as any)?.acceptAudioMessageContact || "").trim() === "disabled");

  if (shouldWarnAudioNotAccepted) {
    const audioBlockMessage = String(
      (settings as any)?.AcceptAudioMessageContactMessage ||
      "Infelizmente não conseguimos escutar nem enviar áudios por este canal de atendimento, por favor, envie uma mensagem de texto."
    ).trim();

    await wbot.sendMessage(remoteJid, {
      text: `\u200e*Assistente Virtual*:\n${audioBlockMessage}`
    });

    await CreateMessageService({
      companyId: whatsapp.companyId,
      messageData: {
        wid: `wuzapi-audio-block:${remoteJid}:${Date.now()}`,
        ticketId: ticket.id,
        contactId: contact.id,
        body: `*Assistente Virtual*:\n${audioBlockMessage}`,
        fromMe: true,
        read: true,
        ack: 2,
        mediaType: "conversation",
        quotedMsgId: null,
        remoteJid,
        channel: "whatsapp",
        dataJson: JSON.stringify({ audioBlocked: true }),
        isForwarded: false
      }
    });
  }

  if (
    !isFromMe &&
    (effectiveSettings as any)?.scheduleType &&
    Number(ticket.queueId) > 0 &&
    (!ticket.isGroup || whatsapp.groupAsTicket === "enabled") &&
    !ticket.imported
  ) {
    const queue = await Queue.findByPk(ticket.queueId);

    if (queue) {
      let currentSchedule: Awaited<ReturnType<typeof VerifyCurrentSchedule>> | null =
        null;

      if ((effectiveSettings as any)?.scheduleType === "queue") {
        currentSchedule = await VerifyCurrentSchedule(
          whatsapp.companyId,
          queue.id,
          0
        );
      }

      const maxRepeats =
        whatsapp.maxUseBotQueues && whatsapp.maxUseBotQueues > 0
          ? whatsapp.maxUseBotQueues
          : 4;

      if (
        (effectiveSettings as any)?.scheduleType === "queue" &&
        ticket.amountUsedBotQueues < maxRepeats &&
        (!currentSchedule || currentSchedule.inActivity === false)
      ) {
        const ticketTraking = await FindOrCreateATicketTrakingService({
          ticketId: ticket.id,
          companyId: whatsapp.companyId,
          whatsappId: whatsapp.id,
          userId: ticket.userId
        });

        if (Number(whatsapp.timeUseBotQueues) > 0) {
          if (ticket.isOutOfHour === false && ticketTraking.chatbotAt !== null) {
            await ticketTraking.update({
              chatbotAt: null
            });
            await ticket.update({
              amountUsedBotQueues: 0
            });
          }

          const dataLimite = new Date();
          const agora = new Date();

          if (ticketTraking.chatbotAt !== null) {
            dataLimite.setMinutes(
              ticketTraking.chatbotAt.getMinutes() +
                Number(whatsapp.timeUseBotQueues)
            );

            if (
              agora < dataLimite &&
              whatsapp.timeUseBotQueues !== "0" &&
              ticket.amountUsedBotQueues !== 0
            ) {
              return;
            }
          }

          await ticketTraking.update({
            chatbotAt: null
          });
        }

        const outOfHoursMessage = String(
          currentSchedule?.message || queue.outOfHoursMessage || ""
        ).trim();

        if (outOfHoursMessage) {
          const body = formatBody(`${outOfHoursMessage}`, ticket as any);
          await wbot.sendMessage(
            `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
            { text: body }
          );
        }

        await ticket.update({
          isOutOfHour: true,
          amountUsedBotQueues: Number(ticket.amountUsedBotQueues || 0) + 1
        });
        return;
      }
    }
  }

  const shouldHandleQueueRouting =
    !isFromMe &&
    !isGroupChat &&
    !ticket.imported &&
    !ticket.queueId &&
    !ticket.userId &&
    !ticket.useIntegration;
  let integrationHandledByQueueRouting = false;

  if (shouldHandleQueueRouting) {
    const flowInputBody = String(
      finalBody || (mediaType ? getMediaSummaryLabel(mediaType) : "")
    ).trim();

    const isQueueScheduleEnabled =
      String((effectiveSettings as any)?.scheduleType || "").toLowerCase() === "queue";
    const defaultQueueId = Number((whatsapp as any)?.sendIdQueue || 0);

    // No provider Wuzapi, quando o contato entra direto pela fila da conexão (sendIdQueue),
    // aplicamos a regra de expediente da fila antes de qualquer roteamento.
    if (isQueueScheduleEnabled && defaultQueueId > 0) {
      const queueForSchedule = await Queue.findByPk(defaultQueueId);

      if (queueForSchedule) {
        const currentSchedule = await VerifyCurrentSchedule(
          whatsapp.companyId,
          queueForSchedule.id,
          0
        );

        if (!currentSchedule || currentSchedule.inActivity === false) {
          const outOfHoursMessage = String(
            currentSchedule?.message || queueForSchedule.outOfHoursMessage || ""
          ).trim();

          if (outOfHoursMessage) {
            const body = formatBody(`${outOfHoursMessage}`, ticket as any);
            await wbot.sendMessage(
              `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
              { text: body }
            );
          }

          await ticket.update({
            isOutOfHour: true,
            amountUsedBotQueues: Number(ticket.amountUsedBotQueues || 0) + 1
          });

          return;
        }
      }
    }

    const queueIds = await resolveQueueIdsForWhatsapp(whatsapp.id);

    if (queueIds.length === 0) {
      if (
        whatsapp.greetingMessage &&
        whatsapp.greetingMessage.trim().length > 0
      ) {
        try {
          const body = formatBody(`\u200e${whatsapp.greetingMessage}`, ticket as any);
          await wbot.sendMessage(
            `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
            { text: body }
          );
        } catch (e) {
          logger.error(e);
        }
      }
      
      if (whatsapp.sendIdQueue) {
        await ticket.update({ queueId: whatsapp.sendIdQueue });
      }

      await ticket.reload();
    } else {
    const ticketTraking = await FindOrCreateATicketTrakingService({
      ticketId: ticket.id,
      companyId: whatsapp.companyId,
      whatsappId: whatsapp.id,
      userId: ticket.userId
    });

    const queueMsg = {
      key: {
        id: messageIdRaw || messageWid,
        fromMe: false,
        remoteJid: remoteJid || `${number}@s.whatsapp.net`,
        participant: isGroupChat ? participantJid : undefined
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      message: {
        conversation: flowInputBody
      },
      pushName: pushName || contact.name
    } as any;

    await verifyQueue(
      wbot as any,
      queueMsg,
      ticket as any,
      contact as any,
      effectiveSettings as any,
      ticketTraking as any
    );

    await ticket.reload();
    integrationHandledByQueueRouting = Boolean(
      (ticket as any)?.useIntegration && (ticket as any)?.integrationId
    );
    }
  }

  if (integrationHandledByQueueRouting) {
    logger.info(
      `[WUZAPI_WEBHOOK] Integração já processada em verifyQueue (ticket=${ticket.id}); evitando reprocessamento no mesmo evento`
    );
    return;
  }

  const shouldHandleFlowContinuation =
    !isFromMe &&
    !isGroupChat &&
    !ticket.imported &&
    !!ticket.flowWebhook &&
    !!ticket.flowStopped &&
    !!ticket.lastFlowId &&
    !!(ticket.integrationId || whatsapp.integrationId);

  const shouldHandleConnectionIntegration =
    !isFromMe &&
    !isGroupChat &&
    !ticket.imported &&
    !ticket.userId &&
    !ticket.useIntegration &&
    !!whatsapp.integrationId;

  const shouldHandleConnectionPrompt =
    !isFromMe &&
    !isGroupChat &&
    !ticket.imported &&
    !ticket.queueId &&
    !ticket.userId &&
    !isNaN(Number((whatsapp as any)?.promptId)) &&
    Number((whatsapp as any)?.promptId) > 0;

  if (shouldHandleConnectionPrompt) {
    try {
      const promptId = Number((whatsapp as any).promptId);
      const prompt = (await ShowPromptService({
        promptId,
        companyId: whatsapp.companyId
      })) as unknown as IOpenAi;

      const flowInputBody = String(
        finalBody || (mediaType ? getMediaSummaryLabel(mediaType) : "")
      ).trim();

      const isAudioPromptInput = String(mediaType || "").toLowerCase() === "audio";
      const isImagePromptInput = String(mediaType || "").toLowerCase() === "image";
      const promptMsg = {
        key: {
          id: messageIdRaw || messageWid,
          fromMe: false,
          remoteJid: remoteJid || `${number}@s.whatsapp.net`,
          participant: isGroupChat ? participantJid : undefined
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        message: isAudioPromptInput
          ? ({ audioMessage: {} } as any)
          : isImagePromptInput
            ? ({
                imageMessage: {
                  mimetype: extractedMedia?.mimetype || "image/jpeg",
                  caption: finalBody || undefined
                }
              } as any)
            : {
                conversation: flowInputBody
              },
        pushName: pushName || contact.name
      } as any;

      const ticketTraking = await FindOrCreateATicketTrakingService({
        ticketId: ticket.id,
        companyId: whatsapp.companyId,
        whatsappId: whatsapp.id,
        userId: ticket.userId
      });

      await handleOpenAi(
        prompt,
        promptMsg,
        wbot,
        ticket,
        contact,
        isAudioPromptInput || isImagePromptInput ? persistedIncomingMessage : undefined,
        ticketTraking
      );

      return;
    } catch (error: any) {
      logger.error(
        `[WUZAPI_WEBHOOK] falha ao acionar IA da conexão (promptId=${(whatsapp as any)?.promptId}, ticket=${ticket.id}): ${String(
          error?.message || error
        )}`
      );
    }
  }

  const shouldHandleTicketIntegration =
    !isFromMe &&
    !isGroupChat &&
    !ticket.imported &&
    !ticket.userId &&
    !!ticket.useIntegration &&
    !!ticket.integrationId;

  if (
    !shouldHandleFlowContinuation &&
    !shouldHandleConnectionIntegration &&
    !shouldHandleTicketIntegration
  ) {
    return;
  }

  const integrationIdToUse =
    (shouldHandleTicketIntegration || shouldHandleFlowContinuation) &&
    !!ticket.integrationId
      ? ticket.integrationId
      : whatsapp.integrationId;

  if (!integrationIdToUse) {
    return;
  }

  const queueIntegration = await ShowQueueIntegrationService(
    String(integrationIdToUse),
    whatsapp.companyId
  );

  if (!queueIntegration) {
    return;
  }

  // Mantém o comportamento alinhado ao listener do Baileys:
  // quando o contato desabilita o bot/flow, não executa FlowBuilder.
  if (queueIntegration.type === "flowbuilder" && contact?.disableBot) {
    logger.info(
      `[WUZAPI_WEBHOOK] FlowBuilder ignorado por disableBot no contato | ticket=${ticket.id} | contact=${contact.id}`
    );
    return;
  }

  const flowInputBody = String(
    finalBody || (mediaType ? getMediaSummaryLabel(mediaType) : "")
  ).trim();

  let isMenuNode = false;
  let flowForContinuation: FlowBuilderModel | null = null;
  let currentNode: any = null;
  let currentNodeType = "";
  if (
    queueIntegration.type === "flowbuilder" &&
    ticket.flowWebhook &&
    ticket.flowStopped &&
    ticket.lastFlowId
  ) {
    flowForContinuation = await FlowBuilderModel.findOne({
      where: { id: ticket.flowStopped }
    });
    const nodes = Array.isArray((flowForContinuation as any)?.flow?.nodes)
      ? (flowForContinuation as any).flow.nodes
      : [];
    currentNode = nodes.find(
      (node: any) => String(node?.id) === String(ticket.lastFlowId)
    );
    currentNodeType = String(currentNode?.type || "")
      .trim()
      .toLowerCase();

    isMenuNode = currentNodeType === "menu";

    if (currentNodeType && !FLOW_NODE_TYPES_EXPECTING_INPUT.has(currentNodeType)) {
      logger.info(
        `[WUZAPI_WEBHOOK] flowbuilder aguardando nó automático; mensagem ignorada | ticket=${ticket.id} | nodeType=${currentNodeType} | lastFlowId=${ticket.lastFlowId}`
      );
      return;
    }
  }

  const previousTicket = await Ticket.findOne({
    where: {
      id: { [Op.ne]: ticket.id },
      contactId: ticket.contactId,
      companyId: whatsapp.companyId,
      whatsappId: whatsapp.id
    },
    order: [["updatedAt", "DESC"]]
  });

  const isImageFlowInput = String(mediaType || "").toLowerCase() === "image";
  const integrationMsg = {
    key: {
      id: messageIdRaw || messageWid,
      fromMe: false,
      remoteJid: remoteJid || `${number}@s.whatsapp.net`,
      participant: isGroupChat ? participantJid : undefined
    },
    messageTimestamp: Math.floor(Date.now() / 1000),
    message: {
      conversation: flowInputBody,
      // Marca a mensagem sintética como imagem (o binário já foi persistido em
      // disco por `persistWuzapiMedia`/`persistedIncomingMessage` acima) para que
      // o nó de IA do FlowBuilder (ActionsWebhookService -> handleOpenAi) consiga
      // localizar a Message real pelo wid e leia a imagem em vez de tratar o
      // rótulo genérico como texto comum.
      ...(isImageFlowInput
        ? {
            imageMessage: {
              mimetype: extractedMedia?.mimetype || "image/jpeg",
              caption: finalBody || undefined
            }
          }
        : {})
    },
    pushName: pushName || contact.name
  } as any;

  if (
    queueIntegration.type === "flowbuilder" &&
    currentNodeType === "question" &&
    flowForContinuation &&
    flowInputBody
  ) {
    const nodes = Array.isArray((flowForContinuation as any)?.flow?.nodes)
      ? (flowForContinuation as any).flow.nodes
      : [];
    const connections = Array.isArray(
      (flowForContinuation as any)?.flow?.connections
    )
      ? (flowForContinuation as any).flow.connections
      : [];

    const answerKey = String(
      currentNode?.data?.typebotIntegration?.answerKey || ""
    ).trim();
    const oldDataWebhook = (ticket.dataWebhook || {}) as {
      variables?: Record<string, unknown>;
      [key: string]: unknown;
    };
    const nextConnection = connections.find(
      (connection: any) =>
        String(connection?.source) === String(currentNode?.id) &&
        Boolean(connection?.target)
    );
    const lastFlowId = nextConnection?.target;
    const nextDataWebhook = {
      ...oldDataWebhook,
      variables: {
        ...(oldDataWebhook?.variables || {}),
        ...(answerKey ? { [answerKey]: flowInputBody } : {})
      }
    };

    if (!lastFlowId) {
      await ticket.update({
        dataWebhook: nextDataWebhook
      });
      return;
    }

    await ticket.update({
      lastFlowId,
      dataWebhook: nextDataWebhook
    });

    const mountDataContact = {
      number: contact.number,
      name: contact.name,
      email: contact.email
    };

    await ActionsWebhookService(
      whatsapp.id,
      parseInt(String(ticket.flowStopped), 10),
      ticket.companyId,
      nodes,
      connections,
      String(lastFlowId),
      null,
      "",
      "",
      "",
      ticket.id,
      mountDataContact,
      integrationMsg
    );

    return;
  }

  // Guard contra disparo duplicado do menu inicial do FlowBuilder no Wuzapi.
  // Webhooks podem chegar duplicados com JIDs diferentes (@lid vs @s.whatsapp.net),
  // e a deduplicação por messageId (linha ~1564) só protege a gravação da mensagem,
  // não o disparo do fluxo. Este guard bloqueia o menu por contato/conexão.
  const isWuzapiWelcomeDispatch =
    queueIntegration.type === "flowbuilder" &&
    !ticket.flowStopped &&
    !ticket.lastFlowId &&
    !ticket.flowWebhook &&
    !ticket.userId;

  if (isWuzapiWelcomeDispatch) {
    const guardKey = `wuzapi:flow-welcome:${whatsapp.companyId}:${whatsapp.id}:${number}`;
    try {
      const guardLock = await cacheLayer
        .getRedisInstance()
        .set(guardKey, "1", "EX", 45, "NX");

      if (!guardLock) {
        logger.info(
          `[WUZAPI_WEBHOOK] Menu inicial FlowBuilder suprimido por dedupe (ticket=${ticket.id}, number=${number})`
        );
        return;
      }
    } catch (err) {
      logger.warn(
        `[WUZAPI_WEBHOOK] Falha no guard Redis do menu FlowBuilder; seguindo fluxo (ticket=${ticket.id}): ${String(
          (err as any)?.message || err
        )}`
      );
    }
  }

  await handleMessageIntegration(
    integrationMsg,
    wbot,
    whatsapp.companyId,
    queueIntegration as any,
    ticket as any,
    isMenuNode,
    whatsapp as any,
    contact as any,
    (previousTicket as any) || null
  );
};

export default handleWuzapiWebhook;
