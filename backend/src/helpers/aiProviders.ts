export type AIProvider = "openai" | "gemini" | "deepseek" | "groq";

type ProviderModelsMap = Record<AIProvider, string[]>;

export const AI_PROVIDER_MODELS: ProviderModelsMap = {
  openai: [
    "gpt-4.1-mini",
    "gpt-4.1",
    "gpt-4.1-nano",
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-5.2"
  ],
  gemini: [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-3-pro",
    "gemini-3-flash-preview"
  ],
  deepseek: [
    "deepseek-v4-flash",
    "deepseek-v4-pro"
  ],
  groq: [
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile"
  ]
};

export const TRANSCRIPTION_PROVIDER_MODELS = {
  openai: "gpt-4o-transcribe",
  groq: "whisper-large-v3-turbo"
} as const;

const OPENAI_COMPATIBLE_PROVIDERS: AIProvider[] = ["openai", "deepseek", "groq"];

export const normalizeAIProvider = (value?: string | null): AIProvider => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "gemini") return "gemini";
  if (normalized === "deepseek") return "deepseek";
  if (normalized === "groq") return "groq";
  return "openai";
};

export const getDefaultModelByProvider = (providerValue?: string | null): string => {
  const provider = normalizeAIProvider(providerValue);
  return AI_PROVIDER_MODELS[provider][0];
};

export const isSupportedProviderModel = (
  providerValue: string | null | undefined,
  modelValue: string | null | undefined
): boolean => {
  const provider = normalizeAIProvider(providerValue);
  const model = String(modelValue || "").trim();
  return AI_PROVIDER_MODELS[provider].includes(model);
};

export const normalizeProviderModel = (
  providerValue: string | null | undefined,
  modelValue: string | null | undefined
): string => {
  const provider = normalizeAIProvider(providerValue);
  const model = String(modelValue || "").trim();

  if (AI_PROVIDER_MODELS[provider].includes(model)) {
    return model;
  }

  return getDefaultModelByProvider(provider);
};

export const inferAIProviderFromModel = (modelValue?: string | null): AIProvider => {
  const model = String(modelValue || "").trim().toLowerCase();

  if (model.startsWith("gemini-")) return "gemini";
  if (model.startsWith("deepseek-")) return "deepseek";
  if (
    model.startsWith("openai/") ||
    model.startsWith("llama-") ||
    model.startsWith("meta-llama/")
  ) {
    return "groq";
  }

  return "openai";
};

export const resolveAIProvider = (
  providerValue?: string | null,
  modelValue?: string | null,
  apiKeyValue?: string | null
): AIProvider => {
  const explicit = String(providerValue || "").trim();
  if (explicit) {
    return normalizeAIProvider(explicit);
  }

  const apiKey = String(apiKeyValue || "").trim();
  if (/^AIza/i.test(apiKey)) return "gemini";
  if (/^gsk_/i.test(apiKey)) return "groq";

  return inferAIProviderFromModel(modelValue);
};

export const isOpenAICompatibleProvider = (providerValue?: string | null): boolean =>
  OPENAI_COMPATIBLE_PROVIDERS.includes(normalizeAIProvider(providerValue));

export const getOpenAICompatibleBaseURL = (
  providerValue?: string | null
): string | undefined => {
  const provider = normalizeAIProvider(providerValue);

  if (provider === "deepseek") return "https://api.deepseek.com";
  if (provider === "groq") return "https://api.groq.com/openai/v1";
  return undefined;
};

export const providerSupportsTranscription = (
  providerValue?: string | null
): boolean => {
  const provider = normalizeAIProvider(providerValue);
  return provider === "openai" || provider === "gemini" || provider === "groq";
};

export const providerSupportsVision = (
  providerValue?: string | null
): boolean => {
  const provider = normalizeAIProvider(providerValue);
  return provider === "openai" || provider === "gemini";
};

export const VISION_PROVIDER_MODELS = {
  openai: "gpt-4o-mini"
} as const;
