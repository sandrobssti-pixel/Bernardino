import fs from "fs";
import path from "path";
import FormData from "form-data";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Setting from "../../models/Setting";
import {
  TRANSCRIPTION_PROVIDER_MODELS,
  normalizeAIProvider,
  providerSupportsTranscription
} from "../../helpers/aiProviders";

interface Response {
  transcribedText: string;
}

class TranscribeAudioMessageService {
  private normalizeFileName(input: string): string {
    const raw = String(input || "").trim();
    if (!raw) return "";

    let candidate = raw;
    try {
      if (/^https?:\/\//i.test(raw)) {
        const parsed = new URL(raw);
        candidate = parsed.pathname || raw;
      }
    } catch {
      candidate = raw;
    }

    const decoded = decodeURIComponent(candidate);
    return path.basename(decoded);
  }

  private resolveMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const mimeByExt: Record<string, string> = {
      ".ogg": "audio/ogg",
      ".oga": "audio/ogg",
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".m4a": "audio/mp4",
      ".mp4": "audio/mp4",
      ".aac": "audio/aac",
      ".webm": "audio/webm"
    };

    return mimeByExt[ext] || "audio/ogg";
  }

  public async execute(
    fileName: string,
    companyId: number
  ): Promise<Response | { error: string }> {
    if (!fileName || typeof fileName !== "string") {
      return { error: "fileName é obrigatório e deve ser uma string." };
    }
    if (!companyId || typeof companyId !== "number") {
      return { error: "companyId é obrigatório e deve ser um número." };
    }

    const normalizedFileName = this.normalizeFileName(fileName);
    if (!normalizedFileName) {
      return { error: "Nome de arquivo inválido" };
    }

    const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
    const filePath = path.join(publicFolder, `company${companyId}`, normalizedFileName);

    if (!fs.existsSync(filePath)) {
      console.error(`Arquivo não encontrado: ${filePath}`);
      return { error: "Arquivo não encontrado" };
    }

    const [apiKeySetting, providerSetting] = await Promise.all([
      Setting.findOne({
        where: { key: "apiTranscription", companyId }
      }),
      Setting.findOne({
        where: { key: "transcriptionProvider", companyId }
      })
    ]);

    const apiKey = (apiKeySetting?.value || "").trim();
    if (!apiKey) {
      console.error(
        `Chave da API não encontrada para apiTranscription e companyId: ${companyId}`
      );
      return { error: "Chave da API não configurada" };
    }

    const providerValue = (providerSetting?.value || "").trim().toLowerCase();
    const transcriptionProvider = providerValue
      ? normalizeAIProvider(providerValue)
      : apiKey.startsWith("AIza")
        ? "gemini"
        : apiKey.startsWith("gsk_")
          ? "groq"
          : "openai";

    if (!providerSupportsTranscription(transcriptionProvider)) {
      return { error: `Provedor ${transcriptionProvider} nao suporta transcricao de audio` };
    }

    try {
      if (transcriptionProvider === "openai" || transcriptionProvider === "groq") {
        const form = new FormData();
        form.append("file", fs.createReadStream(filePath));
        form.append(
          "model",
          transcriptionProvider === "groq"
            ? TRANSCRIPTION_PROVIDER_MODELS.groq
            : TRANSCRIPTION_PROVIDER_MODELS.openai
        );
        form.append("response_format", "text");
        form.append("language", "pt");

        const response = await axios.post(
          transcriptionProvider === "groq"
            ? "https://api.groq.com/openai/v1/audio/transcriptions"
            : "https://api.openai.com/v1/audio/transcriptions",
          form,
          {
            headers: {
              ...form.getHeaders(),
              Authorization: `Bearer ${apiKey}`
            }
          }
        );

        return { transcribedText: response.data };
      }

      const audioBuffer = fs.readFileSync(filePath);
      const audioBase64 = audioBuffer.toString("base64");
      const mimeType = this.resolveMimeType(normalizedFileName);
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash"
      });

      const result = await model.generateContent([
        { text: "Transcreva este áudio em português do Brasil, apenas o texto da transcrição." },
        {
          inlineData: {
            mimeType,
            data: audioBase64
          }
        }
      ]);

      const text = result.response.text()?.trim();
      if (!text) {
        return { error: "Transcrição não disponível" };
      }

      return { transcribedText: text };
    } catch (error) {
      console.error(
        `Erro ao transcrever áudio para fileName: ${fileName}, companyId: ${companyId}`,
        error
      );
      return { error: "Conversão para texto falhou" };
    }
  }
}

export default TranscribeAudioMessageService;
