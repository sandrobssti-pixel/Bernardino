export interface IOpenAi {
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
  openAiApiKey?: string; // chave opcional específica para OpenAI (ex.: só para transcrição)
}
