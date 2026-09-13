import { getIO } from "../../libs/socket";
import { Op } from "sequelize";
import { tryGetWbot } from "../../libs/wbot";
import CompaniesSettings from "../../models/CompaniesSettings";
import Message from "../../models/Message";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import CreateMessageService from "../MessageServices/CreateMessageService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import { closeTicketsImported } from "../WhatsappService/ImportWhatsAppMessageService";
import {
  isWuzapiProvider,
  resolveWuzapiAvatarUrlByCandidates,
  wuzapiRequest
} from "./wuzapiClient";
import { extractInteractiveMessageBody } from "./wuzapiInteractive";
import { extractWuzapiMedia, persistWuzapiMedia } from "./wuzapiMedia";

const numberFromEnv = (name: string, fallback: number): number => {
  const raw = String(process.env[name] || "").trim();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const HISTORY_LIMIT = numberFromEnv("WUZAPI_HISTORY_LIMIT", 2000);
const HISTORY_SYNC_COUNT = numberFromEnv("WUZAPI_HISTORY_SYNC_COUNT", 5000);
const HISTORY_SYNC_WAIT_MS = numberFromEnv("WUZAPI_HISTORY_SYNC_WAIT_MS", 10000);
const HISTORY_FETCH_CONCURRENCY = numberFromEnv("WUZAPI_HISTORY_FETCH_CONCURRENCY", 8);
const INDEX_RETRY_ATTEMPTS = numberFromEnv("WUZAPI_INDEX_RETRY_ATTEMPTS", 20);
const INDEX_RETRY_WAIT_MS = numberFromEnv("WUZAPI_INDEX_RETRY_WAIT_MS", 3000);
const INDEX_RETRY_STABLE_ATTEMPTS = numberFromEnv("WUZAPI_INDEX_RETRY_STABLE_ATTEMPTS", 3);
const runningImports = new Set<number>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeJid = (value: string): string => {
  const raw = String(value || "").trim();
  if (!raw || !raw.includes("@")) return raw;
  const [left, domain] = raw.split("@");
  const primaryId = (left || "").split(":")[0] || left || "";
  return `${primaryId}@${String(domain || "").toLowerCase()}`;
};

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

const normalizeGroupNumber = (jid: string): string => {
  const normalized = normalizeJid(String(jid || ""));
  if (!isGroupJid(normalized)) return "";
  return String(normalized || "")
    .split("@")[0]
    .split(":")[0]
    .replace(/[^\d-]/g, "");
};
const GROUP_NAME_CACHE_TTL_MS = 10 * 60 * 1000;
const groupNameCache = new Map<string, { name: string; expiresAt: number }>();

const isGroupJid = (jid: string): boolean =>
  String(jid || "")
    .toLowerCase()
    .endsWith("@g.us");

const isBroadcastJid = (jid: string): boolean => {
  const normalized = normalizeJid(String(jid || ""));
  return normalized === "status@broadcast" || normalized.endsWith("@broadcast");
};

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

const parseTimestamp = (value: any): number => {
  if (typeof value === "number") {
    if (value > 10_000_000_000) return value;
    return value * 1000;
  }

  const stringValue = String(value || "").trim();
  if (!stringValue) return NaN;

  const asNumber = Number(stringValue);
  if (Number.isFinite(asNumber)) {
    if (asNumber > 10_000_000_000) return asNumber;
    return asNumber * 1000;
  }

  const parsed = new Date(stringValue).getTime();
  return Number.isFinite(parsed) ? parsed : NaN;
};

const extractOriginalTimestamp = (entry: any): number => {
  const parsed = parseDataJson(entry?.datajson ?? entry?.data_json);
  const info = parsed?.Info || parsed?.info || {};

  const timestampCandidates = [
    info?.Timestamp,
    info?.timestamp,
    info?.MessageTimestamp,
    info?.messageTimestamp,
    parsed?.timestamp,
    parsed?.Timestamp,
    parsed?.messageTimestamp,
    parsed?.MessageTimestamp,
    parsed?.Message?.messageTimestamp,
    parsed?.Message?.Timestamp,
    parsed?.message?.messageTimestamp,
    parsed?.message?.Timestamp,
    parsed?.RawMessage?.messageTimestamp,
    parsed?.RawMessage?.Timestamp,
    parsed?.rawMessage?.messageTimestamp,
    parsed?.rawMessage?.Timestamp,
    parsed?.event?.Info?.Timestamp,
    parsed?.event?.Info?.timestamp,
    parsed?.event?.info?.Timestamp,
    parsed?.event?.info?.timestamp
  ];

  for (const candidate of timestampCandidates) {
    const parsedValue = parseTimestamp(candidate);
    if (Number.isFinite(parsedValue)) return parsedValue;
  }

  // Não usar fallback de entry.timestamp:
  // no WuzAPI esse campo pode refletir momento de gravação no histórico local.
  return NaN;
};

const parseDataJson = (raw: any): any => {
  if (!raw) return null;
  if (typeof raw === "object") return raw;

  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
};

const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const output: R[] = new Array(items.length);
  const safeConcurrency = Math.max(1, Math.floor(concurrency));
  let cursor = 0;

  const next = async (): Promise<void> => {
    const index = cursor;
    cursor += 1;
    if (index >= items.length) return;
    output[index] = await worker(items[index], index);
    await next();
  };

  const runners = Array.from(
    { length: Math.min(safeConcurrency, items.length) },
    () => next()
  );
  await Promise.all(runners);
  return output;
};

