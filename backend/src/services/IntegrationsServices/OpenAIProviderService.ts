import OpenAI from "openai";
import { normalizeAIProvider } from "../../helpers/aiProviders";

interface IOpenAiSettings {
  maxTokens: number;
  temperature: number;
  provider?: string;
}

export interface SessionOpenAi extends OpenAI {
  id?: number;
  apiKeyValue?: string;
}

const extractTextFromContentParts = (content: any): string => {
  if (typeof content === "string") return content.trim();

  if (Array.isArray(content)) {
    return content
      .map((part: any) => {
        if (typeof part === "string") return part;
        if (part?.type === "text" && typeof part?.text === "string") {
          return part.text;
        }
        if (typeof part?.content === "string") return part.content;
        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
};

export const extractOpenAICompatibleText = (chat: any): string => {
  const choice = chat?.choices?.[0];
  const message = choice?.message || {};
  const messageAny = message as any;

  const directContent = extractTextFromContentParts(message?.content);
  if (directContent) return directContent;

  const alternateCandidates = [
    message?.text,
    messageAny?.reasoning,
    messageAny?.reasoning_content,
    choice?.text,
    chat?.output_text
  ];

  for (const candidate of alternateCandidates) {
    const extracted = extractTextFromContentParts(candidate);
    if (extracted) return extracted;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }

  return "";
};

const toNumber = (value: any, fallback: number): number => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
};

const isGpt5FamilyModel = (modelName: string): boolean =>
  String(modelName || "").toLowerCase().startsWith("gpt-5");

export const requestOpenAICompletion = async (
  openai: SessionOpenAi,
  messagesAI: any[],
  openAiSettings: IOpenAiSettings,
  modelName: string
): Promise<string> => {
  try {
    const rawMaxTokens = toNumber(openAiSettings.maxTokens, 1000);
    // Ensure the model always has at least 300 tokens to produce a valid JSON response.
    // Low values (e.g. 100) cause the model to fill the budget with English reasoning
    // and never produce the actual JSON output.
    const maxTokens = Math.max(rawMaxTokens, 300);
    const provider = normalizeAIProvider(openAiSettings.provider);
    // Groq (LLaMA models) does not reliably support json_object mode and throws
    // json_validate_failed consistently — rely on the prompt for JSON structure instead.
    const supportsJsonMode = provider === "deepseek";

    const createCompletion = async (enableJsonMode: boolean) =>
      openai.chat.completions.create({
        model: modelName,
        messages: messagesAI,
        ...(isGpt5FamilyModel(modelName)
          ? { max_completion_tokens: maxTokens }
          : { max_tokens: maxTokens }),
        temperature: toNumber(openAiSettings.temperature, 0.7),
        ...((enableJsonMode && supportsJsonMode)
          ? { response_format: { type: "json_object" as const } }
          : {})
      });

    let chat: any;

    try {
      chat = await createCompletion(true);
    } catch (error: any) {
      const isJsonValidationFailure =
        supportsJsonMode &&
        String(error?.code || "").toLowerCase() === "json_validate_failed";

      if (!isJsonValidationFailure) {
        throw error;
      }

      console.warn(
        `OpenAI-compatible JSON mode validation failed for ${provider}; retrying without response_format.`
      );
      chat = await createCompletion(false);
    }

    const text = extractOpenAICompatibleText(chat);

    if (!text) {
      console.warn("OpenAI-compatible response came back without text content", {
        finishReason: chat?.choices?.[0]?.finish_reason,
        providerLikeId: chat?.id,
        contentType: Array.isArray(chat?.choices?.[0]?.message?.content)
          ? "array"
          : typeof chat?.choices?.[0]?.message?.content,
        hasReasoning: Boolean(
          (chat?.choices?.[0]?.message as any)?.reasoning ||
            (chat?.choices?.[0]?.message as any)?.reasoning_content
        )
      });
    }

    return text;
  } catch (error) {
    console.error("OpenAI request error:", error);
    throw error;
  }
};
