import type { MessageUpsertType, proto, WASocket } from "baileys";
import {
  convertTextToSpeechAndSaveToFile,
  getBodyMessage,
  transferQueue,
  verifyMediaMessage,
  verifyMessage,
} from "../WbotServices/wbotMessageListener";
import { isNil, isNull } from "lodash";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import TicketTraking from "../../models/TicketTraking";
import CreateMessageService from "../MessageServices/CreateMessageService";
import {
  extractOpenAICompatibleText,
  requestOpenAICompletion,
  SessionOpenAi
} from "./OpenAIProviderService";
import {
  requestGeminiCompletion,
  SessionGemini
} from "./GeminiProviderService";
import {
  AIProvider,
  TRANSCRIPTION_PROVIDER_MODELS,
  VISION_PROVIDER_MODELS,
  getOpenAICompatibleBaseURL,
  isOpenAICompatibleProvider,
  providerSupportsTranscription,
  providerSupportsVision,
  resolveAIProvider
} from "../../helpers/aiProviders";
import PromptFiles from "../../models/PromptFiles";
import SendWhatsAppMedia from "../WbotServices/SendWhatsAppMedia";

import { sleep, randomInt } from "../../utils/delay";


const toNumber = (value: any, fallback: number): number => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
};

const buildGeminiGenerationConfig = (openAiSettings: IOpenAi) => {
  const parsedTemperature = toNumber(openAiSettings.temperature, 0.7);
  const parsedMaxTokens = toNumber(openAiSettings.maxTokens, 1000);

  return {
    temperature: parsedTemperature >= 0 ? parsedTemperature : 0.7,
    maxOutputTokens: parsedMaxTokens > 0 ? Math.floor(parsedMaxTokens) : 1000
  };
};

const DEFAULT_AI_DELAY_MIN_SECONDS = 3;
const DEFAULT_AI_DELAY_MAX_SECONDS = 5;
const AI_USER_BURST_WAIT_MS = 5000;
const MAX_CHARS_PER_MESSAGE = 260;
const MIN_CHARS_PER_NATURAL_BLOCK = 120;
const DEFAULT_AUTO_MAX_RESPONSE_MESSAGES = 6;

// mantém letras (com acento), números, pontuação comum e quebras de linha
const keepOnlySpecifiedChars = (text: string): string => {
  if (!text) return "";

  return text
    // 🔥 Remove caracteres invisíveis Unicode APENAS no início
    .replace(/^[\u200E\u200F\uFEFF]+/, "")
    // normalização padrão já existente
    .normalize("NFKC")
    // remove caracteres de controle estranhos, preservando PT-BR
    .replace(/[^\p{L}\p{N}\p{P}\p{Zs}\n\r\t]/gu, "")
    // ajusta espaços antes de quebra de linha
    .replace(/[ \t]+\n/g, "\n")
    // trim final (mantido)
    .trim();
};

type Session = WASocket & {
  id?: number;
};

interface ImessageUpsert {
  messages: proto.IWebMessageInfo[];
  type: MessageUpsertType;
}

interface IOpenAi {
  id?: number;
  name: string;
  provider?: string;
  prompt: string;
  voice: string;
  voiceKey: string;
  voiceRegion: string;
  maxTokens: number;
  temperature: number;
  apiKey: string;
  queueId: number;
  maxMessages: number;
  maxResponseMessages?: number;
  model: string;
  openAiApiKey?: string;
}

const sessionsOpenAi: SessionOpenAi[] = [];
const sessionsGemini: SessionGemini[] = [];

// ===== util =====
const deleteFileSync = (path: string): void => {
  try {
    fs.unlinkSync(path);
  } catch (error) {
    console.error("Erro ao deletar o arquivo:", error);
  }
};

const sanitizeName = (name: string): string => {
  let sanitized = name.split(" ")[0];
  sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, "");
  return sanitized.substring(0, 60);
};