const isFromMeMessage = (entry: any, whatsapp: Whatsapp): boolean => {
  const parsed = parseDataJson(entry?.datajson ?? entry?.data_json);
  const info = parsed?.Info || parsed?.info || {};

  const byInfo =
    info?.IsFromMe ??
    info?.isFromMe ??
    info?.FromMe ??
    parsed?.fromMe ??
    parsed?.from_me;

  if (typeof byInfo === "boolean") return byInfo;

  const senderRaw = String(entry?.sender_jid || "").trim();
  if (!senderRaw) return false;
  if (senderRaw.toLowerCase() === "me") return true;

  const senderDigits = normalizeDigits(senderRaw);
  const accountDigits = normalizeDigits(String(whatsapp.number || ""));
  if (senderDigits && accountDigits && senderDigits === accountDigits) return true;

  const accountJid = normalizeJid(`${accountDigits}@s.whatsapp.net`);
  const senderJid = normalizeJid(senderRaw);
  return Boolean(accountDigits && senderJid === accountJid);
};

const resolveMediaType = (
  entry: any,
  fallbackMediaType?: string
): string | undefined => {
  const type = String(entry?.message_type || "")
    .trim()
    .toLowerCase();

  if (!type || ["text", "conversation", "extendedtext", "extended_text"].includes(type)) {
    return fallbackMediaType;
  }

  if (type.includes("image")) return "image";
  if (type.includes("video")) return "video";
  if (type.includes("audio") || type.includes("voice")) return "audio";
  if (type.includes("document") || type.includes("file")) return "document";
  if (type.includes("sticker")) return "sticker";
  if (type.includes("location")) return "location";
  if (type.includes("contact")) return "contact";
  if (type.includes("unknown")) return fallbackMediaType;

  return fallbackMediaType || type;
};

const resolveBody = (entry: any, mediaType?: string): string => {
  const text = String(entry?.text_content || "").trim();
  if (text) return text;
  if (mediaType && mediaType !== "unknown") return `:${mediaType}:`;
  return ":message:";
};

const extractLocationBodyFromPayload = (messagePayload: any): string => {
  const locationNode =
    messagePayload?.locationMessage ||
    messagePayload?.ephemeralMessage?.message?.locationMessage ||
    messagePayload?.viewOnceMessage?.message?.locationMessage ||
    messagePayload?.viewOnceMessageV2?.message?.locationMessage ||
    messagePayload?.viewOnceMessageV2Extension?.message?.locationMessage;

  if (!locationNode || typeof locationNode !== "object") return "";

  const name = String(locationNode?.name || "").trim();
  const address = String(locationNode?.address || "").trim();
  const lat = Number(locationNode?.degreesLatitude);
  const lng = Number(locationNode?.degreesLongitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const mapLink = hasCoords ? `https://maps.google.com/maps?q=${lat}%2C${lng}&z=17` : "";

  return [name, address, mapLink].filter(Boolean).join("\n").trim();
};

const getMediaSummaryLabel = (mediaType?: string): string => {
  const normalized = String(mediaType || "").trim().toLowerCase();
  if (!normalized) return "midia";
  if (normalized === "audio") return "audio";
  if (normalized === "video") return "video";
  if (normalized === "image") return "imagem";
  if (normalized === "document") return "Documento";
  if (normalized === "sticker") return "figurinha";
  if (normalized === "location") return "localizacao";
  if (normalized === "contact") return "contato";
  return normalized;
};

const isPlaceholderBody = (value: string): boolean => {
  const body = String(value || "").trim().toLowerCase();
  if (!body) return true;
  if (body === ":message:" || body === ":unknown:") return true;
  return /^:[a-z_]+:$/.test(body);
};

const extractMessagePayloadFromEntry = (entry: any): any => {
  const parsed = parseDataJson(entry?.datajson ?? entry?.data_json);

  const candidates = [
    parsed,
    parsed?.Message,
    parsed?.message,
    parsed?.RawMessage?.message,
    parsed?.rawMessage?.message,
    parsed?.RawMessage,
    parsed?.rawMessage,
    parsed?.event?.Message,
    parsed?.event?.message,
    parsed?.event?.RawMessage?.message,
    parsed?.event?.rawMessage?.message
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate?.message) return candidate.message;
    if (candidate?.Message) return candidate.Message;
    return candidate;
  }

  return null;
};

const extractContactDisplayName = (entry: any, parsed: any): string => {
  const info = parsed?.Info || parsed?.info || {};
  const rawMessage = parsed?.RawMessage || parsed?.rawMessage || {};
  const rawMessageInfo = rawMessage?.Info || rawMessage?.info || {};

  const candidates = [
    entry?.push_name,
    entry?.pushName,
    entry?.pushname,
    entry?.sender_name,
    entry?.senderName,
    entry?.notify,
    entry?.Notify,
    entry?.verifiedName,
    entry?.VerifiedName,
    entry?.contactName,
    entry?.contact_name,
    entry?.name,
    info?.PushName,
    info?.pushName,
    info?.pushname,
    info?.SenderName,
    info?.senderName,
    info?.Notify,
    info?.notify,
    info?.VerifiedName,
    info?.verifiedName,
    rawMessageInfo?.PushName,
    rawMessageInfo?.pushName,
    rawMessageInfo?.pushname,
    rawMessageInfo?.SenderName,
    rawMessageInfo?.senderName,
    rawMessageInfo?.Notify,
    rawMessageInfo?.notify,
    rawMessageInfo?.VerifiedName,
    rawMessageInfo?.verifiedName,
    parsed?.pushName,
    parsed?.pushname,
    parsed?.PushName,
    parsed?.senderName,
    parsed?.SenderName,
    parsed?.notify,
    parsed?.Notify,
    parsed?.verifiedName,
    parsed?.VerifiedName,
    parsed?.contactName,
    parsed?.contact_name,
    parsed?.event?.Info?.PushName,
    parsed?.event?.info?.PushName,
    parsed?.event?.Info?.pushName,
    parsed?.event?.info?.pushName,
    parsed?.event?.Info?.pushname,
    parsed?.event?.info?.pushname,
    parsed?.event?.Info?.SenderName,
    parsed?.event?.info?.SenderName,
    parsed?.event?.Info?.senderName,
    parsed?.event?.info?.senderName,
    parsed?.event?.Info?.Notify,
    parsed?.event?.info?.Notify,
    parsed?.event?.Info?.notify,
    parsed?.event?.info?.notify,
    parsed?.event?.Info?.VerifiedName,
    parsed?.event?.info?.VerifiedName,
    parsed?.event?.Info?.verifiedName,
    parsed?.event?.info?.verifiedName
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }

  return "";
};

