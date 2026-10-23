import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

import AppError from "../../errors/AppError";
import Prompt from "../../models/Prompt";
import { extractOpenAICompatibleText } from "../IntegrationsServices/OpenAIProviderService";
import {
  AIProvider,
  getOpenAICompatibleBaseURL,
  isOpenAICompatibleProvider,
  normalizeAIProvider
} from "../../helpers/aiProviders";

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface Request {
  promptId: number | string;
  companyId: number;
  message: string;
  history?: HistoryMessage[];
}

const GEMINI_MAX_ATTEMPTS = 2;
const GEMINI_RETRY_DELAY_MS = 700;
const AI_REQUEST_TIMEOUT_MS = 20000;
const MAX_HISTORY_MESSAGES = 20;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> => {
  let timer: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new AppError(timeoutMessage, 504)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const isGpt5FamilyModel = (modelName: string): boolean =>
  String(modelName || "").toLowerCase().startsWith("gpt-5");

const normalizeProviderError = (provider: AIProvider, err: any): AppError => {
  if (err instanceof AppError) return err;

  const status = Number(
    err?.status || err?.statusCode || err?.response?.status || err?.error?.code || 0
  );
  const rawMessage = String(err?.message || "").toLowerCase();

  if (status === 429 || rawMessage.includes("rate limit") || rawMessage.includes("quota")) {
    return new AppError(`O provedor ${provider} atingiu limite temporário. Tente novamente em alguns segundos.`, 429);
  }

  if (status >= 500 || rawMessage.includes("timeout") || rawMessage.includes("deadline")) {
    return new AppError(`O provedor ${provider} está instável no momento. Tente novamente.`, 503);
  }

  return new AppError(`Falha ao testar o agente com ${provider}.`, 502);
};

const sanitizeHistory = (history?: HistoryMessage[]): HistoryMessage[] => {
  if (!Array.isArray(history)) return [];

  return history
    .filter(
      item =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim()
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map(item => ({ role: item.role, content: item.content.trim().slice(0, 2000) }));
};

// Testa a personalidade/instruções do Prompt num chat interno, sem nenhum
// efeito colateral no WhatsApp (sem Ticket, sem Contact, sem wbot) — não é
// o mesmo pipeline de `OpenAiService.handleOpenAi` (que exige JSON
// estruturado pra dividir mensagens/anexar arquivo do catálogo e tem
// efeitos reais de atendimento); aqui a IA responde em texto livre e
// natural, suficiente pra validar o comportamento/tom do agente.
const TestPromptService = async ({
  promptId,
  companyId,
  message,
  history
}: Request): Promise<string> => {
  const trimmedMessage = String(message || "").trim();

  if (!trimmedMessage) {
    throw new AppError("Mensagem vazia para teste.", 400);
  }

  if (trimmedMessage.length > 2000) {
    throw new AppError("Mensagem muito grande para teste (máximo 2000 caracteres).", 400);
  }

  const prompt = await Prompt.findOne({ where: { id: promptId, companyId } });

  if (!prompt) {
    throw new AppError("ERR_NO_PROMPT_FOUND", 404);
  }

  if (!prompt.apiKey) {
    throw new AppError("Este Assistente de IA ainda não tem uma API Key configurada.", 400);
  }

  const provider = normalizeAIProvider(prompt.provider);
  const model = prompt.model;
  const temperature = Number(prompt.temperature) || 0.7;
  const maxTokens = Math.max(Number(prompt.maxTokens) || 300, 300);

  const systemPrompt = [
    `Você é "${prompt.name}", um assistente de atendimento via WhatsApp.`,
    `Instruções do agente:`,
    prompt.prompt,
    ``,
    `Responda sempre em português do Brasil, de forma natural e direta, como faria numa conversa real de WhatsApp — sem formato JSON, sem markdown. Este é um ambiente de TESTE interno (não existe cliente real do outro lado), usado só para validar o comportamento do agente.`
  ].join("\n");

  const trimmedHistory = sanitizeHistory(history);

  if (provider === "gemini") {
    let lastError: any;

    for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt += 1) {
      try {
        const gemini = new GoogleGenerativeAI(prompt.apiKey);
        const modelApi = gemini.getGenerativeModel({
          model,
          generationConfig: { temperature, maxOutputTokens: maxTokens },
          systemInstruction: { role: "system", parts: [{ text: systemPrompt }] }
        });

        const geminiHistory = trimmedHistory.map(item => ({
          role: item.role === "assistant" ? "model" : "user",
          parts: [{ text: item.content }]
        }));

        while (geminiHistory.length > 0 && geminiHistory[0].role !== "user") {
          geminiHistory.shift();
        }

        const chat = modelApi.startChat({ history: geminiHistory });

        const result = await withTimeout(
          chat.sendMessage(trimmedMessage),
          AI_REQUEST_TIMEOUT_MS,
          "Tempo limite excedido ao consultar o Gemini."
        );

        const text = String(result?.response?.text?.() || "").trim();
        if (!text) {
          throw new AppError("Resposta vazia do Gemini.", 502);
        }

        return text;
      } catch (err: any) {
        lastError = err;
        const shouldRetry = attempt < GEMINI_MAX_ATTEMPTS;
        if (!shouldRetry) break;

        const isRetryable =
          err instanceof AppError ? [429, 502, 503, 504].includes(err.statusCode) : true;

        if (!isRetryable) break;
        await wait(GEMINI_RETRY_DELAY_MS * attempt);
      }
    }

    throw normalizeProviderError("gemini", lastError);
  }

  if (!isOpenAICompatibleProvider(provider)) {
    throw new AppError(`Provedor ${provider} não suportado pra teste.`, 400);
  }

  try {
    const baseURL = getOpenAICompatibleBaseURL(provider);
    const client = new OpenAI({
      apiKey: prompt.apiKey,
      ...(baseURL ? { baseURL } : {})
    });

    const maxTokensConfig = isGpt5FamilyModel(model)
      ? { max_completion_tokens: maxTokens }
      : { max_tokens: maxTokens };

    const completion = await withTimeout(
      client.chat.completions.create({
        model,
        temperature,
        ...maxTokensConfig,
        messages: [
          { role: "system", content: systemPrompt },
          ...trimmedHistory,
          { role: "user", content: trimmedMessage }
        ]
      }),
      AI_REQUEST_TIMEOUT_MS,
      "Tempo limite excedido ao consultar a OpenAI."
    );

    const reply = extractOpenAICompatibleText(completion);
    if (!reply) {
      throw new AppError("Não foi possível gerar uma resposta de teste.", 502);
    }

    return reply;
  } catch (err: any) {
    throw normalizeProviderError(provider, err);
  }
};

export default TestPromptService;