// sanitiza a API key que vem do fluxo
const cleanApiKey = (k: string) =>
  (k || "")
    .replace(/^["']|["']$/g, "") // tira aspas no início/fim
    .replace(/\s+/g, "") // remove espaços/quebras internas
    .trim();

const normalizeModelName = (model: string): string => {
  const normalized = (model || "").trim().toLowerCase();

  if (
    normalized === "gemini-1.5-flash" ||
    normalized === "gemini-1.5-pro" ||
    normalized === "gemini-2.0-flash"
  ) {
    return "gemini-2.5-flash";
  }

  return (model || "").trim();
};

// mensagens de erro mais claras
function humanizeAIError(provider: AIProvider, err: any): string {
  const status =
    err?.status ||
    err?.response?.status ||
    err?.response?.data?.error?.status ||
    err?.code;

  const providerLabels: Record<AIProvider, string> = {
    openai: "OPENAI",
    gemini: "GEMINI",
    deepseek: "DEEPSEEK",
    groq: "GROQ"
  };
  const prov = providerLabels[provider] || String(provider || "").toUpperCase();

  if (status === 401) return `${prov}: 401 (API key inválida). Verifique a chave do fluxo.`;
  if (status === 403) return `${prov}: 403 (acesso bloqueado/billing/quotas).`;
  if (status === 429) return `${prov}: 429 (limite/velocidade atingido). Tente novamente.`;
  if (status && Number(status) >= 500)
    return `${prov}: ${status} (instabilidade do provedor).`;
  if (err?.name === "AbortError") return `${prov}: tempo limite esgotado.`;
  return `${prov}: falha ao processar — ${err?.message || "erro desconhecido"}`;
}

const getErrorStatusCode = (err: any): number | null => {
  const status =
    err?.status ||
    err?.response?.status ||
    err?.response?.data?.error?.code ||
    err?.code;
  const parsed = Number(status);
  return Number.isFinite(parsed) ? parsed : null;
};

const isRetryableGeminiError = (err: any): boolean => {
  const status = getErrorStatusCode(err);
  if (status === 429 || status === 503 || status === 504) return true;
  const msg = normalizeText(String(err?.message || err || "")).toLowerCase();
  return (
    msg.includes("high demand") ||
    msg.includes("service unavailable") ||
    msg.includes("rate limit") ||
    msg.includes("temporarily unavailable")
  );
};

// anti-loop de transferência e de mensagem "aguarde"
const NOTIFY_COOLDOWN_MS = 60_000; // 1 min
const lastNotifyAt = new Map<number, number>(); // ticketId -> timestamp

// 🔹 tickets onde a IA deve ficar desativada (apenas para aquele chamado)
const disabledAIBotTickets = new Set<number>(); // ticketId

// 🔹 palavras-chave de intenção clara de falar com humano
const HUMAN_KEYWORDS = [
  "atendimento humano",
  "falar com atendimento",
  "falar com o atendimento",
  "falar com atendente",
  "falar com o atendente",
  "quero falar com atendente",
  "quero falar com o atendente",
  "me transfere para um atendente",
  "transferir para atendente",
  "transferir para humano",
  "quero atendimento com humano",
  "preciso de atendimento humano",
  "falar com especialista",
  "falar com um especialista",
  "falar com o especialista",
  "quero falar com especialista",
  "quero falar com um especialista",
  "quero um especialista",
  "quero falar com alguem",
  "falar com alguem",
  "quero falar com alguém",
  "falar com alguém",
  "quero falar com uma pessoa de verdade",
  "falar com pessoa real",
  "quero suporte humano",
  "falar com suporte",
  "falar com consultor",
  "quero falar com consultor",
  "falar com vendedor",
  "quero falar com vendedor",
  "falar com gerente",
  "quero falar com gerente",
  "quero falar com uma pessoa",
  "quero falar com pessoa",
  "falar com humano",
  "falar com uma pessoa",
  "falar com um humano",
  "atendente humano",
  "quero um atendente",
  "quero atendimento humano"
];

const TRANSFER_ACTION = "transfer_to_human";
const TRANSFER_TAG = "acao: transferir para o setor de atendimento";

const resolveAutoResponseMessageLimit = (): number => {
  const parsed = Math.floor(
    toNumber(
      process.env.AI_AUTO_MAX_RESPONSE_MESSAGES,
      DEFAULT_AUTO_MAX_RESPONSE_MESSAGES
    )
  );
  if (parsed < 2) return 2;
  if (parsed > 8) return 8;
  return parsed;
};

const normalizeText = (text: string): string =>
  String(text || "")
    .replace(/^[\u200E\u200F\uFEFF]+/, "")
    .trim();

const normalizeForComparison = (text: string): string =>
  String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const isLikelyRepeatedAnswer = (current: string, previous: string): boolean => {
  const nowNorm = normalizeForComparison(current);
  const prevNorm = normalizeForComparison(previous);
  if (!nowNorm || !prevNorm) return false;
  if (nowNorm === prevNorm) return true;
  if (nowNorm.length >= 40 && prevNorm.length >= 40) {
    if (nowNorm.includes(prevNorm) || prevNorm.includes(nowNorm)) return true;
  }
  return false;
};

// Detecta estruturalmente se uma mensagem é raciocínio interno do modelo, sem depender de frases específicas.
// Modelos reasoning (DeepSeek, R1, etc.) vazam chain-of-thought de duas formas principais:
//   1. Referem-se ao cliente em 3ª pessoa como sujeito ("o cliente está X", "ele quer Y")
//   2. Descrevem meta-ações sobre a própria resposta ("vou responder de forma X", "preciso manter o tom")
// Mensagens genuínas para o cliente usam 2ª pessoa ("você", "seu", "sua") ou imperativo.
const isReasoningMessage = (text: string): boolean => {
  const n = normalizeForComparison(text);
  if (!n || n.length < 15) return false;

  // 1. Mensagem inteiramente entre parênteses (raciocínio explícito)
  const raw = normalizeText(text).trim();
  if (raw.startsWith("(") && raw.endsWith(")") && raw.length > 20) return true;

  // 2. Cliente/usuário referenciado em 3ª pessoa como sujeito + verbo de estado/ação
  //    Ex: "O cliente está confirmando", "O usuário respondeu", "Ele demonstrou interesse"
  if (
    /\b(o|a)\s+(cliente|usuario|lead|contato)\b/.test(n) &&
    /\b(esta|foi|respondeu|confirmou|quer|precisa|demonstrou|pediu|enviou|perguntou|disse|solicitou|mostrou|expressou|indicou)\b/.test(n)
  ) return true;

  // "Ele/ela + verbo de estado" (quando o bot fala sobre o cliente em 3ª pessoa sem nomeá-lo)
  if (
    /\b(ele|ela)\s+(esta|quer|pediu|confirmou|respondeu|demonstrou|disse|perguntou|ja)\b/.test(n)
  ) return true;

  // 3. Meta-ações de 1ª ou 1ª pessoa do plural SEM usar "você" (planejamento interno)
  //    Ex: "Preciso manter o tom", "Precisamos conduzir", "Vou direcionar para o fechamento"
  //    Ex: "Vou gerar uma resposta", "Devo lembrá-lo dos benefícios"
  if (
    !/\bvoce\b/.test(n) &&
    /\b(preciso|precisamos|devo|devemos|vou|iremos|irei)\s+(manter|conduzir|direcionar|avancar|fechar|garantir|soar|convencer|usar|adotar|gerar|criar|elaborar|formular|lembr|ser (direto|persuasivo|simpatico|profissional|cuidadoso)|ir (direto|diretamente)|agir)\b/.test(n)
  ) return true;

  // "Vou direto ao ponto" — meta-comentário sobre a abordagem da resposta
  if (/\bvou (direto|diretamente)\b/.test(n) && !/\bvoce\b/.test(n)) return true;

  // "para reforçar a decisão/venda" — raciocínio sobre tática de fechamento
  if (/\bpara reforcar a (decisao|venda|compra|escolha|conversao)\b/.test(n)) return true;

  // 4. "Vou responder de forma X" — meta-comentário sobre estilo de resposta
  if (/\bvou responder de forma\b/.test(n)) return true;

  // 5. "Tom persuasivo/profissional/..." — análise estratégica
  if (/\btom\s+(persuasivo|profissional|amigavel|simpatico|certo|adequado|ideal|assertivo)\b/.test(n)) return true;

  // 6. "Direcionar/conduzir para o fechamento/pagamento" — meta sobre funil de vendas
  if (/\b(direcionar|conduzir|levar)\s+(para|ao)\s+(fechamento|pagamento|conversao)\b/.test(n)) return true;

  return false;
};

const hasLeakedInternalReasoning = (messages: string[]): boolean => {
  if (!Array.isArray(messages) || messages.length === 0) return false;

  const combined = normalizeText(messages.join(" ")).toLowerCase();
  if (!combined) return false;

  const combinedNoAccents = combined
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const englishPatterns = [
    "we need to",
    "must greet",
    "must end with",
    "respond in json",
    "fields action",
    "keep under",
    "likely 1 message",
    "should be short",
    "example:",
    "no transfer request"
  ];

  // Padrões de raciocínio interno em português (vazamento do DeepSeek/modelos de reasoning)
  const portuguesePatterns = [
    // análise do estado do cliente
    "o cliente respondeu",
    "o usuario respondeu",
    "o cliente confirmou",
    "o usuario confirmou",
    "ele ja demonstrou interesse",
    "ela ja demonstrou interesse",
    "ja demonstrou interesse",
    "ele demonstrou interesse",
    "ela demonstrou interesse",
    "que e uma confirmacao",
    "que e uma negacao",
    "que e uma objecao",
    // meta-comentários sobre a própria resposta
    "vou gerar uma resposta",
    "vou criar uma resposta",
    "vou elaborar uma resposta",
    "vou formular uma resposta",
    "vou responder com",
    "vou direto ao ponto",
    "vou ser direto",
    "vou destacar",
    "vou oferecer o link",
    "oferecendo o link de pagamento",
    "destacando a urgencia",
    "destacando o pagamento",
    // raciocínio sobre estratégia/próximo passo
    "como a regra diz",
    "como a regra estabelece",
    "precisamos conduzir",
    "preciso avancar para",
    "preciso conduzir",
    "devo avancar para",
    "devo conduzir",
    "conduzir para o pagamento",
    "conduzir para o fechamento",
    "para o fechamento da venda",
    "estrategia de vendas",
    "estrategia de atendimento",
    "proximo passo e",
    "vou direcionar para"
  ];

  // Detecção estrutural por padrão semântico: qualquer mensagem que pareça raciocínio interno
  if (messages.some(isReasoningMessage)) return true;

  if (englishPatterns.some(pattern => combined.includes(pattern))) return true;
  if (portuguesePatterns.some(pattern => combinedNoAccents.includes(pattern))) return true;
  return false;
};

const isLowQualitySingleReply = (value: string): boolean => {
  const normalized = normalizeForComparison(value);
  if (!normalized) return true;
  if (normalized.length <= 10) return true;
  if (
    normalized === "here is" ||
    normalized === "here is the" ||
    normalized === "here are" ||
    normalized.startsWith("here is ") ||
    normalized.startsWith("here are ") ||
    normalized === "aqui esta" ||
    normalized === "aqui esta:" ||
    normalized.startsWith("aqui esta ")
  ) {
    return true;
  }
  return false;
};

const hasInvalidStructuredReply = (messages: string[]): boolean => {
  if (!Array.isArray(messages) || messages.length === 0) return true;
  const first = normalizeText(messages[0] || "");
  if (isLowQualitySingleReply(first)) return true;
  return false;
};

const isLikelyEnglishCustomerReply = (value: string): boolean => {
  const normalized = normalizeText(value);
  if (!normalized) return false;

  const lower = normalized.toLowerCase();
  const normalizedNoAccents = lower
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const englishSignals = [
    "yes",
    "send the link",
    "here is",
    "how can i help",
    "would you like",
    "payment link",
    "source code",
    "single payment",
    "click here",
    "get access now"
  ];

  const portugueseSignals = [
    "voce",
    "olá",
    "ola",
    "como posso",
    "posso ajudar",
    "segue",
    "pagamento",
    "codigo-fonte",
    "mensalidade",
    "atendimento",
    "valor",
    "link de pagamento",
    "quer garantir",
    "agora"
  ];

  if (portugueseSignals.some(signal => normalizedNoAccents.includes(signal))) {
    return false;
  }

  if (englishSignals.some(signal => normalizedNoAccents.includes(signal))) {
    return true;
  }

  const englishWordMatches =
    normalizedNoAccents.match(
      /\b(yes|send|link|payment|source|code|single|access|hello|thanks|price|system|guarantee|would|like|click|now)\b/g
    ) || [];

  return englishWordMatches.length >= 2;
};

const hasDeepseekLanguageLeak = (messages: string[]): boolean =>
  Array.isArray(messages) && messages.some(message => isLikelyEnglishCustomerReply(message));

// Attempts to salvage a customer-facing Portuguese message from English reasoning text.
// LLaMA models sometimes output reasoning like "We need to... Something like 'Olá!...'"
// instead of raw JSON. This extracts the quoted Portuguese content from that pattern.
const extractPortugueseFromReasoningText = (rawText: string): string | null => {
  const text = normalizeText(rawText);
  if (!text) return null;

  // If it starts with { it's likely already JSON (or partial JSON), not reasoning text.
  if (text.trimStart().startsWith("{")) return null;

  // Collect all double-quoted strings from the raw text.
  const quoted: string[] = [];
  const quotedRegex = /"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = quotedRegex.exec(text)) !== null) {
    const v = normalizeText(m[1].replace(/\\n/g, " ").replace(/\\"/g, '"'));
    if (v && v.length >= 12) quoted.push(v);
  }

  // Prefer strings that look Portuguese (contain accented chars or common PT words).
  const looksPortuguese = (s: string): boolean => {
    if (/[áàãâéêíóõôúçÁÀÃÂÉÊÍÓÕÔÚÇ]/.test(s)) return true;
    const lower = s.toLowerCase();
    return (
      lower.includes("você") ||
      lower.includes("oi ") ||
      lower.includes("olá") ||
      lower.includes("como posso") ||
      lower.includes("posso ajudar") ||
      lower.includes("obrigado") ||
      lower.includes("para ") ||
      lower.includes("nosso") ||
      lower.includes("nossa")
    );
  };

  const portuguese = quoted.filter(looksPortuguese);
  if (portuguese.length > 0) {
    // Return the longest plausible Portuguese sentence (likely the actual response).
    return portuguese.reduce((a, b) => (b.length > a.length ? b : a));
  }

  // Fallback: return the longest quoted string as a last resort.
  if (quoted.length > 0) {
    return quoted.reduce((a, b) => (b.length > a.length ? b : a));
  }

  return null;
};

const safeGeminiFallbackJson = (userMessage: string): string => {
  const userSnippet = normalizeText(userMessage).slice(0, 120);
  const message = userSnippet
    ? `Tive uma instabilidade momentânea no atendimento. Pode repetir sua última mensagem em uma frase curta para eu continuar?`
    : `Tive uma instabilidade momentânea no atendimento. Pode me enviar novamente sua mensagem para eu continuar?`;
  return JSON.stringify({
    action: "none",
    messages: [message]
  });
};

const buildDeepseekAudioUnsupportedMessage = (): string =>
  "No momento, não estamos aceitando mensagens de audio. Por favor, envie sua mensagem em texto para eu continuar.";

const buildVisionUnsupportedMessage = (): string =>
  "No momento, não consigo analisar imagens. Por favor, descreva em texto o que você gostaria de mostrar para eu continuar.";

const SEND_FILE_ACTION = "send_file";

// Remove blocos de raciocínio que modelos como DeepSeek R1 emitem antes do JSON.
// Isso garante que <think>...</think> e blocos similares não poluam o parsing.
const stripReasoningFromRawResponse = (text: string): string => {
  let cleaned = String(text || "");
  // Remove tags <think>...</think> (DeepSeek R1, QwQ e modelos similares)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "");
  return cleaned.trim();
};

const extractJsonPayload = (rawText: string): string => {
  const text = String(rawText || "").trim();
  if (!text) return text;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text;
};

const splitByParagraphs = (text: string, maxParts: number): string[] => {
  const paragraphs = text
    .split(/\n{2,}/g)
    .map(chunk => normalizeText(chunk))
    .filter(Boolean);

  if (paragraphs.length <= 1) return [normalizeText(text)].filter(Boolean);
  return paragraphs.slice(0, maxParts);
};

const extractMessagesFromLooseJson = (
  rawText: string,
  maxResponseMessages: number
): string[] => {
  const text = String(rawText || "");
  const messagesKeyMatch = text.match(/"messages"\s*:\s*\[/i);
  if (!messagesKeyMatch?.index && messagesKeyMatch?.index !== 0) return [];

  // Captura mesmo quando o JSON vem truncado (sem fechar "]" ou "}").
  const startIndex = messagesKeyMatch.index + messagesKeyMatch[0].length;
  const tail = text.slice(startIndex);

  const messages: string[] = [];
  const regex = /"((?:[^"\\]|\\.)*)"/g;
  let match: RegExpExecArray | null = null;

  while ((match = regex.exec(tail)) !== null) {
    const value = normalizeText(
      String(match[1] || "").replace(/\\"/g, "\"").replace(/\\n/g, "\n")
    );
    if (value) messages.push(value);
    if (messages.length >= maxResponseMessages) break;
  }

  return messages;
};

const extractMessagesFromMalformedPayload = (
  rawText: string,
  maxResponseMessages: number
): string[] => {
  const text = String(rawText || "");
  if (!text) return [];

  const candidates: string[] = [];
  const pairRegex = /"(?:message|mensagem|reply|resposta)"\s*:\s*"((?:[^"\\]|\\.)*)"/gi;
  let match: RegExpExecArray | null = null;

  while ((match = pairRegex.exec(text)) !== null) {
    const value = normalizeText(
      String(match[1] || "").replace(/\\"/g, "\"").replace(/\\n/g, "\n")
    );
    if (value) candidates.push(value);
    if (candidates.length >= maxResponseMessages) break;
  }

  if (candidates.length) return candidates.slice(0, maxResponseMessages);

  const stripped = normalizeText(
    text
      .replace(/```(?:json)?/gi, "")
      .replace(/[{}[\]"]/g, " ")
      .replace(/\s+/g, " ")
  );

  if (!stripped || stripped.length < 8) return [];
  return [stripped.slice(0, MAX_CHARS_PER_MESSAGE)];
};

const compactMessagesByLength = (
  messages: string[],
  maxResponseMessages: number
): string[] => {
  const chunks: string[] = [];

  for (const message of messages) {
    const normalized = normalizeText(message);
    if (!normalized) continue;

    if (normalized.length <= MAX_CHARS_PER_MESSAGE) {
      chunks.push(normalized);
      continue;
    }

    const sentenceParts = normalized
      .split(/(?<=[.!?])\s+/)
      .map(part => normalizeText(part))
      .filter(Boolean);

    let current = "";
    for (const part of sentenceParts.length ? sentenceParts : [normalized]) {
      const candidate = current ? `${current} ${part}` : part;
      if (candidate.length <= MAX_CHARS_PER_MESSAGE) {
        current = candidate;
      } else {
        if (current) chunks.push(current);
        if (part.length <= MAX_CHARS_PER_MESSAGE) {
          current = part;
        } else {
          chunks.push(part.slice(0, MAX_CHARS_PER_MESSAGE).trim());
          current = "";
        }
      }
    }
    if (current) chunks.push(current);
  }

  const limited = chunks.filter(Boolean).slice(0, maxResponseMessages);
  if (limited.length) return limited;
  return messages
    .map(message => normalizeText(message))
    .filter(Boolean)
    .slice(0, maxResponseMessages);
};

const normalizeNaturalMessageFlow = (
  messages: string[],
  maxResponseMessages: number
): string[] => {
  const cleaned = messages.map(msg => normalizeText(msg)).filter(Boolean);
  if (!cleaned.length) return [];

  const merged: string[] = [];
  for (const msg of cleaned) {
    const isQuestion = /\?\s*$/.test(msg);
    const last = merged[merged.length - 1];
    const lastIsQuestion = !!last && /\?\s*$/.test(last);
    const canMergeWithLast =
      !!last &&
      !lastIsQuestion &&
      !isQuestion &&
      last.length < MIN_CHARS_PER_NATURAL_BLOCK &&
      `${last} ${msg}`.length <= MAX_CHARS_PER_MESSAGE;

    if (canMergeWithLast) {
      merged[merged.length - 1] = `${last} ${msg}`;
    } else {
      merged.push(msg);
    }
  }

  return merged.slice(0, maxResponseMessages);
};

const isLikelyInternalPayloadLine = (text: string): boolean => {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) return true;

  const normalizedNoAccents = normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const hasActionKey = /(^|[\s{,;])"?action"?\s*:/i.test(normalizedNoAccents);
  const hasMessagesKey = /(^|[\s{,;])"?messages"?\s*:/i.test(normalizedNoAccents);

  return (
    normalized.startsWith("{") ||
    normalized.startsWith("[") ||
    /^[\]\[}{:,]+$/.test(normalized) ||
    (/^[\]\[}{:,\s]+$/.test(normalized) && normalized.length <= 12) ||
    (/^[^a-z0-9]*$/i.test(normalized) && normalized.length <= 12) ||
    /^[\]\[}{:,]+\s*[\p{L}\p{N}]/u.test(normalized) ||
    /[\]\[}{:,]+\s*$/.test(normalized) ||
    normalized.startsWith("\"action\"") ||
    normalized.includes("\"action\":") ||
    normalized.includes("\"messages\":") ||
    (hasActionKey && hasMessagesKey) ||
    normalized === "{\"" ||
    normalized === "{\"action" ||
    normalized === "{\"action\":\"none\"" ||
    normalized === "{\"action\":\"none\",\"messages\"" ||
    // Detecção semântica: raciocínio interno do modelo (barreira de segurança final)
    isReasoningMessage(text)
  );
};

const notifyInternalAIError = async ({
  ticket,
  contact,
  context,
  error
}: {
  ticket: Ticket;
  contact: Contact;
  context: string;
  error?: any;
}): Promise<void> => {
  try {
    const rawDetail = normalizeText(
      String(
        error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          error ||
          "falha desconhecida"
      )
    );
    const detail = rawDetail ? rawDetail.slice(0, 240) : "falha desconhecida";

    await CreateMessageService({
      companyId: ticket.companyId,
      messageData: {
        wid: `PVT-AI-${ticket.id}-${Date.now()}`,
        ticketId: ticket.id,
        contactId: undefined,
        body: `⚠️ Erro da IA (${context}): ${detail}`,
        fromMe: true,
        read: true,
        mediaType: "conversation",
        isPrivate: true,
        ack: 1,
        remoteJid: ticket.isGroup
          ? `${contact.number}@g.us`
          : `${contact.number}@s.whatsapp.net`,
        createdAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error("Falha ao registrar erro interno de IA:", err);
  }
};

const registerInternalAudioTranscription = async ({
  ticket,
  contact,
  transcription
}: {
  ticket: Ticket;
  contact: Contact;
  transcription: string;
}): Promise<void> => {
  try {
    const normalizedTranscription = normalizeText(transcription);
    if (!normalizedTranscription) return;

    await CreateMessageService({
      companyId: ticket.companyId,
      messageData: {
        wid: `PVT-AI-AUDIO-${ticket.id}-${Date.now()}`,
        ticketId: ticket.id,
        contactId: undefined,
        body: `🎤 Transcrição de áudio: ${normalizedTranscription}`,
        fromMe: true,
        read: true,
        mediaType: "conversation",
        isPrivate: true,
        ack: 1,
        remoteJid: ticket.isGroup
          ? `${contact.number}@g.us`
          : `${contact.number}@s.whatsapp.net`,
        createdAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error("Falha ao registrar transcrição interna de áudio:", err);
  }
};

const registerInternalImageDescription = async ({
  ticket,
  contact,
  description
}: {
  ticket: Ticket;
  contact: Contact;
  description: string;
}): Promise<void> => {
  try {
    const normalizedDescription = normalizeText(description);
    if (!normalizedDescription) return;

    await CreateMessageService({
      companyId: ticket.companyId,
      messageData: {
        wid: `PVT-AI-IMG-${ticket.id}-${Date.now()}`,
        ticketId: ticket.id,
        contactId: undefined,
        body: `🖼️ Leitura de imagem pela IA: ${normalizedDescription}`,
        fromMe: true,
        read: true,
        mediaType: "conversation",
        isPrivate: true,
        ack: 1,
        remoteJid: ticket.isGroup
          ? `${contact.number}@g.us`
          : `${contact.number}@s.whatsapp.net`,
        createdAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error("Falha ao registrar leitura interna de imagem:", err);
  }
};

const findLastQuestionMessage = (messages: string[]): string => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = normalizeText(messages[i]);
    if (msg && /\?\s*$/.test(msg)) return msg;
  }
  return "";
};

type ParsedAIOutput = {
  action: "none" | "transfer_to_human" | "send_file";
  messages: string[];
  fileId?: number;
};

const parseStructuredAiOutput = (
  rawText: string,
  maxResponseMessages: number
): ParsedAIOutput => {
  const fallbackMessages = splitByParagraphs(rawText, maxResponseMessages);
  const jsonPayload = extractJsonPayload(rawText);

  try {
    const parsed = JSON.parse(jsonPayload);
    const messagesRaw = Array.isArray(parsed?.messages) ? parsed.messages : [];
    const messages = messagesRaw
      .map((item: unknown) => normalizeText(String(item || "")))
      .filter(Boolean)
      .slice(0, maxResponseMessages);

    const actionRaw = normalizeText(String(parsed?.action || "none")).toLowerCase();
    const action: ParsedAIOutput["action"] =
      actionRaw === TRANSFER_ACTION
        ? TRANSFER_ACTION
        : actionRaw === SEND_FILE_ACTION
          ? SEND_FILE_ACTION
          : "none";
    const parsedFileId = Number(parsed?.fileId);
    const fileId =
      action === SEND_FILE_ACTION && Number.isFinite(parsedFileId) && parsedFileId > 0
        ? parsedFileId
        : undefined;

    if (messages.length > 0) {
      return { action, messages, fileId };
    }
  } catch (_) {
    const looseMessages = extractMessagesFromLooseJson(rawText, maxResponseMessages);
    if (looseMessages.length > 0) {
      return {
        action: "none",
        messages: looseMessages
      };
    }

    const looksLikeJsonPayload =
      /^\s*\{/.test(String(rawText || "")) &&
      /"action"\s*:|"messages"\s*:/i.test(String(rawText || ""));
    if (looksLikeJsonPayload) {
      const recoveredMessages = extractMessagesFromMalformedPayload(
        rawText,
        maxResponseMessages
      );
      if (recoveredMessages.length > 0) {
        return {
          action: "none",
          messages: recoveredMessages
        };
      }
      return {
        action: "none",
        messages: fallbackMessages.slice(0, maxResponseMessages)
      };
    }
  }

  return {
    action: "none",
    messages: fallbackMessages.slice(0, maxResponseMessages)
  };
};

// ===== helpers =====
const prepareMessagesAI = (
  pastMessages: Message[],
  isGeminiModel: boolean,
  promptSystem: string
): any[] => {
  const messagesAI: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];

  if (!isGeminiModel) {
    messagesAI.push({ role: "system", content: promptSystem });
  }

  for (const message of pastMessages) {
    const body = normalizeText(String((message as any)?.body || ""));
    const mediaType = normalizeText(String((message as any)?.mediaType || "")).toLowerCase();
    const isTextLike =
      mediaType === "conversation" ||
      mediaType === "extendedtextmessage" ||
      mediaType === "";

    if (isTextLike && body) {
      if (message.fromMe) {
        messagesAI.push({ role: "assistant", content: body });
      } else {
        messagesAI.push({ role: "user", content: body });
      }
    }
  }

  return messagesAI;
};

const getLastAssistantMessage = (
  messagesAI: Array<{ role: "system" | "user" | "assistant"; content: string }>
): string => {
  for (let i = messagesAI.length - 1; i >= 0; i -= 1) {
    const item = messagesAI[i];
    if (item?.role === "assistant") {
      const content = normalizeText(String(item.content || ""));
      if (content) return content;
    }
  }
  return "";
};

// ===== processamento da resposta =====
const processResponse = async (
  responseText: string,
  wbot: Session,
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact,
  openAiSettings: IOpenAi,
  ticketTraking: TicketTraking,
  userText: string | null
): Promise<void> => {
  const maxResponseMessages = resolveAutoResponseMessageLimit();
  const structured = parseStructuredAiOutput(stripReasoningFromRawResponse(responseText || ""), maxResponseMessages);
  const rawMessages = structured.messages
    .map(message => normalizeText(message))
    .filter(Boolean);
  const rawJoinedResponse = rawMessages.join("\n\n");

  // normaliza input do cliente para checar se ele REALMENTE pediu humano
  const userNorm = (userText || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const clientExplicitlyWantsHuman = HUMAN_KEYWORDS.some(k =>
    userNorm.includes(
      k
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
    )
  );

  // ===== DETECÇÃO ROBUSTA DA AÇÃO DE TRANSFERÊNCIA =====
  const normalized = rawJoinedResponse
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  const askedTransferInTag = normalized.startsWith(TRANSFER_TAG);
  const askedTransferInAction = structured.action === TRANSFER_ACTION;
  const shouldTransfer =
    askedTransferInTag || askedTransferInAction || clientExplicitlyWantsHuman;

  // disparo de transferência (idempotente e com cooldown)
  if (shouldTransfer) {
    // 1) define de onde vem o queueId:
    //    - prioridade 1: queueId configurado no nó OpenAI do FlowBuilder
    //    - prioridade 2: queueId atual do ticket (se já estiver numa fila)
    const raw = (openAiSettings as any)?.queueId;
    const n = Number(raw);
    let targetQueueId: number | null =
      Number.isFinite(n) && n > 0
        ? n
        : ticket.queueId && Number(ticket.queueId) > 0
          ? Number(ticket.queueId)
          : null;

    const now = Date.now();
    const last = lastNotifyAt.get(ticket.id) || 0;

    try {
      // só tenta transferir se mudou o destino ou passou o cooldown
      if (ticket?.queueId !== targetQueueId || now - last > NOTIFY_COOLDOWN_MS) {
        await transferQueue(targetQueueId, ticket, contact);

        // 🔹 marca apenas ESTE ticket para não chamar mais a IA
        disabledAIBotTickets.add(ticket.id);

        lastNotifyAt.set(ticket.id, now);
      }

      // avisa "aguarde" no máx. 1x por minuto (mensagem opcional pro cliente)
      const lastNotify = lastNotifyAt.get(ticket.id) || 0;
      if (Date.now() - lastNotify >= NOTIFY_COOLDOWN_MS) {
        await sleep(randomInt(DEFAULT_AI_DELAY_MIN_SECONDS, DEFAULT_AI_DELAY_MAX_SECONDS) * 1000);
        const sent = await wbot.sendMessage(msg.key.remoteJid!, {
          text:
            "Por favor, aguarde, em breve um de nossos colaboradores irá lhe atender. " +
            "Para retornar ao bot, envie # a qualquer momento."
        });
        try {
          await verifyMessage(sent!, ticket, contact);
        } catch (_) { }
        lastNotifyAt.set(ticket.id, Date.now());
      }
    } catch (e: any) {
      console.error("transferQueue falhou", {
        targetQueueId,
        ticketId: ticket.id,
        err: e?.message || e
      });
    }
  }

  // ===== ENVIO DE ARQUIVO DO CATÁLOGO (send_file) =====
  // Catálogo é único por empresa (companyId), compartilhado entre o
  // assistente geral de /prompts e qualquer nó de IA do flowbuilder.
  let fileCaptionUsed = "";
  let fileSentSuccessfully = false;
  if (structured.action === SEND_FILE_ACTION && structured.fileId) {
    try {
      const promptFile = await PromptFiles.findOne({
        where: {
          id: structured.fileId,
          companyId: ticket.companyId
        }
      });

      if (promptFile) {
        const companyPublicFolder = path.resolve(
          __dirname,
          "..",
          "..",
          "..",
          "public",
          `company${ticket.companyId}`
        );
        const folder = path.resolve(companyPublicFolder, "promptFiles");
        const mediaSrc = {
          fieldname: "media",
          originalname: promptFile.path,
          encoding: "7bit",
          mimetype: promptFile.mediaType,
          filename: promptFile.path,
          path: path.resolve(folder, promptFile.path)
        } as Express.Multer.File;

        fileCaptionUsed = rawMessages[0] || promptFile.name;

        await sleep(randomInt(DEFAULT_AI_DELAY_MIN_SECONDS, DEFAULT_AI_DELAY_MAX_SECONDS) * 1000);
        if (typeof (wbot as any).sendMetaAttachment === "function") {
          // Instagram/Messenger (metaAiAgent): a Meta baixa o arquivo pela URL
          // pública e a legenda vai como mensagem de texto logo em seguida.
          const sentFile = await (wbot as any).sendMetaAttachment(
            msg.key.remoteJid!,
            `company${ticket.companyId}/promptFiles/${promptFile.path}`,
            promptFile.mediaType,
            promptFile.name
          );
          try {
            await verifyMessage(sentFile, ticket, contact);
          } catch (_) { }
          fileCaptionUsed = "";
        } else {
          await SendWhatsAppMedia({
            media: mediaSrc,
            ticket,
            body: fileCaptionUsed,
            isForwarded: false
          });
        }
        fileSentSuccessfully = true;
      } else {
        console.warn("AI tentou enviar um fileId inexistente no catálogo.", {
          ticketId: ticket.id,
          fileId: structured.fileId,
          companyId: ticket.companyId
        });
      }
    } catch (error: any) {
      console.error("Falha ao enviar arquivo do catálogo da IA:", error?.message || error);
    }
  }

  const messagesToSend = rawMessages
    .filter(message => !fileSentSuccessfully || message !== fileCaptionUsed)
    .map(message =>
      message
        .replace(/ação: transferir para o setor de atendimento/gi, "")
        .replace(/acao: transferir para o setor de atendimento/gi, "")
        .trim()
    )
    .filter(Boolean);
  const safeMessagesToSend = messagesToSend.filter(
    message => !isLikelyInternalPayloadLine(message)
  );
  const normalizedMessagesToSend = compactMessagesByLength(
    safeMessagesToSend,
    maxResponseMessages
  );
  const naturalMessagesToSend = normalizeNaturalMessageFlow(
    normalizedMessagesToSend,
    maxResponseMessages
  );
  const lastQuestionMessage = findLastQuestionMessage(messagesToSend);
  if (
    naturalMessagesToSend.length >= maxResponseMessages &&
    lastQuestionMessage &&
    !naturalMessagesToSend.some(msg => normalizeText(msg) === normalizeText(lastQuestionMessage))
  ) {
    naturalMessagesToSend[naturalMessagesToSend.length - 1] = lastQuestionMessage;
  }

  if (!naturalMessagesToSend.length) {
    if (fileSentSuccessfully) {
      return;
    }

    console.warn("AI response produced no safe outbound messages after filtering.", {
      ticketId: ticket.id,
      provider: resolveAIProvider(
        (openAiSettings as any)?.provider,
        openAiSettings.model,
        openAiSettings.apiKey
      ),
      rawPreview: normalizeText(rawJoinedResponse).slice(0, 220)
    });

    const fallbackStructured = parseStructuredAiOutput(
      safeGeminiFallbackJson(userText || ""),
      maxResponseMessages
    );
    const fallbackMessages = fallbackStructured.messages
      .map(message => normalizeText(message))
      .filter(Boolean)
      .slice(0, 1);

    if (!fallbackMessages.length) {
      return;
    }

    naturalMessagesToSend.push(...fallbackMessages);
  }

  const joinedResponse = naturalMessagesToSend.join("\n\n");

  const publicFolder: string = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "public",
    `company${ticket.companyId}`
  );


  // "digitando..."
  await wbot.sendPresenceUpdate("composing", msg.key.remoteJid!);
  await new Promise(resolve => setTimeout(resolve, 3000));
  await wbot.sendPresenceUpdate("paused", msg.key.remoteJid!);

  // envia como texto ou áudio
  if (openAiSettings.voice === "texto") {
    for (let i = 0; i < naturalMessagesToSend.length; i++) {
      const delaySeconds =
        i === 0
          ? randomInt(DEFAULT_AI_DELAY_MIN_SECONDS, DEFAULT_AI_DELAY_MAX_SECONDS)
          : randomInt(1, 2);
      await sleep(delaySeconds * 1000);

      const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        text: naturalMessagesToSend[i].replace(/^[\u200E\u200F\uFEFF]+/, "")
      });
      try {
        await verifyMessage(sentMessage!, ticket, contact);
      } catch (e: any) {
        if ((e?.message || e) !== "ERR_UPDATE_TICKET")
          console.warn("verifyMessage falhou:", e?.message || e);
      }
    }
  } else {
    const fileNameWithOutExtension = `${ticket.id}_${Date.now()}`;
    try {
      await convertTextToSpeechAndSaveToFile(
        keepOnlySpecifiedChars(joinedResponse),
        `${publicFolder}/${fileNameWithOutExtension}`,
        openAiSettings.voiceKey,
        openAiSettings.voiceRegion,
        openAiSettings.voice,
        "mp3"
      );
      await sleep(randomInt(DEFAULT_AI_DELAY_MIN_SECONDS, DEFAULT_AI_DELAY_MAX_SECONDS) * 1000);
      const sendMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        audio: { url: `${publicFolder}/${fileNameWithOutExtension}.mp3` },
        mimetype: "audio/mpeg",
        ptt: true
      });
      try {
        await verifyMediaMessage(
          sendMessage!,
          ticket,
          contact,
          ticketTraking,
          false,
          false,
          wbot
        );
      } catch (e: any) {
        if ((e?.message || e) !== "ERR_UPDATE_TICKET")
          console.warn("verifyMediaMessage falhou:", e?.message || e);
      }
      deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.mp3`);
      deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.wav`);
    } catch (error) {
      console.error(`Erro para responder com audio: ${error}`);
      await sleep(randomInt(DEFAULT_AI_DELAY_MIN_SECONDS, DEFAULT_AI_DELAY_MAX_SECONDS) * 1000);
      const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        text: joinedResponse.replace(/^[\u200E\u200F\uFEFF]+/, "")
      });
      try {
        await verifyMessage(sentMessage!, ticket, contact);
      } catch (e: any) {
        if ((e?.message || e) !== "ERR_UPDATE_TICKET")
          console.warn("verifyMessage falhou:", e?.message || e);
      }
    }
  }
};

const tryDeepseekRecovery = async ({
  openaiCompatibleClient,
  openAiSettings,
  modelName,
  normalizedBodyMessage
}: {
  openaiCompatibleClient: SessionOpenAi;
  openAiSettings: IOpenAi;
  modelName: string;
  normalizedBodyMessage: string;
}): Promise<string | null> => {
  const recoveryPrompt =
    'Responda APENAS com JSON valido no formato {"action":"none","messages":["mensagem objetiva em portugues"]}. Nao use markdown, nao use ingles, nao explique o raciocinio e nao escreva nada fora do JSON.';

  const recoveryMessages = [
    { role: "system" as const, content: recoveryPrompt },
    {
      role: "user" as const,
      content: `Mensagem do cliente: ${normalizedBodyMessage}`
    }
  ];

  const recoverySettings: IOpenAi = {
    ...openAiSettings,
    temperature: 0.2,
    maxTokens: Math.max(toNumber(openAiSettings.maxTokens, 1000), 300)
  };

  const recovered = await requestOpenAICompletion(
    openaiCompatibleClient,
    recoveryMessages,
    recoverySettings,
    modelName
  );

  if (!recovered) return null;

  const structured = parseStructuredAiOutput(
    stripReasoningFromRawResponse(recovered),
    resolveAutoResponseMessageLimit()
  );

  if (
    hasInvalidStructuredReply(structured.messages) ||
    hasDeepseekLanguageLeak(structured.messages)
  ) {
    return null;
  }

  return recovered;
};

// ===== orquestração =====
export const handleOpenAi = async (
  openAiSettings: IOpenAi,
  msg: proto.IWebMessageInfo,
  wbot: Session,
  ticket: Ticket,
  contact: Contact,
  mediaSent: Message | undefined,
  ticketTraking: TicketTraking
): Promise<void> => {
  const bodyMessage = getBodyMessage(msg);

  // Marca o ticket atual como atendimento por IA.
  // Mantemos isso no próprio ticket para o frontend identificar sem inferir pela conexão inteira.
  if (!ticket.useIntegration) {
    try {
      await ticket.update({ useIntegration: true });
    } catch (_) {
      // Não bloqueia o fluxo de resposta por falha transitória de update.
    }
  }

  // 🔹 permite reativar o BOT enviando "#"
  if (disabledAIBotTickets.has(ticket.id)) {
    if (bodyMessage && bodyMessage.trim() === "#") {
      disabledAIBotTickets.delete(ticket.id);
      // mensagem opcional avisando que voltou para o bot
      await sleep(randomInt(DEFAULT_AI_DELAY_MIN_SECONDS, DEFAULT_AI_DELAY_MAX_SECONDS) * 1000);
      const sent = await wbot.sendMessage(msg.key.remoteJid!, {
        text: "Bot reativado. Como posso ajudar você novamente?"
      });
      try {
        await verifyMessage(sent!, ticket, contact);
      } catch (_) { }
    } else {
      // se não mandou "#", não responde mais enquanto estiver em atendimento humano
      return;
    }
  }

  if (!bodyMessage && !msg.message?.audioMessage && !msg.message?.imageMessage) return;
  if (!openAiSettings) return;
  if (msg.messageStubType) return;

  const publicFolder: string = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "public",
    `company${ticket.companyId}`
  );


  // ===== detecção do provedor =====
  const modelName = normalizeModelName(openAiSettings.model);
  if (modelName !== (openAiSettings.model || "").trim()) {
    console.warn(
      `[AI] Modelo "${openAiSettings.model}" foi normalizado para "${modelName}".`
    );
  }
  const cleanedKey = cleanApiKey(openAiSettings.apiKey);
  const provider = resolveAIProvider(
    openAiSettings.provider,
    modelName,
    cleanedKey
  );
  const isGeminiModel = provider === "gemini";
  const isOpenAICompatibleModel = isOpenAICompatibleProvider(provider);

  let openaiCompatibleClient: SessionOpenAi | null = null;
  let gemini: SessionGemini | null = null;

  if (isOpenAICompatibleModel) {
    const baseURL = getOpenAICompatibleBaseURL(provider);
    const sessionKey = `${provider}:${baseURL || "default"}:${cleanedKey}`;
    const openAiIndex = sessionsOpenAi.findIndex(s => s.id === ticket.id);
    if (
      openAiIndex === -1 ||
      sessionsOpenAi[openAiIndex].apiKeyValue !== sessionKey
    ) {
      openaiCompatibleClient = new OpenAI({
        apiKey: cleanedKey,
        ...(baseURL ? { baseURL } : {})
      }) as SessionOpenAi;
      openaiCompatibleClient.id = ticket.id;
      openaiCompatibleClient.apiKeyValue = sessionKey;
      if (openAiIndex === -1) {
        sessionsOpenAi.push(openaiCompatibleClient);
      } else {
        sessionsOpenAi[openAiIndex] = openaiCompatibleClient;
      }
    } else {
      openaiCompatibleClient = sessionsOpenAi[openAiIndex];
    }
  } else if (isGeminiModel) {
    const geminiIndex = sessionsGemini.findIndex(s => s.id === ticket.id);
    if (
      geminiIndex === -1 ||
      sessionsGemini[geminiIndex].apiKeyValue !== cleanedKey
    ) {
      gemini = new GoogleGenerativeAI(cleanedKey) as SessionGemini;
      gemini.id = ticket.id;
      gemini.apiKeyValue = cleanedKey;
      if (geminiIndex === -1) {
        sessionsGemini.push(gemini);
      } else {
        sessionsGemini[geminiIndex] = gemini;
      }
    } else {
      gemini = sessionsGemini[geminiIndex];
    }
  } else {
    console.error(
      `Unsupported model or API key: model=${openAiSettings.model}, key=${cleanedKey.slice(
        0,
        5
      )}***`
    );
    return;
  }

  if (msg.message?.audioMessage && provider === "deepseek") {
    const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
      text: buildDeepseekAudioUnsupportedMessage()
    });

    try {
      await verifyMessage(sentMessage!, ticket, contact);
    } catch (e: any) {
      if ((e?.message || e) !== "ERR_UPDATE_TICKET") {
        console.warn("verifyMessage falhou ao responder audio do DeepSeek:", e?.message || e);
      }
    }

    return;
  }

  if (msg.message?.imageMessage && !providerSupportsVision(provider)) {
    const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
      text: buildVisionUnsupportedMessage()
    });

    try {
      await verifyMessage(sentMessage!, ticket, contact);
    } catch (e: any) {
      if ((e?.message || e) !== "ERR_UPDATE_TICKET") {
        console.warn("verifyMessage falhou ao responder imagem não suportada:", e?.message || e);
      }
    }

    return;
  }

  // OpenAI para transcrição (compatibilidade com config antiga)
  if (provider === "openai" && openAiSettings.openAiApiKey && !openaiCompatibleClient) {
    const cleanedTranscriptionKey = cleanApiKey(
      openAiSettings.openAiApiKey || openAiSettings.apiKey
    );
    const openAiIndex = sessionsOpenAi.findIndex(s => s.id === ticket.id);
    if (
      openAiIndex === -1 ||
      sessionsOpenAi[openAiIndex].apiKeyValue !== `openai:default:${cleanedTranscriptionKey}`
    ) {
      openaiCompatibleClient = new OpenAI({
        apiKey: cleanedTranscriptionKey
      }) as SessionOpenAi;
      openaiCompatibleClient.id = ticket.id;
      openaiCompatibleClient.apiKeyValue = `openai:default:${cleanedTranscriptionKey}`;
      if (openAiIndex === -1) {
        sessionsOpenAi.push(openaiCompatibleClient);
      } else {
        sessionsOpenAi[openAiIndex] = openaiCompatibleClient;
      }
    } else {
      openaiCompatibleClient = sessionsOpenAi[openAiIndex];
    }
  }

  // histórico
  // isPrivate: false — mensagens internas (leitura de imagem, transcrição de áudio,
  // avisos de erro) não podem ser tratadas como falas reais do assistente ao cliente.
  const messages = await Message.findAll({
    where: { ticketId: ticket.id, isPrivate: false },
    order: [["createdAt", "DESC"]],
    limit: openAiSettings.maxMessages
  });

  // Pegamos as últimas mensagens (DESC) e reordenamos para manter o contexto cronológico
  messages.reverse();


  // prompt de sistema
  const clientName = sanitizeName(contact.name || "Amigo(a)");
  const assistantName = sanitizeName(openAiSettings.name || "Assistente");
  const maxResponseMessages = resolveAutoResponseMessageLimit();

  // Catálogo é único por empresa, compartilhado entre o assistente
  // geral de /prompts e qualquer nó de IA do flowbuilder.
  let fileCatalog: PromptFiles[] = [];
  try {
    fileCatalog = await PromptFiles.findAll({
      where: { companyId: ticket.companyId }
    });
  } catch (err) {
    console.error("Falha ao buscar catálogo de arquivos da IA:", err);
  }

  const fileCatalogText = fileCatalog.length
    ? `\nArquivos disponíveis para envio (use "send_file" com o "fileId" exato quando o cliente pedir ou quando fizer sentido; NUNCA invente um fileId que não esteja nesta lista):\n${JSON.stringify(
        fileCatalog.map(f => ({ fileId: f.id, name: f.name, description: f.description }))
      )}\n`
    : "";

  const promptSystem = `RULE #1 — OUTPUT FORMAT: Your response MUST start with the character { and end with }. Nothing before {. Nothing after }. No markdown. No thinking. No reasoning. Output valid JSON immediately.

JSON structure:
{"action":"none","messages":["mensagem em português"]}
${fileCatalog.length ? 'When sending a file: {"action":"send_file","fileId":<id from the catalog below>,"messages":["legenda curta em português"]}' : ""}

ABSOLUTE PROHIBITIONS — never do any of the following:
- Do NOT write reasoning, analysis or thinking in any language — not in English, not in Portuguese.
- Do NOT wrap any text in parentheses like (thinking...) or (analysis...) or (reasoning...).
- Do NOT explain what you are about to say or do. Just say it.
- Do NOT reference the customer in third person as part of your output (e.g. "O cliente respondeu", "Ele demonstrou interesse").
- Do NOT put any text outside the JSON object.
- Do NOT use <think> tags or any other reasoning markup.

Rules:
- "action" is "none", "transfer_to_human"${fileCatalog.length ? ' or "send_file"' : ""} only.
- "messages" contains ONLY short Portuguese sentences addressed directly to the customer. Never put reasoning or analysis inside "messages".
- Use as few messages as needed. Never exceed ${maxResponseMessages} messages.
- Keep each message concise and direct.
- End with a clear question to advance the conversation when not transferring.
${fileCatalog.length ? '- "send_file" must always include a "fileId" that exists in the catalog below and at least one message in "messages" as the file caption. Never use "send_file" if no catalog file matches the request.' : ""}

Transfer to human ONLY when the customer explicitly says (e.g.): "falar com atendente", "quero atendimento humano", "me transfira", "falar com humano", "quero falar com uma pessoa". Never transfer for any other reason.

Customer name: ${clientName}
Assistant name: ${assistantName}
Never identify yourself as the customer. If greeting, address ${clientName} as the customer.
${fileCatalogText}
${fileCatalog.length ? "The file catalog above is only a list of files YOU can send to the customer. It has no relation whatsoever to images/photos the customer sends you. When describing or commenting on an image sent by the customer, rely EXCLUSIVELY on the '[Imagem enviada pelo cliente: ...]' description provided in the conversation — never assume it matches any catalog item's name or description unless the customer explicitly says so.\n" : ""}
Specific instructions:
${openAiSettings.prompt}

FINAL RULE: Output ONLY the JSON object. Start with {. End with }. No text outside the JSON. No parentheses wrapping any content.`;

  // texto
  if (msg.message?.conversation || msg.message?.extendedTextMessage?.text) {
    await sleep(AI_USER_BURST_WAIT_MS);
    const currentInboundId = normalizeText(String(msg?.key?.id || ""));
    const latestInboundMessage = await Message.findOne({
      where: {
        ticketId: ticket.id,
        fromMe: false
      },
      order: [["createdAt", "DESC"], ["id", "DESC"]]
    });

    if (latestInboundMessage && currentInboundId) {
      const latestWid = normalizeText(String((latestInboundMessage as any)?.wid || ""));
      const latestMessageId = normalizeText(
        String((latestInboundMessage as any)?.messageId || "")
      );
      const isCurrentTurnStillLatest =
        latestWid === currentInboundId || latestMessageId === currentInboundId;

      if (!isCurrentTurnStillLatest) {
        return;
      }
    }

    const messagesAI = prepareMessagesAI(messages, isGeminiModel, promptSystem);
    const normalizedBodyMessage = normalizeText(String(bodyMessage || ""));
    const lastHistoryItem = messagesAI[messagesAI.length - 1];
    const historyAlreadyContainsCurrentUserTurn =
      Boolean(normalizedBodyMessage) &&
      lastHistoryItem?.role === "user" &&
      normalizeText(String(lastHistoryItem?.content || "")) === normalizedBodyMessage;

    try {
      let responseText: string | null = null;

      if (isOpenAICompatibleModel && openaiCompatibleClient) {
        if (!historyAlreadyContainsCurrentUserTurn) {
          messagesAI.push({ role: "user", content: normalizedBodyMessage });
        }
        responseText = await requestOpenAICompletion(
          openaiCompatibleClient,
          messagesAI,
          openAiSettings,
          modelName
        );

        // Remove blocos <think>...</think> antes de qualquer parsing
        if (responseText) responseText = stripReasoningFromRawResponse(responseText);

        let structuredOpenAIOutput = parseStructuredAiOutput(
          responseText || "",
          resolveAutoResponseMessageLimit()
        );
        const firstOpenAIReply = normalizeText(
          structuredOpenAIOutput.messages?.[0] || ""
        );

        const responseIsLeakedReasoning =
          hasLeakedInternalReasoning(structuredOpenAIOutput.messages) ||
          // If parsedOutput fell back to raw text and it starts with English reasoning patterns
          (!structuredOpenAIOutput.messages.some(m => m.trimStart().startsWith("{")) &&
            /^(we |i need|let me|the (customer|user|client)|here (is|are)|to respond|my response|in (this|the) (case|situation))/i
              .test(normalizeText(responseText || "")));
        const deepseekLanguageLeak =
          provider === "deepseek" &&
          hasDeepseekLanguageLeak(structuredOpenAIOutput.messages);

        const openAIOutputNeedsRepair =
          hasInvalidStructuredReply(structuredOpenAIOutput.messages) ||
          isLowQualitySingleReply(firstOpenAIReply) ||
          responseIsLeakedReasoning ||
          deepseekLanguageLeak;

        if (openAIOutputNeedsRepair) {
          console.warn(`[AI:${provider}] output needs repair`, {
            isLeakedReasoning: responseIsLeakedReasoning,
            hasLanguageLeak: deepseekLanguageLeak,
            messages: structuredOpenAIOutput.messages.slice(0, 2)
          });

          // Before making another API call, try to extract Portuguese content
          // from the reasoning text (e.g. model output: 'Something like "Olá!..."').
          const salvaged = extractPortugueseFromReasoningText(responseText || "");
          if (salvaged) {
            responseText = JSON.stringify({ action: "none", messages: [salvaged] });
          } else {
            // Salvage failed — make a targeted repair call.
            const repairMessages = messagesAI.concat([
              {
                role: "user" as const,
                content: `Resposta inválida. Responda APENAS com JSON. Primeira resposta deve ser { e última deve ser }. Formato: {"action":"none","messages":["sua resposta em português"]}. Mensagem do cliente: ${normalizedBodyMessage}`
              }
            ]);

            const initialResponseText = responseText;
            responseText = await requestOpenAICompletion(
              openaiCompatibleClient,
              repairMessages,
              openAiSettings,
              modelName
            );

            structuredOpenAIOutput = parseStructuredAiOutput(
              responseText || "",
              resolveAutoResponseMessageLimit()
            );

            if (
              hasInvalidStructuredReply(structuredOpenAIOutput.messages) ||
              (provider === "deepseek" &&
                hasDeepseekLanguageLeak(structuredOpenAIOutput.messages))
            ) {
              // Repair also failed — try to salvage from the repair response.
              const salvagedRepair = extractPortugueseFromReasoningText(responseText || "");
              if (salvagedRepair) {
                console.warn(`[AI:${provider}] using salvaged content from repair response`);
                responseText = JSON.stringify({ action: "none", messages: [salvagedRepair] });
              } else {
                // Last resort: use initial response if it had any parseable content.
                const initialParsed = parseStructuredAiOutput(initialResponseText || "", resolveAutoResponseMessageLimit());
                if (!hasInvalidStructuredReply(initialParsed.messages)) {
                  console.warn(`[AI:${provider}] repair failed; using initial response`);
                  responseText = initialResponseText;
                } else if (provider === "deepseek") {
                  const deepseekRecovered = await tryDeepseekRecovery({
                    openaiCompatibleClient,
                    openAiSettings,
                    modelName,
                    normalizedBodyMessage
                  });

                  if (deepseekRecovered) {
                    console.warn("[AI:deepseek] using deepseek-specific recovery response");
                    responseText = deepseekRecovered;
                  } else {
                    console.warn(`[AI:${provider}] all recovery attempts failed; using safe fallback`);
                    responseText = safeGeminiFallbackJson(normalizedBodyMessage);
                  }
                } else {
                  console.warn(`[AI:${provider}] all recovery attempts failed; using safe fallback`);
                  responseText = safeGeminiFallbackJson(normalizedBodyMessage);
                }
              }
            }
          }
        }
      } else if (isGeminiModel && gemini) {
        const geminiHistory = historyAlreadyContainsCurrentUserTurn
          ? messagesAI.slice(0, -1)
          : messagesAI;
        const lastAssistantMessage = getLastAssistantMessage(geminiHistory);
        responseText = await requestGeminiCompletion(
          gemini,
          geminiHistory,
          openAiSettings,
          modelName,
          normalizedBodyMessage,
          promptSystem,
          lastAssistantMessage,
          {
            buildGeminiGenerationConfig,
            normalizeText,
            isRetryableGeminiError,
            randomInt,
            parseStructuredAiOutput,
            resolveAutoResponseMessageLimit,
            isLowQualitySingleReply,
            hasInvalidStructuredReply,
            safeGeminiFallbackJson,
            isLikelyRepeatedAnswer
          }
        );
      }

      if (!responseText) {
        console.error("No response from AI provider");
        await notifyInternalAIError({
          ticket,
          contact,
          context: "resposta vazia do provedor"
        });
        return;
      }

      await processResponse(
        responseText,
        wbot,
        msg,
        ticket,
        contact,
        openAiSettings,
        ticketTraking,
        bodyMessage || ""
      );
    } catch (error: any) {
      const isTicketErr =
        (error?.message || error) === "ERR_UPDATE_TICKET" ||
        error?.body === "ERR_UPDATE_TICKET" ||
        error?.errMsg === "ERR_UPDATE_TICKET_QUEUE_NOT_FOUND";

      if (isTicketErr) {
        console.error(
          "Ticket update falhou durante resposta da IA (não é erro da IA)."
        );
        return;
      }

      console.error("AI request failed:", {
        provider,
        status: error?.status || error?.response?.status,
        body: error?.body || error?.response?.data || error?.message
      });
      await notifyInternalAIError({
        ticket,
        contact,
        context: `falha na requisição (${provider})`,
        error
      });
      return;
    }
  }
  // áudio
  else if (msg.message?.audioMessage && mediaSent) {
    const messagesAI = prepareMessagesAI(messages, isGeminiModel, promptSystem);

    try {
      const mediaUrl = mediaSent.mediaUrl!.split("/").pop();
      const audioFilePath = `${publicFolder}/${mediaUrl}`;

      if (!fs.existsSync(audioFilePath)) {
        console.error(`Arquivo de áudio não encontrado: ${audioFilePath}`);
        await notifyInternalAIError({
          ticket,
          contact,
          context: "arquivo de áudio não encontrado"
        });
        return;
      }

      let transcription: string | null = null;

      if (!providerSupportsTranscription(provider)) {
        await notifyInternalAIError({
          ticket,
          contact,
          context: `provedor ${provider} nao suporta transcricao de audio`
        });
        return;
      }

      if (isOpenAICompatibleModel && openaiCompatibleClient) {
        const file = fs.createReadStream(audioFilePath) as any;
        const transcriptionModel =
          provider === "groq"
            ? TRANSCRIPTION_PROVIDER_MODELS.groq
            : TRANSCRIPTION_PROVIDER_MODELS.openai;
        const transcriptionResult = await openaiCompatibleClient.audio.transcriptions.create({
          model: transcriptionModel,
          file: file
        });
        transcription = transcriptionResult.text;

        await registerInternalAudioTranscription({
          ticket,
          contact,
          transcription
        });

        await sleep(randomInt(DEFAULT_AI_DELAY_MIN_SECONDS, DEFAULT_AI_DELAY_MAX_SECONDS) * 1000);

        messagesAI.push({ role: "user", content: transcription });
        const responseText = await requestOpenAICompletion(
          openaiCompatibleClient,
          messagesAI,
          openAiSettings,
          modelName
        );
        if (responseText) {
          await processResponse(
            responseText,
            wbot,
            msg,
            ticket,
            contact,
            openAiSettings,
            ticketTraking,
            transcription || ""
          );
        }
      } else if (isGeminiModel && gemini) {
        const generationConfig = buildGeminiGenerationConfig(openAiSettings);
        const model = gemini.getGenerativeModel({
          model: modelName,
          generationConfig,
          systemInstruction: promptSystem
            ? { role: "system", parts: [{ text: promptSystem }] }
            : undefined
        });

        const audioFileBase64 = fs.readFileSync(audioFilePath, {
          encoding: "base64"
        });
        const fileExtension = path.extname(audioFilePath).toLowerCase();

        let mimeType = "audio/mpeg";
        switch (fileExtension) {
          case ".wav":
            mimeType = "audio/wav";
            break;
          case ".mp3":
            mimeType = "audio/mpeg";
            break;
          case ".aac":
            mimeType = "audio/aac";
            break;
          case ".ogg":
            mimeType = "audio/ogg";
            break;
          case ".flac":
            mimeType = "audio/flac";
            break;
          case ".aiff":
            mimeType = "audio/aiff";
            break;
        }

        const transcriptionRequest = await model.generateContent({
          contents: [
            {
              role: "user",
              parts: [
                { text: "Gere uma transcrição precisa deste áudio." },
                { inlineData: { mimeType, data: audioFileBase64 } }
              ]
            }
          ]
        });

        transcription = transcriptionRequest.response.text();

        await registerInternalAudioTranscription({
          ticket,
          contact,
          transcription
        });

        await sleep(randomInt(DEFAULT_AI_DELAY_MIN_SECONDS, DEFAULT_AI_DELAY_MAX_SECONDS) * 1000);

        const responseText = await requestGeminiCompletion(
          gemini,
          messagesAI,
          openAiSettings,
          modelName,
          transcription,
          promptSystem,
          getLastAssistantMessage(messagesAI),
          {
            buildGeminiGenerationConfig,
            normalizeText,
            isRetryableGeminiError,
            randomInt,
            parseStructuredAiOutput,
            resolveAutoResponseMessageLimit,
            isLowQualitySingleReply,
            hasInvalidStructuredReply,
            safeGeminiFallbackJson,
            isLikelyRepeatedAnswer
          }
        );
        if (responseText) {
          await processResponse(
            responseText,
            wbot,
            msg,
            ticket,
            contact,
            openAiSettings,
            ticketTraking,
            transcription || ""
          );
        }
      }

      if (!transcription) {
        console.warn("Transcrição vazia recebida");
        await notifyInternalAIError({
          ticket,
          contact,
          context: "transcrição de áudio vazia"
        });
        return;
      }
    } catch (error: any) {
      console.error("Erro no processamento de áudio:", error);
      await notifyInternalAIError({
        ticket,
        contact,
        context: "falha no processamento de áudio",
        error
      });
      return;
    }
  }
  // imagem (visão)
  else if (msg.message?.imageMessage && mediaSent) {
    const messagesAI = prepareMessagesAI(messages, isGeminiModel, promptSystem);

    try {
      const mediaUrl = mediaSent.mediaUrl!.split("/").pop();
      const imageFilePath = `${publicFolder}/${mediaUrl}`;

      if (!fs.existsSync(imageFilePath)) {
        console.error(`Arquivo de imagem não encontrado: ${imageFilePath}`);
        await notifyInternalAIError({
          ticket,
          contact,
          context: "arquivo de imagem não encontrado"
        });
        return;
      }

      const imageCaption = normalizeText(
        String(msg.message?.imageMessage?.caption || "")
      );
      const imageMimeType = msg.message?.imageMessage?.mimetype || "image/jpeg";
      const imageBase64 = fs.readFileSync(imageFilePath, { encoding: "base64" });
      const visionPrompt = `Descreva o conteúdo desta imagem em detalhes, considerando que é uma conversa de atendimento ao cliente. Se houver texto na imagem, transcreva-o literalmente.${imageCaption ? ` Legenda enviada pelo cliente: "${imageCaption}"` : ""}`;

      let description: string | null = null;

      if (isOpenAICompatibleModel && openaiCompatibleClient) {
        const chat = await openaiCompatibleClient.chat.completions.create({
          model: VISION_PROVIDER_MODELS.openai,
          max_tokens: 500,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: visionPrompt },
                {
                  type: "image_url",
                  image_url: { url: `data:${imageMimeType};base64,${imageBase64}` }
                }
              ]
            }
          ] as any
        });
        description = extractOpenAICompatibleText(chat);
      } else if (isGeminiModel && gemini) {
        const model = gemini.getGenerativeModel({ model: modelName });
        const visionRequest = await model.generateContent({
          contents: [
            {
              role: "user",
              parts: [
                { text: visionPrompt },
                { inlineData: { mimeType: imageMimeType, data: imageBase64 } }
              ]
            }
          ]
        });
        description = visionRequest.response.text();
      }

      if (!description) {
        console.warn("Descrição de imagem vazia recebida");
        await notifyInternalAIError({
          ticket,
          contact,
          context: "leitura de imagem vazia"
        });
        return;
      }

      await registerInternalImageDescription({ ticket, contact, description });

      await sleep(randomInt(DEFAULT_AI_DELAY_MIN_SECONDS, DEFAULT_AI_DELAY_MAX_SECONDS) * 1000);

      const userTurnContent = imageCaption
        ? `${imageCaption}\n\n[Imagem enviada pelo cliente: ${description}]`
        : `[Imagem enviada pelo cliente: ${description}]`;

      if (isOpenAICompatibleModel && openaiCompatibleClient) {
        messagesAI.push({ role: "user", content: userTurnContent });
        const responseText = await requestOpenAICompletion(
          openaiCompatibleClient,
          messagesAI,
          openAiSettings,
          modelName
        );
        if (responseText) {
          await processResponse(
            responseText,
            wbot,
            msg,
            ticket,
            contact,
            openAiSettings,
            ticketTraking,
            userTurnContent
          );
        }
      } else if (isGeminiModel && gemini) {
        const responseText = await requestGeminiCompletion(
          gemini,
          messagesAI,
          openAiSettings,
          modelName,
          userTurnContent,
          promptSystem,
          getLastAssistantMessage(messagesAI),
          {
            buildGeminiGenerationConfig,
            normalizeText,
            isRetryableGeminiError,
            randomInt,
            parseStructuredAiOutput,
            resolveAutoResponseMessageLimit,
            isLowQualitySingleReply,
            hasInvalidStructuredReply,
            safeGeminiFallbackJson,
            isLikelyRepeatedAnswer
          }
        );
        if (responseText) {
          await processResponse(
            responseText,
            wbot,
            msg,
            ticket,
            contact,
            openAiSettings,
            ticketTraking,
            userTurnContent
          );
        }
      }
    } catch (error: any) {
      console.error("Erro no processamento de imagem:", error);
      await notifyInternalAIError({
        ticket,
        contact,
        context: "falha no processamento de imagem",
        error
      });
      return;
    }
  }
};