const sanitizeContactDisplayName = (name: string, contactNumber: string): string => {
  const value = String(name || "").trim();
  if (!value) return "";

  const normalized = value.toLowerCase();
  if (normalized.includes("@s.whatsapp.net") || normalized.includes("@c.us")) return "";
  if (normalized.includes("@g.us") || normalized.includes("@lid")) return "";

  const digitsOnly = value.replace(/\D/g, "");
  if (digitsOnly && contactNumber && digitsOnly === String(contactNumber || "")) return "";

  if (/^[0-9a-f]{16,}$/i.test(value.replace(/[\s-]/g, ""))) return "";
  if (/^(id|jid|user|contact)[_:\-]/i.test(value)) return "";

  return value;
};

const chunkArray = <T>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};

const extractGroupDisplayName = (entry: any, parsed: any, fallback: string): string => {
  const info = parsed?.Info || parsed?.info || {};

  const candidates = [
    entry?.chat_name,
    entry?.chatName,
    entry?.group_name,
    entry?.groupName,
    info?.ChatName,
    info?.chatName,
    info?.GroupName,
    info?.groupName,
    parsed?.chatName,
    parsed?.groupName,
    parsed?.event?.Info?.ChatName,
    parsed?.event?.info?.ChatName,
    parsed?.event?.Info?.chatName,
    parsed?.event?.info?.chatName
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }

  return String(fallback || "").trim();
};

const resolveGroupNameFromProvider = async (
  whatsapp: Whatsapp,
  groupJid: string
): Promise<string> => {
  const normalized = normalizeJid(String(groupJid || ""));
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
    // Não interrompe importação se metadata de grupo falhar.
  }

  return "";
};

const AVATAR_CACHE_TTL_MS = 15 * 60 * 1000;
const AVATAR_CACHE_NEGATIVE_TTL_MS = 60 * 1000;
const contactAvatarCache = new Map<string, { url: string; expiresAt: number }>();

const buildAvatarLookupCandidates = (...values: Array<string | null | undefined>): string[] => {
  const candidates: string[] = [];

  for (const value of values) {
    const raw = String(value || "").trim();
    if (!raw) continue;
    const normalized = normalizeJid(raw);

    if (normalized.includes("@")) {
      if (normalized.endsWith("@lid")) continue;
      if (normalized.endsWith("@g.us")) {
        candidates.push(normalized);
        const groupNumber = normalizeGroupNumber(normalized);
        if (groupNumber) candidates.push(groupNumber);
        continue;
      }
      if (
        normalized.endsWith("@s.whatsapp.net") ||
        normalized.endsWith("@c.us")
      ) {
        candidates.push(normalized);
        const phone = normalizeDigits(normalized);
        if (phone) candidates.push(phone);
        continue;
      }
    }

    const phone = normalizeDigits(raw);
    if (phone) candidates.push(phone);
  }

  return Array.from(new Set(candidates));
};

const resolveContactAvatarUrl = async (
  whatsapp: Whatsapp,
  options: { forceRetry?: boolean } = {},
  ...jidOrPhones: Array<string | null | undefined>
): Promise<string> => {
  const candidates = buildAvatarLookupCandidates(...jidOrPhones);
  if (!candidates.length) return "";
  const forceRetry = Boolean(options.forceRetry);

  for (const candidate of candidates) {
    const cachedEntry = contactAvatarCache.get(candidate);
    if (!forceRetry && cachedEntry && cachedEntry.expiresAt > Date.now()) {
      if (cachedEntry.url) return cachedEntry.url;
      continue;
    }

    try {
      const resolved = await resolveWuzapiAvatarUrlByCandidates(whatsapp, [candidate]);
      contactAvatarCache.set(candidate, {
        url: resolved,
        expiresAt: Date.now() + (resolved ? AVATAR_CACHE_TTL_MS : AVATAR_CACHE_NEGATIVE_TTL_MS)
      });
      if (resolved) return resolved;
    } catch {
      contactAvatarCache.set(candidate, {
        url: "",
        expiresAt: Date.now() + AVATAR_CACHE_NEGATIVE_TTL_MS
      });
    }
  }

  return "";
};

const resolveHistoryWid = (entry: any): string => {
  const directId = String(entry?.message_id || "").trim();
  const chatJid = normalizeJid(String(entry?.chat_jid || ""));
  if (directId && chatJid) return `wuzapi:${chatJid}:${directId}`;
  if (directId) return `wuzapi:${directId}`;

  const chat = chatJid;
  const sender = normalizeJid(String(entry?.sender_jid || ""));
  const when = String(parseTimestamp(entry?.timestamp) || "0");
  const type = String(entry?.message_type || "text").trim().toLowerCase();
  return `wuzapi-history-${chat}-${sender}-${when}-${type}`;
};

type IndexResolution = {
  chatJidsByUserId: Record<string, string[]>;
  chatJids: string[];
  selectedUserId?: string;
  availableUserIds: string[];
};

