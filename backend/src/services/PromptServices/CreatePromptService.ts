import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Prompt from "../../models/Prompt";
import ShowPromptService from "./ShowPromptService";
import {
  AI_PROVIDER_MODELS,
  getDefaultModelByProvider,
  normalizeAIProvider,
  isSupportedProviderModel
} from "../../helpers/aiProviders";

interface PromptData {
  name: string;
  provider?: string;
  apiKey: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  queueId?: number;
  maxMessages?: number;
  maxResponseMessages?: number;
  companyId: string | number;
  voice?: string;
  voiceKey?: string;
  voiceRegion?: string;
  model: string; // Model is now required
}

const CreatePromptService = async (promptData: PromptData): Promise<Prompt> => {
  const {
    name,
    provider,
    apiKey,
    prompt,
    queueId,
    maxMessages,
    maxResponseMessages = 3,
    companyId,
    model,
    maxTokens,
    temperature,
    promptTokens,
    completionTokens,
    totalTokens,
    voice,
    voiceKey,
    voiceRegion
  } = promptData;

  const normalizedProvider = normalizeAIProvider(provider);
  const allowedModels = Object.values(AI_PROVIDER_MODELS).flat();
  const normalizedModel = String(model || "").trim() || getDefaultModelByProvider(normalizedProvider);

  const promptSchema = Yup.object().shape({
    name: Yup.string()
      .min(5, "ERR_PROMPT_NAME_MIN")
      .max(100, "ERR_PROMPT_NAME_MAX")
      .required("ERR_PROMPT_NAME_INVALID"),
    prompt: Yup.string()
      .min(50, "ERR_PROMPT_INTELLIGENCE_MIN")
      .required("ERR_PROMPT_INTELLIGENCE_INVALID"),
    apiKey: Yup.string().required("ERR_PROMPT_APIKEY_INVALID"),
    queueId: Yup.number().required("ERR_PROMPT_QUEUEID_INVALID"),
    maxMessages: Yup.number()
      .min(1, "ERR_PROMPT_MAX_MESSAGES_MIN")
      .max(50, "ERR_PROMPT_MAX_MESSAGES_MAX")
      .required("ERR_PROMPT_MAX_MESSAGES_INVALID"),
    maxResponseMessages: Yup.number()
      .min(1, "ERR_PROMPT_MAX_RESPONSE_MESSAGES_MIN")
      .max(3, "ERR_PROMPT_MAX_RESPONSE_MESSAGES_MAX")
      .required("ERR_PROMPT_MAX_RESPONSE_MESSAGES_INVALID"),
    companyId: Yup.number().required("ERR_PROMPT_companyId_INVALID"),
    provider: Yup.string()
      .oneOf(Object.keys(AI_PROVIDER_MODELS), "ERR_PROMPT_PROVIDER_INVALID")
      .required("ERR_PROMPT_PROVIDER_REQUIRED"),
    model: Yup.string()
      .oneOf(allowedModels, "ERR_PROMPT_MODEL_INVALID")
      .required("ERR_PROMPT_MODEL_REQUIRED"),
    maxTokens: Yup.number()
      .min(10, "ERR_PROMPT_MAX_TOKENS_MIN")
      .max(4096, "ERR_PROMPT_MAX_TOKENS_MAX")
      .required("ERR_PROMPT_MAX_TOKENS_REQUIRED"),
    temperature: Yup.number()
      .min(0, "ERR_PROMPT_TEMPERATURE_MIN")
      .max(1, "ERR_PROMPT_TEMPERATURE_MAX")
      .required("ERR_PROMPT_TEMPERATURE_REQUIRED"),
    voice: Yup.string().when("model", {
      is: (val: string) => val === "gpt-3.5-turbo-1106",
      then: Yup.string().required("ERR_PROMPT_VOICE_REQUIRED"),
      otherwise: Yup.string().notRequired()
    })
  });

  try {
    await promptSchema.validate(
      {
        name,
        apiKey,
        prompt,
        queueId,
        maxMessages,
        maxResponseMessages,
        companyId,
        provider: normalizedProvider,
        model: normalizedModel,
        maxTokens,
        temperature,
        voice
      },
      { abortEarly: false }
    );
  } catch (err) {
    throw new AppError(`${JSON.stringify(err, undefined, 2)}`);
  }

  if (!isSupportedProviderModel(normalizedProvider, normalizedModel)) {
    throw new AppError("ERR_PROMPT_MODEL_INVALID");
  }

  let promptTable = await Prompt.create({
    name,
    provider: normalizedProvider,
    apiKey,
    prompt,
    queueId,
    maxMessages,
    maxResponseMessages,
    companyId,
    model: normalizedModel,
    maxTokens,
    temperature,
    promptTokens,
    completionTokens,
    totalTokens,
    voice,
    voiceKey,
    voiceRegion
  });

  promptTable = await ShowPromptService({ promptId: promptTable.id, companyId });

  return promptTable;
};

export default CreatePromptService;
