import path, { join } from "path";
import { readFile, writeFile } from "fs/promises";
import fs from "fs";
import { createHash } from "crypto";
import * as Sentry from "@sentry/node";
import { isNil, isNull } from "lodash";
import { REDIS_URI_MSG_CONN } from "../../config/redis";
import axios from "axios";
import NodeCache from "node-cache";

import type {
  AnyMessageContent,
  GroupMetadata,
  MediaType,
  MessageUpsertType,
  proto,
  WAMessage,
  WAMessageStubType,
  WAMessageUpdate,
  WASocket
} from "baileys";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import { Mutex } from "async-mutex";
import { getIO } from "../../libs/socket";
import CreateMessageService from "../MessageServices/CreateMessageService";
import logger from "../../utils/logger";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import { debounce } from "../../helpers/Debounce";
import formatBody from "../../helpers/Mustache";
import TicketTraking from "../../models/TicketTraking";
import UserRating from "../../models/UserRating";
import SendWhatsAppMessage from "./SendWhatsAppMessage";
import sendFaceMessage from "../FacebookServices/sendFacebookMessage";
import Queue from "../../models/Queue";
import moment from "moment";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import VerifyCurrentSchedule from "../CompanyService/VerifyCurrentSchedule";
import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import { Op } from "sequelize";
import { campaignQueue, parseToMilliseconds, randomValue } from "../../queues";
import User from "../../models/User";
import { sayChatbot } from "./ChatBotListener";
import MarkDeleteWhatsAppMessage from "./MarkDeleteWhatsAppMessage";
import ListUserQueueServices from "../UserQueueServices/ListUserQueueServices";
import cacheLayer from "../../libs/cache";
import { addLogs } from "../../helpers/addLogs";
import SendWhatsAppMedia, { getMessageOptions } from "./SendWhatsAppMedia";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import ShowQueueIntegrationService from "../QueueIntegrationServices/ShowQueueIntegrationService";
import { createDialogflowSessionWithModel } from "../QueueIntegrationServices/CreateSessionDialogflow";
import { queryDialogFlow } from "../QueueIntegrationServices/QueryDialogflow";
import CompaniesSettings from "../../models/CompaniesSettings";
import CreateLogTicketService from "../TicketServices/CreateLogTicketService";
import Whatsapp from "../../models/Whatsapp";
import QueueIntegrations from "../../models/QueueIntegrations";
import ShowFileService from "../FileServices/ShowService";
import { acquireTicketWelcomeLock, releaseTicketWelcomeLock } from "../../libs/ticketLock";
import { getWidFromMsg } from "../../helpers/getWid";

import Message from "../../models/Message"; 
import OpenAI from "openai";
import ffmpeg from "fluent-ffmpeg";
import {
  SpeechConfig,
  SpeechSynthesizer,
  AudioConfig
} from "microsoft-cognitiveservices-speech-sdk";
import typebotListener from "../TypebotServices/typebotListener";
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import pino from "pino";
import BullQueues from "../../libs/queue";
import { Transform } from "stream";
import { msgDB } from "../../libs/wbot";
import {CheckSettings1, CheckCompanySetting} from "../../helpers/CheckSettings";
import { title } from "process";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import { IConnections, INodes } from "../WebhookService/DispatchWebHookService";
import { FlowDefaultModel } from "../../models/FlowDefault";
import { ActionsWebhookService } from "../WebhookService/ActionsWebhookService";
import { WebhookModel } from "../../models/Webhook";
import { add, differenceInMilliseconds } from "date-fns";
import { FlowCampaignModel } from "../../models/FlowCampaign";
import ShowTicketService from "../TicketServices/ShowTicketService";
import { handleOpenAi } from "../IntegrationsServices/OpenAiService";
import { IOpenAi } from "../../@types/openai";
import HandleNpsReplyService from "../TicketServices/HandleNpsReplyService";
import type { MessageUserReceiptUpdate } from "baileys";
import { dynamicImport } from "../../utils/dynamicImport";

let baileysMod: typeof import("baileys") | null = null;
let getContentTypeRef: any = (message: any) =>
  message && typeof message === "object" ? Object.keys(message)[0] : undefined;
let extractMessageContentRef: any = (message: any) => message;
let jidNormalizedUserRef: any = (jid: string) => jid;
let generateWAMessageFromContentRef: any = (..._args: any[]) => {
  throw new Error("Baileys module not initialized yet");
};
let WAMessageStubTypeRef: Partial<typeof import("baileys").WAMessageStubType> =
  {};

async function getBaileys() {
  if (!baileysMod) {
    baileysMod = await dynamicImport("baileys");
    getContentTypeRef = baileysMod.getContentType;
    extractMessageContentRef = baileysMod.extractMessageContent;
    jidNormalizedUserRef = baileysMod.jidNormalizedUser;
    generateWAMessageFromContentRef = baileysMod.generateWAMessageFromContent;
    WAMessageStubTypeRef = baileysMod.WAMessageStubType;
  }
  return baileysMod;
}

const getContentType = (...args: any[]) => getContentTypeRef(...args);
const extractMessageContent = (...args: any[]) => extractMessageContentRef(...args);
const jidNormalizedUser = (...args: any[]) => jidNormalizedUserRef(...args);
const generateWAMessageFromContent = (...args: any[]) =>
  generateWAMessageFromContentRef(...args);
const delay = async (...args: any[]) => (await getBaileys()).delay(args[0]);
const downloadMediaMessage = async (...args: any[]) =>
  (await getBaileys() as any).downloadMediaMessage(...args);
const downloadContentFromMessage = async (...args: any[]) =>
  (await getBaileys() as any).downloadContentFromMessage(...args);
const generateWAMessageContent = async (...args: any[]) =>
  (await getBaileys() as any).generateWAMessageContent(...args);

// Cache otimizado para LID migration performance conforme v7.0.0-rc.3
const lidCache = new NodeCache({
  stdTTL: 300, // 5 minutos
  maxKeys: 10000,
  checkperiod: 60,
  useClones: false
});

const addressingModeCache = new NodeCache({
  stdTTL: 600, // 10 minutos  
  maxKeys: 5000,
  checkperiod: 120,
  useClones: false
});

// Cache para phoneNumber attributes de participantes de grupo
const participantPhoneCache = new NodeCache({
  stdTTL: 1800, // 30 minutos
  maxKeys: 15000,
  checkperiod: 300,
  useClones: false
});

// Cooldown curto para impedir disparo duplicado do menu inicial do FlowBuilder
// quando chegam 2+ mensagens quase ao mesmo tempo no mesmo ticket.
const flowWelcomeDispatchCache = new NodeCache({
  stdTTL: 45, // segundos
  maxKeys: 20000,
  checkperiod: 10,
  useClones: false
});

// Blindagem extra por contato/conexão para evitar menu inicial duplicado
// quando há corrida de criação/reabertura de ticket para o mesmo número.
const flowWelcomeContactDispatchCache = new NodeCache({
  stdTTL: 45, // segundos
  maxKeys: 20000,
  checkperiod: 10,
  useClones: false
});

const reserveFlowWelcomeStart = async (
  ticket: Ticket,
  flowId: number,
  firstNodeId: string
): Promise<boolean> => {
  const [affectedRows] = await Ticket.update(
    {
      flowStopped: String(flowId),
      flowWebhook: false,
      lastFlowId: firstNodeId,
      hashFlowId: null,
      dataWebhook: null
    },
    {
      where: {
        id: ticket.id,
        [Op.and]: [
          {
            [Op.or]: [
              { flowStopped: null },
              { flowStopped: "" }
            ]
          },
          {
            [Op.or]: [
              { lastFlowId: null },
              { lastFlowId: "" }
            ]
          },
          {
            [Op.or]: [
              { flowWebhook: null },
              { flowWebhook: false }
            ]
          }
        ]
      }
    }
  );

  if (affectedRows > 0) {
    ticket.flowStopped = String(flowId);
    ticket.flowWebhook = false;
    ticket.lastFlowId = firstNodeId;
    ticket.hashFlowId = null;
    ticket.dataWebhook = null;
    return true;
  }

  await ticket.reload();
  return false;
};

// Função para extrair o número real do WhatsApp de mensagens @lid
const extractRealWhatsAppNumber = async (
  msg: proto.IWebMessageInfo,
  wbot?: Session
): Promise<string | null> => {
  const remoteJid = msg.key.remoteJid;

  if (!remoteJid?.endsWith("@lid")) {
    // Se não é @lid, extrai o número normalmente (removendo sufixo de device ":N" antes)
    return remoteJid?.split(":")[0].replace(/\D/g, "") || null;
  }
  
  // Log detalhado para mensagens @lid
  console.log("=".repeat(50));
  console.log("=== MENSAGEM @LID DETECTADA ===");
  console.log(`RemoteJid: ${remoteJid}`);
  
  // Verifica todas as possíveis fontes de número - PRIORIDADE: remoteJidAlt
  const remoteJidAlt = (msg.key as any)?.remoteJidAlt;
  const senderPn = (msg as any)?.key?.senderPn || (msg as any)?.senderPn;
  const participantPn = (msg as any)?.key?.participantPn || (msg as any)?.participantPn;
  const phoneNumber = (msg as any)?.phoneNumber;
  const participant = msg.key.participant;
  
  console.log(`RemoteJidAlt: ${remoteJidAlt || "NÃO DISPONÍVEL"}`);
  console.log(`SenderPn: ${senderPn || "NÃO DISPONÍVEL"}`);
  console.log(`ParticipantPn: ${participantPn || "NÃO DISPONÍVEL"}`);
  console.log(`PhoneNumber: ${phoneNumber || "NÃO DISPONÍVEL"}`);
  console.log(`Participant: ${participant || "NÃO DISPONÍVEL"}`);
  console.log(`FromMe: ${msg.key.fromMe}`);
  
  let contactId = remoteJid; // fallback
  let source = "UNKNOWN";
  
  // Prioridade: remoteJidAlt > senderPn > participantPn > phoneNumber > participant
  if (remoteJidAlt) {
    contactId = remoteJidAlt;
    source = "remoteJidAlt";
  } else if (senderPn) {
    contactId = senderPn;
    source = "senderPn";
  } else if (participantPn) {
    contactId = participantPn;
    source = "participantPn";
  } else if (phoneNumber) {
    contactId = phoneNumber;
    source = "phoneNumber";
  } else if (participant) {
    contactId = participant;
    source = "participant";
  }

  // Nenhum dos campos alternativos do proprio evento resolveu o numero real —
  // isso acontece com frequencia em ecos de mensagens enviadas por FORA do
  // sistema (celular ou outro WhatsApp Web ligado a mesma conta), que podem
  // chegar como @lid puro sem remoteJidAlt/senderPn. Antes de desistir,
  // consulta o mapeamento LID->numero que o proprio Baileys mantem
  // internamente (populado via USync), que nao depende de nenhum campo
  // opcional do evento em si.
  if (source === "UNKNOWN" && wbot?.signalRepository?.lidMapping?.getPNForLID) {
    try {
      const mappedPn = await wbot.signalRepository.lidMapping.getPNForLID(remoteJid);
      if (mappedPn) {
        contactId = mappedPn;
        source = "lidMappingStore";
        console.log(`🎯 RESOLVIDO VIA lidMapping (Baileys): ${mappedPn}`);
      }
    } catch (e) {
      console.log("⚠️ Falha ao consultar lidMapping do Baileys:", e);
    }
  }

  // Extrai apenas os números do contactId final.
  // IMPORTANTE: remove primeiro o sufixo de device (":0", ":12" etc.) que o
  // Baileys as vezes anexa (ex: no retorno do lidMappingStore), senão o
  // replace(/\D/g,"") junta esses digitos ao número e gera um número errado
  // (ex: "5527997899106:0" -> "55279978991060" em vez de "5527997899106").
  const realNumber = contactId.split(":")[0].replace(/\D/g, "");

  console.log(`🎯 USANDO PARA CONTATO: ${contactId}`);
  console.log(`🎯 NÚMERO EXTRAÍDO: ${realNumber} (fonte: ${source})`);
  console.log("=== FIM LOG @LID ===");
  console.log("=".repeat(50));
  
  return realNumber;
};

// Função otimizada para resolução de remoteJid com LID v7.0.0-rc.3
// Função otimizada para resolução de remoteJid com LID v7.0.0-rc.3
// Função otimizada para resolução de remoteJid com LID v7.0.0-rc.3
const resolveRemoteJid = (msg: proto.IWebMessageInfo, ticket: Ticket): string => {
  const remoteJid = msg.key.remoteJid;

  // SE NÃO É @LID OU JID PADRÃO, RETORNA COMO ESTÁ
  if (!remoteJid?.endsWith("@lid") && !remoteJid?.includes(':')) {
    return remoteJid;
  }

  const cacheKey = `remoteJid_${remoteJid}_${msg.key.id}`;
  const cached = lidCache.get(cacheKey) as string | undefined;
  if (cached) return cached;

  let resolved = remoteJid;
  // PRIORIDADE 1: remoteJidAlt (MAIS CONFIÁVEL)
  if ((msg.key as any)?.remoteJidAlt) {
    resolved = (msg.key as any).remoteJidAlt;
    console.log(`📱 RESOLVIDO VIA remoteJidAlt: ${resolved}`);
  }
  // PRIORIDADE 2: senderPn
  else if ((msg.key as any)?.senderPn) {
    const suffix = ticket.isGroup ? "@g.us" : "@s.whatsapp.net";
    resolved = `${(msg.key as any).senderPn}${suffix}`;
    console.log(`📱 RESOLVIDO VIA senderPn: ${resolved}`);
  }
  
  // NORMALIZAÇÃO FINAL E OBRIGATÓRIA - REMOVE QUALQUER SUFIXO NUMÉRICO (:1, :2, etc.)
  if (resolved && resolved.includes(':')) {
    resolved = resolved.split(':')[0] + (ticket.isGroup ? "@g.us" : "@s.whatsapp.net");
    console.log(`✨ JID FINAL NORMALIZADO: ${resolved}`);
  }

  // CACHE POR 5 MINUTOS
  lidCache.set(cacheKey, resolved, 300);
  return resolved;
};

function emitAppMessage(companyId: number, ticketId: number, payload: any) {
  const io = getIO();

  // raiz (sem namespace)
  io.emit("appMessage", payload);
  io.emit(`company-${companyId}-appMessage`, payload);

  // namespace por empresa (formas "123" e "/123")
  const ns = io.of(String(companyId));
  ns.emit("appMessage", payload);
  ns.emit(`company-${companyId}-appMessage`, payload);

  const nsAlt = io.of(`/${companyId}`);
  nsAlt.emit("appMessage", payload);
  nsAlt.emit(`company-${companyId}-appMessage`, payload);

  // rooms
  io.to(String(ticketId)).emit("appMessage", payload);
  ns.to(String(ticketId)).emit("appMessage", payload);
  io.to(`company-${companyId}`).emit("appMessage", payload);
  ns.to(`company-${companyId}`).emit("appMessage", payload);

  // aliases comuns
  io.emit("message", payload);
  ns.emit("message", payload);
  io.to(String(ticketId)).emit("message", payload);

  io.emit("chat:ack", payload);
  ns.emit("chat:ack", payload);
  io.to(String(ticketId)).emit("chat:ack", payload);
}


const HAS_MESSAGE_ID = !!(Message as any)?.rawAttributes?.messageId;

const getMessageRoot = (message: any): any => {
  if (!message) return {};

  const extracted = extractMessageContent(message as any);
  const candidate =
    extracted && typeof extracted === "object" ? extracted : message;

  if (candidate?.ephemeralMessage?.message) {
    return getMessageRoot(candidate.ephemeralMessage.message);
  }

  if (candidate?.viewOnceMessage?.message) {
    return getMessageRoot(candidate.viewOnceMessage.message);
  }

  if (candidate?.viewOnceMessageV2?.message) {
    return getMessageRoot(candidate.viewOnceMessageV2.message);
  }

  return candidate;
};

function getTextFromBaileysMsg(wm: any): string {
  const root = getMessageRoot(wm?.message);
  return (
    root?.conversation ??
    root?.extendedTextMessage?.text ??
    root?.imageMessage?.caption ??
    root?.videoMessage?.caption ??
    root?.buttonsResponseMessage?.selectedDisplayText ??
    root?.listResponseMessage?.title ??
    root?.listResponseMessage?.singleSelectReply?.selectedRowId ??
    root?.templateButtonReplyMessage?.selectedDisplayText ??
    root?.templateButtonReplyMessage?.selectedId ??
    ""
  ).toString().trim();
}

const os = require("os");

let i = 0;

setInterval(() => {
  i = 0;
}, 5000);

type Session = WASocket & {
  id?: number;
};

interface ImessageUpsert {
  messages: proto.IWebMessageInfo[];
  type: MessageUpsertType;
}

interface IMe {
  name: string;
  id: string;
}

interface SessionOpenAi extends OpenAI {
  id?: number;
}
const sessionsOpenAi: SessionOpenAi[] = [];

function removeFile(directory) {
  fs.unlink(directory, error => {
    if (error) throw error;
  });
}

const getTimestampMessage = (msgTimestamp: any) => {
  if (msgTimestamp === null || msgTimestamp === undefined) {
    return Math.floor(Date.now() / 1000);
  }

  if (typeof msgTimestamp === "number" && Number.isFinite(msgTimestamp)) {
    return msgTimestamp;
  }

  if (typeof msgTimestamp === "string") {
    const trimmed = msgTimestamp.trim();
    if (!trimmed) return Math.floor(Date.now() / 1000);

    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) return asNumber;

    const parsedDate = Date.parse(trimmed);
    if (!Number.isNaN(parsedDate)) return Math.floor(parsedDate / 1000);
  }

  if (typeof msgTimestamp === "object") {
    if (typeof (msgTimestamp as any).toNumber === "function") {
      const asNumber = Number((msgTimestamp as any).toNumber());
      if (Number.isFinite(asNumber)) return asNumber;
    }

    const high = Number((msgTimestamp as any).high);
    const low = Number((msgTimestamp as any).low);
    if (Number.isFinite(high) && Number.isFinite(low)) {
      const combined = high * 4294967296 + (low >>> 0);
      if (Number.isFinite(combined) && combined > 0) return combined;
    }
  }

  return Math.floor(Date.now() / 1000);
};

// ===== [LID/JID] util =====
// Otimizado para v7.0.0-rc.3 - fallback addressing_mode detection by sender suffix
const parseLidJid = (peerId?: string, senderSuffix?: string) => {
  if (!peerId) return { lid: null as string | null, jid: null as string | null };
  
  const cacheKey = `lid_${peerId}_${senderSuffix || 'none'}`;
  const cached = lidCache.get(cacheKey);
  if (cached) return cached;
  
  const id = String(peerId).toLowerCase();
  let result;
  
  // Detecção otimizada de addressing_mode com fallback por sender suffix
  if (id.endsWith("@lid")) {
    result = { lid: id, jid: null };
  } else if (id.endsWith("@s.whatsapp.net") || id.endsWith("@c.us") || id.endsWith("@g.us")) {
    result = { lid: null, jid: id };
  } else if (senderSuffix) {
    // Fallback usando sender suffix conforme v7.0.0-rc.3
    const suffix = senderSuffix.toLowerCase();
    if (suffix.includes("lid")) {
      result = { lid: `${id}@lid`, jid: null };
    } else {
      result = { lid: null, jid: id.includes("@") ? id : `${id}@s.whatsapp.net` };
    }
  } else {
    // fallback padrão: trate como jid
    result = { lid: null, jid: id.includes("@") ? id : `${id}@s.whatsapp.net` };
  }
  
  // Cache do resultado para performance
  lidCache.set(cacheKey, result);
  return result;
};
// ===========================

const multVecardGet = function (param: any) {
  let output = " ";

  let name = param
    .split("\n")[2]
    .replace(";;;", "\n")
    .replace("N:", "")
    .replace(";", "")
    .replace(";", " ")
    .replace(";;", " ")
    .replace("\n", "");
  let inicio = param.split("\n")[4].indexOf("=");
  let fim = param.split("\n")[4].indexOf(":");
  let contact = param
    .split("\n")[4]
    .substring(inicio + 1, fim)
    .replace(";", "");
  let contactSemWhats = param.split("\n")[4].replace("item1.TEL:", "");
  //console.log(contact);
  if (contact != "item1.TEL") {
    output = output + name + ": 📞" + contact + "" + "\n";
  } else output = output + name + ": 📞" + contactSemWhats + "" + "\n";
  return output;
};

const contactsArrayMessageGet = (msg: any) => {
  const root = getMessageRoot(msg.message);
  let contactsArray = root?.contactsArrayMessage?.contacts || [];
  let vcardMulti = contactsArray.map(function (item, indice) {
    return item.vcard;
  });

  let bodymessage = ``;
  vcardMulti.forEach(function (vcard, indice) {
    bodymessage += vcard + "\n\n" + "";
  });

  let contacts = bodymessage.split("BEGIN:");

  contacts.shift();
  let finalContacts = "";
  for (let contact of contacts) {
    finalContacts = finalContacts + multVecardGet(contact);
  }

  return finalContacts;
};

const getTypeMessage = (msg: proto.IWebMessageInfo): string => {
  const root = getMessageRoot(msg.message);
  const msgType = getContentType(root as any) || getContentType(msg.message as any);
  if (
    root?.extendedTextMessage &&
    root?.extendedTextMessage?.contextInfo?.externalAdReply
  ) {
    return "adMetaPreview";
  }
  if (msg.message?.viewOnceMessageV2 && !root?.interactiveMessage) {
    return "viewOnceMessageV2";
  }
  return msgType;
};

const PIX_BUTTON_NAMES = ["review_and_pay", "cta_copy", "copy_code", "copy", "payment_info"];

const PIX_KEY_TYPE_LABELS: Record<string, string> = {
  CNPJ: "CNPJ",
  CPF: "CPF",
  PHONE: "Celular",
  EMAIL: "E-mail",
  EVP: "Chave Aleatória"
};

// O card oficial do WhatsApp exibe o número sem o prefixo "+55". O valor
// completo continua sendo usado no COPY:: (botão de copiar).
const formatPixKeyForDisplay = (keyType: string, key: string): string =>
  keyType === "PHONE" ? key.replace(/^\+55/, "") : key;

// Botão nativo "payment_info": usado no fluxo de "Solicitar pagamento" do
// WhatsApp, que pode embutir uma chave Pix estática dentro de payment_settings.
const extractPixStaticCode = (
  button: any
): { key: string; keyType: string; merchantName: string } | null => {
  try {
    const parsedParams = button?.buttonParamsJson
      ? JSON.parse(button.buttonParamsJson)
      : null;

    const settings = Array.isArray(parsedParams?.payment_settings)
      ? parsedParams.payment_settings
      : [];
    const pixSetting = settings.find((setting: any) => setting?.type === "pix_static_code")
      ?.pix_static_code;

    const key = String(pixSetting?.key || "").trim();
    if (!key) return null;

    return {
      key,
      keyType: String(pixSetting?.key_type || "").trim(),
      merchantName: String(pixSetting?.merchant_name || "").trim()
    };
  } catch (error) {
    return null;
  }
};

const extractInteractiveCopyCode = (button: any): string | null => {
  if (!button) return null;

  const pixStatic = extractPixStaticCode(button);
  if (pixStatic) return pixStatic.key;

  try {
    const parsedParams = button?.buttonParamsJson
      ? JSON.parse(button.buttonParamsJson)
      : null;

    const value = [
      parsedParams?.copy_code,
      parsedParams?.copyCode,
      parsedParams?.code,
      parsedParams?.pix_key,
      parsedParams?.pixKey,
      parsedParams?.value
    ]
      .map(candidate => String(candidate || "").trim())
      .find(Boolean);

    return value || null;
  } catch (error) {
    return null;
  }
};

const extractInteractiveButtonLabel = (button: any): string | null => {
  if (!button) return null;

  try {
    const parsedParams = button?.buttonParamsJson
      ? JSON.parse(button.buttonParamsJson)
      : null;

    const sectionRows = parsedParams?.sections
      ?.flatMap(section => section?.rows || [])
      ?.map(row => {
        const title = String(row?.title || "").trim();
        const description = String(row?.description || "").trim();
        return description ? `${title} - ${description}` : title;
      })
      ?.filter(Boolean);

    const values = [
      parsedParams?.display_text,
      parsedParams?.displayText,
      parsedParams?.title,
      parsedParams?.text,
      parsedParams?.button_text,
      parsedParams?.cta_display_name,
      parsedParams?.name
    ]
      .map(value => String(value || "").trim())
      .filter(Boolean);

    if (sectionRows?.length) {
      values.push(...sectionRows);
    }

    if (values.length) {
      return values.join(" | ");
    }
  } catch (error) {
    logger.debug(`Falha ao parsear interactive button params: ${error}`);
  }

  const fallback = [
    button?.buttonText?.displayText,
    button?.text,
    button?.title,
    button?.name
  ]
    .map(value => String(value || "").trim())
    .find(Boolean);

  return fallback || null;
};

const formatInteractiveMessageBody = (interactiveMessage: any): string | null => {
  if (!interactiveMessage) return null;

  let header = String(interactiveMessage?.header?.title || "").trim();
  let body = String(interactiveMessage?.body?.text || "").trim();
  const footer = String(interactiveMessage?.footer?.text || "").trim();
  const buttons = interactiveMessage?.nativeFlowMessage?.buttons || [];
  const buttonLines = buttons.map(extractInteractiveButtonLabel).filter(Boolean);

  const pixButton = buttons.find(
    button =>
      PIX_BUTTON_NAMES.includes(button?.name) || Boolean(extractInteractiveCopyCode(button))
  );
  const copyCode = extractInteractiveCopyCode(pixButton);
  const isPix = Boolean(pixButton);

  if (isPix && !body) {
    const pixStatic = extractPixStaticCode(pixButton);
    if (pixStatic) {
      if (!header) header = pixStatic.merchantName;
      const keyTypeLabel = PIX_KEY_TYPE_LABELS[pixStatic.keyType] || pixStatic.keyType;
      const displayKey = formatPixKeyForDisplay(pixStatic.keyType, pixStatic.key);
      body = keyTypeLabel ? `${keyTypeLabel}: ${displayKey}` : displayKey;
    }
  }

  const prefix = isPix
    ? "[PIX]"
    : buttonLines.length
      ? "[BOTOES]"
      : "[INTERATIVA]";

  const parts = [prefix];
  if (header) parts.push(`*${header}*`);
  else if (isPix) parts.push("*Chave Pix*");
  if (body) parts.push(body);
  if (footer) parts.push(footer);
  if (buttonLines.length && !isPix) parts.push(buttonLines.join("\n"));
  if (copyCode) parts.push(`COPY::${copyCode}`);

  if (isPix && !copyCode) {
    logger.warn(
      `#### Mensagem PIX sem copy_code reconhecido, payload bruto: ${JSON.stringify(
        interactiveMessage
      )}`
    );
  } else if (prefix === "[INTERATIVA]" && !header && !body && !footer) {
    logger.warn(
      `#### Interactive message não reconhecida, payload bruto: ${JSON.stringify(
        interactiveMessage
      )}`
    );
  }

  const formatted = parts.filter(Boolean).join("\n\n").trim();
  return formatted || prefix;
};

const getAd = (msg: any): string => {
  if (
    msg.key.fromMe &&
    msg.message?.listResponseMessage?.contextInfo?.externalAdReply
  ) {
    let bodyMessage = `*${msg.message?.listResponseMessage?.contextInfo?.externalAdReply?.title}*`;

    bodyMessage += `\n\n${msg.message?.listResponseMessage?.contextInfo?.externalAdReply?.body}`;

    return bodyMessage;
  }
};

