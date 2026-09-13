export const AI_PROVIDER_MODELS = {
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

export const ALL_AI_MODELS = Object.values(AI_PROVIDER_MODELS).flat();

export const AI_PROVIDER_LABELS = {
  openai: "OpenAI",
  gemini: "Google Gemini",
  deepseek: "DeepSeek",
  groq: "Groq"
};

export const AI_MODEL_LABELS = {
  "gpt-4.1-mini": "GPT 4.1 Mini",
  "gpt-4.1": "GPT 4.1",
  "gpt-4.1-nano": "GPT 4.1 Nano",
  "gpt-4o": "GPT 4o",
  "gpt-4o-mini": "GPT 4o Mini",
  "gpt-5": "GPT 5",
  "gpt-5-mini": "GPT 5 Mini",
  "gpt-5-nano": "GPT 5 Nano",
  "gpt-5.2": "GPT 5.2",
  "gemini-2.5-flash-lite": "Gemini 2.5 Flash-Lite",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-2.5-pro": "Gemini 2.5 Pro",
  "gemini-3-pro": "Gemini 3 Pro",
  "gemini-3-flash-preview": "Gemini 3 Flash Preview",
  "deepseek-v4-flash": "DeepSeek V4 Flash",
  "deepseek-v4-pro": "DeepSeek V4 Pro",
  "openai/gpt-oss-20b": "Groq GPT-OSS 20B",
  "openai/gpt-oss-120b": "Groq GPT-OSS 120B",
  "llama-3.1-8b-instant": "Groq Llama 3.1 8B Instant",
  "llama-3.3-70b-versatile": "Groq Llama 3.3 70B Versatile"
};

// Espelha backend/src/helpers/aiProviders.ts -> providerSupportsVision
export const PROVIDERS_WITH_VISION = ["openai", "gemini"];

export const providerSupportsVision = provider =>
  PROVIDERS_WITH_VISION.includes(normalizeAIProvider(provider));

export const normalizeAIProvider = (value) => {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "gemini") return "gemini";
  if (normalized === "deepseek") return "deepseek";
  if (normalized === "groq") return "groq";
  return "openai";
};

export const getDefaultModelByProvider = (provider) =>
  AI_PROVIDER_MODELS[normalizeAIProvider(provider)][0];

export const getProviderFromModel = (model) => {
  const normalized = String(model || "").trim().toLowerCase();

  if (normalized.startsWith("gemini-")) return "gemini";
  if (normalized.startsWith("deepseek-")) return "deepseek";
  if (
    normalized.startsWith("openai/") ||
    normalized.startsWith("llama-") ||
    normalized.startsWith("meta-llama/")
  ) {
    return "groq";
  }

  return "openai";
};
