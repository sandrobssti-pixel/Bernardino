import { GoogleGenerativeAI, Part } from "@google/generative-ai";

interface IOpenAiSettings {
  maxTokens: number;
  temperature: number;
}

export interface SessionGemini extends GoogleGenerativeAI {
  id?: number;
  apiKeyValue?: string;
}

interface GeminiProviderDeps {
  buildGeminiGenerationConfig: (openAiSettings: IOpenAiSettings) => {
    temperature: number;
    maxOutputTokens: number;
  };
  normalizeText: (value: string) => string;
  isRetryableGeminiError: (err: any) => boolean;
  randomInt: (min: number, max: number) => number;
  parseStructuredAiOutput: (
    raw: string,
    maxMessages: number
  ) => { action: string; messages: string[] };
  resolveAutoResponseMessageLimit: () => number;
  isLowQualitySingleReply: (value: string) => boolean;
  hasInvalidStructuredReply: (messages: string[]) => boolean;
  safeGeminiFallbackJson: (bodyMessage: string) => string;
  isLikelyRepeatedAnswer: (candidate: string, previous: string) => boolean;
}

export const requestGeminiCompletion = async (
  gemini: SessionGemini,
  messagesAI: any[],
  openAiSettings: IOpenAiSettings,
  modelName: string,
  bodyMessage: string,
  promptSystem: string,
  lastAssistantMessage: string,
  deps: GeminiProviderDeps
): Promise<string> => {
  try {
    const generationConfig = deps.buildGeminiGenerationConfig(openAiSettings);
    const geminiGenerationConfig = {
      ...generationConfig,
      responseMimeType: "application/json"
    };
    const model = gemini.getGenerativeModel({
      model: modelName,
      generationConfig: geminiGenerationConfig,
      systemInstruction: promptSystem
        ? { role: "system", parts: [{ text: promptSystem }] }
        : undefined
    });

    const geminiHistory = messagesAI
      .map(
        (msg: any): { role: "user" | "model"; parts: Part[] } => ({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: String(msg.content ?? "") }]
        })
      )
      .filter(item => Boolean(String((item.parts?.[0] as any)?.text ?? "").trim()));

    while (geminiHistory.length > 0 && geminiHistory[0].role !== "user") {
      geminiHistory.shift();
    }

    const chat = model.startChat({
      history: geminiHistory,
      generationConfig: geminiGenerationConfig
    });
    const requestBody = [
      `Mensagem do cliente: ${deps.normalizeText(bodyMessage)}`,
      `Responda SOMENTE em JSON válido no formato {"action":"none","messages":["..."]}.`,
      `Não use markdown, não inclua texto fora do JSON e não repita conteúdo já enviado.`
    ].join("\n");

    const sendGemini = async (input: string): Promise<string> => {
      const maxAttempts = 3;
      let lastErr: any = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const output = await chat.sendMessage(input);
          return output.response.text();
        } catch (err: any) {
          lastErr = err;
          if (!deps.isRetryableGeminiError(err) || attempt === maxAttempts) {
            throw err;
          }
          const waitMs = 1200 * attempt + deps.randomInt(150, 450);
          await new Promise(resolve => setTimeout(resolve, waitMs));
        }
      }

      throw lastErr;
    };

    let responseText = await sendGemini(requestBody);

    const firstPassStructured = deps.parseStructuredAiOutput(
      responseText || "",
      deps.resolveAutoResponseMessageLimit()
    );
    const firstPassFirstReply = deps.normalizeText(firstPassStructured.messages?.[0] || "");
    const firstPassInvalid =
      !firstPassStructured.messages?.length ||
      deps.isLowQualitySingleReply(firstPassFirstReply);

    if (firstPassInvalid) {
      const repairBody = [
        requestBody,
        `Sua saída anterior foi inválida ou incompleta: "${deps
          .normalizeText(responseText)
          .slice(0, 140)}"`,
        `Reenvie AGORA somente JSON válido, sem prefixo/sufixo, sem markdown e sem texto fora do JSON.`,
        `Não use frases como "Here is", "Here is the" ou "Aqui está".`
      ].join("\n");
      responseText = await sendGemini(repairBody);
    }

    let structured = deps.parseStructuredAiOutput(
      responseText || "",
      deps.resolveAutoResponseMessageLimit()
    );

    if (deps.hasInvalidStructuredReply(structured.messages)) {
      const hardRepairBody = [
        requestBody,
        `ÚLTIMA CHANCE: responda em PORTUGUÊS (pt-BR), sem inglês, e apenas JSON válido.`,
        `Formato obrigatório: {"action":"none","messages":["mensagem útil e objetiva"]}.`,
        `Proibido responder com prefixos como "Here is", "Here is the", "Aqui está".`
      ].join("\n");
      responseText = await sendGemini(hardRepairBody);
      structured = deps.parseStructuredAiOutput(
        responseText || "",
        deps.resolveAutoResponseMessageLimit()
      );
    }

    if (deps.hasInvalidStructuredReply(structured.messages)) {
      return deps.safeGeminiFallbackJson(bodyMessage);
    }

    const firstReply = deps.normalizeText(structured.messages?.[0] || "");
    if (
      firstReply &&
      lastAssistantMessage &&
      deps.isLikelyRepeatedAnswer(firstReply, lastAssistantMessage)
    ) {
      const retryBody = [
        requestBody,
        `Evite repetir a última resposta enviada ao cliente.`,
        `Última resposta enviada: "${deps.normalizeText(lastAssistantMessage)}"`,
        `Traga avanço objetivo da conversa com nova pergunta comercial.`
      ].join("\n");
      responseText = await sendGemini(retryBody);
    }

    return responseText;
  } catch (error) {
    console.error("Gemini request error:", error);
    throw error;
  }
};