const getBodyButton = (msg: any): string => {
  try {
    const root = getMessageRoot(msg.message);

    if (
      msg?.messageType === "buttonsMessage" ||
      root?.buttonsMessage?.contentText
    ) {
      let bodyMessage = `[BUTTON]\n\n*${root?.buttonsMessage?.contentText}*\n\n`;
      // eslint-disable-next-line no-restricted-syntax
      for (const button of root?.buttonsMessage?.buttons || []) {
        bodyMessage += `- ${button.buttonText.displayText}\n`;
      }

      return bodyMessage;
    }
    const interactiveBody = formatInteractiveMessageBody(root?.interactiveMessage);
    if (interactiveBody) return interactiveBody;

    if (msg?.messageType === "listMessage" || root?.listMessage?.description) {
      let bodyMessage = `[LIST]\n\n`;
      bodyMessage += root?.listMessage?.title ? `*${root?.listMessage?.title}*\n` : "sem titulo\n";
      bodyMessage += root?.listMessage?.description ? `*${root?.listMessage?.description}*\n\n` : "sem descrição\n\n";
      bodyMessage += root?.listMessage?.footerText ? `${root?.listMessage?.footerText}\n\n` : "\n\n";
      const sections = root?.listMessage?.sections;
      if (sections && sections.length > 0) {
        for (const section of sections) {
          bodyMessage += section?.title ? `*${section.title}*\n` : 'Sem titulo';
          const rows = section?.rows;
          if (rows && rows.length > 0) {
            for (const row of rows) {
              const rowTitle = row?.title || '';
              const rowDescription = row?.description || 'Sem descrição';
              bodyMessage += rowDescription
                ? `${rowTitle} - ${rowDescription}\n`
                : `${rowTitle}\n`;
            }
          }
          bodyMessage += `\n`;
        }
      }
      return bodyMessage;
    }

  } catch (error) {
    logger.error(error);
  }
};

const getBodyPIX = (msg: any): string => {
  try {
    const interactiveMessage = getMessageRoot(msg.message)?.interactiveMessage;
    const buttons = interactiveMessage?.nativeFlowMessage?.buttons || [];
    const hasPixButton = buttons.some(button => button?.name === "review_and_pay");
    if (hasPixButton) return "[PIX]";
  } catch (error) {
    console.error("Erro ao processar mensagem:", error);
  }

  return '';
};

const getInteractiveDisplayText = (msg: any): string | null => {
  const root = getMessageRoot(msg.message);
  const selectedText =
    root?.buttonsResponseMessage?.selectedDisplayText ||
    root?.listResponseMessage?.title ||
    root?.listResponseMessage?.description ||
    root?.templateButtonReplyMessage?.selectedDisplayText;
  if (selectedText) return String(selectedText).trim();

  const selectedId =
    root?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    root?.buttonsResponseMessage?.selectedButtonId ||
    root?.templateButtonReplyMessage?.selectedId;
  if (selectedId) return String(selectedId).trim();

  const nativeFlowJson = root?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
  if (!nativeFlowJson) return null;

  try {
    const parsed = JSON.parse(nativeFlowJson);
    const label =
      parsed?.title ||
      parsed?.button_text ||
      parsed?.display_text ||
      parsed?.displayText ||
      parsed?.text ||
      parsed?.selected_option?.title ||
      parsed?.selectedOption?.title;
    if (label) return String(label).trim();

    const nestedRowTitle =
      parsed?.selected_option?.description ||
      parsed?.selectedOption?.description;
    if (nestedRowTitle) return String(nestedRowTitle).trim();

    if (parsed?.id || parsed?.selected_option?.id || parsed?.selectedOption?.id) {
      return String(
        parsed?.id || parsed?.selected_option?.id || parsed?.selectedOption?.id
      ).trim();
    }
  } catch {
    return String(nativeFlowJson).trim();
  }

  return null;
};

const toBase64Safe = (value: any): string | null => {
  if (!value) return null;
  try {
    return Buffer.from(value).toString("base64");
  } catch {
    return null;
  }
};

const msgLocation = (image, latitude, longitude) => {
  if (image) {
    var b64 = Buffer.from(image).toString("base64");

    let data = `data:image/png;base64, ${b64} | https://maps.google.com/maps?q=${latitude}%2C${longitude}&z=17&hl=pt-BR|${latitude}, ${longitude} `;
    return data;
  }
};

export const getBodyMessage = (msg: proto.IWebMessageInfo): string | null => {
  try {
    let type = getTypeMessage(msg);
    const root = getMessageRoot(msg.message);

    if (type === undefined) console.log(JSON.stringify(msg));

    const types = {
      conversation: root?.conversation,
      imageMessage: root?.imageMessage?.caption,
      videoMessage: root?.videoMessage?.caption,
      ptvMessage: root?.ptvMessage?.caption,
      extendedTextMessage: root?.extendedTextMessage?.text,
      buttonsResponseMessage:
        getInteractiveDisplayText(msg),
      listResponseMessage:
        getInteractiveDisplayText(msg),
      templateButtonReplyMessage:
        getInteractiveDisplayText(msg),
      messageContextInfo:
        getInteractiveDisplayText(msg),
      buttonsMessage:
      getBodyButton(msg) || msg.message?.listResponseMessage?.title,
      stickerMessage: "sticker",
      contactMessage: root?.contactMessage?.vcard,
      contactsArrayMessage:
        root?.contactsArrayMessage?.contacts &&
        contactsArrayMessageGet(msg),
      locationMessage:
        msgLocation(
          root?.locationMessage?.jpegThumbnail,
          root?.locationMessage?.degreesLatitude,
          root?.locationMessage?.degreesLongitude
        ) ||
        `https://maps.google.com/maps?q=${root?.locationMessage?.degreesLatitude}%2C${root?.locationMessage?.degreesLongitude}&z=17&hl=pt-BR`,
      liveLocationMessage: `Latitude: ${root?.liveLocationMessage?.degreesLatitude} - Longitude: ${root?.liveLocationMessage?.degreesLongitude}`,
      documentMessage: root?.documentMessage?.caption,
      audioMessage: "Áudio",
      interactiveMessage: getBodyButton(msg) || getInteractiveDisplayText(msg) || getBodyPIX(msg),
      interactiveResponseMessage: getInteractiveDisplayText(msg),
      listMessage:
        getBodyButton(msg) || root?.listResponseMessage?.title,
        viewOnceMessage: getBodyButton(msg) || root?.listResponseMessage?.singleSelectReply?.selectedRowId,
      reactionMessage: root?.reactionMessage?.text || "reaction",
      senderKeyDistributionMessage:
        root?.senderKeyDistributionMessage
          ?.axolotlSenderKeyDistributionMessage,
      documentWithCaptionMessage:
        root?.documentWithCaptionMessage?.message?.documentMessage
          ?.caption,
      viewOnceMessageV2:
        root?.imageMessage?.caption || root?.videoMessage?.caption,
        adMetaPreview: msgAdMetaPreview(
          root?.extendedTextMessage?.contextInfo?.externalAdReply?.thumbnail,
          root?.extendedTextMessage?.contextInfo?.externalAdReply?.title,
          root?.extendedTextMessage?.contextInfo?.externalAdReply?.body,
          root?.extendedTextMessage?.contextInfo?.externalAdReply?.sourceUrl,
          root?.extendedTextMessage?.text
        ), // Adicionado para tratar mensagens de anúncios;
      editedMessage:
        msg?.message?.protocolMessage?.editedMessage?.conversation ||
        msg?.message?.editedMessage?.message?.protocolMessage?.editedMessage
          ?.conversation,
      ephemeralMessage:
        root?.extendedTextMessage?.text,
      imageWhitCaptionMessage:
        root?.imageMessage,
      highlyStructuredMessage: root?.highlyStructuredMessage,
      protocolMessage:
        msg?.message?.protocolMessage?.editedMessage?.conversation,
      advertising:
        getAd(msg) ||
        msg.message?.listResponseMessage?.contextInfo?.externalAdReply?.title,
        pollCreationMessageV3: msg?.message?.pollCreationMessageV3 ? `*Enquete*\n${msg.message.pollCreationMessageV3.name}\n\n${msg.message.pollCreationMessageV3.options.map(option => option.optionName).join('\n')}` : null,
      eventMessage: msg?.message?.eventMessage?.name ? `*Nome do Evento: ${msg.message.eventMessage.name}*\n` : 'sem nome do evento\n',
    };

    const objKey = Object.keys(types).find(key => key === type);

    if (!objKey) {
      logger.warn(
        `#### Nao achou o type 152: ${type} ${JSON.stringify(msg.message)}`
      );
      Sentry.setExtra("Mensagem", { BodyMsg: msg.message, msg, type });
      Sentry.captureException(
        new Error("Novo Tipo de Mensagem em getTypeMessage")
      );
    }
    return types[type];
  } catch (error) {
    Sentry.setExtra("Error getTypeMessage", { msg, BodyMsg: msg.message });
    Sentry.captureException(error);
    console.log(error);
  }
};

const msgAdMetaPreview = (image, title, body, sourceUrl, messageUser) => {
  const b64 = toBase64Safe(image);
  const parts = [
    b64 ? `data:image/png;base64, ${b64}` : null,
    sourceUrl || null,
    title || null,
    body || null,
    messageUser || null
  ].filter(Boolean);

  if (!parts.length) return null;
  return parts.join(" | ");
};

export const getQuotedMessage = (msg: proto.IWebMessageInfo) => {
  const messageRoot = msg?.message;
  if (!messageRoot || typeof messageRoot !== "object") return;

  const content = extractMessageContent(messageRoot);
  if (!content) return;

  for (const key of Object.keys(content)) {
    const quotedMessageRoot = content[key]?.contextInfo?.quotedMessage;
    if (quotedMessageRoot && typeof quotedMessageRoot === "object") {
      const quotedContent = extractMessageContent(quotedMessageRoot);
      if (!quotedContent) return;
      for (const quotedKey of Object.keys(quotedContent)) {
        if (quotedContent[quotedKey]) {
          return extractMessageContent(quotedContent[quotedKey]);
        }
      }
    }
  }

  return;
};

export const getQuotedMessageId = (msg: proto.IWebMessageInfo) => {
  const messageRoot = msg?.message;
  if (!messageRoot || typeof messageRoot !== "object") return "";

  let reaction = msg?.message?.reactionMessage
    ? msg?.message?.reactionMessage?.key?.id
    : "";

  if (reaction) return reaction;

  const content = extractMessageContent(messageRoot);
  if (!content) return "";

  for (const key of Object.keys(content)) {
    const stanzaId = content[key]?.contextInfo?.stanzaId;
    if (stanzaId) {
      return stanzaId;
    }
  }

  return "";
};

const getMeSocket = (wbot: Session): IMe => {
  return {
    id: jidNormalizedUser((wbot as WASocket).user.id),
    name: (wbot as WASocket).user.name
  };
};

// Otimizado para v7.0.0-rc.3 com cache e addressing_mode detection
const getSenderMessage = (
  msg: proto.IWebMessageInfo,
  wbot: Session
): string => {
  const me = getMeSocket(wbot);
  if (msg.key.fromMe) return me.id;
  
  let senderId: any = msg.participant || msg.key.participant || msg.key.remoteJid || undefined;
  
  if (!senderId) return undefined;
  
  const cacheKey = `sender_${senderId}_${msg.key.id}`;
  const cached = addressingModeCache.get(cacheKey) as string;
  if (cached) return cached;
  
  let resolvedSender = senderId;
  
  // Otimizado para LIDs - usar remoteJidAlt como prioridade
  if (typeof senderId === "string" && senderId.endsWith("@lid")) {
    if ((msg.key as any)?.remoteJidAlt) {
      resolvedSender = (msg.key as any).remoteJidAlt;
      console.log(`👤 SENDER RESOLVIDO VIA remoteJidAlt: ${resolvedSender}`);
    } else if ((msg.key as any)?.senderPn) {
      resolvedSender = (msg.key as any).senderPn + (senderId.includes("@g.us") ? "@g.us" : "@s.whatsapp.net");
      console.log(`👤 SENDER RESOLVIDO VIA senderPn: ${resolvedSender}`);
    } else {
      console.log(`⚠️ SENDER @LID SEM remoteJidAlt OU senderPn: ${senderId}`);
    }
  }
  
  const result = resolvedSender && jidNormalizedUser(resolvedSender);
  
  // Cache do resultado
  if (result) {
    addressingModeCache.set(cacheKey, result);
  }
  
  return result;
};

// Otimizado para v7.0.0-rc.3 com cache e phoneNumber attributes
const getContactMessage = async (msg: proto.IWebMessageInfo, wbot: Session) => {
  const isGroup = msg.key.remoteJid?.includes("@g.us");
  let contactId = resolveRemoteJid(msg, { isGroup } as any); // <- NORMALIZA AQUI

  // Em alguns CTWA, o primeiro evento chega como @lid sem remoteJidAlt.
  // Sempre que possível, converte para número real para evitar duplicação de contato/ticket.
  // Guarda o @lid original: mesmo quando a resolução dá certo aqui, precisamos
  // gravar esse @lid no contato para que um evento FUTURO do MESMO chat que
  // chegue como @lid "puro" (ex: eco de mensagem enviada fora da plataforma,
  // sem remoteJidAlt/senderPn e sem mapeamento ainda no store do Baileys)
  // consiga casar com o mesmo contato/ticket em vez de criar um duplicado.
  let rawLid: string | null = null;
  if (!isGroup && typeof contactId === "string" && contactId.endsWith("@lid")) {
    rawLid = contactId;
    const realNumber = await extractRealWhatsAppNumber(msg, wbot);
    if (realNumber && realNumber.length >= 8) {
      contactId = `${realNumber}@s.whatsapp.net`;
    }
  }

  const cacheKey = `contact_${contactId}_${msg.key.id}`;
  const cached = addressingModeCache.get(cacheKey) as {id: string; name: string; lid?: string | null};
  if (cached) return cached;

  const rawNumber = contactId.replace(/\D/g, "");

  const result = isGroup
    ? {
        id: getSenderMessage(msg, wbot), // <- sender já normalizado
        name: msg.pushName
      }
    : {
        id: contactId,
        name: msg.key.fromMe ? rawNumber : msg.pushName,
        lid: rawLid
      };

  addressingModeCache.set(cacheKey, result);
  return result;
};

function findCaption(obj) {
  if (typeof obj !== "object" || obj === null) {
    return null;
  }

  for (const key in obj) {
    if (key === "caption" || key === "text" || key === "conversation") {
      return obj[key];
    }

    const result = findCaption(obj[key]);
    if (result) {
      return result;
    }
  }

  return null;
}

// const downloadMedia = async (msg: proto.IWebMessageInfo, companyId: number, whatsappId: number) => {
//   const mineType =
//     msg.message?.imageMessage ||
//     msg.message?.audioMessage ||
//     msg.message?.videoMessage ||
//     msg.message?.stickerMessage ||
//     msg.message?.documentMessage ||
//     msg.message?.documentWithCaptionMessage?.message?.documentMessage ||
//     // msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage ||
//     // msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage ||
//     // msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.audioMessage ||
//     msg.message?.ephemeralMessage?.message?.audioMessage ||
//     msg.message?.ephemeralMessage?.message?.documentMessage ||
//     msg.message?.ephemeralMessage?.message?.videoMessage ||
//     msg.message?.ephemeralMessage?.message?.stickerMessage ||
//     msg.message?.ephemeralMessage?.message?.imageMessage ||
//     msg.message?.viewOnceMessage?.message?.imageMessage ||
//     msg.message?.viewOnceMessage?.message?.videoMessage ||
//     msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message?.imageMessage ||
//     msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message?.videoMessage ||
//     msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message?.audioMessage ||
//     msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message?.documentMessage ||
//     msg.message?.templateMessage?.hydratedTemplate?.imageMessage ||
//     msg.message?.templateMessage?.hydratedTemplate?.documentMessage ||
//     msg.message?.templateMessage?.hydratedTemplate?.videoMessage ||
//     msg.message?.templateMessage?.hydratedFourRowTemplate?.imageMessage ||
//     msg.message?.templateMessage?.hydratedFourRowTemplate?.documentMessage ||
//     msg.message?.templateMessage?.hydratedFourRowTemplate?.videoMessage ||
//     msg.message?.templateMessage?.fourRowTemplate?.imageMessage ||
//     msg.message?.templateMessage?.fourRowTemplate?.documentMessage ||
//     msg.message?.templateMessage?.fourRowTemplate?.videoMessage ||
//     msg.message?.interactiveMessage?.header?.imageMessage ||
//     msg.message?.interactiveMessage?.header?.documentMessage ||
//     msg.message?.interactiveMessage?.header?.videoMessage;

//   // eslint-disable-next-line no-nested-ternary
//   const messageType = msg.message?.documentMessage
//     ? "document"
//     : mineType.mimetype.split("/")[0].replace("application", "document")
//       ? (mineType.mimetype
//         .split("/")[0]
//         .replace("application", "document") as MediaType)
//       : (mineType.mimetype.split("/")[0] as MediaType);

//   let stream: Transform;
//   let contDownload = 0;

//   while (contDownload < 10 && !stream) {
//     try {
//       const { mediaKey, directPath, url } =
//         msg.message?.imageMessage ||
//         msg.message?.audioMessage ||
//         msg.message?.videoMessage ||
//         msg.message?.stickerMessage ||
//         msg.message?.documentMessage ||
//         msg.message?.documentWithCaptionMessage?.message?.documentMessage ||
//         msg.message?.ephemeralMessage?.message?.audioMessage ||
//         msg.message?.ephemeralMessage?.message?.documentMessage ||
//         msg.message?.ephemeralMessage?.message?.videoMessage ||
//         msg.message?.ephemeralMessage?.message?.stickerMessage ||
//         msg.message?.ephemeralMessage?.message?.imageMessage ||
//         msg.message?.viewOnceMessage?.message?.imageMessage ||
//         msg.message?.viewOnceMessage?.message?.videoMessage ||
//         msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message?.imageMessage ||
//         msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message?.videoMessage ||
//         msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message?.audioMessage ||
//         msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message?.documentMessage ||
//         msg.message?.templateMessage?.hydratedTemplate?.imageMessage ||
//         msg.message?.templateMessage?.hydratedTemplate?.documentMessage ||
//         msg.message?.templateMessage?.hydratedTemplate?.videoMessage ||
//         msg.message?.templateMessage?.hydratedFourRowTemplate?.imageMessage ||
//         msg.message?.templateMessage?.hydratedFourRowTemplate?.documentMessage ||
//         msg.message?.templateMessage?.hydratedFourRowTemplate?.videoMessage ||
//         msg.message?.templateMessage?.fourRowTemplate?.imageMessage ||
//         msg.message?.templateMessage?.fourRowTemplate?.documentMessage ||
//         msg.message?.templateMessage?.fourRowTemplate?.videoMessage ||
//         msg.message?.interactiveMessage?.header?.imageMessage ||
//         msg.message?.interactiveMessage?.header?.documentMessage ||
//         msg.message?.interactiveMessage?.header?.videoMessage ||
//         { mediakey: undefined, directPath: undefined, url: undefined };
//       // eslint-disable-next-line no-await-in-loop
//       stream = await downloadContentFromMessage(
//         { mediaKey, directPath, url: directPath ? "" : url },
//         messageType
//       );

//     } catch (error) {
//       contDownload += 1;
//       // eslint-disable-next-line no-await-in-loop, no-loop-func
//       await new Promise(resolve => { setTimeout(resolve, 1000 * contDownload * 2) }
//       );

//       logger.warn(
//         `>>>> erro ${contDownload} de baixar o arquivo ${msg?.key.id} companie ${companyId} conexão ${whatsappId}`
//       );

//       if (contDownload === 10) {
//         logger.warn(
//           `>>>> erro ao baixar o arquivo ${JSON.stringify(msg)}`
//         );
//       }
//     }
//   }

//   let buffer = Buffer.from([]);
//   try {
//     // eslint-disable-next-line no-restricted-syntax
//     for await (const chunk of stream) {
//       buffer = Buffer.concat([buffer, chunk]);
//     }
//   } catch (error) {
//     return { data: "error", mimetype: "", filename: "" };
//   }

//   if (!buffer) {
//     Sentry.setExtra("ERR_WAPP_DOWNLOAD_MEDIA", { msg });
//     Sentry.captureException(new Error("ERR_WAPP_DOWNLOAD_MEDIA"));
//     throw new Error("ERR_WAPP_DOWNLOAD_MEDIA");
//   }
//   let filename = msg.message?.documentMessage?.fileName || "";

//   if (!filename) {
//     const ext = mineType.mimetype.split("/")[1].split(";")[0];
//     filename = `${new Date().getTime()}.${ext}`;
//   }
//   const media = {
//     data: buffer,
//     mimetype: mineType.mimetype,
//     filename
//   };
//   return media;
// };

const getUnpackedMessage = (msg: proto.IWebMessageInfo) => {
  return (
    msg.message?.documentWithCaptionMessage?.message ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
    msg.message?.ephemeralMessage?.message ||
    msg.message?.viewOnceMessage?.message ||
    msg.message?.viewOnceMessageV2?.message ||
    msg.message?.ephemeralMessage?.message ||
    msg.message?.templateMessage?.hydratedTemplate ||
    msg.message?.templateMessage?.hydratedFourRowTemplate ||
    msg.message?.templateMessage?.fourRowTemplate ||
    msg.message?.interactiveMessage?.header ||
    msg.message?.highlyStructuredMessage?.hydratedHsm?.hydratedTemplate ||
    msg.message
  )
}
const getMessageMedia = (message: proto.IMessage) => {
  return (
    message?.imageMessage ||
    message?.audioMessage ||
    message?.videoMessage ||
    message?.ptvMessage ||
    message?.stickerMessage ||
    message?.documentMessage || null
  );
}

const resolveStoredIncomingMediaType = (msg: proto.IWebMessageInfo, mimeType: string): string => {
  const normalizedMsgType = String(getTypeMessage(msg) || "").trim();

  if (normalizedMsgType === "stickerMessage") return "sticker";
  if (normalizedMsgType === "imageMessage") return "image";
  if (normalizedMsgType === "videoMessage" || normalizedMsgType === "ptvMessage") {
    return "video";
  }
  if (normalizedMsgType === "audioMessage") return "audio";

  return String(mimeType || "application/octet-stream")
    .split("/")[0]
    .trim()
    .toLowerCase() || "application";
};

const downloadMedia = async (msg: proto.IWebMessageInfo, isImported: Date = null, wbot: Session, ticket: Ticket) => {
  const unpackedMessage = getUnpackedMessage(msg);
  const message = getMessageMedia(unpackedMessage);
  if (!message) {
    return null;
  }
  const fallbackFileLimit = parseInt(await CheckSettings1("downloadLimit", "9999"), 10);
  if (
    wbot &&
    message?.fileLength &&
    +message.fileLength > fallbackFileLimit * 1024 * 1024
  ) {
    throw new Error("ERR_FILESIZE_OVER_LIMIT");
  }

  if (msg.message?.stickerMessage) {
    // O WhatsApp as vezes manda a figurinha com um "url" placeholder
    // (ex: https://a.whatsapp.net, https://web.whatsapp.net) que nao e
    // um host de midia real e nao resolve por DNS. Quando ha directPath,
    // sempre reescrevemos para o host real (mmg.whatsapp.net), pois o
    // baileys usa o host do "url" como fallback ao montar a URL de download.
    const directPath = msg.message?.stickerMessage?.directPath;
    if (directPath) {
      msg.message.stickerMessage.url = `https://mmg.whatsapp.net${directPath}`;
    }
  }

  let buffer;
  try {
    buffer = await downloadMediaMessage(
      msg as WAMessage,
      "buffer",
      {},
      {
        logger,
        reuploadRequest: wbot.updateMediaMessage
      }
    );
  } catch (err) {
    if (isImported) {
      console.log(
        "Falha ao fazer o download de uma mensagem importada, provavelmente a mensagem já não esta mais disponível"
      );
    } else {
      console.error("Erro ao baixar mídia:", err);
    }
  }

  let filename = msg.message?.documentMessage?.fileName || "";

  const mineType =
    msg.message?.imageMessage ||
    msg.message?.audioMessage ||
    msg.message?.videoMessage ||
    msg.message?.ptvMessage ||
    msg.message?.stickerMessage ||
    msg.message?.ephemeralMessage?.message?.stickerMessage ||
    msg.message?.documentMessage ||
    msg.message?.documentWithCaptionMessage?.message?.documentMessage ||
    msg.message?.ephemeralMessage?.message?.audioMessage ||
    msg.message?.ephemeralMessage?.message?.documentMessage ||
    msg.message?.ephemeralMessage?.message?.videoMessage ||
    msg.message?.ephemeralMessage?.message?.ptvMessage ||
    msg.message?.ephemeralMessage?.message?.imageMessage ||
    msg.message?.viewOnceMessage?.message?.imageMessage ||
    msg.message?.viewOnceMessage?.message?.videoMessage ||
    msg.message?.viewOnceMessage?.message?.ptvMessage ||
    msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
      ?.imageMessage ||
    msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
      ?.videoMessage ||
    msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
      ?.ptvMessage ||
    msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
      ?.audioMessage ||
    msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
      ?.documentMessage ||
    msg.message?.templateMessage?.hydratedTemplate?.imageMessage ||
    msg.message?.templateMessage?.hydratedTemplate?.documentMessage ||
    msg.message?.templateMessage?.hydratedTemplate?.videoMessage ||
    msg.message?.templateMessage?.hydratedFourRowTemplate?.imageMessage ||
    msg.message?.templateMessage?.hydratedFourRowTemplate?.documentMessage ||
    msg.message?.templateMessage?.hydratedFourRowTemplate?.videoMessage ||
    msg.message?.templateMessage?.fourRowTemplate?.imageMessage ||
    msg.message?.templateMessage?.fourRowTemplate?.documentMessage ||
    msg.message?.templateMessage?.fourRowTemplate?.videoMessage ||
    msg.message?.interactiveMessage?.header?.imageMessage ||
    msg.message?.interactiveMessage?.header?.documentMessage ||
    msg.message?.interactiveMessage?.header?.videoMessage;

  const resolvedMimeType = String((mineType as any)?.mimetype || "application/octet-stream");

  if (!filename) {
    const ext = resolvedMimeType.split("/")[1]?.split(";")[0] || "bin";
    filename = `${new Date().getTime()}.${ext}`;
  } else {
    filename = `${new Date().getTime()}_${filename}`;
  }

  const media = {
    data: buffer,
    mimetype: resolvedMimeType,
    filename
  };

  return media;
};

const verifyContact = async (
  msgContact: IMe & { lid?: string | null },
  wbot: Session,
  companyId: number
): Promise<Contact> => {
  let profilePicUrl: string | undefined;
  // try {
  //   profilePicUrl = await wbot.profilePictureUrl(msgContact.id, "image");
  // } catch (e) {
  //   Sentry.captureException(e);
  //   profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
  // }

  // [LID/JID] extrai ids a partir do msgContact.id
  const { lid: parsedLid, jid } = parseLidJid(msgContact?.id);
  // Preferimos o @lid original (quando o chamador ja resolveu msgContact.id
  // para o numero real) para nao perder o vinculo lid->contato: ver
  // getContactMessage, que guarda o @lid bruto mesmo apos resolver o numero.
  const lid = msgContact?.lid || parsedLid;

  const contactData = {
    name: msgContact.name || msgContact.id.replace(/\D/g, ""),
    number: msgContact.id.replace(/\D/g, ""),
    profilePicUrl,
    isGroup: msgContact.id.includes("g.us"),
    companyId,
    remoteJid: msgContact.id,
    whatsappId: wbot.id,
    wbot,
    // [LID/JID] novos campos
    lid,
    jid
  };

  if (contactData.isGroup) {
    contactData.number = msgContact.id.replace("@g.us", "");
  }

  const contact = await CreateOrUpdateContactService(contactData);

  return contact;
};

const verifyQuotedMessage = async (
  msg: proto.IWebMessageInfo
): Promise<Message | null> => {
  if (!msg) return null;
  const quoted = getQuotedMessageId(msg);

  if (!quoted) return null;

  const quotedMsg = await Message.findOne({
    where: { wid: quoted }
  });

  if (!quotedMsg) return null;

  return quotedMsg;
};