const resolveChatJidsFromIndex = (
  indexPayload: any,
  preferredUserIds: string[] = []
): IndexResolution => {
  const tryCollect = (value: any, collector: Set<string>) => {
    const raw = String(value || "").trim();
    // Importante: para chamar /chat/history precisamos usar o chat_jid exato do índice.
    // Normalizar removendo ":xx" pode quebrar o match no banco do WuzAPI.
    if (raw.includes("@")) collector.add(raw);
  };

  if (Array.isArray(indexPayload)) {
    const output = new Set<string>();
    indexPayload.forEach((item) => {
      tryCollect(item?.chat_jid || item?.chatJid || item, output);
    });
    return {
      chatJidsByUserId: {},
      chatJids: Array.from(output),
      availableUserIds: []
    };
  }

  if (!indexPayload || typeof indexPayload !== "object") {
    return { chatJidsByUserId: {}, chatJids: [], availableUserIds: [] };
  }

  const asMap = indexPayload as Record<string, any>;
  const availableUserIds = Object.keys(asMap);
  const chatJidsByUserId: Record<string, string[]> = {};

  const preferred = preferredUserIds
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const selectedUserId =
    preferred.find((id) => Object.prototype.hasOwnProperty.call(asMap, id)) ||
    (availableUserIds.length === 1 ? availableUserIds[0] : undefined);

  const consumeList = (value: any, collector: Set<string>) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        tryCollect(item?.chat_jid || item?.chatJid || item, collector);
      });
      return;
    }

    if (value && typeof value === "object") {
      tryCollect((value as any)?.chat_jid || (value as any)?.chatJid, collector);
    }
  };

  for (const userId of availableUserIds) {
    const collector = new Set<string>();
    consumeList(asMap[userId], collector);
    if (collector.size > 0) {
      chatJidsByUserId[userId] = Array.from(collector);
    }
  }

  if (selectedUserId) {
    return {
      chatJidsByUserId,
      chatJids: chatJidsByUserId[selectedUserId] || [],
      selectedUserId,
      availableUserIds
    };
  }

  const merged = new Set<string>();
  Object.values(chatJidsByUserId).forEach((list) =>
    list.forEach((chatJid) => merged.add(chatJid))
  );

  return {
    chatJidsByUserId,
    chatJids: Array.from(merged),
    availableUserIds
  };
};

const loadChatHistory = async (whatsapp: Whatsapp, chatJid: string): Promise<any[]> => {
  const data = await wuzapiRequest(whatsapp, "GET", "/chat/history", undefined, {
    params: {
      chat_jid: chatJid,
      limit: HISTORY_LIMIT
    }
  });

  if (Array.isArray(data)) return data;
  if (Array.isArray((data as any)?.messages)) return (data as any).messages;
  return [];
};

