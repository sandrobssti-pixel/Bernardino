import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import AppError from "../../errors/AppError";
import CompaniesSettings from "../../models/CompaniesSettings";
import { extractOpenAICompatibleText } from "../IntegrationsServices/OpenAIProviderService";
import {
  AIProvider,
  getDefaultModelByProvider,
  getOpenAICompatibleBaseURL,
  isOpenAICompatibleProvider,
  normalizeAIProvider,
  normalizeProviderModel
} from "../../helpers/aiProviders";

type Request = {
  companyId: number;
  inputText: string;
};

const GEMINI_MAX_ATTEMPTS = 3;
const GEMINI_RETRY_DELAY_MS = 700;
const AI_REQUEST_TIMEOUT_MS = 20000;

const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
};

const isGpt5FamilyModel = (modelName: string): boolean =>
  String(modelName || "").toLowerCase().startsWith("gpt-5");

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
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

const normalizeProviderError = (provider: AIProvider, err: any): AppError => {
  if (err instanceof AppError) return err;

  const status = Number(
    err?.status ||
    err?.statusCode ||
    err?.response?.status ||
    err?.error?.code ||
    0
  );
  const rawMessage = String(err?.message || "").toLowerCase();

  if (status === 429 || rawMessage.includes("rate limit") || rawMessage.includes("quota")) {
    return new AppError(`O provedor ${provider} atingiu limite temporário. Tente novamente em alguns segundos.`, 429);
  }

  if (status >= 500 || rawMessage.includes("timeout") || rawMessage.includes("deadline")) {
    return new AppError(`O provedor ${provider} está instável no momento. Tente novamente.`, 503);
  }

  return new AppError(`Falha ao gerar melhoria de texto com ${provider}.`, 502);
};

const ImproveTicketReplyService = async ({ companyId, inputText }: Request): Promise<string> => {
  const trimmedInput = String(inputText || "").trim();

  if (!trimmedInput) {
    throw new AppError("Texto vazio para melhoria.", 400);
  }

  if (trimmedInput.length > 4000) {
    throw new AppError("Texto muito grande para melhoria (máximo 4000 caracteres).", 400);
  }

  const companySettings = await CompaniesSettings.findOne({ where: { companyId } });

  if (!companySettings) {
    throw new AppError("Configurações da empresa não encontradas.", 404);
  }

  const enabled = String(companySettings.aiReplyEnabled || "disabled") === "enabled";
  if (!enabled) {
    throw new AppError("Assistente de IA está desabilitado para esta empresa.", 400);
  }

  const apiKey = String(companySettings.aiReplyApiKey || "").trim();
  if (!apiKey) {
    throw new AppError("API Key do assistente de IA não configurada.", 400);
  }

  const provider = normalizeAIProvider(companySettings.aiReplyProvider || "openai");
  const fallbackModel = getDefaultModelByProvider(provider);
  const configuredModel = String(companySettings.aiReplyModel || fallbackModel).trim();
  const model = normalizeProviderModel(provider, configuredModel);

  const temperature = clampNumber(companySettings.aiReplyTemperature, 0, 1, 0.4);
  const maxTokens = clampNumber(companySettings.aiReplyMaxTokens, 50, 4096, 300);

  const systemPrompt = String(companySettings.aiReplyPrompt || "").trim() ||
    "Melhore a mensagem do atendente para WhatsApp em português-BR, mantendo intenção e contexto. Retorne apenas o texto final, sem explicações.";

  if (provider === "gemini") {
    let lastError: any;

    for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt += 1) {
      try {
        const gemini = new GoogleGenerativeAI(apiKey);
        const modelApi = gemini.getGenerativeModel({
          model,
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens
          }
        });

        const result = await withTimeout(
          modelApi.generateContent([
            `${systemPrompt}\n\nTexto original:\n${trimmedInput}`
          ]),
          AI_REQUEST_TIMEOUT_MS,
          "Tempo limite excedido ao consultar o Gemini."
        );

        const text = String(result?.response?.text?.() || "").trim();
        if (!text) {
          throw new AppError("Resposta vazia do Gemini ao melhorar texto.", 502);
        }

        return text;
      } catch (err: any) {
        lastError = err;
        const shouldRetry = attempt < GEMINI_MAX_ATTEMPTS;
        if (!shouldRetry) break;

        const isRetryable =
          err instanceof AppError
            ? [429, 502, 503, 504].includes(err.statusCode)
            : true;

        if (!isRetryable) break;
        await wait(GEMINI_RETRY_DELAY_MS * attempt);
      }
    }

    throw normalizeProviderError("gemini", lastError);
  }

  if (!isOpenAICompatibleProvider(provider)) {
    throw new AppError(`Provedor ${provider} nao suportado para melhoria de texto.`, 400);
  }

  try {
    const baseURL = getOpenAICompatibleBaseURL(provider);
    const client = new OpenAI({
      apiKey,
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
          { role: "user", content: trimmedInput }
        ]
      }),
      AI_REQUEST_TIMEOUT_MS,
      "Tempo limite excedido ao consultar a OpenAI."
    );

    const improved = extractOpenAICompatibleText(completion);
    if (!improved) {
      throw new AppError("Não foi possível gerar melhoria para o texto informado.", 502);
    }

    return improved;
  } catch (err: any) {
    throw normalizeProviderError(provider, err);
  }
};

export default ImproveTicketReplyService;