export const verifyMediaMessage = async (
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact,
  ticketTraking: TicketTraking,
  isForwarded: boolean = false,
  isPrivate: boolean = false,
  wbot: Session,
  isScheduled: boolean = false
): Promise<Message> => {
  const io = getIO();
  const quotedMsg = await verifyQuotedMessage(msg);
  const companyId = ticket.companyId;

  try {
    const media = await downloadMedia(msg, ticket?.imported, wbot, ticket);

    if (!media && ticket.imported) {
      const body =
        "*System:* \nFalha no download da mídia verifique no dispositivo";
      const messageData = {
        //mensagem de texto
        wid: msg.key.id,
        ticketId: ticket.id,
        contactId: msg.key.fromMe ? undefined : ticket.contactId,
        body,
        reactionMessage: msg.message?.reactionMessage,
        fromMe: msg.key.fromMe,
        mediaType: getTypeMessage(msg),
        read: msg.key.fromMe,
        quotedMsgId: quotedMsg?.id || msg.message?.reactionMessage?.key?.id,
        ack: 1, // inicial; promoção vem só por receipt
        companyId: companyId,
        remoteJid: resolveRemoteJid(msg, ticket),
        participant: msg.key.participant,
        timestamp: getTimestampMessage(msg.messageTimestamp),
        createdAt: new Date(
          Math.floor(getTimestampMessage(msg.messageTimestamp) * 1000)
        ).toISOString(),
    dataJson: JSON.stringify({ ...msg, __isScheduled: isScheduled }),
        ticketImported: ticket.imported,
        isForwarded,
        isPrivate
      };

      await ticket.update({
        lastMessage: body
      });
      logger.error(Error("ERR_WAPP_DOWNLOAD_MEDIA"));
      return CreateMessageService({ messageData, companyId: companyId });
    }

    if (!media) {
      throw new Error("ERR_WAPP_DOWNLOAD_MEDIA");
    }

    // if (!media.filename || media.mimetype === "audio/mp4") {
    //   const ext = media.mimetype === "audio/mp4" ? "m4a" : media.mimetype.split("/")[1].split(";")[0];
    //   media.filename = `${new Date().getTime()}.${ext}`;
    // } else {
    //   // ext = tudo depois do ultimo .
    //   const ext = media.filename.split(".").pop();
    //   // name = tudo antes do ultimo .
    //   const name = media.filename.split(".").slice(0, -1).join(".").replace(/\s/g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    //   media.filename = `${name.trim()}_${new Date().getTime()}.${ext}`;
    // }
    if (!media.filename) {
      const ext = media.mimetype.split("/")[1].split(";")[0];
      media.filename = `${new Date().getTime()}.${ext}`;
    } else {
      // ext = tudo depois do ultimo .
      const ext = media.filename.split(".").pop();
      // name = tudo antes do ultimo .
      const name = media.filename
        .split(".")
        .slice(0, -1)
        .join(".")
        .replace(/\s/g, "_")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      media.filename = `${name.trim()}_${new Date().getTime()}.${ext}`;
    }

    try {
      const folder = path.resolve(
        __dirname,
        "..",
        "..",
        "..",
        "public",
        `company${companyId}`
      );

      // const folder = `public/company${companyId}`; // Correção adicionada por Altemir 16-08-2023
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true }); // Correção adicionada por Altemir 16-08-2023
        fs.chmodSync(folder, 0o777);
      }

      await writeFile(
      join(folder, media.filename),
      media.data.toString("base64"),
      "base64"
    ) // Correção adicionada por Altemir 16-08-2023
        .then(() => {
          // console.log("Arquivo salvo com sucesso!");
          if (media.mimetype.includes("audio")) {
            console.log(media.mimetype);
            const inputFile = path.join(folder, media.filename);
            let outputFile: string;

            if (inputFile.endsWith(".mpeg")) {
              outputFile = inputFile.replace(".mpeg", ".mp3");
            } else if (inputFile.endsWith(".ogg")) {
              outputFile = inputFile.replace(".ogg", ".mp3");
            } else {
              // Trate outros formatos de arquivo conforme necessário
              //console.error("Formato de arquivo não suportado:", inputFile);
              return;
            }

            return new Promise<void>((resolve, reject) => {
              ffmpeg(inputFile)
                .toFormat("mp3")
                .save(outputFile)
                .on("end", () => {
                  resolve();
                })
                .on("error", (err: any) => {
                  reject(err);
                });
            });
          }
        });
      // .then(() => {
      //   //console.log("Conversão concluída!");
      //   // Aqui você pode fazer o que desejar com o arquivo MP3 convertido.
      // })
    } catch (err) {
      Sentry.setExtra("Erro media", {
        companyId: companyId,
        ticket,
        contact,
        media,
        quotedMsg
      });
      Sentry.captureException(err);
      logger.error(err);
      console.log(msg);
    }

    const body = getBodyMessage(msg);
    const storedMediaType = resolveStoredIncomingMediaType(msg, media.mimetype);

    const messageData = {
      wid: msg.key.id,
      ticketId: ticket.id,
      contactId: msg.key.fromMe ? undefined : contact.id,
      body: body || media.filename,
      fromMe: msg.key.fromMe,
      read: msg.key.fromMe,
      mediaUrl: media.filename,
      mediaType: storedMediaType,
      quotedMsgId: quotedMsg?.id,
      ack: 1,
    remoteJid: resolveRemoteJid(msg, ticket),
      participant: msg.key.participant,
      dataJson: JSON.stringify({ ...msg, __isScheduled: isScheduled }),
      ticketTrakingId: ticketTraking?.id,
      createdAt: new Date(
        Math.floor(getTimestampMessage(msg.messageTimestamp) * 1000)
      ).toISOString(),
      ticketImported: ticket.imported,
      isForwarded,
      isPrivate
    };

    await ticket.update({
      lastMessage: body || media.filename
    });

    const newMessage = await CreateMessageService({
      messageData,
      companyId: companyId
    });

    if (!msg.key.fromMe && ticket.status === "closed") {
      // Ticket de grupo fechado nunca reabre como "pending" (aba
      // Aguardando) -- qualquer participante que fale no grupo deve
      // manter/reabrir o ticket na aba Grupos, mesmo depois de fechado
      // (ver docs/MANUAL_TECNICO.md).
      await ticket.update({ status: ticket.isGroup ? "group" : "pending" });
      await ticket.reload({
        attributes: [
          "id",
          "uuid",
          "queueId",
          "isGroup",
          "channel",
          "status",
          "contactId",
          "useIntegration",
          "lastMessage",
          "updatedAt",
          "unreadMessages",
          "companyId",
          "whatsappId",
          "imported",
          "lgpdAcceptedAt",
          "amountUsedBotQueues",
          "useIntegration",
          "integrationId",
          "userId",
          "amountUsedBotQueuesNPS",
          "lgpdSendMessageAt",
          "isBot"
        ],
        include: [
          { model: Queue, as: "queue" },
          { model: User, as: "user" },
          { model: Contact, as: "contact" },
          { model: Whatsapp, as: "whatsapp" }
        ]
      });

      io.of(String(companyId))
        // .to("closed")
        .emit(`company-${companyId}-ticket`, {
          action: "delete",
          ticket,
          ticketId: ticket.id
        });
      // console.log("emitiu socket 902", ticket.id)
      io.of(String(companyId))
        // .to(ticket.status)
        //   .to(ticket.id.toString())
        .emit(`company-${companyId}-ticket`, {
          action: "update",
          ticket,
          ticketId: ticket.id
        });
    }

    return newMessage;
  } catch (error) {
    console.log(error);
    logger.warn("Erro ao baixar media: ", JSON.stringify(msg));
  }
};

export const verifyMessage = async (
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact,
  ticketTraking?: TicketTraking,
  isPrivate?: boolean,
  isForwarded: boolean = false,
  isScheduled: boolean = false
) => {
  // console.log("Mensagem recebida:", JSON.stringify(msg, null, 2));
  const io = getIO();
  const quotedMsg = await verifyQuotedMessage(msg);
  const rawBody = getBodyMessage(msg);
  const body = typeof rawBody === "string" ? rawBody : "";
  const companyId = ticket.companyId;

  const messageData = {
    wid: msg.key.id,
    ticketId: ticket.id,
    contactId: msg.key.fromMe ? undefined : contact.id,
    body,
    fromMe: msg.key.fromMe,
    mediaType: getTypeMessage(msg),
    read: msg.key.fromMe,
    quotedMsgId: quotedMsg?.id,
    ack: 1,
    remoteJid: resolveRemoteJid(msg, ticket),
    participant: msg.key.participant,
    dataJson: JSON.stringify({ ...msg, __isScheduled: isScheduled }),
    ticketTrakingId: ticketTraking?.id,
    isPrivate,
    createdAt: new Date(
      Math.floor(getTimestampMessage(msg.messageTimestamp) * 1000)
    ).toISOString(),
    ticketImported: ticket.imported,
    isForwarded
  };

  await ticket.update({
    lastMessage: body
  });

  await CreateMessageService({ messageData, companyId: companyId });

  if (!msg.key.fromMe && ticket.status === "closed") {
    console.log("===== CHANGE =====");
    // Ticket de grupo fechado nunca reabre como "pending" (aba
    // Aguardando) -- qualquer participante que fale no grupo deve
    // manter/reabrir o ticket na aba Grupos, mesmo depois de fechado
    // (ver docs/MANUAL_TECNICO.md).
    await ticket.update({ status: ticket.isGroup ? "group" : "pending" });
    await ticket.reload({
      include: [
        { model: Queue, as: "queue" },
        { model: User, as: "user" },
        { model: Contact, as: "contact" },
        { model: Whatsapp, as: "whatsapp" }
      ]
    });

    // io.to("closed").emit(`company-${companyId}-ticket`, {
    //   action: "delete",
    //   ticket,
    //   ticketId: ticket.id
    // });

    if (!ticket.imported) {
      io.of(String(companyId))
        // .to(ticket.status)
        // .to(ticket.id.toString())
        .emit(`company-${companyId}-ticket`, {
          action: "update",
          ticket,
          ticketId: ticket.id
        });
    }
  }
};

const isValidMsg = (msg: proto.IWebMessageInfo): boolean => {
  if (msg.key.remoteJid === "status@broadcast") return false;
  try {
    const msgType = getTypeMessage(msg);
    if (!msgType) {
      const unpacked =
        msg?.message?.ephemeralMessage?.message ||
        msg?.message?.viewOnceMessage?.message ||
        msg?.message?.viewOnceMessageV2?.message ||
        msg?.message;
      logger.warn(
        `[WBOT][INVALID] msgType vazio. remoteJid=${msg?.key?.remoteJid || "sem-jid"} id=${msg?.key?.id || "sem-id"} keys=${Object.keys(unpacked || {}).join(",")}`
      );
      return false;
    }

    const ifType =
      msgType === "conversation" ||
      msgType === "extendedTextMessage" ||
      msgType === "audioMessage" ||
      msgType === "videoMessage" ||
      msgType === "ptvMessage" ||
      msgType === "imageMessage" ||
      msgType === "documentMessage" ||
      msgType === "stickerMessage" ||
      msgType === "buttonsResponseMessage" ||
      msgType === "buttonsMessage" ||
      msgType === "templateButtonReplyMessage" ||
      msgType === "interactiveResponseMessage" ||
      msgType === "messageContextInfo" ||
      msgType === "locationMessage" ||
      msgType === "liveLocationMessage" ||
      msgType === "contactMessage" ||
      msgType === "voiceMessage" ||
      msgType === "mediaMessage" ||
      msgType === "contactsArrayMessage" ||
      msgType === "reactionMessage" ||
      msgType === "ephemeralMessage" ||
      msgType === "protocolMessage" ||
      msgType === "listResponseMessage" ||
      msgType === "listMessage" ||
      msgType === "interactiveMessage" ||
      msgType === "pollCreationMessageV3" ||
      msgType === "viewOnceMessage" ||
      msgType === "documentWithCaptionMessage" ||
      msgType === "viewOnceMessageV2" ||
      msgType === "editedMessage" ||
      msgType === "advertisingMessage" ||
      msgType === "highlyStructuredMessage" ||
      msgType === "eventMessage" ||
      msgType === "adMetaPreview"; // Adicionado para tratar mensagens de anúncios

    if (!ifType) {
      logger.warn(`#### Nao achou o type em isValidMsg: ${msgType}
${JSON.stringify(msg?.message)}`);
      Sentry.setExtra("Mensagem", { BodyMsg: msg.message, msg, msgType });
      Sentry.captureException(new Error("Novo Tipo de Mensagem em isValidMsg"));
    }

    return !!ifType;
  } catch (error) {
    Sentry.setExtra("Error isValidMsg", { msg });
    Sentry.captureException(error);
  }
};

const sendDialogflowAwswer = async (
  wbot: Session,
  ticket: Ticket,
  msg: WAMessage,
  contact: Contact,
  inputAudio: string | undefined,
  companyId: number,
  queueIntegration: QueueIntegrations
) => {
  const session = await createDialogflowSessionWithModel(queueIntegration);

  if (session === undefined) {
    return;
  }

  wbot.presenceSubscribe(contact.remoteJid);
  await delay(500);

  let dialogFlowReply = await queryDialogFlow(
    session,
    queueIntegration.projectName,
    contact.remoteJid,
    getBodyMessage(msg),
    queueIntegration.language,
    inputAudio
  );

  if (!dialogFlowReply) {
    wbot.sendPresenceUpdate("composing", contact.remoteJid);

    const bodyDuvida = formatBody(
      `\u200e *${queueIntegration?.name}:* Não consegui entender sua dúvida.`
    );

    await delay(1000);

    await wbot.sendPresenceUpdate("paused", contact.remoteJid);

    const sentMessage = await wbot.sendMessage(`${contact.number}@c.us`, {
      text: bodyDuvida
    });

    await verifyMessage(sentMessage, ticket, contact);
    return;
  }

  if (dialogFlowReply.endConversation) {
    await ticket.update({
      contactId: ticket.contact.id,
      useIntegration: false
    });
  }

  const image = dialogFlowReply.parameters.image?.stringValue ?? undefined;

  const react = dialogFlowReply.parameters.react?.stringValue ?? undefined;

  const audio = dialogFlowReply.encodedAudio.toString("base64") ?? undefined;

  wbot.sendPresenceUpdate("composing", contact.remoteJid);
  await delay(500);

  let lastMessage;

  for (let message of dialogFlowReply.responses) {
    lastMessage = message.text.text[0] ? message.text.text[0] : lastMessage;
  }
  for (let message of dialogFlowReply.responses) {
    if (message.text) {
      await sendDelayedMessages(
        wbot,
        ticket,
        contact,
        message.text.text[0],
        lastMessage,
        audio,
        queueIntegration
      );
    }
  }
};

async function sendDelayedMessages(
  wbot: Session,
  ticket: Ticket,
  contact: Contact,
  message: string,
  lastMessage: string,
  audio: string | undefined,
  queueIntegration: QueueIntegrations
) {
  const companyId = ticket.companyId;
  // console.log("GETTING WHATSAPP SEND DELAYED MESSAGES", ticket.whatsappId, wbot.id)
  const whatsapp = await ShowWhatsAppService(wbot.id!, companyId);
  const farewellMessage = whatsapp.farewellMessage.replace(/[_*]/g, "");

  // if (react) {
  //   const test =
  //     /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g.test(
  //       react
  //     );
  //   if (test) {
  //     msg.react(react);
  //     await delay(1000);
  //   }
  // }
  const sentMessage = await wbot.sendMessage(`${contact.number}@c.us`, {
    text: `\u200e *${queueIntegration?.name}:* ` + message
  });

  await verifyMessage(sentMessage, ticket, contact);
  if (message != lastMessage) {
    await delay(500);
    wbot.sendPresenceUpdate("composing", contact.remoteJid);
  } else if (audio) {
    wbot.sendPresenceUpdate("recording", contact.remoteJid);
    await delay(500);

    // if (audio && message === lastMessage) {
    //   const newMedia = new MessageMedia("audio/ogg", audio);

    //   const sentMessage = await wbot.sendMessage(
    //     `${contact.number}@c.us`,
    //     newMedia,
    //     {
    //       sendAudioAsVoice: true
    //     }
    //   );

    //   await verifyMessage(sentMessage, ticket, contact);
    // }

    // if (sendImage && message === lastMessage) {
    //   const newMedia = await MessageMedia.fromUrl(sendImage, {
    //     unsafeMime: true
    //   });
    //   const sentMessage = await wbot.sendMessage(
    //     `${contact.number}@c.us`,
    //     newMedia,
    //     {
    //       sendAudioAsVoice: true
    //     }
    //   );

    //   await verifyMessage(sentMessage, ticket, contact);
    //   await ticket.update({ lastMessage: "📷 Foto" });
    // }

    if (farewellMessage && message.includes(farewellMessage)) {
      await delay(1000);
      setTimeout(async () => {
        await ticket.update({
          contactId: ticket.contact.id,
          useIntegration: true
        });
        await UpdateTicketService({
          ticketId: ticket.id,
          ticketData: { status: "closed" },
          companyId: companyId
        });
      }, 3000);
    }
  }
}