const importWuzapiHistoryService = async (whatsappId: number): Promise<void> => {
  if (runningImports.has(whatsappId)) {
    logger.info(`[WUZAPI_IMPORT][${whatsappId}] importação já em andamento, ignorando gatilho.`);
    return;
  }

  runningImports.add(whatsappId);

  try {
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) return;
    if (!isWuzapiProvider(whatsapp)) return;
    if (!whatsapp.importOldMessages || !whatsapp.importRecentMessages) return;

    const companyId = whatsapp.companyId;
    const io = getIO();
    const importStartedAt = Date.now();

    logger.info(
      `[WUZAPI_IMPORT][${whatsappId}] iniciando importação | janela=${whatsapp.importOldMessages}..${whatsapp.importRecentMessages}`
    );
    console.log(
      `[WUZAPI_IMPORT][${whatsappId}] INICIO importação | janela=${whatsapp.importOldMessages}..${whatsapp.importRecentMessages}`
    );

    await whatsapp.update({ statusImportMessages: "Running" });
    io.of(String(companyId)).emit(`importMessages-${companyId}`, {
      action: "update",
      status: { this: -1, all: -1 }
    });

    try {
      await wuzapiRequest(whatsapp, "POST", "/session/history", {
        history: HISTORY_LIMIT
      });
    } catch (error: any) {
      logger.warn(
        `[WUZAPI_IMPORT][${whatsappId}] falha ao configurar histórico: ${
          error?.message || error
        }`
      );
    }

    try {
      await wuzapiRequest(whatsapp, "GET", "/session/history", undefined, {
        params: { count: HISTORY_SYNC_COUNT }
      });
      await sleep(HISTORY_SYNC_WAIT_MS);
    } catch (error: any) {
      logger.warn(
        `[WUZAPI_IMPORT][${whatsappId}] falha ao solicitar sync de histórico: ${
          error?.message || error
        }`
      );
    }

    let providerUserId = "";
    try {
      const statusPayload = await wuzapiRequest(whatsapp, "GET", "/session/status");
      providerUserId = String(statusPayload?.id || "").trim();
      logger.info(
        `[WUZAPI_IMPORT][${whatsappId}] status sessão | provider_user_id=${providerUserId || "indefinido"}`
      );
      console.log(
        `[WUZAPI_IMPORT][${whatsappId}] status sessão | provider_user_id=${providerUserId || "indefinido"}`
      );
    } catch (error: any) {
      logger.warn(
        `[WUZAPI_IMPORT][${whatsappId}] falha ao ler /session/status para identificar usuário: ${
          error?.message || error
        }`
      );
    }

    let chatJids: string[] = [];
    let bestChatJids: string[] = [];
    let bestSelectedUserId = "";
    let stableAttempts = 0;
    for (let attempt = 0; attempt < INDEX_RETRY_ATTEMPTS; attempt++) {
      const indexPayload = await wuzapiRequest(
        whatsapp,
        "GET",
        "/chat/history",
        undefined,
        {
          params: { chat_jid: "index" }
        }
      );
      const indexResolution = resolveChatJidsFromIndex(indexPayload, [providerUserId]);
      let chosenUserId = indexResolution.selectedUserId;

      // Fallback resiliente: quando o provider_user_id não casar com a chave do índice
      // (ou índice misturado), testamos poucas chaves para descobrir qual retorna histórico.
      if (!chosenUserId && indexResolution.availableUserIds.length > 1) {
        const orderedCandidateIds = [
          ...indexResolution.availableUserIds.filter((id) => id === providerUserId),
          ...indexResolution.availableUserIds.filter((id) => id !== providerUserId)
        ];

        for (const candidateId of orderedCandidateIds) {
          const candidateChats = indexResolution.chatJidsByUserId[candidateId] || [];
          if (!candidateChats.length) continue;

          const sampleChats = candidateChats.slice(0, 3);
          let hasData = false;

          for (const sampleChat of sampleChats) {
            try {
              const sampleHistory = await loadChatHistory(whatsapp, sampleChat);
              if (sampleHistory.length > 0) {
                hasData = true;
                break;
              }
            } catch {}
          }

          if (hasData) {
            chosenUserId = candidateId;
            break;
          }
        }
      }

      if (chosenUserId) {
        chatJids = indexResolution.chatJidsByUserId[chosenUserId] || [];
      } else if (indexResolution.availableUserIds.length <= 1) {
        // Compatibilidade com payload antigo/único usuário.
        chatJids = indexResolution.chatJids;
      } else {
        // Índice com múltiplos usuários sem match confiável para esta sessão:
        // não podemos seguir com merge global porque gera histórico bruto=0 e
        // também pode trazer dados de outra instância.
        chatJids = [];
      }

      // Status e listas de transmissão não representam conversas de atendimento.
      chatJids = chatJids.filter(chatJid => !isBroadcastJid(chatJid));

      logger.info(
        `[WUZAPI_IMPORT][${whatsappId}] índice tentativa ${
          attempt + 1
        } | user_selecionado=${chosenUserId || indexResolution.selectedUserId || "nenhum"} | users_disponiveis=${
          indexResolution.availableUserIds.length
        } | chats=${chatJids.length}`
      );
      console.log(
        `[WUZAPI_IMPORT][${whatsappId}] índice tentativa ${
          attempt + 1
        } | user_selecionado=${chosenUserId || indexResolution.selectedUserId || "nenhum"} | users_disponiveis=${
          indexResolution.availableUserIds.length
        } | chats=${chatJids.length}`
      );

      if (chatJids.length > bestChatJids.length) {
        bestChatJids = chatJids;
        bestSelectedUserId = chosenUserId || indexResolution.selectedUserId || "";
        stableAttempts = 0;
      } else if (chatJids.length > 0) {
        stableAttempts += 1;
      }

      if (
        bestChatJids.length > 0 &&
        stableAttempts >= INDEX_RETRY_STABLE_ATTEMPTS
      ) {
        logger.info(
          `[WUZAPI_IMPORT][${whatsappId}] índice estabilizado após ${
            attempt + 1
          } tentativas | user=${bestSelectedUserId || "desconhecido"} | chats=${bestChatJids.length}`
        );
        break;
      }

      if (!chatJids.length && indexResolution.availableUserIds.length > 1) {
        logger.info(
          `[WUZAPI_IMPORT][${whatsappId}] índice múltiplo sem match confiável para provider_user_id=${providerUserId || "indefinido"}; aguardando próximo retry`
        );
      }

      if (attempt === INDEX_RETRY_ATTEMPTS - 1) break;
      logger.info(
        `[WUZAPI_IMPORT][${whatsappId}] aguardando índice consolidar (tentativa ${
          attempt + 1
        }/${INDEX_RETRY_ATTEMPTS}) | melhor=${bestChatJids.length} chats | wait=${INDEX_RETRY_WAIT_MS}ms`
      );
      await sleep(INDEX_RETRY_WAIT_MS);
    }

    if (bestChatJids.length > 0) {
      chatJids = bestChatJids;
    }

    if (!chatJids.length) {
      logger.info(`[WUZAPI_IMPORT][${whatsappId}] nenhum chat encontrado no índice.`);
      console.log(`[WUZAPI_IMPORT][${whatsappId}] índice vazio após retries.`);
    } else {
      logger.info(
        `[WUZAPI_IMPORT][${whatsappId}] índice carregado com ${chatJids.length} chats`
      );
      console.log(
        `[WUZAPI_IMPORT][${whatsappId}] índice carregado com ${chatJids.length} chats`
      );
    }

    const settings = await CompaniesSettings.findOne({ where: { companyId } });

    const importStartMs = new Date(whatsapp.importOldMessages).getTime();
    const importEndMs = new Date(whatsapp.importRecentMessages).getTime();

    if (!Number.isFinite(importStartMs) || !Number.isFinite(importEndMs)) {
      throw new Error("Janela de importação inválida para Wuzapi");
    }

    let processedChats = 0;
    const histories = await mapWithConcurrency(
      chatJids,
      HISTORY_FETCH_CONCURRENCY,
      async (chatJid) => {
        try {
          const history = await loadChatHistory(whatsapp, chatJid);
          if (history.length > 0) {
            logger.info(
              `[WUZAPI_IMPORT][${whatsappId}] chat ${chatJid} retornou ${history.length} mensagens`
            );
          }
          return history;
        } catch (error: any) {
          logger.warn(
            `[WUZAPI_IMPORT][${whatsappId}] falha ao carregar histórico do chat ${chatJid}: ${
              error?.message || error
            }`
          );
          return [];
        } finally {
          processedChats += 1;
          if (processedChats % 10 === 0 || processedChats === chatJids.length) {
            io.of(String(companyId)).emit(`importMessages-${companyId}`, {
              action: "update",
              status: {
                this: -1,
                all: -1,
                phase: "loadingHistory"
              }
            });
          }
        }
      }
    );

    const allMessages: any[] = histories.flat();

    const withTimestamp = allMessages.map((item) => ({
      item,
      timestamp: extractOriginalTimestamp(item)
    }));

    const invalidTimestampCount = withTimestamp.filter(
      ({ timestamp }) => !Number.isFinite(timestamp)
    ).length;

    const filtered = withTimestamp
      .filter(({ timestamp, item }) => {
        if (!Number.isFinite(timestamp)) return false;
        const chatJid = normalizeJid(String(item?.chat_jid || ""));
        if (isBroadcastJid(chatJid)) return false;
        const isGroup = isGroupJid(chatJid);
        if (isGroup && (!whatsapp.importOldMessagesGroups || !whatsapp.allowGroup)) return false;
        return timestamp >= importStartMs && timestamp <= importEndMs;
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    logger.info(
      `[WUZAPI_IMPORT][${whatsappId}] histórico bruto=${allMessages.length} | sem timestamp_original=${invalidTimestampCount} | após filtro de data=${filtered.length}`
    );
    console.log(
      `[WUZAPI_IMPORT][${whatsappId}] histórico bruto=${allMessages.length} | sem timestamp_original=${invalidTimestampCount} | após filtro de data=${filtered.length}`
    );

    const dedupe = new Set<string>();
    const filteredHistoryWids = Array.from(
      new Set(filtered.map(({ item }) => resolveHistoryWid(item)).filter(Boolean))
    );
    const filteredRawMessageIds = Array.from(
      new Set(
        filtered
          .map(({ item }) => String(item?.message_id || "").trim())
          .filter(Boolean)
      )
    );
    const existingByWid = new Map<string, Message>();
    const existingByMessageId = new Map<string, Message>();

    for (const chunk of chunkArray(filteredHistoryWids, 1000)) {
      if (!chunk.length) continue;
      const existingChunk = await Message.findAll({
        where: {
          companyId,
          wid: {
            [Op.in]: chunk
          }
        },
        attributes: [
          "id",
          "wid",
          "messageId",
          "remoteJid",
          "body",
          "mediaType",
          "mediaUrl",
          "dataJson"
        ]
      });

      for (const msg of existingChunk) {
        const wid = String(msg.wid || "").trim();
        if (wid) existingByWid.set(wid, msg);
      }
    }

    for (const chunk of chunkArray(filteredRawMessageIds, 1000)) {
      if (!chunk.length) continue;
      const existingChunk = await Message.findAll({
        where: {
          companyId,
          messageId: {
            [Op.in]: chunk
          }
        },
        attributes: [
          "id",
          "wid",
          "messageId",
          "remoteJid",
          "body",
          "mediaType",
          "mediaUrl",
          "dataJson"
        ]
      });

      for (const msg of existingChunk) {
        const messageId = String(msg.messageId || "").trim();
        if (messageId) existingByMessageId.set(messageId, msg);
      }
    }
    let processed = 0;
    let skippedNoRemoteJid = 0;
    let skippedNoHistoryWid = 0;
    let skippedBatchDuplicate = 0;
    let skippedAlreadyExists = 0;
    let updatedExisting = 0;
    let skippedGroupWithoutNumber = 0;
    let skippedWithoutContactNumber = 0;
    const accountDigits = normalizeDigits(String(whatsapp.number || ""));
    const discoveredNamesByNumber = new Map<string, string>();

    for (const [index, record] of filtered.entries()) {
      const entry = record.item;
      const parsedEntry = parseDataJson(entry?.datajson ?? entry?.data_json);
      const timestampMs = record.timestamp;
      const remoteJid = normalizeJid(String(entry?.chat_jid || ""));
      if (!remoteJid) {
        skippedNoRemoteJid += 1;
        continue;
      }

      const isGroupChat = isGroupJid(remoteJid);
      const fromMe = isFromMeMessage(entry, whatsapp);
      const senderJidRaw = String(entry?.sender_jid || "").trim();
      const senderJid = normalizeJid(senderJidRaw);
      const rawMessageId = String(entry?.message_id || "").trim();

      const historyWid = resolveHistoryWid(entry);
      if (!historyWid) {
        skippedNoHistoryWid += 1;
        continue;
      }
      if (dedupe.has(historyWid)) {
        skippedBatchDuplicate += 1;
        continue;
      }
      dedupe.add(historyWid);

      const messagePayload = extractMessagePayloadFromEntry(entry);
      const interactiveBody = messagePayload
        ? extractInteractiveMessageBody(messagePayload)
        : "";
      const interactiveMediaType = interactiveBody
        ? (
            messagePayload?.interactiveResponseMessage
              ? "interactiveResponseMessage"
              : messagePayload?.buttonsResponseMessage
                ? "buttonsResponseMessage"
                : messagePayload?.listResponseMessage
                  ? "listResponseMessage"
                  : messagePayload?.templateButtonReplyMessage
                    ? "templateButtonReplyMessage"
                    : messagePayload?.interactiveMessage
                      ? "interactiveMessage"
                      : messagePayload?.listMessage
                        ? "listMessage"
                        : messagePayload?.buttonsMessage
                          ? "buttonsMessage"
                          : "interactiveMessage"
          )
        : undefined;
      const extractedMedia = messagePayload
        ? extractWuzapiMedia(messagePayload, parsedEntry || entry)
        : null;
      const mediaType = interactiveMediaType || resolveMediaType(entry, extractedMedia?.mediaType);
      const rawBody = interactiveBody || extractedMedia?.body || resolveBody(entry, mediaType);
      const body =
        mediaType === "location" && isPlaceholderBody(rawBody)
          ? extractLocationBodyFromPayload(messagePayload) || rawBody
          : rawBody;
      const summaryBody =
        mediaType === "document"
          ? "Documento"
          : mediaType && isPlaceholderBody(body)
          ? getMediaSummaryLabel(mediaType)
          : body;
      const mediaUrl =
        extractedMedia && mediaType
          ? await persistWuzapiMedia(companyId, extractedMedia, whatsapp)
          : null;

      const dataJsonString = (() => {
        if (typeof entry?.datajson === "string") return entry.datajson;
        if (typeof entry?.data_json === "string") return entry.data_json;
        try {
          return JSON.stringify(entry?.datajson || entry?.data_json || entry);
        } catch {
          return "{}";
        }
      })();

      const alreadyExists =
        existingByWid.get(historyWid) ||
        (rawMessageId ? existingByMessageId.get(rawMessageId) : undefined);
      if (alreadyExists) {
        const existingBody = String(alreadyExists.body || "").trim();
        const existingMediaType = String(alreadyExists.mediaType || "").trim();
        const existingMediaUrl = String(alreadyExists.getDataValue("mediaUrl") || "").trim();
        const existingDataJson = String(alreadyExists.dataJson || "").trim();

        const nextBody =
          body && body !== ":message:" && (isPlaceholderBody(existingBody) || !existingBody)
            ? body
            : existingBody;
        const nextMediaType =
          mediaType && (!existingMediaType || existingMediaType === "unknown")
            ? mediaType
            : existingMediaType;
        const nextMediaUrl = mediaUrl || existingMediaUrl;

        const updatePayload: Record<string, any> = {};
        if (rawMessageId && !alreadyExists.messageId) {
          updatePayload.messageId = rawMessageId;
        }
        if (historyWid && !alreadyExists.wid) {
          updatePayload.wid = historyWid;
        }
        if (nextBody && nextBody !== existingBody) {
          updatePayload.body = nextBody;
        }
        if (nextMediaType && nextMediaType !== existingMediaType) {
          updatePayload.mediaType = nextMediaType;
        }
        if (nextMediaUrl && nextMediaUrl !== existingMediaUrl) {
          updatePayload.mediaUrl = nextMediaUrl;
        }
        if (dataJsonString && (!existingDataJson || existingDataJson === "{}")) {
          updatePayload.dataJson = dataJsonString;
        }

        if (Object.keys(updatePayload).length > 0) {
          await alreadyExists.update(updatePayload);
          updatedExisting += 1;
        } else {
          skippedAlreadyExists += 1;
        }
        continue;
      }

      let groupContact: any = null;
      let contactRemoteJid = "";
      let contactNumber = "";
      const extractedNameRaw = extractContactDisplayName(entry, parsedEntry);

      if (isGroupChat) {
        const groupNumber = normalizeGroupNumber(remoteJid);
        if (!groupNumber) {
          skippedGroupWithoutNumber += 1;
          continue;
        }
        const groupProfilePicUrl = await resolveContactAvatarUrl(
          whatsapp,
          {},
          remoteJid,
          groupNumber
        );
        const groupNameFromPayload = extractGroupDisplayName(entry, parsedEntry, "");
        const groupNameFromProvider = groupNameFromPayload
          ? ""
          : await resolveGroupNameFromProvider(whatsapp, remoteJid);
        const groupName = groupNameFromPayload || groupNameFromProvider || remoteJid;

        groupContact = await CreateOrUpdateContactService({
          name: groupName || groupNumber,
          number: groupNumber,
          profilePicUrl: groupProfilePicUrl,
          isGroup: true,
          companyId,
          channel: "whatsapp",
          remoteJid,
          whatsappId: whatsapp.id,
          wbot: tryGetWbot(whatsapp.id, companyId) || ({ profilePictureUrl: async () => "" } as any)
        });

        if (
          groupContact &&
          (!String((groupContact as any)?.profilePicUrl || "").trim() ||
            String((groupContact as any)?.profilePicUrl || "").toLowerCase().includes("nopicture"))
        ) {
          const forcedGroupAvatar = await resolveContactAvatarUrl(
            whatsapp,
            { forceRetry: true },
            remoteJid,
            groupNumber
          );
          if (forcedGroupAvatar) {
            await groupContact.update({ profilePicUrl: forcedGroupAvatar });
          }
        }

        const accountJid = whatsapp.number
          ? `${normalizeDigits(String(whatsapp.number || ""))}@s.whatsapp.net`
          : "";
        const participantJid = normalizeJid(
          senderJidRaw.toLowerCase() === "me" ? accountJid : senderJid || accountJid
        );
        contactRemoteJid = participantJid || remoteJid;
        contactNumber = normalizeDigits(contactRemoteJid);
      } else {
        const remoteForContact = normalizeJid(
          fromMe
            ? remoteJid
            : senderJidRaw.toLowerCase() === "me"
            ? remoteJid
            : senderJid || remoteJid
        );
        contactRemoteJid = remoteForContact;
        contactNumber = resolveDirectPhone({
          isFromMe: fromMe,
          accountDigits,
          candidates: [
            remoteForContact,
            remoteJid,
            senderJid,
            senderJidRaw
          ]
        });
      }

      if (!contactNumber) {
        skippedWithoutContactNumber += 1;
        continue;
      }

      const profilePicUrl = await resolveContactAvatarUrl(
        whatsapp,
        {},
        contactRemoteJid,
        contactNumber
      );

      const extractedName = sanitizeContactDisplayName(extractedNameRaw, contactNumber);
      if (extractedName) {
        discoveredNamesByNumber.set(contactNumber, extractedName);
      }
      const cachedDiscoveredName = String(discoveredNamesByNumber.get(contactNumber) || "").trim();
      const resolvedContactName = extractedName || cachedDiscoveredName || contactNumber;

      const contact = await CreateOrUpdateContactService({
        name: resolvedContactName,
        number: contactNumber,
        profilePicUrl,
        isGroup: false,
        companyId,
        channel: "whatsapp",
        remoteJid: `${contactNumber}@s.whatsapp.net`,
        whatsappId: whatsapp.id,
        wbot: tryGetWbot(whatsapp.id, companyId) || ({ profilePictureUrl: async () => "" } as any)
      });

      if (
        !String(contact.profilePicUrl || "").trim() ||
        String(contact.profilePicUrl || "").toLowerCase().includes("nopicture")
      ) {
        const forcedAvatar = await resolveContactAvatarUrl(
          whatsapp,
          { forceRetry: true },
          contactRemoteJid,
          contactNumber
        );
        if (forcedAvatar) {
          await contact.update({ profilePicUrl: forcedAvatar });
        }
      }

      if (
        resolvedContactName &&
        resolvedContactName !== contact.name &&
        (String(contact.name || "").trim() === String(contact.number || "").trim() ||
          String(contact.name || "").trim() === "")
      ) {
        await contact.update({ name: resolvedContactName });
      }

      const ticket = await FindOrCreateTicketService(
        contact,
        whatsapp,
        fromMe ? 0 : 1,
        companyId,
        0,
        0,
        groupContact || undefined,
        "whatsapp",
        true,
        false,
        settings
      );

      if (whatsapp.queueIdImportMessages && ticket.queueId !== whatsapp.queueIdImportMessages) {
        await ticket.update({ queueId: whatsapp.queueIdImportMessages });
      }

      await CreateMessageService({
        companyId,
        messageData: {
          wid: historyWid,
          messageId: rawMessageId || undefined,
          ticketId: ticket.id,
          contactId: contact.id,
          body,
          fromMe,
          read: fromMe,
          ack: fromMe ? 2 : 1,
          mediaType,
          mediaUrl: mediaUrl || undefined,
          remoteJid,
          participant: isGroupChat ? contactRemoteJid : "",
          dataJson: dataJsonString,
          channel: "whatsapp",
          ticketImported: true,
          createdAt: new Date(timestampMs),
          updatedAt: new Date(timestampMs)
        }
      });

      await ticket.update({
        lastMessage: summaryBody,
        imported: new Date(timestampMs)
      });

      processed += 1;

      if (processed % 200 === 0) {
        console.log(
          `[WUZAPI_IMPORT][${whatsappId}] progresso: ${processed}/${filtered.length}`
        );
      }

      if ((index + 1) % 20 === 0 || index + 1 === filtered.length) {
        io.of(String(companyId)).emit(`importMessages-${companyId}`, {
          action: "update",
          status: {
            this: index + 1,
            all: filtered.length,
            date: new Date(timestampMs).toISOString()
          }
        });
      }
    }

    logger.info(
      `[WUZAPI_IMPORT][${whatsappId}] resumo processamento | candidatos=${filtered.length} | importadas=${processed} | atualizadas_existentes=${updatedExisting} | skip_exists=${skippedAlreadyExists} | skip_dup_lote=${skippedBatchDuplicate} | skip_sem_remoteJid=${skippedNoRemoteJid} | skip_sem_historyWid=${skippedNoHistoryWid} | skip_grupo_sem_numero=${skippedGroupWithoutNumber} | skip_sem_contato=${skippedWithoutContactNumber}`
    );
    console.log(
      `[WUZAPI_IMPORT][${whatsappId}] resumo processamento | candidatos=${filtered.length} | importadas=${processed} | atualizadas_existentes=${updatedExisting} | skip_exists=${skippedAlreadyExists} | skip_dup_lote=${skippedBatchDuplicate} | skip_sem_remoteJid=${skippedNoRemoteJid} | skip_sem_historyWid=${skippedNoHistoryWid} | skip_grupo_sem_numero=${skippedGroupWithoutNumber} | skip_sem_contato=${skippedWithoutContactNumber}`
    );

    const totalProcessed = processed + updatedExisting;

    if (totalProcessed && whatsapp.closedTicketsPostImported) {
      await closeTicketsImported(whatsapp.id);
    }

    const shouldRenderCloseImportedButton =
      totalProcessed > 0 && !whatsapp.closedTicketsPostImported;

    await whatsapp.update({
      statusImportMessages: shouldRenderCloseImportedButton
        ? "renderButtonCloseTickets"
        : null,
      importOldMessages: totalProcessed > 0 ? null : whatsapp.importOldMessages,
      importRecentMessages: totalProcessed > 0 ? null : whatsapp.importRecentMessages
    });

    if (totalProcessed === 0) {
      logger.warn(
        `[WUZAPI_IMPORT][${whatsappId}] nenhuma mensagem foi importada. Mantendo janela de importação para nova tentativa.`
      );
    }

    io.of(String(companyId)).emit(`importMessages-${companyId}`, {
      action: "refresh"
    });

    logger.info(
      `[WUZAPI_IMPORT][${whatsappId}] finalizado com ${processed} importadas e ${updatedExisting} atualizadas em ${
        Date.now() - importStartedAt
      }ms.`
    );
    console.log(
      `[WUZAPI_IMPORT][${whatsappId}] FIM importação | mensagens=${processed} | atualizadas_existentes=${updatedExisting} | duração_ms=${
        Date.now() - importStartedAt
      }`
    );
  } catch (error: any) {
    logger.error(
      `[WUZAPI_IMPORT][${whatsappId}] falha na importação: ${error?.message || error}`
    );

    try {
      const whatsapp = await Whatsapp.findByPk(whatsappId);
      if (whatsapp) {
        await whatsapp.update({ statusImportMessages: null });
        const io = getIO();
        io.of(String(whatsapp.companyId)).emit(`importMessages-${whatsapp.companyId}`, {
          action: "refresh"
        });
      }
    } catch {}
  } finally {
    runningImports.delete(whatsappId);
  }
};

export default importWuzapiHistoryService;