export const verifyQueue = async (
  wbot: Session,
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact,
  settings?: any,
  ticketTraking?: TicketTraking
) => {
  const companyId = ticket.companyId;
  const settingsResolved =
    settings && typeof settings.scheduleType !== "undefined"
      ? settings
      : await CompaniesSettings.findOne({ where: { companyId } });

  console.log("verifyQueue");
  // console.log("GETTING WHATSAPP VERIFY QUEUE", ticket.whatsappId, wbot.id)
  const { queues, greetingMessage, maxUseBotQueues, timeUseBotQueues } =
    await ShowWhatsAppService(wbot.id!, companyId);

  let chatbot = false;

  if (queues.length === 1) {
    chatbot = queues[0]?.chatbots.length > 1;
  }

  const enableQueuePosition = settingsResolved?.sendQueuePosition === "enabled";

  if (queues.length === 1 && !chatbot) {
    const sendGreetingMessageOneQueues =
      settingsResolved?.sendGreetingMessageOneQueues === "enabled" || false;


    // Regra de expediente por fila (inclusive quando a conexão possui apenas 1 fila):
    // fora do horário, não deve seguir para fluxo/fila, apenas enviar a mensagem da fila.
    if (
      settingsResolved?.scheduleType === "queue" &&
      !msg.key.fromMe &&
      (!ticket.isGroup || ticket.whatsapp?.groupAsTicket === "enabled")
    ) {
      const queueSchedule = await VerifyCurrentSchedule(companyId, queues[0].id, 0);

      if (!queueSchedule || queueSchedule.inActivity === false) {
        const outOfHoursMessage = String(
          queueSchedule?.message || queues[0].outOfHoursMessage || ""
        ).trim();
        const fallbackOutOfHoursMessage = String(ticket.whatsapp?.outOfHoursMessage || "").trim();
        const messageToSend = outOfHoursMessage || fallbackOutOfHoursMessage;

        if (messageToSend) {
          const body = formatBody(`${messageToSend}`, ticket);
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

    //inicia integração dialogflow/n8n
    if (!msg.key.fromMe && !ticket.isGroup && queues[0].integrationId) {
      const integrations = await ShowQueueIntegrationService(
        queues[0].integrationId,
        companyId
      );


      await handleMessageIntegration(
        msg,
        wbot,
        companyId,
        integrations,
        ticket,
        null,
        null,
        null,
        null
      );

      if (msg.key.fromMe) {

        await ticket.update({
          typebotSessionTime: moment().toDate(),
          useIntegration: true,
          integrationId: integrations.id
        });
      } else {
        await ticket.update({
          useIntegration: true,
          integrationId: integrations.id
        });
      }

      // return;
    }

    const queueGreetingMessage = String(queues[0]?.greetingMessage || "").trim();
    const connectionGreetingMessage = String(greetingMessage || "").trim();
    const greetingToSend = queueGreetingMessage || connectionGreetingMessage;

    if (greetingToSend.length > 1 && sendGreetingMessageOneQueues) {
      const body = formatBody(`${greetingToSend}`, ticket);

      if (ticket.whatsapp.greetingMediaAttachment !== null) {
        const filePath = path.resolve(
          "public",
          `company${companyId}`,
          ticket.whatsapp.greetingMediaAttachment
        );

        const fileExists = fs.existsSync(filePath);

        if (fileExists) {
          const messagePath = ticket.whatsapp.greetingMediaAttachment;
          const optionsMsg = await getMessageOptions(
            messagePath,
            filePath,
            String(companyId),
            body
          );
          const debouncedSentgreetingMediaAttachment = debounce(
            async () => {
              const sentMessage = await wbot.sendMessage(
                `${ticket.contact.number}@${
                  ticket.isGroup ? "g.us" : "s.whatsapp.net"
                }`,
                { ...optionsMsg }
              );

              await verifyMediaMessage(
                sentMessage,
                ticket,
                contact,
                ticketTraking,
                false,
                false,
                wbot
              );
            },
            1000,
            ticket.id
          );
          debouncedSentgreetingMediaAttachment();
        } else {
          await wbot.sendMessage(
            `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
            {
              text: body
            }
          );
        }
      } else {
        await wbot.sendMessage(
          `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
          {
            text: body
          }
        );
      }
    }

    if (!isNil(queues[0].fileListId)) {
      try {
        const publicFolder = path.resolve(
          __dirname,
          "..",
          "..",
          "..",
          "public"
        );

        const files = await ShowFileService(
          queues[0].fileListId,
          ticket.companyId
        );

        const folder = path.resolve(
          publicFolder,
          `company${ticket.companyId}`,
          "fileList",
          String(files.id)
        );

        for (const [index, file] of files.options.entries()) {
          const mediaSrc = {
            fieldname: "medias",
            originalname: file.path,
            encoding: "7bit",
            mimetype: file.mediaType,
            filename: file.path,
            path: path.resolve(folder, file.path)
          } as Express.Multer.File;

          await SendWhatsAppMedia({
            media: mediaSrc,
            ticket,
            body: file.name,
            isPrivate: false,
            isForwarded: false
          });
        }
      } catch (error) {
        logger.info(error);
      }
    }

    if (queues[0].closeTicket) {
      await UpdateTicketService({
        ticketData: {
          status: "closed",
          queueId: queues[0].id
          // sendFarewellMessage: false
        },
        ticketId: ticket.id,
        companyId
      });

      return;
    } else {
      await UpdateTicketService({
        ticketData: {
          queueId: queues[0].id,
          status: ticket.status === "lgpd" ? "pending" : ticket.status
        },
        ticketId: ticket.id,
        companyId
      });
    }

    const count = await Ticket.findAndCountAll({
      where: {
        userId: null,
        status: "pending",
        companyId,
        queueId: queues[0].id,
        isGroup: false
      }
    });

    if (enableQueuePosition) {
      // Lógica para enviar posição da fila de atendimento
      const qtd = count.count === 0 ? 1 : count.count;
      const msgFila = `${settingsResolved?.sendQueuePositionMessage || ""} *${qtd}*`;
      // const msgFila = `*Assistente Virtual:*\n{{ms}} *{{name}}*, sua posição na fila de atendimento é: *${qtd}*`;
      const bodyFila = formatBody(`${msgFila}`, ticket);
      const debouncedSentMessagePosicao = debounce(
        async () => {
          await wbot.sendMessage(
            `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
            {
              text: bodyFila
            }
          );
        },
        3000,
        ticket.id
      );
      debouncedSentMessagePosicao();
    }

    return;
  }

  // REGRA PARA DESABILITAR O BOT PARA ALGUM CONTATO
  if (contact.disableBot) {
    return;
  }

  let selectedOption = "";

  if (ticket.status !== "lgpd") {
    selectedOption =
      msg?.message?.buttonsResponseMessage?.selectedButtonId ||
      msg?.message?.listResponseMessage?.singleSelectReply.selectedRowId ||
      getBodyMessage(msg);
  } else {
    if (!isNil(ticket.lgpdAcceptedAt))
      await ticket.update({
        status: "pending"
      });

    await ticket.reload();
  }

  const normalizedSelectedOption = String(selectedOption || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();

  if (normalizedSelectedOption === "sair") {
    // Encerra atendimento


    const ticketData = {
      isBot: true,
      status: "closed",
      sendFarewellMessage: true,
      maxUseBotQueues: 0,
      queueId: null,
      userId: null,
      useIntegration: false
    };

    await UpdateTicketService({ ticketData, ticketId: ticket.id, companyId });
    // await ticket.update({ queueOptionId: null, chatbot: false, queueId: null, userId: null, status: "closed"});
    //await verifyQueue(wbot, msg, ticket, ticket.contact);

    // const complationMessage = ticket.whatsapp?.complationMessage;

    // console.log(complationMessage)
    // const textMessage = {
    //   text: formatBody(`\u200e${complationMessage}`, ticket),
    // };

    // if (!isNil(complationMessage)) {
    //   const sendMsg = await wbot.sendMessage(
    //     `${ticket?.contact?.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
    //     textMessage
    //   );

    //   await verifyMessage(sendMsg, ticket, ticket.contact);
    // }

    return;
  }

  let choosenQueue =
    chatbot && queues.length === 1
      ? queues[+selectedOption]
      : queues[+selectedOption - 1];


  const typeBot = settings?.chatBotType || "text";

  // Serviço p/ escolher consultor aleatório para o ticket, ao selecionar fila.
  let randomUserId;

  if (choosenQueue) {
    try {
      const userQueue = await ListUserQueueServices(choosenQueue.id);

      if (userQueue.userId > -1) {
        randomUserId = userQueue.userId;
      }
    } catch (error) {
      console.error(error);
    }
  }

  // Ativar ou desativar opção de escolher consultor aleatório.
  /*   let settings = await CompaniesSettings.findOne({
      where: {
        companyId: companyId
      }
    }); */

  const botText = async () => {

    if (choosenQueue || (queues.length === 1 && chatbot)) {
      // console.log("entrou no choose", ticket.isOutOfHour, ticketTraking.chatbotAt)
      if (queues.length === 1) choosenQueue = queues[0];
      const queue = await Queue.findByPk(choosenQueue.id);


      if (ticket.isOutOfHour === false && ticketTraking.chatbotAt !== null) {
        await ticketTraking.update({
          chatbotAt: null
        });
        await ticket.update({
          amountUsedBotQueues: 0
        });
      }

      let currentSchedule;

      if (settings?.scheduleType === "queue") {
        currentSchedule = await VerifyCurrentSchedule(companyId, queue.id, 0);
      }

      if (
        settings?.scheduleType === "queue" &&
        ticket.status !== "open" &&
        (ticket.amountUsedBotQueues < maxUseBotQueues ||
          maxUseBotQueues === 0) &&
        (!currentSchedule || currentSchedule.inActivity === false) &&
        (!ticket.isGroup || ticket.whatsapp?.groupAsTicket === "enabled")
      ) {
        if (timeUseBotQueues !== "0") {
          //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
          //const ticketTraking = await FindOrCreateATicketTrakingService({ ticketId: ticket.id, companyId });
          let dataLimite = new Date();
          let Agora = new Date();

          if (ticketTraking.chatbotAt !== null) {
            dataLimite.setMinutes(
              ticketTraking.chatbotAt.getMinutes() + Number(timeUseBotQueues)
            );

            if (
              ticketTraking.chatbotAt !== null &&
              Agora < dataLimite &&
              timeUseBotQueues !== "0" &&
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

        if (outOfHoursMessage !== "") {
          // console.log("entrei3");
          const body = formatBody(`${outOfHoursMessage}`, ticket);


          const debouncedSentMessage = debounce(
            async () => {
              await wbot.sendMessage(
                `${ticket.contact.number}@${
                  ticket.isGroup ? "g.us" : "s.whatsapp.net"
                }`,
                {
                  text: body
                }
              );
            },
            1000,
            ticket.id
          );
          debouncedSentMessage();

          //atualiza o contador de vezes que enviou o bot e que foi enviado fora de hora
          // await ticket.update({
          //   queueId: queue.id,
          //   isOutOfHour: true,
          //   amountUsedBotQueues: ticket.amountUsedBotQueues + 1
          // });

          // return;
        }
        //atualiza o contador de vezes que enviou o bot e que foi enviado fora de hora
        await ticket.update({
          queueId: queue.id,
          isOutOfHour: true,
          amountUsedBotQueues: ticket.amountUsedBotQueues + 1
        });
        return;
      }

      await UpdateTicketService({
        ticketData: {
          // amountUsedBotQueues: 0,
          queueId: choosenQueue.id
        },
        // ticketData: { queueId: queues.length ===1 ? null : choosenQueue.id },
        ticketId: ticket.id,
        companyId
      });
      // }

      if (choosenQueue.chatbots.length > 0 && !ticket.isGroup) {
        let options = "";
        choosenQueue.chatbots.forEach((chatbot, index) => {
          options += `*[ ${index + 1} ]* - ${chatbot.name}\n`;
        });

        const body = formatBody(
          `\u200e ${choosenQueue.greetingMessage}\n\n${options}\n*[ # ]* Voltar para o menu principal\n*[ Sair ]* Encerrar atendimento`,
          ticket
        );

        const sentMessage = await wbot.sendMessage(
          `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,

          {
            text: body
          }
        );

        await verifyMessage(sentMessage, ticket, contact, ticketTraking);

        if (settings?.settingsUserRandom === "enabled") {
          await UpdateTicketService({
            ticketData: { userId: randomUserId },
            ticketId: ticket.id,
            companyId
          });
        }
      }

      if (
        !choosenQueue.chatbots.length &&
        choosenQueue.greetingMessage.length !== 0
      ) {
        console.log(choosenQueue.greetingMessage);
        const body = formatBody(
          `\u200e${choosenQueue.greetingMessage}`,
          ticket
        );
        const sentMessage = await wbot.sendMessage(
          `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
          {
            text: body
          }
        );

        await verifyMessage(sentMessage, ticket, contact, ticketTraking);
      }

      if (!isNil(choosenQueue.fileListId)) {
        try {
          const publicFolder = path.resolve(
            __dirname,
            "..",
            "..",
            "..",
            "public"
          );

          const files = await ShowFileService(
            choosenQueue.fileListId,
            ticket.companyId
          );

          const folder = path.resolve(
            publicFolder,
            `company${ticket.companyId}`,
            "fileList",
            String(files.id)
          );

          for (const [index, file] of files.options.entries()) {
            const mediaSrc = {
              fieldname: "medias",
              originalname: file.path,
              encoding: "7bit",
              mimetype: file.mediaType,
              filename: file.path,
              path: path.resolve(folder, file.path)
            } as Express.Multer.File;

            // const debouncedSentMessagePosicao = debounce(
            //   async () => {
            const sentMessage = await SendWhatsAppMedia({
              media: mediaSrc,
              ticket,
              body: `\u200e ${file.name}`,
              isPrivate: false,
              isForwarded: false
            });

            await verifyMediaMessage(
              sentMessage,
              ticket,
              ticket.contact,
              ticketTraking,
              false,
              false,
              wbot
            );
            //   },
            //   2000,
            //   ticket.id
            // );
            // debouncedSentMessagePosicao();
          }
        } catch (error) {
          logger.info(error);
        }
      }

      await delay(4000);

      //se fila está parametrizada para encerrar ticket automaticamente
      if (choosenQueue.closeTicket) {
        try {
          await UpdateTicketService({
            ticketData: {
              status: "closed",
              queueId: choosenQueue.id
              // sendFarewellMessage: false,
            },
            ticketId: ticket.id,
            companyId
          });
        } catch (error) {
          logger.info(error);
        }

        return;
      }

      const count = await Ticket.findAndCountAll({
        where: {
          userId: null,
          status: "pending",
          companyId,
          queueId: choosenQueue.id,
          whatsappId: wbot.id,
          isGroup: false
        }
      });

      console.log("======== choose queue ========");
      await CreateLogTicketService({
        ticketId: ticket.id,
        type: "queue",
        queueId: choosenQueue.id
      });

      if (enableQueuePosition && !choosenQueue.chatbots.length) {
        // Lógica para enviar posição da fila de atendimento
        const qtd = count.count === 0 ? 1 : count.count;
        const msgFila = `${settings.sendQueuePositionMessage} *${qtd}*`;
        // const msgFila = `*Assistente Virtual:*\n{{ms}} *{{name}}*, sua posição na fila de atendimento é: *${qtd}*`;
        const bodyFila = formatBody(`${msgFila}`, ticket);
        const debouncedSentMessagePosicao = debounce(
          async () => {
            await wbot.sendMessage(
              `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
              {
                text: bodyFila
              }
            );
          },
          3000,
          ticket.id
        );
        debouncedSentMessagePosicao();
      }
    } else {
      if (ticket.isGroup) return;

      if (
        maxUseBotQueues &&
        maxUseBotQueues !== 0 &&
        ticket.amountUsedBotQueues >= maxUseBotQueues
      ) {
        // await UpdateTicketService({
        //   ticketData: { queueId: queues[0].id },
        //   ticketId: ticket.id
        // });

        return;
      }

      if (timeUseBotQueues !== "0") {
        //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
        //const ticketTraking = await FindOrCreateATicketTrakingService({ ticketId: ticket.id, companyId });
        let dataLimite = new Date();
        let Agora = new Date();


        if (ticketTraking.chatbotAt !== null) {
          dataLimite.setMinutes(
            ticketTraking.chatbotAt.getMinutes() + Number(timeUseBotQueues)
          );


          if (
            ticketTraking.chatbotAt !== null &&
            Agora < dataLimite &&
            timeUseBotQueues !== "0" &&
            ticket.amountUsedBotQueues !== 0
          ) {
            return;
          }
        }
        await ticketTraking.update({
          chatbotAt: null
        });
      }

      // if (wbot.waitForSocketOpen()) {
      //   console.log("AGUARDANDO")
      //   console.log(wbot.waitForSocketOpen())
      // }

      wbot.presenceSubscribe(contact.remoteJid);

      let options = "";

      wbot.sendPresenceUpdate("composing", contact.remoteJid);

      console.log("============= queue menu =============");
      queues.forEach((queue, index) => {
        options += `*[ ${index + 1} ]* - ${queue.name}\n`;
      });
      options += `\n*[ Sair ]* - Encerrar atendimento`;

      const body = formatBody(`\u200e${greetingMessage}\n\n${options}`, ticket);

      await CreateLogTicketService({
        ticketId: ticket.id,
        type: "chatBot"
      });

      await delay(1000);

      await wbot.sendPresenceUpdate("paused", contact.remoteJid);

      if (ticket.whatsapp.greetingMediaAttachment !== null) {

        const filePath = path.resolve(
          "public",
          `company${companyId}`,
          ticket.whatsapp.greetingMediaAttachment
        );

        const fileExists = fs.existsSync(filePath);
        // console.log(fileExists);
        if (fileExists) {
          const messagePath = ticket.whatsapp.greetingMediaAttachment;
          const optionsMsg = await getMessageOptions(
            messagePath,
            filePath,
            String(companyId),
            body
          );


          const debouncedSentgreetingMediaAttachment = debounce(
            async () => {
              let sentMessage = await wbot.sendMessage(
                `${ticket.contact.number}@${
                  ticket.isGroup ? "g.us" : "s.whatsapp.net"
                }`,
                { ...optionsMsg }
              );

              await verifyMediaMessage(
                sentMessage,
                ticket,
                contact,
                ticketTraking,
                false,
                false,
                wbot
              );
            },
            1000,
            ticket.id
          );
          debouncedSentgreetingMediaAttachment();
        } else {
          const debouncedSentMessage = debounce(
            async () => {
              const sentMessage = await wbot.sendMessage(
                `${contact.number}@${
                  ticket.isGroup ? "g.us" : "s.whatsapp.net"
                }`,
                {
                  text: body
                }
              );

              await verifyMessage(sentMessage, ticket, contact, ticketTraking);
            },
            1000,
            ticket.id
          );
          debouncedSentMessage();
        }


        await UpdateTicketService({
          ticketData: {
            // amountUsedBotQueues: ticket.amountUsedBotQueues + 1
          },
          ticketId: ticket.id,
          companyId
        });

        return;
      } else {

        const debouncedSentMessage = debounce(
          async () => {
            const sentMessage = await wbot.sendMessage(
              `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
              {
                text: body
              }
            );

            await verifyMessage(sentMessage, ticket, contact, ticketTraking);
          },
          1000,
          ticket.id
        );

        await UpdateTicketService({
          ticketData: {},
          ticketId: ticket.id,
          companyId
        });

        debouncedSentMessage();
      }
    }
  };

  const botList = async () => {


    if (choosenQueue || (queues.length === 1 && chatbot)) {
      // console.log("entrou no choose", ticket.isOutOfHour, ticketTraking.chatbotAt)
      if (queues.length === 1) choosenQueue = queues[0]
      const queue = await Queue.findByPk(choosenQueue.id);


      if (ticket.isOutOfHour === false && ticketTraking.chatbotAt !== null) {
        await ticketTraking.update({
          chatbotAt: null
        });
        await ticket.update({
          amountUsedBotQueues: 0
        });
      }

      let currentSchedule;

      if (settings?.scheduleType === "queue") {
        currentSchedule = await VerifyCurrentSchedule(companyId, queue.id, 0);
      }

      if (
        settings?.scheduleType === "queue" && ticket.status !== "open" &&
        (ticket.amountUsedBotQueues < maxUseBotQueues || maxUseBotQueues === 0)
        && (!currentSchedule || currentSchedule.inActivity === false)
        && (!ticket.isGroup || ticket.whatsapp?.groupAsTicket === "enabled")
      ) {
        if (timeUseBotQueues !== "0") {
          //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
          //const ticketTraking = await FindOrCreateATicketTrakingService({ ticketId: ticket.id, companyId });
          let dataLimite = new Date();
          let Agora = new Date();


          if (ticketTraking.chatbotAt !== null) {
            dataLimite.setMinutes(ticketTraking.chatbotAt.getMinutes() + (Number(timeUseBotQueues)));

            if (ticketTraking.chatbotAt !== null && Agora < dataLimite && timeUseBotQueues !== "0" && ticket.amountUsedBotQueues !== 0) {
              return
            }
          }
          await ticketTraking.update({
            chatbotAt: null
          })
        }

        const outOfHoursMessage = String(
          currentSchedule?.message || queue.outOfHoursMessage || ""
        ).trim();

        if (outOfHoursMessage !== "") {
          // console.log("entrei3");
          const body = formatBody(`${outOfHoursMessage}`, ticket);


          const debouncedSentMessage = debounce(
            async () => {
              await wbot.sendMessage(
                `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"
                }`,
                {
                  text: body
                }
              );
            },
            1000,
            ticket.id
          );
          debouncedSentMessage();

          //atualiza o contador de vezes que enviou o bot e que foi enviado fora de hora
          // await ticket.update({
          //   queueId: queue.id,
          //   isOutOfHour: true,
          //   amountUsedBotQueues: ticket.amountUsedBotQueues + 1
          // });

          // return;

        }
        //atualiza o contador de vezes que enviou o bot e que foi enviado fora de hora
        await ticket.update({
          queueId: queue.id,
          isOutOfHour: true,
          amountUsedBotQueues: ticket.amountUsedBotQueues + 1
        });
        return;
      }

      await UpdateTicketService({
        ticketData: {
          // amountUsedBotQueues: 0, 
          queueId: choosenQueue.id
        },
        // ticketData: { queueId: queues.length ===1 ? null : choosenQueue.id },
        ticketId: ticket.id,
        companyId
      });
      // }

      if (choosenQueue.chatbots.length > 0 && !ticket.isGroup) {

        const sectionsRows = [];

        choosenQueue.chatbots.forEach((chatbot, index) => {
          sectionsRows.push({
            title: chatbot.name,
            rowId: `${index + 1}`
          });
        });
        sectionsRows.push({
          title: "Voltar Menu Inicial",
          rowId: "#"
        });
        const sections = [
          {
            title: 'Lista de Botões',
            rows: sectionsRows
          }
        ];

        const listMessage = {
          text: formatBody(`\u200e${queue.greetingMessage}\n`),
          title: "Lista\n",
          buttonText: "Clique aqui",
          //footer: ".",
          //listType: 2,
          sections
        };
        const sendMsg = await wbot.sendMessage(
          `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
          listMessage
        );

        await verifyMessage(sendMsg, ticket, contact, ticketTraking);



        if (settings?.settingsUserRandom === "enabled") {
          await UpdateTicketService({
            ticketData: { userId: randomUserId },
            ticketId: ticket.id,
            companyId
          });
        }
      }

      if (!choosenQueue.chatbots.length && choosenQueue.greetingMessage.length !== 0) {
        console.log(choosenQueue.greetingMessage)
        const body = formatBody(
          `\u200e${choosenQueue.greetingMessage}`,
          ticket
        );
        const sentMessage = await wbot.sendMessage(
          `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
          {
            text: body
          }
        );

        await verifyMessage(sentMessage, ticket, contact, ticketTraking);

      }


      if (!isNil(choosenQueue.fileListId)) {
        try {

          const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

          const files = await ShowFileService(choosenQueue.fileListId, ticket.companyId)

          const folder = path.resolve(publicFolder, `company${ticket.companyId}`, "fileList", String(files.id))

          for (const [index, file] of files.options.entries()) {
            const mediaSrc = {
              fieldname: 'medias',
              originalname: file.path,
              encoding: '7bit',
              mimetype: file.mediaType,
              filename: file.path,
              path: path.resolve(folder, file.path),
            } as Express.Multer.File

            // const debouncedSentMessagePosicao = debounce(
            //   async () => {
            const sentMessage = await SendWhatsAppMedia({ media: mediaSrc, ticket, body: `\u200e ${file.name}`, isPrivate: false, isForwarded: false });

            await verifyMediaMessage(sentMessage, ticket, ticket.contact, ticketTraking, false, false, wbot);
            //   },
            //   2000,
            //   ticket.id
            // );
            // debouncedSentMessagePosicao();
          };


        } catch (error) {
          logger.info(error);
        }
      }

      await delay(4000)


      //se fila está parametrizada para encerrar ticket automaticamente
      if (choosenQueue.closeTicket) {
        try {

          await UpdateTicketService({
            ticketData: {
              status: "closed",
              queueId: choosenQueue.id,
              // sendFarewellMessage: false,
            },
            ticketId: ticket.id,
            companyId,
          });
        } catch (error) {
          logger.info(error);
        }

        return;
      }

      const count = await Ticket.findAndCountAll({
        where: {
          userId: null,
          status: "pending",
          companyId,
          queueId: choosenQueue.id,
          whatsappId: wbot.id,
          isGroup: false
        }
      });

      console.log("======== choose queue ========")
      await CreateLogTicketService({
        ticketId: ticket.id,
        type: "queue",
        queueId: choosenQueue.id
      });

      if (enableQueuePosition && !choosenQueue.chatbots.length) {
        // Lógica para enviar posição da fila de atendimento
        const qtd = count.count === 0 ? 1 : count.count
        const msgFila = `${settings.sendQueuePositionMessage} *${qtd}*`;
        // const msgFila = `*Assistente Virtual:*\n{{ms}} *{{name}}*, sua posição na fila de atendimento é: *${qtd}*`;
        const bodyFila = formatBody(`${msgFila}`, ticket);
        const debouncedSentMessagePosicao = debounce(
          async () => {
            await wbot.sendMessage(
              `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"
              }`,
              {
                text: bodyFila
              }
            );
          },
          3000,
          ticket.id
        );
        debouncedSentMessagePosicao();
      }


    } else {

      if (ticket.isGroup) return;

      if (maxUseBotQueues && maxUseBotQueues !== 0 && ticket.amountUsedBotQueues >= maxUseBotQueues) {
        // await UpdateTicketService({
        //   ticketData: { queueId: queues[0].id },
        //   ticketId: ticket.id
        // });

        return;
      }

      if (timeUseBotQueues !== "0") {
        //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
        //const ticketTraking = await FindOrCreateATicketTrakingService({ ticketId: ticket.id, companyId });
        let dataLimite = new Date();
        let Agora = new Date();


        if (ticketTraking.chatbotAt !== null) {
          dataLimite.setMinutes(ticketTraking.chatbotAt.getMinutes() + (Number(timeUseBotQueues)));


          if (ticketTraking.chatbotAt !== null && Agora < dataLimite && timeUseBotQueues !== "0" && ticket.amountUsedBotQueues !== 0) {
            return
          }
        }
        await ticketTraking.update({
          chatbotAt: null
        })
      }

      // if (wbot.waitForSocketOpen()) {
      //   console.log("AGUARDANDO")
      //   console.log(wbot.waitForSocketOpen())
      // }

      wbot.presenceSubscribe(contact.remoteJid);


      let options = "";

      wbot.sendPresenceUpdate("composing", contact.remoteJid);

      console.log("============= queue menu =============")
      const sectionsRows = [];

      queues.forEach((queue, index) => {
        sectionsRows.push({
          title: `${queue.name}`,//queue.name,
          description: `_`,
          rowId: `${index + 1}`
        });
      });

     sectionsRows.push({
          title: "Voltar Menu Inicial",
          rowId: "#"
        });
        
      await CreateLogTicketService({
        ticketId: ticket.id,
        type: "chatBot"
      });

      await delay(1000);
      const body = formatBody(
        `\u200e${greetingMessage}\n\n${options}`,
        ticket
      );

      await wbot.sendPresenceUpdate('paused', contact.remoteJid)

      if (ticket.whatsapp.greetingMediaAttachment !== null) {


        const filePath = path.resolve("public", `company${companyId}`, ticket.whatsapp.greetingMediaAttachment);

        const fileExists = fs.existsSync(filePath);
        // console.log(fileExists);
        if (fileExists) {
          const messagePath = ticket.whatsapp.greetingMediaAttachment
          const optionsMsg = await getMessageOptions(messagePath, filePath, String(companyId), body);


          const debouncedSentgreetingMediaAttachment = debounce(
            async () => {

              let sentMessage = await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, { ...optionsMsg });

              await verifyMediaMessage(sentMessage, ticket, contact, ticketTraking, false, false, wbot);

            },
            1000,
            ticket.id
          );
          debouncedSentgreetingMediaAttachment();
        } else {
          const debouncedSentMessage = debounce(
            async () => {
              const sections = [
                {
                  title: 'Lista de Botões',
                  rows: sectionsRows
                }
              ];

              const listMessage = {
                title: "Lista\n",
                text: formatBody(`\u200e${greetingMessage}\n`),
                buttonText: "Clique aqui",
                //footer: "_",
                sections
              };

              const sendMsg = await wbot.sendMessage(
                `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
                listMessage
              );

              await verifyMessage(sendMsg, ticket, contact, ticketTraking);

            },
            1000,
            ticket.id
          );
          debouncedSentMessage();
        }


        await UpdateTicketService({
          ticketData: {
            // amountUsedBotQueues: ticket.amountUsedBotQueues + 1 
          },
          ticketId: ticket.id,
          companyId
        });

        return
      } else {


        const debouncedSentMessage = debounce(
          async () => {
            const sections = [
              {
                title: 'Lista de Botões',
                rows: sectionsRows
              }
            ];

            const listMessage = {
              title: "Lista\n",
              text: formatBody(`\u200e${greetingMessage}\n`),
              buttonText: "Clique aqui",
              //footer: "_",
              sections
            };

            const sendMsg = await wbot.sendMessage(
              `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
              listMessage
            );

            await verifyMessage(sendMsg, ticket, contact, ticketTraking);
          },
          1000,
          ticket.id
        );

        await UpdateTicketService({
          ticketData: {

          },
          ticketId: ticket.id,
          companyId
        });

        debouncedSentMessage();
      }
    }
  };

  const botButton = async () => {


    if (choosenQueue || (queues.length === 1 && chatbot)) {
      // console.log("entrou no choose", ticket.isOutOfHour, ticketTraking.chatbotAt)
      if (queues.length === 1) choosenQueue = queues[0]
      const queue = await Queue.findByPk(choosenQueue.id);


      if (ticket.isOutOfHour === false && ticketTraking.chatbotAt !== null) {
        await ticketTraking.update({
          chatbotAt: null
        });
        await ticket.update({
          amountUsedBotQueues: 0
        });
      }

      let currentSchedule;

      if (settings?.scheduleType === "queue") {
        currentSchedule = await VerifyCurrentSchedule(companyId, queue.id, 0);
      }

      if (
        settings?.scheduleType === "queue" && ticket.status !== "open" &&
        (ticket.amountUsedBotQueues < maxUseBotQueues || maxUseBotQueues === 0)
        && (!currentSchedule || currentSchedule.inActivity === false)
        && (!ticket.isGroup || ticket.whatsapp?.groupAsTicket === "enabled")
      ) {
        if (timeUseBotQueues !== "0") {
          //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
          //const ticketTraking = await FindOrCreateATicketTrakingService({ ticketId: ticket.id, companyId });
          let dataLimite = new Date();
          let Agora = new Date();


          if (ticketTraking.chatbotAt !== null) {
            dataLimite.setMinutes(ticketTraking.chatbotAt.getMinutes() + (Number(timeUseBotQueues)));

            if (ticketTraking.chatbotAt !== null && Agora < dataLimite && timeUseBotQueues !== "0" && ticket.amountUsedBotQueues !== 0) {
              return
            }
          }
          await ticketTraking.update({
            chatbotAt: null
          })
        }

        const outOfHoursMessage = String(
          currentSchedule?.message || queue.outOfHoursMessage || ""
        ).trim();

        if (outOfHoursMessage !== "") {
          // console.log("entrei3");
          const body = formatBody(`${outOfHoursMessage}`, ticket);


          const debouncedSentMessage = debounce(
            async () => {
              await wbot.sendMessage(
                `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"
                }`,
                {
                  text: body
                }
              );
            },
            1000,
            ticket.id
          );
          debouncedSentMessage();

        }

        await ticket.update({
          queueId: queue.id,
          isOutOfHour: true,
          amountUsedBotQueues: ticket.amountUsedBotQueues + 1
        });
        return;
      }

      await UpdateTicketService({
        ticketData: {
          queueId: choosenQueue.id
        },
        ticketId: ticket.id,
        companyId
      });
      // }

      if (choosenQueue.chatbots.length > 0 && !ticket.isGroup) {
        const debouncedSentMessage = debounce(
          async () => {
            try {
              // Busca o número do WhatsApp associado ao ticket
              const whatsapp = await Whatsapp.findOne({ where: { id: ticket.whatsappId } });
              if (!whatsapp || !whatsapp.number) {
                console.error('Número de WhatsApp não encontrado para o ticket:', ticket.whatsappId);
                throw new Error('Número de WhatsApp não encontrado');
              }
              const botNumber = whatsapp.number;

              const buttons = [];

              // Adiciona os chatbots como botões
              choosenQueue.chatbots.forEach((chatbot, index) => {
                buttons.push({
                  name: 'quick_reply',  // Substitua por 'quick_reply' se necessário, dependendo do contexto
                  buttonParamsJson: JSON.stringify({
                    display_text: chatbot.name,
                    id: `${index + 1}`
                  })
                });
              });

              buttons.push({
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                  display_text: "Voltar Menu Inicial",
                  id: "#"
                })
              });
              const interactiveMsg = {
                viewOnceMessage: {
                  message: {
                    interactiveMessage: {
                      body: {
                        text: `\u200e${choosenQueue.greetingMessage}`,
                      },
                      nativeFlowMessage: {
                        buttons: buttons,
                        messageParamsJson: JSON.stringify({
                          from: 'apiv2',
                          templateId: '4194019344155670',
                        }),
                      },
                    },
                  },
                },
              };
              const jid = `${contact.number}@${ticket.isGroup ? 'g.us' : 's.whatsapp.net'}`;
              const newMsg = generateWAMessageFromContent(jid, interactiveMsg, { userJid: botNumber, });
              await wbot.relayMessage(jid, newMsg.message!, { messageId: newMsg.key.id }
              );
              if (newMsg) {
                await wbot.upsertMessage(newMsg, 'notify');
              }
            } catch (error) {
              console.error('Erro ao enviar ou fazer upsert da mensagem:', error);
            }
          },
          1000,
          ticket.id
        );
        debouncedSentMessage();

     if (settings?.settingsUserRandom === "enabled") {
          await UpdateTicketService({
            ticketData: { userId: randomUserId },
            ticketId: ticket.id,
            companyId
          });
        }
      }

      if (!choosenQueue.chatbots.length && choosenQueue.greetingMessage.length !== 0) {
        console.log(choosenQueue.greetingMessage)
        const body = formatBody(
          `\u200e${choosenQueue.greetingMessage}`,
          ticket
        );
        const sentMessage = await wbot.sendMessage(
          `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
          {
            text: body
          }
        );

        await verifyMessage(sentMessage, ticket, contact, ticketTraking);

      }


      if (!isNil(choosenQueue.fileListId)) {
        try {

          const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

          const files = await ShowFileService(choosenQueue.fileListId, ticket.companyId)

          const folder = path.resolve(publicFolder, `company${ticket.companyId}`, "fileList", String(files.id))

          for (const [index, file] of files.options.entries()) {
            const mediaSrc = {
              fieldname: 'medias',
              originalname: file.path,
              encoding: '7bit',
              mimetype: file.mediaType,
              filename: file.path,
              path: path.resolve(folder, file.path),
            } as Express.Multer.File

            // const debouncedSentMessagePosicao = debounce(
            //   async () => {
            const sentMessage = await SendWhatsAppMedia({ media: mediaSrc, ticket, body: `\u200e ${file.name}`, isPrivate: false, isForwarded: false });

            await verifyMediaMessage(sentMessage, ticket, ticket.contact, ticketTraking, false, false, wbot);
            //   },
            //   2000,
            //   ticket.id
            // );
            // debouncedSentMessagePosicao();
          };


        } catch (error) {
          logger.info(error);
        }
      }

      await delay(4000)


      //se fila está parametrizada para encerrar ticket automaticamente
      if (choosenQueue.closeTicket) {
        try {

          await UpdateTicketService({
            ticketData: {
              status: "closed",
              queueId: choosenQueue.id,
              // sendFarewellMessage: false,
            },
            ticketId: ticket.id,
            companyId,
          });
        } catch (error) {
          logger.info(error);
        }

        return;
      }

      const count = await Ticket.findAndCountAll({
        where: {
          userId: null,
          status: "pending",
          companyId,
          queueId: choosenQueue.id,
          whatsappId: wbot.id,
          isGroup: false
        }
      });

      console.log("======== choose queue ========")
      await CreateLogTicketService({
        ticketId: ticket.id,
        type: "queue",
        queueId: choosenQueue.id
      });

      if (enableQueuePosition && !choosenQueue.chatbots.length) {
        // Lógica para enviar posição da fila de atendimento
        const qtd = count.count === 0 ? 1 : count.count
        const msgFila = `${settings.sendQueuePositionMessage} *${qtd}*`;
        // const msgFila = `*Assistente Virtual:*\n{{ms}} *{{name}}*, sua posição na fila de atendimento é: *${qtd}*`;
        const bodyFila = formatBody(`${msgFila}`, ticket);
        const debouncedSentMessagePosicao = debounce(
          async () => {
            await wbot.sendMessage(
              `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"
              }`,
              {
                text: bodyFila
              }
            );
          },
          3000,
          ticket.id
        );
        debouncedSentMessagePosicao();
      }


    } else {

      if (ticket.isGroup) return;

      if (maxUseBotQueues && maxUseBotQueues !== 0 && ticket.amountUsedBotQueues >= maxUseBotQueues) {
        // await UpdateTicketService({
        //   ticketData: { queueId: queues[0].id },
        //   ticketId: ticket.id
        // });

        return;
      }

      if (timeUseBotQueues !== "0") {
        //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
        //const ticketTraking = await FindOrCreateATicketTrakingService({ ticketId: ticket.id, companyId });
        let dataLimite = new Date();
        let Agora = new Date();


        if (ticketTraking.chatbotAt !== null) {
          dataLimite.setMinutes(ticketTraking.chatbotAt.getMinutes() + (Number(timeUseBotQueues)));


          if (ticketTraking.chatbotAt !== null && Agora < dataLimite && timeUseBotQueues !== "0" && ticket.amountUsedBotQueues !== 0) {
            return
          }
        }
        await ticketTraking.update({
          chatbotAt: null
        })
      }

      wbot.presenceSubscribe(contact.remoteJid);


      let options = "";

      wbot.sendPresenceUpdate("composing", contact.remoteJid);

      console.log("============= queue menu =============")

      const body = formatBody(
        `\u200e${greetingMessage}\n\n${options}`,
        ticket
      );

      await CreateLogTicketService({
        ticketId: ticket.id,
        type: "chatBot"
      });

      await delay(1000);

      await wbot.sendPresenceUpdate('paused', contact.remoteJid)

      if (ticket.whatsapp.greetingMediaAttachment !== null) {


        const filePath = path.resolve("public", `company${companyId}`, ticket.whatsapp.greetingMediaAttachment);

        const fileExists = fs.existsSync(filePath);
        // console.log(fileExists);
        if (fileExists) {
          const debouncedSentgreetingMediaAttachment = debounce(
            async () => {
              try {
                const whatsapp = await Whatsapp.findOne({ where: { id: ticket.whatsappId } });
                if (!whatsapp || !whatsapp.number) {
                  console.error('Número de WhatsApp não encontrado para o ticket:', ticket.whatsappId);
                  throw new Error('Número de WhatsApp não encontrado');
                }
                const botNumber = whatsapp.number;

                const buttons = [];

                queues.forEach((queue, index) => {
                  buttons.push({
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                      display_text: queue.name,
                      id: `${index + 1}`
                    }),
                  });
                });

                buttons.push({
                  name: 'quick_reply',
                  buttonParamsJson: JSON.stringify({
                    display_text: "Encerrar atendimento",
                    id: "Sair"
                  }),
                });

                // Verifica se há uma mídia para enviar
                if (ticket.whatsapp.greetingMediaAttachment) {
                  const filePath = path.resolve("public", `company${companyId}`, ticket.whatsapp.greetingMediaAttachment);
                  const fileExists = fs.existsSync(filePath);

                  if (fileExists) {
                    // Carrega a imagem local
                    const imageMessageContent = await generateWAMessageContent(
                      { image: { url: filePath } }, // Caminho da imagem local
                      { upload: wbot.waUploadToServer! }
                    );
                    const imageMessage = imageMessageContent.imageMessage;

                    // Mensagem interativa com mídia
                    const interactiveMsg = {
                      viewOnceMessage: {
                        message: {
                          interactiveMessage: {
                            body: {
                              text: `\u200e${greetingMessage}`,
                            },
                            header: {
                              imageMessage,  // Anexa a imagem
                              hasMediaAttachment: true
                            },
                            nativeFlowMessage: {
                              buttons: buttons,
                              messageParamsJson: JSON.stringify({
                                from: 'apiv2',
                                templateId: '4194019344155670',
                              }),
                            },
                          },
                        },
                      },
                    };

                    const jid = `${contact.number}@${ticket.isGroup ? 'g.us' : 's.whatsapp.net'}`;
                    const newMsg = generateWAMessageFromContent(jid, interactiveMsg, { userJid: botNumber });
                    await wbot.relayMessage(jid, newMsg.message!, { messageId: newMsg.key.id });

                    if (newMsg) {
                      await wbot.upsertMessage(newMsg, 'notify');
                    }
                  }
                }
              } catch (error) {
                console.error('Erro ao enviar ou fazer upsert da mensagem:', error);
              }
            },
            1000,
            ticket.id
          );
          debouncedSentgreetingMediaAttachment();
        } else {
          const debouncedSentButton = debounce(
            async () => {
              try {
                const whatsapp = await Whatsapp.findOne({ where: { id: ticket.whatsappId } });
                if (!whatsapp || !whatsapp.number) {
                  console.error('Número de WhatsApp não encontrado para o ticket:', ticket.whatsappId);
                  throw new Error('Número de WhatsApp não encontrado');
                }
                const botNumber = whatsapp.number;

                const buttons = [];

                queues.forEach((queue, index) => {
                  buttons.push({
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                      display_text: queue.name,
                      id: `${index + 1}`
                    }),
                  });
                });

                buttons.push({
                  name: 'quick_reply',
                  buttonParamsJson: JSON.stringify({
                    display_text: "Encerrar atendimento",
                    id: "Sair"
                  }),
                });

                const interactiveMsg = {
                  viewOnceMessage: {
                    message: {
                      interactiveMessage: {
                        body: {
                          text: `\u200e${greetingMessage}`,
                        },
                        nativeFlowMessage: {
                          buttons: buttons,
                          messageParamsJson: JSON.stringify({
                            from: 'apiv2',
                            templateId: '4194019344155670',
                          }),
                        },
                      },
                    },
                  },
                };

                const jid = `${contact.number}@${ticket.isGroup ? 'g.us' : 's.whatsapp.net'}`;
                const newMsg = generateWAMessageFromContent(jid, interactiveMsg, { userJid: botNumber });
                await wbot.relayMessage(jid, newMsg.message!, { messageId: newMsg.key.id });

                if (newMsg) {
                  await wbot.upsertMessage(newMsg, 'notify');
                }
              } catch (error) {
                console.error('Erro ao enviar ou fazer upsert da mensagem:', error);
              }
            },
            1000,
            ticket.id
          );

          debouncedSentButton();
        }


        await UpdateTicketService({
          ticketData: {
          },
          ticketId: ticket.id,
          companyId
        });

        return
      } else {


        const debouncedSentButton = debounce(
          async () => {
            try {
              const whatsapp = await Whatsapp.findOne({ where: { id: ticket.whatsappId } });
              if (!whatsapp || !whatsapp.number) {
                console.error('Número de WhatsApp não encontrado para o ticket:', ticket.whatsappId);
                throw new Error('Número de WhatsApp não encontrado');
              }
              const botNumber = whatsapp.number;

              const buttons = [];

              queues.forEach((queue, index) => {
                buttons.push({
                  name: 'quick_reply',
                  buttonParamsJson: JSON.stringify({
                    display_text: queue.name,
                    id: `${index + 1}`
                  }),
                });
              });

              buttons.push({
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                  display_text: "Encerrar atendimento",
                  id: "Sair"
                }),
              });

              const interactiveMsg = {
                viewOnceMessage: {
                  message: {
                    interactiveMessage: {
                      body: {
                        text: `\u200e${greetingMessage}`,
                      },
                      nativeFlowMessage: {
                        buttons: buttons,
                        messageParamsJson: JSON.stringify({
                          from: 'apiv2',
                          templateId: '4194019344155670',
                        }),
                      },
                    },
                  },
                },
              };

              const jid = `${contact.number}@${ticket.isGroup ? 'g.us' : 's.whatsapp.net'}`;
              const newMsg = generateWAMessageFromContent(jid, interactiveMsg, { userJid: botNumber });
              await wbot.relayMessage(jid, newMsg.message!, { messageId: newMsg.key.id });

              if (newMsg) {
                await wbot.upsertMessage(newMsg, 'notify');
              }
            } catch (error) {
              console.error('Erro ao enviar ou fazer upsert da mensagem:', error);
            }
          },
          1000,
          ticket.id
        );



        await UpdateTicketService({
          ticketData: {

          },
          ticketId: ticket.id,
          companyId
        });
        debouncedSentButton();
      }
    }
  };

  if (typeBot === "text") {
    return botText();
  }
  
   if (typeBot === "list") {
    return botList();
  }

  if (typeBot === "button") {
    return botButton();
  }

  if (typeBot === "button" && queues.length > 3) {
    return botText();
  }
};

export const verifyRating = (ticketTraking: TicketTraking) => {
  console.log("2029", { verifyRating })
  if (
    ticketTraking &&
    ticketTraking.finishedAt === null &&
    ticketTraking.closedAt !== null &&
    ticketTraking.userId !== null &&
    ticketTraking.ratingAt === null
  ) {
    return true;
  }
  return false;
};

export const handleRating = async (
  rate: number,
  ticket: Ticket,
  ticketTraking: TicketTraking
) => {
  const io = getIO();
  const companyId = ticket.companyId;

  console.log("2050", { handleRating })

  // console.log("GETTING WHATSAPP HANDLE RATING", ticket.whatsappId, ticket.id)
  const { complationMessage } = await ShowWhatsAppService(
    ticket.whatsappId,

    companyId
  );

  let finalRate = rate;

  if (rate < 0) {
    finalRate = 0;
  }
  if (rate > 10) {
    finalRate = 10;
  }

  await UserRating.create({
    ticketId: ticketTraking.ticketId,
    companyId: ticketTraking.companyId,
    userId: ticketTraking.userId,
    rate: finalRate
  });

  if (
    !isNil(complationMessage) &&
    complationMessage !== "" &&
    !ticket.isGroup
  ) {
    const body = formatBody(`\u200e${complationMessage}`, ticket);
    if (ticket.channel === "whatsapp") {
      const msg = await SendWhatsAppMessage({ body, ticket });

      await verifyMessage(msg, ticket, ticket.contact, ticketTraking);
    }

    if (["facebook", "instagram"].includes(ticket.channel)) {
      await sendFaceMessage({ body, ticket });
    }
  }

  await ticket.update({
    isBot: false,
    status: "closed",
    amountUsedBotQueuesNPS: 0
  });

  //loga fim de atendimento
  await CreateLogTicketService({
    userId: ticket.userId,
    queueId: ticket.queueId,
    ticketId: ticket.id,
    type: "closed"
  });

  io.of(String(companyId))
    // .to("open")
    .emit(`company-${companyId}-ticket`, {
      action: "delete",
      ticket,
      ticketId: ticket.id
    });

  io.of(String(companyId))
    // .to(ticket.status)
    // .to(ticket.id.toString())
    .emit(`company-${companyId}-ticket`, {
      action: "update",
      ticket,
      ticketId: ticket.id
    });
};

const sanitizeName = (name: string): string => {
  let sanitized = name.split(" ")[0];
  sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, "");
  return sanitized.substring(0, 60);
};

const deleteFileSync = (path: string): void => {
  try {
    fs.unlinkSync(path);
  } catch (error) {
    console.error("Erro ao deletar o arquivo:", error);
  }
};

export const convertTextToSpeechAndSaveToFile = (
  text: string,
  filename: string,
  subscriptionKey: string,
  serviceRegion: string,
  voice: string = "pt-BR-FabioNeural",
  audioToFormat: string = "mp3"
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const speechConfig = SpeechConfig.fromSubscription(
      subscriptionKey,
      serviceRegion
    );
    speechConfig.speechSynthesisVoiceName = voice;
    const audioConfig = AudioConfig.fromAudioFileOutput(`${filename}.wav`);
    const synthesizer = new SpeechSynthesizer(speechConfig, audioConfig);
    synthesizer.speakTextAsync(
      text,
      result => {
        if (result) {
          convertWavToAnotherFormat(
            `${filename}.wav`,
            `${filename}.${audioToFormat}`,
            audioToFormat
          )
            .then(output => {
              resolve();
            })
            .catch(error => {
              console.error(error);
              reject(error);
            });
        } else {
          reject(new Error("No result from synthesizer"));
        }
        synthesizer.close();
      },
      error => {
        console.error(`Error: ${error}`);
        synthesizer.close();
        reject(error);
      }
    );
  });
};

const convertWavToAnotherFormat = (
  inputPath: string,
  outputPath: string,
  toFormat: string
) => {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .toFormat(toFormat)
      .on("end", () => resolve(outputPath))
      .on("error", (err: { message: any }) =>
        reject(new Error(`Error converting file: ${err.message}`))
      )
      .save(outputPath);
  });
};

// Transfere o ticket para uma fila.
// chama a transferência e abre o ticket na fila escolhida
export const transferQueue = async (
  targetQueueId: number | null,
  ticket: Ticket,
  contact: Contact,
  msgTransfer?: string
) => {
  if (!targetQueueId || targetQueueId <= 0) return;

  // Agora o ticket NÃO vai mais para "open"
  const { ticket: updatedTicket } = await UpdateTicketService({
    ticketId: ticket.id,
    companyId: ticket.companyId,
    ticketData: {
      isTransfered: true,        // <- aciona a lógica de transferência
      queueId: targetQueueId,    // <- fila de destino
      // Ticket de grupo nunca vira "pending" (aba Aguardando), nem numa
      // transferência de fluxo/chatbot para fila (ver docs/MANUAL_TECNICO.md).
      status: ticket.isGroup ? "group" : "pending", // <- **** AQUI !!!! (Aguardando)
      userId: null,              // <- libera para qualquer atendente pegar
      msgTransfer: msgTransfer ?? 
        `Transferindo você para um de nossos atendentes humanos.`
    }
  });

  const settings = await CompaniesSettings.findOne({
    where: { companyId: ticket.companyId }
  });

  if (settings?.scheduleType !== "queue") {
    return;
  }

  const queue = await Queue.findByPk(targetQueueId);
  if (!queue) {
    return;
  }

  const currentSchedule = await VerifyCurrentSchedule(
    ticket.companyId,
    targetQueueId,
    0
  );

  if (currentSchedule && currentSchedule.inActivity !== false) {
    await updatedTicket.update({
      isOutOfHour: false
    });
    return;
  }

  const outOfHoursMessage = String(
    currentSchedule?.message || queue.outOfHoursMessage || ""
  ).trim();

  if (outOfHoursMessage && !updatedTicket.isGroup) {
    const body = formatBody(`${outOfHoursMessage}`, updatedTicket);
    const sentMessage = await SendWhatsAppMessage({
      body,
      ticket: updatedTicket,
      isForwarded: false
    });

    await verifyMessage(sentMessage as any, updatedTicket, contact);
  }

  await updatedTicket.update({
    isOutOfHour: true,
    amountUsedBotQueues: Number(updatedTicket.amountUsedBotQueues || 0) + 1
  });
};

const flowbuilderIntegration = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number,
  queueIntegration: QueueIntegrations,
  ticket: Ticket,
  contact: Contact,
  isFirstMsg?: Ticket,
  isTranfered?: boolean
) => {
  const io = getIO();
  const quotedMsg = await verifyQuotedMessage(msg);
  const body = getBodyMessage(msg);

  if (contact.disableBot) {
    return;
  }

  // ============ LOCK ESPECÍFICO PARA INÍCIO DE CONVERSA ============
  const fromMe = !!msg?.key?.fromMe;
  const isPotentialWelcomeDispatch =
    !fromMe &&
    ticket &&
    ticket.status === "pending" &&
    !ticket.userId &&
    !ticket.flowStopped &&
    !ticket.lastFlowId;

  // Blindagem extra por EVENTO de mensagem (id/timestamp+body) para impedir
  // duplicidade do menu inicial em corridas intermitentes do provider.
  if (isPotentialWelcomeDispatch) {
    const normalizedContactNumber = String(contact?.number || "").replace(/\D/g, "");
    const rawMessageId = String(msg?.key?.id || "").trim();
    const fallbackToken = `${Math.floor(
      getTimestampMessage(msg.messageTimestamp)
    )}:${String(body || "").trim().slice(0, 80)}`;
    const eventToken = rawMessageId || fallbackToken;
    const eventKey = `flow-welcome-event:${companyId}:${normalizedContactNumber || contact.id}:${eventToken}`;

    try {
      const eventLock = await cacheLayer
        .getRedisInstance()
        .set(eventKey, "1", "EX", 90, "NX");

      if (!eventLock) {
        logger.warn(
          `[FLOWBUILDER] Menu inicial suprimido por dedupe de evento (ticket=${ticket.id}, contact=${contact.id}, msgId=${rawMessageId || "fallback"})`
        );
        return;
      }
    } catch (error) {
      logger.warn(
        `[FLOWBUILDER] Falha no dedupe de evento do menu inicial; seguindo fluxo (ticket=${ticket.id}): ${String(
          (error as any)?.message || error
        )}`
      );
    }
  }
  
  // Aplica lock APENAS para mensagens iniciais que disparam o menu de boas-vindas
  // Condição: primeira mensagem OU ticket recém-criado sem interação anterior
  if (isPotentialWelcomeDispatch) {
    const lockAcquired = await acquireTicketWelcomeLock(ticket.id);
    
    if (!lockAcquired) {
      console.log(`🔒 [MENU-LOCK] Ticket ${ticket.id} já processando menu inicial - ignorando duplicata`);
      return;
    }
    
    console.log(`🔓 [MENU-LOCK] Iniciando menu para novo ticket ${ticket.id}`);
  }
  // ============ FIM DO LOCK ============
  try {

  /*
  const messageData = {
    wid: msg.key.id,
    ticketId: ticket.id,
    contactId: msg.key.fromMe ? undefined : contact.id,
    body: body,
    fromMe: msg.key.fromMe,
    read: msg.key.fromMe,
    quotedMsgId: quotedMsg?.id,
    ack: Number(String(msg.status).replace('PENDING', '2').replace('NaN', '1')) || 2,
    remoteJid: msg.key.remoteJid,
    participant: msg.key.participant,
    dataJson: JSON.stringify({ ...msg, __isScheduled: isScheduled }),
    createdAt: new Date(
      Math.floor(getTimestampMessage(msg.messageTimestamp) * 1000)
    ).toISOString(),
    ticketImported: ticket.imported,
  };

  await CreateMessageService({ messageData, companyId: ticket.companyId });
  */

  if (!msg.key.fromMe && ticket.status === "closed") {
    console.log("===== CHANGE =====");
    // Ticket de grupo fechado nunca reabre como "pending" (aba
    // Aguardando) -- qualquer participante que fale no grupo deve
    // manter/reabrir o ticket na aba Grupos, mesmo depois de fechado
    // (ver docs/MANUAL_TECNICO.md).
    await ticket.update({ status: ticket.isGroup ? "group" : "pending" });
    await ticket.reload({
      include: [
        { model: Queue, as: "queue" },
        { model: User, as: "user" },
        { model: Contact, as: "contact" }
      ]
    });
    await UpdateTicketService({
      ticketData: {
        status: ticket.isGroup ? "group" : "pending",
        integrationId: ticket.integrationId
      },
      ticketId: ticket.id,
      companyId
    });

    io.of(String(companyId)).emit(`company-${companyId}-ticket`, {
      action: "delete",
      ticket,
      ticketId: ticket.id
    });

    io.of(String(companyId)).to(ticket.status).emit(`company-${companyId}-ticket`, {
      action: "update",
      ticket,
      ticketId: ticket.id
    });
  }

  if (msg.key.fromMe) {
    return;
  }

  // Recupera estado inválido de fluxo (geralmente causado por interrupção
  // durante typing/delay): lastFlowId sem flowWebhook/flowStopped.
  if (
    ticket.lastFlowId &&
    !ticket.flowWebhook &&
    !ticket.flowStopped &&
    !ticket.hashFlowId
  ) {
    logger.warn(
      `[FLOWBUILDER] Estado inválido detectado no ticket ${ticket.id}; limpando lastFlowId órfão.`
    );
    await ticket.update({ lastFlowId: null });
    ticket.lastFlowId = null;
  }

  const whatsapp = await ShowWhatsAppService(wbot.id!, companyId);
  const settings = await CompaniesSettings.findOne({
    where: { companyId }
  });
  const ticketTraking = await FindOrCreateATicketTrakingService({
    ticketId: ticket.id,
    companyId
  });

  // Prioriza regra de expediente (company/connection) antes de disparar FlowBuilder.
  // Evita envio de flow fora do horário quando existe mensagem de fora de expediente.
  if (
    !msg.key.fromMe &&
    settings?.scheduleType &&
    (settings.scheduleType === "company" ||
      settings.scheduleType === "connection") &&
    (!ticket.isGroup || whatsapp.groupAsTicket === "enabled") &&
    !["open", "group"].includes(ticket.status)
  ) {
    let currentSchedule;

    if (settings.scheduleType === "company") {
      currentSchedule = await VerifyCurrentSchedule(companyId, 0, 0);
    } else {
      currentSchedule = await VerifyCurrentSchedule(companyId, 0, whatsapp.id);
    }

    if (!currentSchedule || currentSchedule.inActivity === false) {
      const maxRepeats =
        whatsapp.maxUseBotQueues && whatsapp.maxUseBotQueues > 0
          ? whatsapp.maxUseBotQueues
          : 4;

      if (ticket.amountUsedBotQueues >= maxRepeats) {
        return;
      }

      if (whatsapp.timeUseBotQueues !== "0") {
        if (ticket.isOutOfHour === false && ticketTraking.chatbotAt !== null) {
          await ticketTraking.update({
            chatbotAt: null
          });
          await ticket.update({
            amountUsedBotQueues: 0
          });
        }

        let dataLimite = new Date();
        let Agora = new Date();

        if (ticketTraking.chatbotAt !== null) {
          dataLimite.setMinutes(
            ticketTraking.chatbotAt.getMinutes() + Number(whatsapp.timeUseBotQueues)
          );

          if (
            ticketTraking.chatbotAt !== null &&
            Agora < dataLimite &&
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

      const scopedOutOfHoursMessage = String(
        currentSchedule?.message || whatsapp.outOfHoursMessage || ""
      ).trim();

      if (scopedOutOfHoursMessage && !ticket.isGroup) {
        const bodyOutOfHours = formatBody(`${scopedOutOfHoursMessage}`, ticket);
        const debouncedSentMessage = debounce(
          async () => {
            await wbot.sendMessage(
              `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
              {
                text: bodyOutOfHours
              }
            );
          },
          1000,
          ticket.id
        );
        debouncedSentMessage();
      }

      await ticket.update({
        isOutOfHour: true,
        amountUsedBotQueues: ticket.amountUsedBotQueues + 1
      });

      return;
    }
  }

  const listPhrase = await FlowCampaignModel.findAll({
    where: {
      whatsappId: whatsapp.id
    }
  });

  if (
    listPhrase.filter(item => item.phrase === body).length === 0 &&
    !ticket.flowStopped &&
    !ticket.lastFlowId &&
    !ticket.flowWebhook
  ) {
    const welcomeDispatchKey = `flow-welcome:${companyId}:${ticket.id}`;
    const welcomeContactKey = `flow-welcome-contact:${companyId}:${whatsapp.id}:${contact.id}`;
    const normalizedContactNumber = String(contact?.number || "").replace(/\D/g, "");
    const welcomeStrongGuardKey = `flow-welcome-strong:${companyId}:${whatsapp.id}:${normalizedContactNumber || contact.id}`;

    try {
      const strongGuardLock = await cacheLayer
        .getRedisInstance()
        .set(welcomeStrongGuardKey, "1", "EX", 45, "NX");

      if (!strongGuardLock) {
        logger.warn(
          `[FLOWBUILDER] Menu inicial suprimido por guard Redis (ticket=${ticket.id}, contact=${contact.id}, number=${normalizedContactNumber || "n/a"})`
        );
        return;
      }
    } catch (error) {
      logger.warn(
        `[FLOWBUILDER] Falha no guard Redis do menu inicial; mantendo guardas locais (ticket=${ticket.id}): ${String(
          (error as any)?.message || error
        )}`
      );
    }

    if (flowWelcomeDispatchCache.get(welcomeDispatchKey)) {
      logger.warn(
        `[FLOWBUILDER] Menu inicial suprimido por cooldown curto (ticket=${ticket.id})`
      );
      return;
    }

    if (flowWelcomeContactDispatchCache.get(welcomeContactKey)) {
      logger.warn(
        `[FLOWBUILDER] Menu inicial suprimido por cooldown do contato (ticket=${ticket.id}, contact=${contact.id})`
      );
      return;
    }

    flowWelcomeDispatchCache.set(welcomeDispatchKey, true);
    flowWelcomeContactDispatchCache.set(welcomeContactKey, true);

    const flow = await FlowBuilderModel.findOne({
      where: {
        id: whatsapp.flowIdWelcome
      }
    });
    if (flow?.active) {
      const nodes: INodes[] = flow.flow["nodes"];
      const connections: IConnections[] = flow.flow["connections"];

      const mountDataContact = {
        number: contact.number,
        name: contact.name,
        email: contact.email
      };

      const nextStageWelcome = flow.flow["nodes"][0].id;
      const reservedWelcomeStart = await reserveFlowWelcomeStart(
        ticket,
        whatsapp.flowIdWelcome,
        nextStageWelcome
      );

      if (!reservedWelcomeStart) {
        logger.warn(
          `[FLOWBUILDER] Menu inicial suprimido por reserva concorrente do ticket (ticket=${ticket.id}, contact=${contact.id})`
        );
        return;
      }

      await ActionsWebhookService(
        whatsapp.id,
        whatsapp.flowIdWelcome,
        ticket.companyId,
        nodes,
        connections,
        nextStageWelcome,
        null,
        {},
        "",
        undefined,
        ticket.id,
        mountDataContact,
        msg
      );
    }
  }

  const dateTicket = new Date(
    isFirstMsg?.updatedAt ? isFirstMsg.updatedAt : ""
  );
  const dateNow = new Date();
  const diferencaEmMilissegundos = Math.abs(
    differenceInMilliseconds(dateTicket, dateNow)
  );
  const seisHorasEmMilissegundos = 6 * 60 * 60 * 1000;
  const hasPreviousTicket = !!isFirstMsg && isFirstMsg.id !== ticket.id;

  if (
    listPhrase.filter(item => item.phrase === body).length === 0 &&
    diferencaEmMilissegundos >= seisHorasEmMilissegundos &&
    hasPreviousTicket &&
    !ticket.flowStopped &&
    !ticket.lastFlowId &&
    !ticket.flowWebhook
  ) {
    console.log("2427", "handleMessageIntegration");

    const flow = await FlowBuilderModel.findOne({
      where: {
        id: whatsapp.flowIdNotPhrase
      }
    });

    if (flow?.active) {
      const nodes: INodes[] = flow.flow["nodes"];
      const connections: IConnections[] = flow.flow["connections"];

      const mountDataContact = {
        number: contact.number,
        name: contact.name,
        email: contact.email
      };

      await ActionsWebhookService(
        whatsapp.id,
        whatsapp.flowIdNotPhrase,
        ticket.companyId,
        nodes,
        connections,
        flow.flow["nodes"][0].id,
        null,
        "",
        "",
        null,
        ticket.id,
        mountDataContact,
        msg
      );
    }
  }

  // Campaign fluxo
  if (listPhrase.filter(item => item.phrase === body).length !== 0) {
    const flowDispar = listPhrase.filter(item => item.phrase === body)[0];
    const flow = await FlowBuilderModel.findOne({
      where: {
        id: flowDispar.flowId
      }
    });
    const nodes: INodes[] = flow.flow["nodes"];
    const connections: IConnections[] = flow.flow["connections"];

    const mountDataContact = {
      number: contact.number,
      name: contact.name,
      email: contact.email
    };

    await ActionsWebhookService(
      whatsapp.id,
      flowDispar.flowId,
      ticket.companyId,
      nodes,
      connections,
      flow.flow["nodes"][0].id,
      null,
      "",
      "",
      null,
      ticket.id,
      mountDataContact
    );
    return;
  }

  if (ticket.flowWebhook) {
    let webhook: WebhookModel | null = null;
    if (ticket.hashFlowId) {
      webhook = await WebhookModel.findOne({
        where: {
          company_id: ticket.companyId,
          hash_id: ticket.hashFlowId
        }
      });
    }

    if (webhook && webhook.config["details"]) {
      const flow = await FlowBuilderModel.findOne({
        where: {
          id: webhook.config["details"].idFlow
        }
      });
      const nodes: INodes[] = flow.flow["nodes"];
      const connections: IConnections[] = flow.flow["connections"];

      await ActionsWebhookService(
        whatsapp.id,
        webhook.config["details"].idFlow,
        ticket.companyId,
        nodes,
        connections,
        ticket.lastFlowId,
        ticket.dataWebhook,
        webhook.config["details"],
        ticket.hashFlowId,
        body,
        ticket.id
      );
    } else {
      const flow = await FlowBuilderModel.findOne({
        where: {
          id: ticket.flowStopped
        }
      });

      const nodes: INodes[] = flow.flow["nodes"];
      const connections: IConnections[] = flow.flow["connections"];

      if (!ticket.lastFlowId) {
        return;
      }

      const mountDataContact = {
        number: contact.number,
        name: contact.name,
        email: contact.email
      };

      await ActionsWebhookService(
        whatsapp.id,
        parseInt(ticket.flowStopped),
        ticket.companyId,
        nodes,
        connections,
        ticket.lastFlowId,
        null,
        "",
        "",
        body,
        ticket.id,
        mountDataContact,
        msg
      );
    }
    return;
  }

  // Campaign fluxo
  if (listPhrase.filter(item => item.phrase === body).length !== 0) {
    const flowDispar = listPhrase.filter(item => item.phrase === body)[0];
    const flow = await FlowBuilderModel.findOne({
      where: {
        id: flowDispar.flowId
      }
    });
    const nodes: INodes[] = flow.flow["nodes"];
    const connections: IConnections[] = flow.flow["connections"];

    const mountDataContact = {
      number: contact.number,
      name: contact.name,
      email: contact.email
    };

    //const worker = new Worker("./src/services/WebhookService/WorkerAction.ts");

    //console.log('DISPARO3')
    // Enviar as variáveis como parte da mensagem para o Worker
    // const data = {
    //   idFlowDb: flowDispar.flowId,
    //   companyId: ticketUpdate.companyId,
    //   nodes: nodes,
    //   connects: connections,
    //   nextStage: flow.flow["nodes"][0].id,
    //   dataWebhook: null,
    //   details: "",
    //   hashWebhookId: "",
    //   pressKey: null,
    //   idTicket: ticketUpdate.id,
    //   numberPhrase: mountDataContact
    // };
    // worker.postMessage(data);

    // worker.on("message", message => {
    //   console.log(`Mensagem do worker: ${message}`);
    // });

    await ActionsWebhookService(
      whatsapp.id,
      flowDispar.flowId,
      ticket.companyId,
      nodes,
      connections,
      flow.flow["nodes"][0].id,
      null,
      "",
      "",
      null,
      ticket.id,
      mountDataContact
    );
    return;
  }

  if (ticket.flowWebhook) {
    const webhook = await WebhookModel.findOne({
      where: {
        company_id: ticket.companyId,
        hash_id: ticket.hashFlowId
      }
    });

    if (webhook && webhook.config["details"]) {
      const flow = await FlowBuilderModel.findOne({
        where: {
          id: webhook.config["details"].idFlow
        }
      });
      const nodes: INodes[] = flow.flow["nodes"];
      const connections: IConnections[] = flow.flow["connections"];

      // const worker = new Worker("./src/services/WebhookService/WorkerAction.ts");

      // console.log('DISPARO4')
      // // Enviar as variáveis como parte da mensagem para o Worker
      // const data = {
      //   idFlowDb: webhook.config["details"].idFlow,
      //   companyId: ticketUpdate.companyId,
      //   nodes: nodes,
      //   connects: connections,
      //   nextStage: ticketUpdate.lastFlowId,
      //   dataWebhook: ticketUpdate.dataWebhook,
      //   details: webhook.config["details"],
      //   hashWebhookId: ticketUpdate.hashFlowId,
      //   pressKey: body,
      //   idTicket: ticketUpdate.id,
      //   numberPhrase: ""
      // };
      // worker.postMessage(data);

      // worker.on("message", message => {
      //   console.log(`Mensagem do worker: ${message}`);
      // });

      await ActionsWebhookService(
        whatsapp.id,
        webhook.config["details"].idFlow,
        ticket.companyId,
        nodes,
        connections,
        ticket.lastFlowId,
        ticket.dataWebhook,
        webhook.config["details"],
        ticket.hashFlowId,
        body,
        ticket.id
      );
    } else {
      const flow = await FlowBuilderModel.findOne({
        where: {
          id: ticket.flowStopped
        }
      });

      const nodes: INodes[] = flow.flow["nodes"];
      const connections: IConnections[] = flow.flow["connections"];

      if (!ticket.lastFlowId) {
        return;
      }

      const mountDataContact = {
        number: contact.number,
        name: contact.name,
        email: contact.email
      };

      // const worker = new Worker("./src/services/WebhookService/WorkerAction.ts");

      // console.log('DISPARO5')
      // // Enviar as variáveis como parte da mensagem para o Worker
      // const data = {
      //   idFlowDb: parseInt(ticketUpdate.flowStopped),
      //   companyId: ticketUpdate.companyId,
      //   nodes: nodes,
      //   connects: connections,
      //   nextStage: ticketUpdate.lastFlowId,
      //   dataWebhook: null,
      //   details: "",
      //   hashWebhookId: "",
      //   pressKey: body,
      //   idTicket: ticketUpdate.id,
      //   numberPhrase: mountDataContact
      // };
      // worker.postMessage(data);
      // worker.on("message", message => {
      //   console.log(`Mensagem do worker: ${message}`);
      // });

      await ActionsWebhookService(
        whatsapp.id,
        parseInt(ticket.flowStopped),
        ticket.companyId,
        nodes,
        connections,
        ticket.lastFlowId,
        null,
        "",
        "",
        body,
        ticket.id,
        mountDataContact,
        msg
      );
    }
  }
  } finally {
    // Libera o lock do menu para o ticket assim que o processamento termina.
    // A proteção contra duplicatas reais é feita pelos guards Redis por
    // evento (90s) e por contato/número (45s) que foram setados ANTES.
    if (isPotentialWelcomeDispatch) {
      await releaseTicketWelcomeLock(ticket.id);
    }
  }
};
export const handleMessageIntegration = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number,
  queueIntegration: QueueIntegrations,
  ticket: Ticket,
  isMenu: boolean,
  whatsapp: Whatsapp,
  contact: Contact,
  isFirstMsg: Ticket | null
): Promise<void> => {
  const msgType = getTypeMessage(msg);

  if (queueIntegration.type === "n8n" || queueIntegration.type === "webhook") {
    if (queueIntegration?.urlN8N) {
      axios
        .post(queueIntegration.urlN8N, msg, {
          headers: {
            "Content-Type": "application/json"
          }
        })
        .then(response => {
          console.log(response.data);
        })
        .catch(error => {
          logger.error(error);
        });
    }
  } else if (queueIntegration.type === "dialogflow") {
    let inputAudio: string | undefined;

    if (msgType === "audioMessage") {
      let filename = `${msg.messageTimestamp}.ogg`;
      try {
        inputAudio = await readFile(
          join(
            __dirname,
            "..",
            "..",
            "..",
            "public",
            `company${companyId}`,
            filename
          ),
          "base64"
        );
      } catch (err) {
        logger.error(err);
        inputAudio = undefined;
      }
    } else {
      inputAudio = undefined;
    }

    const debouncedSentMessage = debounce(
      async () => {
        await sendDialogflowAwswer(
          wbot,
          ticket,
          msg as WAMessage,
          ticket.contact,
          inputAudio,
          companyId,
          queueIntegration
        );
      },
      500,
      ticket.id
    );
    debouncedSentMessage();
  } else if (queueIntegration.type === "typebot") {
  // 🔒 LOCK TYPEBOT PARA EVITAR DUPLICATAS usando o ID numérico do ticket
  const lockAcquired = await acquireTicketWelcomeLock(ticket.id);

  if (!lockAcquired) {
    console.log(`🔒 TYPEBOT LOCK - Ticket ${ticket.id} já processando`);
    return;
  }

  try {
    await typebotListener({
       ticket,
       msg: { ...msg, key: { ...msg.key, remoteJid: resolveRemoteJid(msg, ticket) } },
       wbot,
       typebot: queueIntegration
     });
  } finally {
    // Libera lock usando o ID numérico
    await releaseTicketWelcomeLock(ticket.id);
  }
}
  
  else if (queueIntegration.type === "flowbuilder") {
    if (contact.disableBot) {
      return;
    }

    if (!isMenu) {
      const integrations = await ShowQueueIntegrationService(
        whatsapp.integrationId,
        companyId
      );
      await flowbuilderIntegration(
  msg,
  wbot,
  companyId,
  integrations,
  ticket,
  contact,
  isFirstMsg,
  false
);
    } else {
      const body = (getBodyMessage(msg) || "").trim();
      if (
        body.length > 0 &&
        ticket.status !== "open" &&
        ticket.status !== "closed"
      ) {
        await flowBuilderQueue(
          ticket,
          msg,
          wbot,
          whatsapp,
          companyId,
          contact,
          isFirstMsg
        );
      }
    }
  }
};

const flowBuilderQueue = async (
  ticket: Ticket,
  msg: proto.IWebMessageInfo,
  wbot: Session,
  whatsapp: Whatsapp,
  companyId: number,
  contact: Contact,
  isFirstMsg: Ticket
) => {
  const body = getBodyMessage(msg);

  const flow = await FlowBuilderModel.findOne({
    where: {
      id: ticket.flowStopped
    }
  });

  if (!flow || !flow.active) {
    await ticket.update({
      flowStopped: null,
      flowWebhook: false,
      lastFlowId: null,
      dataWebhook: null,
      hashFlowId: null
    });
    return;
  }

  const mountDataContact = {
    number: contact.number,
    name: contact.name,
    email: contact.email
  };

  const nodes: INodes[] = flow.flow["nodes"];
  const connections: IConnections[] = flow.flow["connections"];

  if (!ticket.lastFlowId) {
    return;
  }

  if (
    ticket.status === "closed" ||
    ticket.status === "interrupted" ||
    ticket.status === "open"
  ) {
    return;
  }

  await ActionsWebhookService(
    whatsapp.id,
    parseInt(ticket.flowStopped),
    ticket.companyId,
    nodes,
    connections,
    ticket.lastFlowId,
    null,
    "",
    "",
    body,
    ticket.id,
    mountDataContact,
    msg
  );

  //const integrations = await ShowQueueIntegrationService(whatsapp.integrationId, companyId);
  //await handleMessageIntegration(msg, wbot, companyId, integrations, ticket, contact, isFirstMsg)
};

const handleMessage = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number,
  isImported: boolean = false
): Promise<void> => {

  if (!isValidMsg(msg)) {
    return;
  }

  try {
    let msgContact: IMe;
    let groupContact: Contact | undefined;
    let queueId: number = null;
    let tagsId: number = null;
    let userId: number = null;

    let bodyMessage = getBodyMessage(msg);
    const msgType = getTypeMessage(msg);


    const hasMedia =
      msg.message?.imageMessage ||
      msg.message?.audioMessage ||
      msg.message?.videoMessage ||
      msg.message?.stickerMessage ||
      msg.message?.documentMessage ||
      msg.message?.documentWithCaptionMessage?.message?.documentMessage ||
      // msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage ||
      // msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage ||
      // msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.audioMessage ||
      msg.message?.ephemeralMessage?.message?.audioMessage ||
      msg.message?.ephemeralMessage?.message?.documentMessage ||
      msg.message?.ephemeralMessage?.message?.videoMessage ||
      msg.message?.ephemeralMessage?.message?.stickerMessage ||
      msg.message?.ephemeralMessage?.message?.imageMessage ||
      msg.message?.viewOnceMessage?.message?.imageMessage ||
      msg.message?.viewOnceMessage?.message?.videoMessage ||
      msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
        ?.imageMessage ||
      msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
        ?.videoMessage ||
      msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
        ?.audioMessage ||
      msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
        ?.documentMessage ||
      msg.message?.documentWithCaptionMessage?.message?.documentMessage ||
      msg.message?.templateMessage?.hydratedTemplate?.imageMessage ||
      msg.message?.templateMessage?.hydratedTemplate?.documentMessage ||
      msg.message?.templateMessage?.hydratedTemplate?.videoMessage ||
      msg.message?.templateMessage?.hydratedFourRowTemplate?.imageMessage ||
      msg.message?.templateMessage?.hydratedFourRowTemplate?.documentMessage ||
      msg.message?.templateMessage?.hydratedFourRowTemplate?.videoMessage ||
      msg.message?.templateMessage?.fourRowTemplate?.imageMessage ||
      msg.message?.templateMessage?.fourRowTemplate?.documentMessage ||
      msg.message?.templateMessage?.fourRowTemplate?.videoMessage ||
      msg.message?.interactiveMessage?.header?.imageMessage ||
      msg.message?.interactiveMessage?.header?.documentMessage ||
      msg.message?.interactiveMessage?.header?.videoMessage ||
      msg.message?.highlyStructuredMessage?.hydratedHsm?.hydratedTemplate
        ?.documentMessage ||
      msg.message?.highlyStructuredMessage?.hydratedHsm?.hydratedTemplate
        ?.videoMessage ||
      msg.message?.highlyStructuredMessage?.hydratedHsm?.hydratedTemplate
        ?.imageMessage ||
      msg.message?.highlyStructuredMessage?.hydratedHsm?.hydratedTemplate
        ?.locationMessage;

    if (msg.key.fromMe) {
      if (/\u200e/.test(bodyMessage)) return;


      if (
        !hasMedia &&
        msgType !== "conversation" &&
        msgType !== "extendedTextMessage" &&
        msgType !== "contactMessage" &&
        msgType !== "locationMessage" &&
        msgType !== "liveLocationMessage" &&
        msgType !== "reactionMessage" &&
        msgType !== "ephemeralMessage" &&
        msgType !== "protocolMessage" &&
        msgType !== "viewOnceMessage" &&
        msgType !== "editedMessage" &&
        msgType !== "hydratedContentText"
      )
        return;
      msgContact = await getContactMessage(msg, wbot);
    } else {
      msgContact = await getContactMessage(msg, wbot);
    }

    const isGroup = msg.key.remoteJid?.endsWith("@g.us");

    const whatsapp = await ShowWhatsAppService(wbot.id!, companyId);


    if (!whatsapp.allowGroup && isGroup) {
      logger.info(
        `[GROUP] Mensagem de grupo ignorada (allowGroup=false) na conexão ${whatsapp.id}.`
      );
      return;
    }

    if (isGroup) {
      const grupoMeta = await wbot.groupMetadata(msg.key.remoteJid);
      const msgGroupContact = {
        id: grupoMeta.id,
        name: grupoMeta.subject
      };
      groupContact = await verifyContact(msgGroupContact, wbot, companyId);
    }

    const contact = await verifyContact(msgContact, wbot, companyId);

    let unreadMessages = 0;

    if (msg.key.fromMe) {
      await cacheLayer.set(`contacts:${contact.id}:unreads`, "0");
    } else {
      const unreads = await cacheLayer.get(`contacts:${contact.id}:unreads`);
      unreadMessages = +unreads + 1;
      await cacheLayer.set(
        `contacts:${contact.id}:unreads`,
        `${unreadMessages}`
      );
    }

    const settings = await CompaniesSettings.findOne({
      where: { companyId }
    });

    const enableLGPD = settings.enableLGPD === "enabled";

    const isFirstMsg = await Ticket.findOne({
      where: {
        contactId: groupContact ? groupContact.id : contact.id,
        companyId,
        whatsappId: whatsapp.id
      },
      order: [["id", "DESC"]]
    });

    // BUSCA O ÚLTIMO TICKET DO CONTATO, INDEPENDENTE DO STATUS
    const lastTicket = await Ticket.findOne({
      where: {
        contactId: groupContact ? groupContact.id : contact.id,
        companyId,
        whatsappId: whatsapp.id
      },
      order: [["id", "DESC"]]
    });

    // SE EXISTIR UM TICKET ANTERIOR, TENTA TRATAR A MENSAGEM COMO NPS PRIMEIRO
    if (lastTicket) {
      const plainText = getTextFromBaileysMsg(msg as any);
      const npsHandled = await HandleNpsReplyService({
        ticket: lastTicket,
        companyId: lastTicket.companyId, // <--- CORREÇÃO FINAL
        text: plainText
      });
      // SE A MENSAGEM FOI TRATADA COM SUCESSO COMO NPS, INTERROMPE O FLUXO AQUI
      if (npsHandled) {
        return;
      }
    }

    // SE NÃO FOR UMA RESPOSTA DE NPS, CONTINUA O FLUXO NORMAL DE ABERTURA/REABERTURA DE TICKET
    const mutex = new Mutex();
    let ticket = await mutex.runExclusive(async () => {
      const result = await FindOrCreateTicketService(
        contact,
        whatsapp,
        unreadMessages,
        companyId,
        queueId,
        userId,
        groupContact,
        "whatsapp",
        isImported,
        false,
        settings
      );
      return result;
    });

    let reopenedFromClosed = false;
    if (ticket.status === "closed" && !msg.key.fromMe) {
      reopenedFromClosed = true;
      // Mesma regra: ticket de grupo nunca reabre como "pending" (aba
      // Aguardando) — sempre volta como "group" (ver
      // docs/MANUAL_TECNICO.md).
      await ticket.update({
        status: ticket.isGroup ? "group" : "pending",
        unreadMessages,
        isBot: true,
        queueId: null,
        userId: null,
        useIntegration: false,
        integrationId: null,
        flowStopped: null,
        flowWebhook: false,
        lastFlowId: null,
        dataWebhook: null,
        hashFlowId: null,
        typebotSessionId: null,
        typebotStatus: false,
        typebotSessionTime: null
      });
      await ticket.reload();

      const io = getIO();
      io.of(String(companyId)).emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket,
        ticketId: ticket.id
      });
    }

    // Quando o ticket foi criado previamente pelo placeholder CTWA e ainda não possui mensagens,
    // a primeira mensagem "sintética" deve ser tratada como início de fluxo.
    const ticketMessagesCount = await Message.count({
      where: { ticketId: ticket.id, companyId }
    });
    const previousTicketWasClosed =
      Boolean(isFirstMsg) &&
      String(isFirstMsg?.status || "").toLowerCase() === "closed" &&
      isFirstMsg?.id !== ticket.id;

    // Quando há um ticket anterior fechado (ex.: usuário saiu do menu com "sair"),
    // tratamos a nova mensagem como novo início para reativar o fluxo desde o começo.
    const effectiveIsFirstMsg =
      reopenedFromClosed || previousTicketWasClosed
        ? null
        : ticketMessagesCount > 0
          ? isFirstMsg
          : null;

    let bodyRollbackTag = "";
    let bodyNextTag = "";
    let rollbackTag;
    let nextTag;
    let ticketTag = undefined;
    // console.log(ticket.id)
    if (ticket?.company?.plan?.useKanban) {
      ticketTag = await TicketTag.findOne({
        where: {
          ticketId: ticket.id
        }
      });

      if (ticketTag) {
        const tag = await Tag.findByPk(ticketTag.tagId);
        if (tag.nextLaneId) {
          nextTag = await Tag.findByPk(tag.nextLaneId);
          bodyNextTag = nextTag.greetingMessageLane;
        }
        if (tag.rollbackLaneId) {
          rollbackTag = await Tag.findByPk(tag.rollbackLaneId);
          bodyRollbackTag = rollbackTag.greetingMessageLane;
        }
      }
    }

    if (
      unreadMessages === 0 &&
      whatsapp.complationMessage &&
      formatBody(whatsapp.complationMessage, ticket) === bodyMessage
    ) {
      return;
    }

    if (
      rollbackTag &&
      formatBody(bodyNextTag, ticket) !== bodyMessage &&
      formatBody(bodyRollbackTag, ticket) !== bodyMessage
    ) {
      await TicketTag.destroy({
        where: { ticketId: ticket.id, tagId: ticketTag.tagId }
      });
      await TicketTag.create({ ticketId: ticket.id, tagId: rollbackTag.id });
    }

    if (isImported) {
      await ticket.update({
        queueId: whatsapp.queueIdImportMessages
      });
    }

    // console.log(msg.message?.editedMessage)
    // console.log(ticket)
    if (msgType === "editedMessage" || msgType === "protocolMessage") {
      const msgKeyIdEdited =
        msgType === "editedMessage"
          ? msg.message.editedMessage.message.protocolMessage.key.id
          : msg.message?.protocolMessage.key.id;
      let bodyEdited = findCaption(msg.message);


      // console.log("bodyEdited", bodyEdited)
      const io = getIO();
      try {
        const messageToUpdate = await Message.findOne({
          where: {
            wid: msgKeyIdEdited,
            companyId,
            ticketId: ticket.id
          }
        });

        if (!messageToUpdate) return;

        const previousBody = String(messageToUpdate.body || "");
        let currentDataJson: any = {};
        try {
          currentDataJson = messageToUpdate.dataJson ? JSON.parse(messageToUpdate.dataJson) : {};
        } catch {
          currentDataJson = {};
        }

        const editHistory = Array.isArray(currentDataJson?.__editHistory)
          ? currentDataJson.__editHistory
          : [];
        editHistory.push({
          editedAt: new Date().toISOString(),
          oldBody: previousBody,
          newBody: bodyEdited,
          provider: "baileys"
        });

        await messageToUpdate.update({
          isEdited: true,
          body: bodyEdited,
          dataJson: JSON.stringify({
            ...currentDataJson,
            __lastEditedOldBody: previousBody,
            __lastEditedNewBody: bodyEdited,
            __lastEditedAt: new Date().toISOString(),
            __editHistory: editHistory
          })
        });

        await ticket.update({ lastMessage: bodyEdited });


        io.of(String(companyId))
          // .to(String(ticket.id))
          .emit(`company-${companyId}-appMessage`, {
            action: "update",
            message: messageToUpdate
          });

        io.of(String(companyId))
          // .to(ticket.status)
          // .to("notification")
          // .to(String(ticket.id))
          .emit(`company-${companyId}-ticket`, {
            action: "update",
            ticket
          });
      } catch (err) {
        Sentry.captureException(err);
        logger.error(`Error handling message ack. Err: ${err}`);
      }
      return;
    }

    const ticketTraking = await FindOrCreateATicketTrakingService({
      ticketId: ticket.id,
      companyId,
      userId,
      whatsappId: whatsapp?.id
    });

    let useLGPD = false;

    try {
      if (!msg.key.fromMe) {
        //MENSAGEM DE FÉRIAS COLETIVAS


        if (!isNil(whatsapp.collectiveVacationMessage && !isGroup)) {
          const currentDate = moment();


          if (
            currentDate.isBetween(
              moment(whatsapp.collectiveVacationStart),
              moment(whatsapp.collectiveVacationEnd)
            )
          ) {

            if (hasMedia) {

              await verifyMediaMessage(
                msg,
                ticket,
                contact,
                ticketTraking,
                false,
                false,
                wbot
              );
            } else {
              await verifyMessage(msg, ticket, contact, ticketTraking);
            }

            wbot.sendMessage(contact.remoteJid, {
              text: whatsapp.collectiveVacationMessage
            });

            return;
          }
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }

    const isMsgForwarded =
      msg.message?.extendedTextMessage?.contextInfo?.isForwarded ||
      msg.message?.imageMessage?.contextInfo?.isForwarded ||
      msg.message?.audioMessage?.contextInfo?.isForwarded ||
      msg.message?.videoMessage?.contextInfo?.isForwarded ||
      msg.message?.documentMessage?.contextInfo?.isForwarded;

    let mediaSent: Message | undefined;

    if (!useLGPD) {
      if (hasMedia) {
        mediaSent = await verifyMediaMessage(
          msg,
          ticket,
          contact,
          ticketTraking,
          isMsgForwarded,
          false,
          wbot
        );
      } else {
        // console.log("antes do verifyMessage")
        await verifyMessage(
          msg,
          ticket,
          contact,
          ticketTraking,
          false,
          isMsgForwarded
        );
      }
    }

    try {
      if (!msg.key.fromMe) {
        if (ticketTraking !== null && verifyRating(ticketTraking)) {
          const parsedRate = Number.parseFloat(bodyMessage);
          if (Number.isFinite(parsedRate)) {
            await handleRating(parsedRate, ticket, ticketTraking);
            return;
          }
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }
    
    // Atualiza o ticket se a ultima mensagem foi enviada por mim, para que possa ser finalizado.
    try {
      await ticket.update({
        fromMe: msg.key.fromMe
      });
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }

    let currentSchedule;

    if (settings.scheduleType === "company") {
      currentSchedule = await VerifyCurrentSchedule(companyId, 0, 0);
    } else if (settings.scheduleType === "connection") {
      currentSchedule = await VerifyCurrentSchedule(companyId, 0, whatsapp.id);
    }

    try {
  if (
    !msg.key.fromMe &&
    settings.scheduleType &&
    (!ticket.isGroup || whatsapp.groupAsTicket === "enabled") &&
    !["open", "group"].includes(ticket.status)
  ) {
    /**
     * Tratamento para envio de mensagem quando a empresa está fora do expediente
     */
    if (
      (settings.scheduleType === "company" ||
        settings.scheduleType === "connection") &&
      (!currentSchedule || currentSchedule.inActivity === false)
    ) {

      // 🔁 Limite de repetições da mensagem fora de expediente
      // (use whatsapp.maxUseBotQueues configurado na conexão ou “4” como padrão)
      const maxRepeats =
        whatsapp.maxUseBotQueues && whatsapp.maxUseBotQueues > 0
          ? whatsapp.maxUseBotQueues
          : 4;

      if (ticket.amountUsedBotQueues >= maxRepeats) {
        // Já repetiu a mensagem o máximo de vezes -> só não responde mais
        return;
      }

      if (whatsapp.timeUseBotQueues !== "0") {
        if (
          ticket.isOutOfHour === false &&
          ticketTraking.chatbotAt !== null
        ) {
          await ticketTraking.update({
            chatbotAt: null
          });
          await ticket.update({
            amountUsedBotQueues: 0
          });
        }

        //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
        let dataLimite = new Date();
        let Agora = new Date();

        if (ticketTraking.chatbotAt !== null) {
          dataLimite.setMinutes(
            ticketTraking.chatbotAt.getMinutes() +
              Number(whatsapp.timeUseBotQueues)
          );
          if (
            ticketTraking.chatbotAt !== null &&
            Agora < dataLimite &&
            whatsapp.timeUseBotQueues !== "0" &&
            ticket.amountUsedBotQueues !== 0
          ) {
            // ainda dentro da janela de bloqueio -> não responde
            return;
          }
        }

        await ticketTraking.update({
          chatbotAt: null
        });
      }

      // 💬 NOVO: mensagem de fora de expediente configurada na conexão
      // 👉 Troque "outOfHoursMessage" pelo nome EXATO do campo na tabela Whatsapp, se for diferente
      const scopedOutOfHoursMessage = String(
        currentSchedule?.message || whatsapp.outOfHoursMessage || ""
      ).trim();

      if (scopedOutOfHoursMessage && !ticket.isGroup) {
        const body = formatBody(`${scopedOutOfHoursMessage}`, ticket);

        const debouncedSentMessage = debounce(
          async () => {
            await wbot.sendMessage(
              `${contact.number}@${
                ticket.isGroup ? "g.us" : "s.whatsapp.net"
              }`,
              {
                text: body
              }
            );
          },
          1000,
          ticket.id
        );

        debouncedSentMessage();
      }

      // Marca que foi fora de expediente e incrementa o contador de repetições
      await ticket.update({
        isOutOfHour: true,
        amountUsedBotQueues: ticket.amountUsedBotQueues + 1
      });

      return;
    }
  }
} catch (e) {
  Sentry.captureException(e);
  console.log(e);
}

    const flow = await FlowBuilderModel.findOne({
      where: {
        id: ticket.flowStopped
      }
    });

    if (flow && !flow.active) {
      await ticket.update({
        flowStopped: null,
        flowWebhook: false,
        lastFlowId: null,
        dataWebhook: null,
        hashFlowId: null,
        typebotSessionId: null,
        typebotStatus: false,
        typebotSessionTime: null
      });
      return;
    }

    let isMenu = false;
    let isOpenai = false;
    let isQuestion = false;
    let isTypebotNode = false;

    if (flow) {
      isMenu =
        flow.flow["nodes"].find(
          (node: any) => String(node.id) === String(ticket.lastFlowId)
        )
          ?.type === "menu";
      isOpenai =
        flow.flow["nodes"].find(
          (node: any) => String(node.id) === String(ticket.lastFlowId)
        )
          ?.type === "openai";
      isQuestion =
        flow.flow["nodes"].find(
          (node: any) => String(node.id) === String(ticket.lastFlowId)
        )
          ?.type === "question";
      isTypebotNode =
        flow.flow["nodes"].find(
          (node: any) => String(node.id) === String(ticket.lastFlowId)
        )
          ?.type === "typebot";
    }

    if (!isNil(flow) && isQuestion && !msg.key.fromMe) {
      console.log(
        "|============= QUESTION =============|",
        JSON.stringify(flow, null, 4)
      );
      const body = getBodyMessage(msg);
      if (body) {
        const nodes: INodes[] = flow.flow["nodes"];
        const nodeSelected = flow.flow["nodes"].find(
          (node: any) => String(node.id) === String(ticket.lastFlowId)
        );

        const connections: IConnections[] = flow.flow["connections"];

        const { answerKey } = nodeSelected.data.typebotIntegration;
        const oldDataWebhook = (ticket.dataWebhook || {}) as {
          variables?: Record<string, unknown>;
          [key: string]: unknown;
        };
        const nextConnection = connections.find(
          connection =>
            String(connection.source) === String(nodeSelected.id) &&
            Boolean(connection.target)
        );
        const lastFlowId = nextConnection?.target;

        if (!lastFlowId) {
          await ticket.update({
            dataWebhook: {
              ...oldDataWebhook,
              variables: {
                ...(oldDataWebhook?.variables || {}),
                [answerKey]: body
              }
            }
          });
          await ticket.save();
          return;
        }

        await ticket.update({
          lastFlowId,
          dataWebhook: {
            ...oldDataWebhook,
            variables: {
              ...(oldDataWebhook?.variables || {}),
              [answerKey]: body
            }
          }
        });

        await ticket.save();

        const mountDataContact = {
          number: contact.number,
          name: contact.name,
          email: contact.email
        };

        await ActionsWebhookService(
          whatsapp.id,
          parseInt(ticket.flowStopped),
          ticket.companyId,
          nodes,
          connections,
          lastFlowId,
          null,
          "",
          "",
          "",
          ticket.id,
          mountDataContact,
          msg
        );
      }

      return;
    }

    // Fallback para continuidade do FlowBuilder quando o ticket já entrou em fila/setor.
    // Fica após o bloco "question" para não interceptar a captura da resposta.
    // Só deve processar entrada do usuário em nós que aguardam input.
    if (
      !msg.key.fromMe &&
      ticket.flowWebhook &&
      ticket.flowStopped &&
      ticket.lastFlowId &&
      !ticket.isGroup
    ) {
      if (!isMenu && !isOpenai && !isQuestion && !isTypebotNode) {
        logger.info(
          `[FLOWBUILDER] Mensagem ignorada em nó automático (ticket=${ticket.id}, lastFlowId=${ticket.lastFlowId})`
        );
        return;
      }

      if (isMenu) {
        const menuInputType = getTypeMessage(msg);
        const allowedMenuInputTypes = new Set([
          "conversation",
          "extendedTextMessage",
          "buttonsResponseMessage",
          "listResponseMessage",
          "templateButtonReplyMessage",
          "messageContextInfo",
          "listMessage"
        ]);
        const menuBody = (getBodyMessage(msg) || "").trim();

        if (!allowedMenuInputTypes.has(String(menuInputType || "")) || !menuBody) {
          logger.info(
            `[FLOWBUILDER] Entrada não textual ignorada no menu (ticket=${ticket.id}, type=${menuInputType || "unknown"})`
          );
          return;
        }

        await flowBuilderQueue(
          ticket,
          msg,
          wbot,
          whatsapp,
          companyId,
          contact,
          isFirstMsg
        );
        return;
      }

      // O nó OpenAI aguarda novas mensagens do cliente. Ele deve seguir para
      // handleOpenAi abaixo, sem ser tratado como continuação de menu.
      if (!isOpenai) {
        return;
      }
    }

    
    if (isOpenai && !isNil(flow) && !ticket.queueId) {
      const nodeSelected = flow.flow["nodes"].find(
        (node: any) => node.id === ticket.lastFlowId
      );
    
      if (!nodeSelected?.data?.typebotIntegration) {
        console.error("typebotIntegration not found in nodeSelected");
        return;
      }
    
      const {
        name,
        provider,
        prompt,
        voice,
        voiceKey,
        voiceRegion,
        maxTokens,
        temperature,
        apiKey,
        queueId,
        maxMessages,
        maxResponseMessages,
        model // <- Aqui está o campo ausente
      } = nodeSelected.data.typebotIntegration as IOpenAi;
    
      const openAiSettings = {
        name,
        provider,
        prompt,
        voice,
        voiceKey,
        voiceRegion,
        maxTokens: Number(maxTokens) || 0,
        temperature: Number(temperature) || 0,
        apiKey,
        queueId: Number(queueId) || 0,
        maxMessages: Number(maxMessages) || 0,
        maxResponseMessages: Number(maxResponseMessages) || 3,
        model
      };
    
      await handleOpenAi(
        openAiSettings,
        msg,
        wbot,
        ticket,
        contact,
        mediaSent,
        ticketTraking
      );
    
      return;
    }
    



    //openai na conexao
    if (
      !ticket.queue &&
      !isGroup &&
      !msg.key.fromMe &&
      !ticket.userId &&
      !isNil(whatsapp.promptId)
    ) {
      const { prompt } = whatsapp;
      await handleOpenAi(
        prompt,
        msg,
        wbot,
        ticket,
        contact,
        mediaSent,
        ticketTraking
      );
    }

if (
      !isNil(ticket.typebotSessionId) &&
      ticket.typebotStatus &&
      !msg.key.fromMe &&
      !isNil(ticket.typebotSessionTime) &&
      ticket.useIntegration
    ) {
      console.log("|================== CONTINUE TYPEBO ==============|");
      const flow = await FlowBuilderModel.findOne({
        where: {
          id: ticket.flowStopped
        }
      });
      if (!flow || !flow.active) {
        return;
      }
      const nodes: INodes[] = flow.flow["nodes"];
      const lastFlow = nodes.find(f => f.id === ticket.lastFlowId);
      const typebot = lastFlow.data.typebotIntegration;

      await typebotListener({
        wbot: wbot,
        msg,
        ticket,
        typebot: lastFlow.data.typebotIntegration
      });
      return;
    }

    //integraçao na conexao
    if (
      !ticket.imported &&
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !ticket.queueId &&
      !ticket.userId &&
      ticket.isBot &&
      !isNil(whatsapp.integrationId) &&
      !ticket.useIntegration
    ) {
      console.log("3245");
      const integrations = await ShowQueueIntegrationService(
        whatsapp.integrationId,
        companyId
      );

      await handleMessageIntegration(
        msg,
        wbot,
        companyId,
        integrations,
        ticket,
        isMenu,
        whatsapp,
        contact,
        effectiveIsFirstMsg
      );
      return;
    }

    // integração flowbuilder
    if (
      !ticket.imported &&
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !ticket.queueId &&
      !ticket.userId &&
      !isNil(whatsapp.integrationId) &&
      !ticket.useIntegration
    ) {

      const integrations = await ShowQueueIntegrationService(
        whatsapp.integrationId,
        companyId
      );
      await handleMessageIntegration(
        msg,
        wbot,
        companyId,
        integrations,
        ticket,
        isMenu,
        whatsapp,
        contact,
        effectiveIsFirstMsg
      );
      await ticket.reload();
    }

    if (
      !ticket.imported &&
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !ticket.userId &&
      ticket.integrationId &&
      ticket.useIntegration
    ) {
      const integrations = await ShowQueueIntegrationService(
        ticket.integrationId,
        companyId
      );

      console.log("3264");
      console.log("3257", { ticket });
      await handleMessageIntegration(
        msg,
        wbot,
        companyId,
        integrations,
        ticket,
        null,
        null,
        contact,
        null
      );

      if (msg.key.fromMe) {
        await ticket.update({
          typebotSessionTime: moment().toDate()
        });
      }
    }

    const sendIdQueue = Number(whatsapp.sendIdQueue);
    const timeSendQueue = Number(whatsapp.timeSendQueue);
    const shouldRedirectQueueImmediately =
      !ticket.imported &&
      !ticket.queueId &&
      (!ticket.isGroup || whatsapp.groupAsTicket === "enabled") &&
      !msg.key.fromMe &&
      !ticket.userId &&
      !ticket.useIntegration &&
      timeSendQueue === 0 &&
      Number.isInteger(sendIdQueue) &&
      sendIdQueue > 0;

    if (shouldRedirectQueueImmediately) {
      await ticket.update({
        queueId: sendIdQueue
      });
      await ticket.reload();
    }

    if (
      !ticket.imported &&
      !ticket.queueId &&
      (!ticket.isGroup || whatsapp.groupAsTicket === "enabled") &&
      !msg.key.fromMe &&
      !ticket.userId &&
      whatsapp.queues.length >= 1 &&
      !ticket.useIntegration
    ) {
      // console.log("antes do verifyqueue")
      await verifyQueue(wbot, msg, ticket, contact, settings, ticketTraking);

      if (ticketTraking.chatbotAt === null) {
        await ticketTraking.update({
          chatbotAt: moment().toDate()
        });
      }
    }

    if (ticket.queueId > 0) {
      await ticketTraking.update({
        queueId: ticket.queueId
      });
    }

    // Verificação se aceita audio do contato
    if (
      getTypeMessage(msg) === "audioMessage" &&
      !msg.key.fromMe &&
      (!ticket.isGroup || whatsapp.groupAsTicket === "enabled") &&
      (!contact?.acceptAudioMessage ||
        settings?.acceptAudioMessageContact === "disabled")
    ) {
      const audioBlockMessage = String(
        settings?.AcceptAudioMessageContactMessage ||
        "Infelizmente não conseguimos escutar nem enviar áudios por este canal de atendimento, por favor, envie uma mensagem de texto."
      ).trim();
      const sentMessage = await wbot.sendMessage(
        `${contact.number}@c.us`,
        {
          text: `\u200e*Assistente Virtual*:\n${audioBlockMessage}`
        },
        {
          quoted: {
            key: msg.key,
            message: {
              extendedTextMessage: msg.message.extendedTextMessage
            }
          }
        }
      );
      await verifyMessage(sentMessage, ticket, contact, ticketTraking);
    }

    try {
      if (
        !msg.key.fromMe &&
        settings?.scheduleType &&
        Number(ticket.queueId) > 0 &&
        (!ticket.isGroup || whatsapp.groupAsTicket === "enabled") &&
        !ticket.imported
      ) {
        /**
         * Tratamento para envio de mensagem quando a empresa/fila está fora do expediente
         */
        const queue = await Queue.findByPk(ticket.queueId);
        if (!queue) {
          return;
        }

        if (settings?.scheduleType === "queue") {
          currentSchedule = await VerifyCurrentSchedule(companyId, queue.id, 0);
        }

        const maxRepeats =
          whatsapp.maxUseBotQueues && whatsapp.maxUseBotQueues > 0
            ? whatsapp.maxUseBotQueues
            : 4;

        if (
          settings?.scheduleType === "queue" &&
          ticket.amountUsedBotQueues < maxRepeats &&
          (!currentSchedule || currentSchedule.inActivity === false) &&
          !ticket.imported
        ) {
          if (Number(whatsapp.timeUseBotQueues) > 0) {
            if (
              ticket.isOutOfHour === false &&
              ticketTraking.chatbotAt !== null
            ) {
              await ticketTraking.update({
                chatbotAt: null
              });
              await ticket.update({
                amountUsedBotQueues: 0
              });
            }

            //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
            let dataLimite = new Date();
            let Agora = new Date();

            if (ticketTraking.chatbotAt !== null) {
              dataLimite.setMinutes(
                ticketTraking.chatbotAt.getMinutes() +
                  Number(whatsapp.timeUseBotQueues)
              );

              if (
                ticketTraking.chatbotAt !== null &&
                Agora < dataLimite &&
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
            // console.log("entrei2");
            const body = formatBody(`${outOfHoursMessage}`, ticket);

            const debouncedSentMessage = debounce(
              async () => {
                await wbot.sendMessage(
                  `${ticket.contact.number}@${
                    ticket.isGroup ? "g.us" : "s.whatsapp.net"
                  }`,
                  {
                    text: body
                  }
                );
              },
              1000,
              ticket.id
            );
            debouncedSentMessage();
          }
          //atualiza o contador de vezes que enviou o bot e que foi enviado fora de hora
          await ticket.update({
            isOutOfHour: true,
            amountUsedBotQueues: ticket.amountUsedBotQueues + 1
          });
          return;
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }

    if (ticket.queue && ticket.queueId && !msg.key.fromMe) {
      if (!ticket.user || ticket.queue?.chatbots?.length > 0) {
        await sayChatbot(
          ticket.queueId,
          wbot,
          ticket,
          contact,
          msg,
          ticketTraking
        );
      }

      //atualiza mensagem para indicar que houve atividade e aí contar o tempo novamente para enviar mensagem de inatividade
      await ticket.update({
        sendInactiveMessage: false
      });
    }

    await ticket.reload();
  } catch (err) {
    Sentry.captureException(err);
    console.log(err);
    logger.error(`Error handling whatsapp message: Err: ${err}`);
  }
};
const handleMsgAck = async (
  msg: WAMessage,
  chat: number | null | undefined
) => {
  await new Promise(r => setTimeout(r, 500));
  const io = getIO();

  try {
    const messageToUpdate = await Message.findOne({
      where: {
        wid: msg.key.id
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
              attributes: ["id", "name", "groupAsTicket"]
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
    if (!messageToUpdate || messageToUpdate.ack > chat) return;

    // nunca regride ACK; só avança
const nextAck =
  typeof chat === "number"
    ? Math.max(Number(messageToUpdate.ack ?? 0), chat)
    : Number(messageToUpdate.ack ?? 0);

if (nextAck !== messageToUpdate.ack) {
  await messageToUpdate.update({ ack: nextAck });

  // recarrega a mensagem completa (mesmo include do CreateMessageService)
  const fullMessage = await Message.findByPk(messageToUpdate.id, {
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
          { model: Queue, attributes: ["id", "name", "color"] },
          { model: Whatsapp, attributes: ["id", "name", "groupAsTicket"] },
          { model: User, attributes: ["id", "name"] },
          { model: Tag, as: "tags", attributes: ["id", "name", "color"] }
        ]
      },
      { model: Message, as: "quotedMsg", include: ["contact"] }
    ]
  });

  // emite no formato que o front já consome
  emitAppMessage(messageToUpdate.companyId, messageToUpdate.ticketId, {
    action: "update",
    message: fullMessage,
    ticket: fullMessage?.ticket,
    contact: fullMessage?.ticket?.contact
  });

  // opcional: alguns fronts atualizam listas com esse evento
  emitAppMessage(messageToUpdate.companyId, messageToUpdate.ticketId, {
    action: "ticket:update",
    ticketId: messageToUpdate.ticketId
  });
}

  } catch (err) {
    Sentry.captureException(err);
    logger.error(`Error handling message ack. Err: ${err}`);
  }
};

const verifyRecentCampaign = async (
  message: proto.IWebMessageInfo,
  companyId: number
) => {
  if (!isValidMsg(message)) {
    return;
  }
  if (!message.key.fromMe) {
    const number = message.key.remoteJid.replace(/\D/g, "");
    const campaigns = await Campaign.findAll({
      where: { companyId, status: "EM_ANDAMENTO", confirmation: true }
    });
    if (campaigns) {
      const ids = campaigns.map(c => c.id);
      const campaignShipping = await CampaignShipping.findOne({
        where: {
          campaignId: { [Op.in]: ids },
          number,
          confirmation: null,
          deliveredAt: { [Op.ne]: null }
        }
      });

      if (campaignShipping) {
        await campaignShipping.update({
          confirmedAt: moment(),
          confirmation: true
        });
        await campaignQueue.add(
          "DispatchCampaign",
          {
            campaignShippingId: campaignShipping.id,
            campaignId: campaignShipping.campaignId
          },
          {
            delay: parseToMilliseconds(randomValue(0, 10))
          }
        );
      }
    }
  }
};

const verifyCampaignMessageAndCloseTicket = async (
  message: proto.IWebMessageInfo,
  companyId: number,
  wbot: Session
) => {
  if (!isValidMsg(message)) {
    return;
  }

  const io = getIO();
  const body = await getBodyMessage(message);
  const isCampaign = /\u200c/.test(body);

  if (message.key.fromMe && isCampaign) {
    let msgContact: IMe;
    msgContact = await getContactMessage(message, wbot);
    const contact = await verifyContact(msgContact, wbot, companyId);

    const messageRecord = await Message.findOne({
      where: {
        [Op.or]: [{ wid: message.key.id! }, { contactId: contact.id }],
        companyId
      }
    });

    if (
      !isNull(messageRecord) ||
      !isNil(messageRecord) ||
      messageRecord !== null
    ) {
      const ticket = await Ticket.findByPk(messageRecord.ticketId);
      await ticket.update({ status: "closed", amountUsedBotQueues: 0 });

      io.of(String(companyId))
        // .to("open")
        .emit(`company-${companyId}-ticket`, {
          action: "delete",
          ticket,
          ticketId: ticket.id
        });

      io.of(String(companyId))
        // .to(ticket.status)
        // .to(ticket.id.toString())
        .emit(`company-${companyId}-ticket`, {
          action: "update",
          ticket,
          ticketId: ticket.id
        });
    }
  }
};

const filterMessages = (msg: WAMessage): boolean => {
  msgDB.save(msg);

  if (msg.message?.protocolMessage?.editedMessage) return true;
  if (msg.message?.protocolMessage) return false;

  const blockedStubTypes = [
    WAMessageStubTypeRef.REVOKE,
    WAMessageStubTypeRef.E2E_DEVICE_CHANGED,
    WAMessageStubTypeRef.E2E_IDENTITY_CHANGED
  ].filter((v): v is number => typeof v === "number");

  const hasRealStubPayload =
    Array.isArray((msg as any)?.messageStubParameters) &&
    (msg as any).messageStubParameters.length > 0;

  if (
    hasRealStubPayload &&
    msg.messageStubType != null &&
    blockedStubTypes.includes(msg.messageStubType as number)
  ) {
    return false;
  }

  return true;
};

type CtwaPlaceholderState = {
  attempts: number;
  pending: boolean;
  fallbackAttempted?: boolean;
  contactId?: number;
  ticketId?: number;
  remoteJid?: string;
  messageId?: string;
  lastRequestAt?: number;
  syntheticDispatched?: boolean;
  syntheticMessageId?: string;
};

const CTWA_RETRY_MAX = 3;
const CTWA_RETRY_DEBOUNCE_MS = 5000;

const ctwaPlaceholderCache = new NodeCache({
  stdTTL: 60 * 20,
  checkperiod: 60,
  useClones: false
});

const ctwaPlaceholderByChatCache = new NodeCache({
  stdTTL: 60 * 20,
  checkperiod: 60,
  useClones: false
});

const ctwaSyntheticByChatCache = new NodeCache({
  stdTTL: 60 * 20,
  checkperiod: 60,
  useClones: false
});

const inboundDispatchInFlightCache = new NodeCache({
  stdTTL: 60 * 2,
  checkperiod: 30,
  useClones: false
});

const inboundSemanticDedupCache = new NodeCache({
  stdTTL: 45,
  checkperiod: 15,
  useClones: false
});

const ctwaRetryTimers = new Map<string, NodeJS.Timeout>();
const ctwaSyntheticTimers = new Map<string, NodeJS.Timeout>();

const getCtwaPlaceholderCacheKey = (
  companyId: number,
  wbot: Session,
  msg: proto.IWebMessageInfo
): string => {
  const messageId = msg?.key?.id || "no-id";
  const remoteJid = msg?.key?.remoteJid || "no-jid";
  return `ctwa:${companyId}:${wbot?.id}:${remoteJid}:${messageId}`;
};

const getCtwaChatCacheKey = (
  companyId: number,
  wbot: Session,
  msg: proto.IWebMessageInfo
): string => {
  const remoteJid = msg?.key?.remoteJid || "no-jid";
  return `ctwa-chat:${companyId}:${wbot?.id}:${remoteJid}`;
};

const getStableMissingId = (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  remoteJid: string
): string => {
  const rawTs: any = msg?.messageTimestamp;
  const tsSource =
    rawTs && typeof rawTs === "object"
      ? `${rawTs.high ?? ""}:${rawTs.low ?? ""}:${rawTs.unsigned ?? ""}`
      : String(rawTs ?? "");
  const fingerprint = {
    remoteJid,
    participant: msg?.key?.participant || "",
    fromMe: !!msg?.key?.fromMe,
    messageStubType: msg?.messageStubType || "",
    messageStubParameters: msg?.messageStubParameters || [],
    tsSource,
    msgType: getTypeMessage(msg) || "",
    hasMessage: !!msg?.message
  };
  const digest = createHash("sha1")
    .update(JSON.stringify(fingerprint))
    .digest("hex")
    .slice(0, 16);

  return `ctwa-${wbot?.id || "unknown"}-${remoteJid || "no-jid"}-${digest}`;
};

const isCtwaEligiblePrivateInbound = (msg: proto.IWebMessageInfo): boolean => {
  const remoteJid = msg?.key?.remoteJid || "";
  const remoteJidAlt = (msg?.key as any)?.remoteJidAlt || "";

  if (!remoteJid) return false;
  if (msg?.key?.fromMe) return false;
  if (remoteJid === "status@broadcast") return false;
  if (remoteJid.endsWith("@g.us")) return false;
  if (remoteJid.endsWith("@newsletter")) return false;
  if (remoteJid.endsWith("@broadcast")) return false;
  const hasPrivateSuffix =
    remoteJid.endsWith("@s.whatsapp.net") ||
    remoteJid.endsWith("@lid") ||
    remoteJidAlt.endsWith("@s.whatsapp.net");
  if (!hasPrivateSuffix) return false;

  return true;
};

const hasUsableInboundContent = (msg: proto.IWebMessageInfo): boolean => {
  if (!msg?.message) return false;

  const msgType = getTypeMessage(msg);
  if (!msgType) return false;

  // Eventos/updates não devem acionar CTWA.
  if (
    msgType === "reactionMessage" ||
    msgType === "protocolMessage" ||
    msgType === "editedMessage" ||
    msgType === "senderKeyDistributionMessage" ||
    msgType === "messageContextInfo"
  ) {
    return false;
  }

  const body = getBodyMessage(msg);
  if (typeof body === "string" && body.trim().length > 0) {
    return true;
  }

  const root = getMessageRoot(msg.message);
  const externalAdReply =
    root?.extendedTextMessage?.contextInfo?.externalAdReply ||
    msg.message?.extendedTextMessage?.contextInfo?.externalAdReply;
  if (
    externalAdReply?.title ||
    externalAdReply?.body ||
    externalAdReply?.sourceUrl ||
    externalAdReply?.thumbnail
  ) {
    return true;
  }

  const hasMediaLikeContent =
    !!root?.imageMessage ||
    !!root?.videoMessage ||
    !!root?.audioMessage ||
    !!root?.documentMessage ||
    !!root?.documentWithCaptionMessage?.message?.documentMessage ||
    !!root?.stickerMessage ||
    !!root?.contactMessage ||
    !!root?.contactsArrayMessage ||
    !!root?.locationMessage ||
    !!root?.liveLocationMessage ||
    !!root?.buttonsMessage ||
    !!root?.buttonsResponseMessage ||
    !!root?.templateButtonReplyMessage ||
    !!root?.listMessage ||
    !!root?.listResponseMessage ||
    !!root?.interactiveMessage ||
    !!root?.interactiveResponseMessage ||
    !!root?.pollCreationMessageV3 ||
    !!root?.eventMessage ||
    !!root?.viewOnceMessage?.message ||
    !!root?.viewOnceMessageV2?.message;

  return hasMediaLikeContent;
};

const isCtwaNonDispatchEvent = (msg: proto.IWebMessageInfo): boolean => {
  const msgType = getTypeMessage(msg);
  return (
    msgType === "reactionMessage" ||
    msgType === "protocolMessage" ||
    msgType === "editedMessage" ||
    msgType === "senderKeyDistributionMessage" ||
    msgType === "messageContextInfo"
  );
};

const hasCtwaContextHint = (msg: proto.IWebMessageInfo): boolean => {
  const msgType = getTypeMessage(msg);
  const stubParams = msg?.messageStubParameters || [];
  const hasStrongStubHint =
    msgType === "placeholderMessage" ||
    stubParams.some(param =>
      /(absent|placeholder|incomplete|ctwa|click to whatsapp|click-to-whatsapp)/i.test(
        String(param)
      )
    );

  if (hasStrongStubHint) return true;

  const root = getMessageRoot(msg.message);
  const externalAdReply =
    root?.extendedTextMessage?.contextInfo?.externalAdReply ||
    root?.listResponseMessage?.contextInfo?.externalAdReply ||
    msg.message?.extendedTextMessage?.contextInfo?.externalAdReply ||
    msg.message?.listResponseMessage?.contextInfo?.externalAdReply;
  if (externalAdReply?.sourceUrl || externalAdReply?.title || externalAdReply?.body) {
    return true;
  }

  if (
    msg?.messageStubType === WAMessageStubTypeRef.CIPHERTEXT &&
    stubParams.length > 0
  ) {
    return true;
  }

  return false;
};

const isCtwaPlaceholderMessage = (msg: proto.IWebMessageInfo): boolean => {
  if (!isCtwaEligiblePrivateInbound(msg)) return false;

  // Exclui explicitamente eventos de sistema/ack/edits/reactions.
  if (
    msg?.message?.protocolMessage ||
    msg?.message?.reactionMessage ||
    msg?.message?.editedMessage
  ) {
    return false;
  }

  const msgType = getTypeMessage(msg);
  const hasNoUsableContent =
    !msg?.message ||
    Object.keys(msg?.message || {}).length === 0 ||
    !hasUsableInboundContent(msg);

  if (!hasNoUsableContent) return false;

  const stubParams = msg?.messageStubParameters || [];
  const hasStrongCtwaHint =
    msgType === "placeholderMessage" ||
    stubParams.some(param =>
      /(absent|placeholder|incomplete|ctwa)/i.test(String(param))
    );

  return hasStrongCtwaHint;
};

const markInboundDispatchInFlight = (
  companyId: number,
  wbot: Session,
  messageId?: string | null
): boolean => {
  if (!messageId) return true;

  const cacheKey = `inbound-dispatch:${companyId}:${wbot?.id}:${messageId}`;
  if (inboundDispatchInFlightCache.get(cacheKey)) return false;

  inboundDispatchInFlightCache.set(cacheKey, true);
  return true;
};

const markInboundSemanticDispatch = (
  companyId: number,
  wbot: Session,
  msg: proto.IWebMessageInfo
): boolean => {
  if (msg?.key?.fromMe) return true;
  // Mensagens inbound normais do WhatsApp/Baileys já possuem key.id e
  // passam por idempotência forte (DB wid + cache in-flight + jobId da fila).
  // Evitamos dedupe semântico nesses casos para não suprimir lotes legítimos
  // de mídia enviados no mesmo segundo.
  if (msg?.key?.id) return true;

  const remoteJid =
    (msg?.key as any)?.remoteJidAlt ||
    msg?.key?.remoteJid ||
    "";
  if (!remoteJid) return true;

  const msgType = getTypeMessage(msg) || "unknown";
  const body = (getBodyMessage(msg) || "").trim().toLowerCase();
  const ts = Number(getTimestampMessage(msg?.messageTimestamp) || 0);

  // Evita dedupe em eventos sem conteúdo útil.
  if (!body && msgType === "unknown") return true;

  const semanticHash = createHash("sha1")
    .update(`${msgType}|${body}`)
    .digest("hex")
    .slice(0, 20);

  const cacheKey = `inbound-semantic:${companyId}:${wbot?.id}:${remoteJid}:${ts}:${semanticHash}`;
  if (inboundSemanticDedupCache.get(cacheKey)) {
    return false;
  }

  inboundSemanticDedupCache.set(cacheKey, true);
  return true;
};

const dispatchCtwaSyntheticInbound = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number,
  placeholderCacheKey: string
): Promise<void> => {
  try {
    if (!msg?.key?.remoteJid) return;

    const chatCacheKey = getCtwaChatCacheKey(companyId, wbot, msg);
    if (ctwaSyntheticByChatCache.get(chatCacheKey)) return;

    const state = (ctwaPlaceholderCache.get(
      placeholderCacheKey
    ) || {}) as CtwaPlaceholderState;
    if (state.syntheticDispatched) return;

    const syntheticMessageId = `ctwa-synthetic-${wbot?.id || "unknown"}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    let canonicalRemoteJid = msg.key.remoteJid;
    if (state.contactId) {
      const persistedContact = await Contact.findByPk(state.contactId);
      const persistedNumber = String(persistedContact?.number || "").replace(/\D/g, "");
      const persistedJid =
        (persistedContact as any)?.jid ||
        persistedContact?.remoteJid ||
        null;

      if (persistedJid && typeof persistedJid === "string") {
        canonicalRemoteJid = persistedJid;
      } else if (persistedNumber.length >= 8) {
        canonicalRemoteJid = `${persistedNumber}@s.whatsapp.net`;
      }
    }

    const syntheticInbound = {
      key: {
        ...(msg.key as any),
        id: syntheticMessageId,
        fromMe: false,
        remoteJid: canonicalRemoteJid,
        participant: msg.key.participant,
        remoteJidAlt: (msg.key as any)?.remoteJidAlt
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      message: {
        conversation:
          "[Mensagem não compatível] Recebemos uma mensagem que não pôde ser exibida corretamente no sistema. Se necessário, verifique o conteúdo diretamente no aplicativo oficial do WhatsApp."
      },
      pushName: msg.pushName
    } as unknown as proto.IWebMessageInfo;

    ctwaPlaceholderCache.set(placeholderCacheKey, {
      ...state,
      syntheticDispatched: true,
      syntheticMessageId
    } as CtwaPlaceholderState);
    ctwaSyntheticByChatCache.set(chatCacheKey, true);

    await handleMessage(syntheticInbound, wbot, companyId);

    logger.warn(
      `[CTWA] Mensagem sintética inbound criada para acionar fluxo (ticket=${state.ticketId || "n/a"}, messageId=${syntheticMessageId}, remoteJid=${msg.key.remoteJid})`
    );
  } catch (error) {
    Sentry.captureException(error);
    logger.error(
      `[CTWA] Falha ao gerar mensagem sintética inbound para placeholder messageId=${msg?.key?.id}: ${error}`
    );
  }
};

const scheduleCtwaSyntheticInbound = (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number,
  placeholderCacheKey: string
) => {
  if (ctwaSyntheticTimers.has(placeholderCacheKey)) return;

  const timer = setTimeout(async () => {
    ctwaSyntheticTimers.delete(placeholderCacheKey);
    const state = (ctwaPlaceholderCache.get(
      placeholderCacheKey
    ) || {}) as CtwaPlaceholderState;

    // Só dispara sintética se placeholder ainda estiver pendente
    // e nenhuma mensagem real tiver resolvido o estado.
    if (!state.pending || state.syntheticDispatched) return;
    await dispatchCtwaSyntheticInbound(msg, wbot, companyId, placeholderCacheKey);
  }, CTWA_RETRY_DEBOUNCE_MS);

  ctwaSyntheticTimers.set(placeholderCacheKey, timer);
};

const ensureCtwaPendingLead = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number,
  placeholderCacheKey: string
): Promise<void> => {
  if (msg?.key?.fromMe) return;
  if (!msg?.key?.remoteJid || msg.key.remoteJid === "status@broadcast") return;
  if (isCtwaNonDispatchEvent(msg)) return;

  try {
    const msgContact = await getContactMessage(msg, wbot);
    if (!msgContact?.id) return;

    const contact = await verifyContact(msgContact, wbot, companyId);
    const whatsapp = await ShowWhatsAppService(wbot.id!, companyId);
    const settings = await CompaniesSettings.findOne({ where: { companyId } });

    const ticket = await FindOrCreateTicketService(
      contact,
      whatsapp,
      0,
      companyId,
      null,
      null,
      null,
      "whatsapp",
      false,
      false,
      settings
    );

    if (ticket.status === "closed") {
      await ticket.update({ status: "pending" });
    }

    const state = (ctwaPlaceholderCache.get(
      placeholderCacheKey
    ) || {}) as CtwaPlaceholderState;
    ctwaPlaceholderCache.set(placeholderCacheKey, {
      ...state,
      pending: true,
      contactId: contact.id,
      ticketId: ticket.id,
      remoteJid: msg.key.remoteJid,
      messageId: msg.key.id
    } as CtwaPlaceholderState);

    logger.warn(
      `[CTWA] Placeholder pendente registrado (ticket=${ticket.id}, contact=${contact.id}, messageId=${msg?.key?.id})`
    );
    scheduleCtwaSyntheticInbound(msg, wbot, companyId, placeholderCacheKey);
  } catch (error) {
    Sentry.captureException(error);
    logger.error(
      `[CTWA] Falha ao garantir lead pendente para placeholder messageId=${msg?.key?.id}: ${error}`
    );
  }
};

const runCtwaHistoryFallback = async (
  wbot: Session,
  msg: proto.IWebMessageInfo
): Promise<void> => {
  const fallbackFetchHistory = (wbot as any)?.fetchMessageHistory;
  const fallbackStoreLoad = (wbot as any)?.store?.loadMessages;

  try {
    if (typeof fallbackFetchHistory === "function") {
      await fallbackFetchHistory.call(
        wbot,
        20,
        msg.key,
        Number(msg?.messageTimestamp || Date.now())
      );
      logger.warn(
        `[CTWA] Fallback fetchMessageHistory executado para ${msg?.key?.remoteJid}`
      );
      return;
    }

    if (typeof fallbackStoreLoad === "function") {
      await fallbackStoreLoad.call(
        (wbot as any).store,
        msg?.key?.remoteJid,
        20
      );
      logger.warn(
        `[CTWA] Fallback store.loadMessages executado para ${msg?.key?.remoteJid}`
      );
      return;
    }

    logger.warn(
      `[CTWA] Fallback histórico indisponível nesta versão do Baileys (messageId=${msg?.key?.id})`
    );
  } catch (error) {
    Sentry.captureException(error);
    logger.error(
      `[CTWA] Falha no fallback de histórico para messageId=${msg?.key?.id}: ${error}`
    );
  }
};

const requestCtwaPlaceholderResend = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number,
  placeholderCacheKey: string
): Promise<void> => {
  const resendFn = (wbot as any)?.requestPlaceholderResend;
  const state = (ctwaPlaceholderCache.get(
    placeholderCacheKey
  ) || {}) as CtwaPlaceholderState;

  if (!state.pending) return;

  if (state.attempts >= CTWA_RETRY_MAX) {
    if (!state.fallbackAttempted) {
      ctwaPlaceholderCache.set(placeholderCacheKey, {
        ...state,
        fallbackAttempted: true
      } as CtwaPlaceholderState);
      logger.warn(
        `[CTWA] Limite de retries atingido (messageId=${msg?.key?.id}). Tentando fallback de histórico.`
      );
      await runCtwaHistoryFallback(wbot, msg);
    }
    return;
  }

  if (typeof resendFn !== "function") {
    logger.warn(
      `[CTWA] requestPlaceholderResend indisponível nesta sessão do Baileys (messageId=${msg?.key?.id})`
    );
    await runCtwaHistoryFallback(wbot, msg);
    return;
  }

  if (!msg?.key?.id || !msg?.key?.remoteJid) {
    logger.warn(
      `[CTWA] resend abortado por key inválida (jid=${msg?.key?.remoteJid || "undefined"} id=${msg?.key?.id || "undefined"})`
    );
    return;
  }

  const nextAttempts = (state.attempts || 0) + 1;
  ctwaPlaceholderCache.set(placeholderCacheKey, {
    ...state,
    attempts: nextAttempts,
    lastRequestAt: Date.now()
  } as CtwaPlaceholderState);

  try {
    logger.warn(
      `[CTWA] resend requested -> jid=${msg.key.remoteJid} id=${msg.key.id}`
    );
    await resendFn.call(wbot, msg.key);
    logger.warn(
      `[CTWA] requestPlaceholderResend enviado (attempt=${nextAttempts}/${CTWA_RETRY_MAX}, messageId=${msg?.key?.id})`
    );
  } catch (error) {
    Sentry.captureException(error);
    logger.error(
      `[CTWA] requestPlaceholderResend falhou (attempt=${nextAttempts}/${CTWA_RETRY_MAX}, messageId=${msg?.key?.id}): ${error}`
    );
  }

  const stateAfterRequest = (ctwaPlaceholderCache.get(
    placeholderCacheKey
  ) || {}) as CtwaPlaceholderState;
  if (stateAfterRequest.pending && stateAfterRequest.attempts < CTWA_RETRY_MAX) {
    const retryTimer = setTimeout(() => {
      ctwaRetryTimers.delete(placeholderCacheKey);
      requestCtwaPlaceholderResend(msg, wbot, companyId, placeholderCacheKey);
    }, CTWA_RETRY_DEBOUNCE_MS);

    ctwaRetryTimers.set(placeholderCacheKey, retryTimer);
  } else if (stateAfterRequest.pending) {
    await requestCtwaPlaceholderResend(msg, wbot, companyId, placeholderCacheKey);
  }
};

const scheduleCtwaPlaceholderResend = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number,
  placeholderCacheKey: string
): Promise<void> => {
  if (ctwaRetryTimers.has(placeholderCacheKey)) {
    logger.debug(
      `[CTWA] Debounce ativo para resend de placeholder (messageId=${msg?.key?.id})`
    );
    return;
  }

  const timer = setTimeout(() => {
    ctwaRetryTimers.delete(placeholderCacheKey);
    requestCtwaPlaceholderResend(msg, wbot, companyId, placeholderCacheKey);
  }, CTWA_RETRY_DEBOUNCE_MS);

  ctwaRetryTimers.set(placeholderCacheKey, timer);
};

const clearCtwaPendingIfRecovered = (
  companyId: number,
  wbot: Session,
  msg: proto.IWebMessageInfo
) => {
  const placeholderCacheKey = getCtwaPlaceholderCacheKey(companyId, wbot, msg);
  const chatCacheKey = getCtwaChatCacheKey(companyId, wbot, msg);

  const directPending = ctwaPlaceholderCache.get(
    placeholderCacheKey
  ) as CtwaPlaceholderState;
  const chatPendingRef = ctwaPlaceholderByChatCache.get(chatCacheKey) as
    | string
    | undefined;
  const chatPendingState = chatPendingRef
    ? (ctwaPlaceholderCache.get(chatPendingRef) as CtwaPlaceholderState)
    : undefined;

  const pendingKey = directPending?.pending
    ? placeholderCacheKey
    : chatPendingState?.pending
      ? chatPendingRef
      : null;

  if (!pendingKey) return;

  ctwaPlaceholderCache.del(pendingKey);
  ctwaPlaceholderByChatCache.del(chatCacheKey);
  ctwaSyntheticByChatCache.del(chatCacheKey);

  const retryTimer = ctwaRetryTimers.get(pendingKey);
  if (retryTimer) {
    clearTimeout(retryTimer);
    ctwaRetryTimers.delete(pendingKey);
  }
  const syntheticTimer = ctwaSyntheticTimers.get(pendingKey);
  if (syntheticTimer) {
    clearTimeout(syntheticTimer);
    ctwaSyntheticTimers.delete(pendingKey);
  }

  logger.warn(
    `[CTWA] Placeholder resolvido; mensagem real voltou ao pipeline inbound normal (messageId=${msg?.key?.id})`
  );
};

const useInboundQueue =
  REDIS_URI_MSG_CONN !== "" && process.env.WBOT_INBOUND_QUEUE === "true";

const wbotMessageListener = (wbot: Session, companyId: number): void => {
  const alreadyBound = (wbot as any).__messagesUpsertListenerBound;
  if (alreadyBound) {
    logger.warn(
      `[WBOT] messages.upsert listener já registrado para sessão ${wbot?.id}; ignorando bind duplicado.`
    );
    return;
  }
  (wbot as any).__messagesUpsertListenerBound = true;
  console.log(`[WBOT] listener bound (session=${wbot?.id}, company=${companyId})`);

const wbotUserJid = wbot?.user?.id;
  wbot.ev.on("messages.upsert", async (messageUpsert: ImessageUpsert) => {
    const upsertTotal = Array.isArray((messageUpsert as any)?.messages)
      ? (messageUpsert as any).messages.length
      : 0;
    console.log(
      `[WBOT] upsert event (session=${wbot?.id}, company=${companyId}, type=${String(
        (messageUpsert as any)?.type || "unknown"
      )}, total=${upsertTotal})`
    );
    logger.info(
      `[WBOT] messages.upsert received (session=${wbot?.id}, company=${companyId}, type=${String(
        (messageUpsert as any)?.type || "unknown"
      )}, total=${Array.isArray((messageUpsert as any)?.messages) ? (messageUpsert as any).messages.length : 0})`
    );

    const rawSample = (messageUpsert as any)?.messages?.[0] as any;
    if (rawSample) {
      const rawUnpacked =
        rawSample?.message?.ephemeralMessage?.message ||
        rawSample?.message?.viewOnceMessage?.message ||
        rawSample?.message?.viewOnceMessageV2?.message ||
        rawSample?.message;
      console.log(
        `[WBOT][RAW] session=${wbot?.id} type=${String((messageUpsert as any)?.type || "unknown")} fromMe=${String(
          !!rawSample?.key?.fromMe
        )} id=${String(rawSample?.key?.id || "sem-id")} remoteJid=${String(
          rawSample?.key?.remoteJid || "sem-jid"
        )} keys=${Object.keys(rawUnpacked || {}).join(",")}`
      );
    }

    const messages = messageUpsert.messages
      .filter(filterMessages)
      .map(msg => msg);

    if (messages.length > 0) {
      const sample = messages[0] as any;
      const unpacked =
        sample?.message?.ephemeralMessage?.message ||
        sample?.message?.viewOnceMessage?.message ||
        sample?.message?.viewOnceMessageV2?.message ||
        sample?.message;
      console.log(
        `[WBOT][SAMPLE] session=${wbot?.id} fromMe=${String(
          !!sample?.key?.fromMe
        )} id=${String(sample?.key?.id || "sem-id")} remoteJid=${String(
          sample?.key?.remoteJid || "sem-jid"
        )} stubType=${String(sample?.messageStubType ?? "none")} msgKeys=${Array.isArray(
          Object.keys(unpacked || {})
        )
          ? Object.keys(unpacked || {}).join(",")
          : "none"}`
      );
    }

    if (!messages.length) return;

  for (const message of messages) {
  try {
  // Ignore Status e Canais (WhatsApp Channels)
  const rjid = message?.key?.remoteJid || "";
  if (
    rjid === "status@broadcast" ||
    rjid.endsWith("@newsletter") ||
    rjid.endsWith("@broadcast")
  ) {
    continue;
  }

  let messageId = message?.key?.id;
  if (!messageId) {
    const fallbackId = getStableMissingId(message, wbot, rjid);
    message.key = { ...(message.key || {}), id: fallbackId } as any;
    messageId = fallbackId;
    logger.warn(
      `[CTWA] Mensagem sem key.id recebeu fallback id=${fallbackId} (remoteJid=${rjid})`
    );
  }

  const placeholderCacheKey = getCtwaPlaceholderCacheKey(companyId, wbot, message);
  const chatCacheKey = getCtwaChatCacheKey(companyId, wbot, message);

  // 🔎 Fallback CTWA: mensagens inbound privadas sem conteúdo "útil"
  // mas que não passam nos hints explícitos de placeholder do Baileys.
  const ctwaEligible = isCtwaEligiblePrivateInbound(message);
  const ctwaHasContent = hasUsableInboundContent(message);
  const ctwaNonDispatchEvent = isCtwaNonDispatchEvent(message);
  const ctwaHasHint = hasCtwaContextHint(message);

  if (
    ctwaEligible &&
    !ctwaNonDispatchEvent &&
    !ctwaHasContent &&
    !isCtwaPlaceholderMessage(message)
  ) {
    const previousState = (ctwaPlaceholderCache.get(
      placeholderCacheKey
    ) || {}) as CtwaPlaceholderState;

    ctwaPlaceholderCache.set(placeholderCacheKey, {
      ...previousState,
      pending: true,
      attempts: previousState.attempts || 0,
      remoteJid: message?.key?.remoteJid,
      messageId
    } as CtwaPlaceholderState);
    ctwaPlaceholderByChatCache.set(chatCacheKey, placeholderCacheKey);

    logger.warn(
      `[CTWA] Placeholder (fallback) detectado (messageId=${messageId}, remoteJid=${rjid}, hasHint=${ctwaHasHint})`
    );

    await ensureCtwaPendingLead(message, wbot, companyId, placeholderCacheKey);
    await scheduleCtwaPlaceholderResend(message, wbot, companyId, placeholderCacheKey);
    continue;
  }

  if (!ctwaNonDispatchEvent && isCtwaPlaceholderMessage(message)) {
    const previousState = (ctwaPlaceholderCache.get(
      placeholderCacheKey
    ) || {}) as CtwaPlaceholderState;

    ctwaPlaceholderCache.set(placeholderCacheKey, {
      ...previousState,
      pending: true,
      attempts: previousState.attempts || 0,
      remoteJid: message?.key?.remoteJid,
      messageId
    } as CtwaPlaceholderState);
    ctwaPlaceholderByChatCache.set(chatCacheKey, placeholderCacheKey);

    logger.warn(
      `[CTWA] Placeholder detectado (messageId=${messageId}, remoteJid=${rjid}). Solicitando resend.`
    );

    await ensureCtwaPendingLead(message, wbot, companyId, placeholderCacheKey);
    await scheduleCtwaPlaceholderResend(message, wbot, companyId, placeholderCacheKey);
    continue;
  }

  clearCtwaPendingIfRecovered(companyId, wbot, message);

  if (
    message?.messageStubParameters?.length &&
    message.messageStubParameters[0].includes("absent")
  ) {
    const msg = {
      companyId: companyId,
      whatsappId: wbot.id,
      message: message
    };
    logger.warn("MENSAGEM PERDIDA", JSON.stringify(msg));
  }

	  const messageExists = await Message.count({
	    where: { wid: messageId, companyId }
	  });

	  if (!messageExists) {
	    if (!markInboundSemanticDispatch(companyId, wbot, message)) {
	      logger.warn(
	        `[CTWA] Mensagem duplicada suprimida por fingerprint semântico (messageId=${messageId}, remoteJid=${rjid})`
	      );
	      continue;
	    }

	    if (!markInboundDispatchInFlight(companyId, wbot, messageId)) {
	      logger.warn(
	        `[CTWA] Mensagem duplicada ignorada por idempotência (messageId=${messageId})`
	      );
	      continue;
    }

    let isCampaign = false;
    let body = await getBodyMessage(message);
    const fromMe = message?.key?.fromMe;
    if (fromMe) {
      isCampaign = /\u200c/.test(body);
    } else {
      if (/\u200c/.test(body)) body = body.replace(/\u200c/, "");
      logger.debug(
        "Validação de mensagem de campanha enviada por terceiros: " + body
      );
    }

    if (!isCampaign) {
      if (useInboundQueue) {
        try {
          await BullQueues.add(
            `${process.env.DB_NAME}-handleMessage`,
            { message, wbot: wbot.id, companyId },
            {
              priority: 1,
              jobId: `${wbot.id}-handleMessage-${messageId}`
            }
          );
        } catch (e) {
          Sentry.captureException(e);
          logger.error(
            `[WBOT] Falha ao enfileirar handleMessage (session=${wbot?.id}, company=${companyId}, messageId=${messageId}). Aplicando fallback local.`,
            e
          );
          await handleMessage(message, wbot, companyId);
        }
      } else {
        await handleMessage(message, wbot, companyId);
      }
    }

    await verifyRecentCampaign(message, companyId);
    await verifyCampaignMessageAndCloseTicket(message, companyId, wbot);
  }

  if (message.key.remoteJid?.endsWith("@g.us") && message.key.fromMe) {
    if (useInboundQueue) {
      try {
        await BullQueues.add(
          `${process.env.DB_NAME}-handleMessageAck`,
          { msg: message, chat: 1 },
          {
            priority: 1,
            jobId: `${wbot.id}-handleMessageAck-${message.key.id}`
          }
        );
      } catch (e) {
        Sentry.captureException(e);
        logger.error(
          `[WBOT] Falha ao enfileirar handleMessageAck (session=${wbot?.id}, company=${companyId}, messageId=${message?.key?.id}). Aplicando fallback local.`,
          e
        );
        await persistAck(companyId, message.key.id, 1);
      }
    } else {
      await persistAck(companyId, message.key.id, 1); // <--- CORREÇÃO
    }
  }
  } catch (error) {
    Sentry.captureException(error);
    logger.error(
      `[CTWA] Falha ao processar message.upsert (messageId=${message?.key?.id || "sem-id"}, remoteJid=${message?.key?.remoteJid || "sem-jid"}): ${error}`
    );
  }
}

    // messages.forEach(async (message: proto.IWebMessageInfo) => {
    //   const messageExists = await Message.count({
    //     where: { id: message.key.id!, companyId }
    //   });

    //   if (!messageExists) {
    //     await handleMessage(message, wbot, companyId);
    //     await verifyRecentCampaign(message, companyId);
    //     await verifyCampaignMessageAndCloseTicket(message, companyId);
    //   }
    // });
  });

  // === ACK UTILS (defina UMA vez, acima dos handlers) ===
// agora retorna boolean para sabermos se atualizou
async function updateAckSafe(where: any, nextAck: number | undefined): Promise<boolean> {
  if (nextAck == null) return false;

  // 1) pega só o básico pra calcular avanço de ACK
  const msg = await Message.findOne({
    where,
    attributes: ["id", "messageId", "wid", "ack", "ticketId", "companyId"]
  });
  if (!msg) return false;

  const current = Number(msg.get("ack") ?? 0);
  const target  = Math.max(current, Number(nextAck));
  if (target === current) return false;

  await msg.update({ ack: target });

  const companyIdNum = Number(msg.get("companyId"));
  const ticketIdNum  = Number(msg.get("ticketId"));

  // 2) recarrega a MENSAGEM COMPLETA com o mesmo include do CreateMessageService
  const fullMessage = await Message.findByPk(msg.get("id") as any, {
    include: [
      "contact",
      {
        model: Ticket,
        as: "ticket",
        include: [
          {
            model: Contact,
            attributes: ["id","name","number","email","profilePicUrl","acceptAudioMessage","active","urlPicture","companyId"],
            include: ["extraInfo","tags"]
          },
          { model: Queue,    attributes: ["id","name","color"] },
          { model: Whatsapp, attributes: ["id","name","groupAsTicket"] },
          { model: User,     attributes: ["id","name"] },
          { model: Tag,      as: "tags", attributes: ["id","name","color"] }
        ]
      },
      { model: Message, as: "quotedMsg", include: ["contact"] }
    ]
  });

  // 3) emite exatamente o SHAPE que o front já usa no "create"
  emitAppMessage(companyIdNum, ticketIdNum, {
    action: "update",
    message: fullMessage,
    ticket: fullMessage?.ticket,
    contact: fullMessage?.ticket?.contact
  });

  // (opcional) alguns fronts re-renderizam listas com esse evento também
  emitAppMessage(companyIdNum, ticketIdNum, {
    action: "ticket:update",
    ticketId: ticketIdNum
  });

  return true;
}



async function persistAck(companyId: number, msgId: string, ack: number) {
  const tries: any[] = [];
  // messageId (string) - prefer first when available
  if (HAS_MESSAGE_ID) {
    tries.push({ companyId, messageId: msgId });
  }
  // wid (string)
  tries.push({ companyId, wid: msgId });

  // Only attempt primary key (id) lookup if msgId looks like a decimal integer
  if (/^\d+$/.test(msgId)) {
    // convert to number to match integer column; avoid passing string to PG int field
    tries.push({ companyId, id: Number(msgId) });
  }

  for (const where of tries) {
    try {
      const ok = await updateAckSafe(where, ack);
      if (ok) break;
    } catch (err) {
      // Log once per where clause; continue attempting other strategies
      console.warn("persistAck lookup failed", where, (err as any)?.message);
    }
  }
}

// Tipagem leve compatível com Baileys 6.7.x (declare UMA vez)
type ReceiptLike = {
  // se você não importa Long, deixe só number|string|null
  deliveredTimestamp?: number | string | null;
  readTimestamp?: number | string | null;
  playedTimestamp?: number | string | null;
};

type MessageUserReceiptUpdateLike = {
  key?: { id?: string | null } | null;
  receipt?: ReceiptLike | null;
};

// === messages.update ===
wbot.ev.on("messages.update", async (updates: WAMessageUpdate[]) => {
  if (!updates?.length) return;

  const first = updates[0] as any;
  if (
    first?.update?.messageStubType === 1 &&
    first?.key?.remoteJid !== "status@broadcast"
  ) {
    MarkDeleteWhatsAppMessage(
      first?.key?.remoteJid,
      null,
      first?.key?.id,
      companyId
    );
  }

  for (const u of updates) {
    try {
      if (!u?.key?.fromMe) {
        (wbot as WASocket).readMessages([u.key]);
      }

      const rawStatus = u?.update?.status;
      let ack: number | undefined;

      // Mapeamento correto do status do Baileys para o ack do sistema
      if (typeof rawStatus === "number") {
        switch (rawStatus) {
          case 2: // SERVER_ACK (Enviado)
            ack = 1;
            break;
          case 3: // DELIVERY_ACK (Entregue)
            ack = 2;
            break;
          case 4: // READ (Lido)
            ack = 3;
            break;
          case 5: // PLAYED (Reproduzido)
            ack = 4;
            break;
        }
      }

      const msgIdUpdate = u?.key?.id as string | undefined;
      if (!msgIdUpdate) continue;

      if (ack != null) {
        await persistAck(companyId, msgIdUpdate, ack);
      }
    } catch (err) {
      console.error("messages.update ack error:", err);
    }
  }
});

// === message-receipt.update ===
wbot.ev.on("message-receipt.update", async (updates: MessageUserReceiptUpdate[]) => {
  if (!Array.isArray(updates) || updates.length === 0) return;

  for (const rec of updates) {
    try {
      const msgId = rec?.key?.id as string | undefined;
      if (!msgId) continue;

      const r: any = rec?.receipt ?? {};

      let ack: number | undefined;
      if (r?.playedTimestamp)        ack = 4; // reproduzida
      else if (r?.readTimestamp)     ack = 3; // lida
      else if (r?.deliveredTimestamp) ack = 2; // entregue

      if (ack != null) {
        await persistAck(companyId, msgId, ack);
      }
    } catch (err) {
      console.error("message-receipt.update error:", err);
    }
  }
}); // <-- fecha o 'on' de message-receipt.update

  wbot.ev.on("presence.update", async (events: any) => {
    try {
      const chatJidRaw = String(events?.id || "");
      if (!chatJidRaw || chatJidRaw === "status@broadcast" || chatJidRaw.endsWith("@g.us")) {
        return;
      }

      const presences = events?.presences || {};
      const presenceEntries = Object.entries(presences) as Array<[string, any]>;
      if (!presenceEntries.length) return;

      const ownJid = String((wbot as any)?.user?.id || "").trim();
      const candidateEntry =
        presenceEntries.find(([participantJid]) => {
          const participant = String(participantJid || "").trim();
          return participant && participant !== ownJid && !participant.endsWith("@g.us");
        }) || presenceEntries[0];

      const [presenceJidRaw, presenceData] = candidateEntry;
      const participantJid = String(presenceJidRaw || "").trim();
      const selectedJid =
        participantJid && participantJid !== ownJid ? participantJid : String(chatJidRaw || "");
      if (!selectedJid || selectedJid.endsWith("@g.us") || selectedJid === "status@broadcast") {
        return;
      }

      const lastKnownPresence = String(
        presenceData?.lastKnownPresence || presenceData?.presence || ""
      ).toLowerCase();
      const isTyping = ["composing", "recording"].includes(lastKnownPresence);
      const isStopTyping = ["paused", "available", "unavailable"].includes(lastKnownPresence);
      if (!isTyping && !isStopTyping) return;

      const normalizedJid = jidNormalizedUser(selectedJid);
      const contactNumber = String(normalizedJid || "").replace(/\D/g, "");
      if (!contactNumber) return;

      const contact = await Contact.findOne({
        where: {
          companyId,
          [Op.or]: [
            { remoteJid: normalizedJid },
            { number: contactNumber }
          ]
        },
        order: [["updatedAt", "DESC"]]
      });

      if (!contact) return;

      const ticket = await Ticket.findOne({
        where: {
          companyId,
          whatsappId: wbot.id,
          contactId: contact.id,
          status: { [Op.in]: ["open", "pending", "group"] }
        },
        order: [["updatedAt", "DESC"]]
      });

      if (!ticket) return;

      const io = getIO();
      io.of(String(companyId)).emit(`company-${companyId}-typing`, {
        ticketId: ticket.id,
        isTyping,
        isOnline: ["composing", "recording", "paused", "available"].includes(lastKnownPresence),
        userId: null,
        companyId,
        at: new Date().toISOString()
      });
    } catch (error) {
      logger.warn(`[WBOT] presence.update parse falhou: ${String((error as any)?.message || error)}`);
    }
  });


  // wbot.ev.on('message-receipt.update', (events: any) => {
  //   events.forEach(async (msg: any) => {
  //     const ack = msg?.receipt?.receiptTimestamp ? 3 : msg?.receipt?.readTimestamp ? 4 : 0;
  //     if (!ack) return;
  //     await handleMsgAck(msg, ack);
  //   });
  // })
  // wbot.ev.on("presence.update", (events: any) => {
  //   console.log(events)
  // })

    wbot.ev.on("contacts.update", (contacts: any) => {
    contacts.forEach(async (contact: any) => {
      if (!contact?.id) return;

      if (typeof contact.imgUrl !== "undefined") {
        const newUrl =
          contact.imgUrl === ""
            ? ""
            : await wbot!.profilePictureUrl(contact.id!).catch(() => null);

        // [LID/JID] extrai ids a partir do contact.id
        const { lid, jid } = parseLidJid(contact.id);

        const contactData = {
          name: contact.id.replace(/\D/g, ""),
          number: contact.id.replace(/\D/g, ""),
          isGroup: contact.id.includes("@g.us") ? true : false,
          companyId: companyId,
          remoteJid: contact.id,
          profilePicUrl: newUrl,
          whatsappId: wbot.id,
          wbot: wbot,
          // [LID/JID] novos campos
          lid,
          jid
        };

        await CreateOrUpdateContactService(contactData);
      }
    });
  });

    wbot.ev.on("groups.update", (groupUpdate: GroupMetadata[]) => {
    if (!groupUpdate[0]?.id) return;
    if (groupUpdate.length === 0) return;
    groupUpdate.forEach(async (group: GroupMetadata) => {
      const number = group.id.replace(/\D/g, "");
      const nameGroup = group.subject || number;

      let profilePicUrl: string = "";
       try {
         profilePicUrl = await wbot.profilePictureUrl(group.id, "preview");
       } catch (e) {
         Sentry.captureException(e);
         profilePicUrl = "/nopicture.png";
       }

      // [LID/JID] extrai ids a partir do group.id
      const { lid, jid } = parseLidJid(group.id);

      const contactData = {
        name: nameGroup,
        number: number,
        isGroup: true,
        companyId: companyId,
        remoteJid: group.id,
        profilePicUrl,
        whatsappId: wbot.id,
        wbot: wbot,
        // [LID/JID] novos campos
        lid,
        jid
      };

      const contact = await CreateOrUpdateContactService(contactData);
    });
  });
};

export {
  wbotMessageListener,
  handleMessage,
  isValidMsg,
  getTypeMessage,
  handleMsgAck
};

export default wbotMessageListener;
