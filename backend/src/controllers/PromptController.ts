import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import CreatePromptService from "../services/PromptServices/CreatePromptService";
import DeletePromptService from "../services/PromptServices/DeletePromptService";
import ListPromptsService from "../services/PromptServices/ListPromptsService";
import ShowPromptService from "../services/PromptServices/ShowPromptService";
import UpdatePromptService from "../services/PromptServices/UpdatePromptService";
import TestPromptService from "../services/PromptServices/TestPromptService";
import Prompt from "../models/Prompt";
import Whatsapp from "../models/Whatsapp";
import { verify } from "jsonwebtoken";
import authConfig from "../config/auth";

// v2.3.195 — pedido do cliente (revisão do módulo Assistente IA): a chave
// de API de cada provedor (OpenAI/Gemini/DeepSeek/Groq) voltava em TEXTO
// PURO em toda resposta (listar, criar, editar) — inclusive no evento de
// socket emitido pra TODOS os clientes conectados da empresa a cada
// criação/edição, não só pra quem estava editando. Mesmo padrão já usado
// em `FiscalConfigService.maskConfig` (Resend): a chave nunca mais volta
// em texto puro pro frontend depois de salva — `apiKeyConfigured` avisa
// se já tem uma chave salva, sem expor o valor. Mascarado só AQUI (nível
// HTTP/controller) — o model/service continuam com o valor real, usado
// de verdade por `OpenAiService.ts` pra chamar a IA.
const maskPrompt = (prompt: Prompt): Record<string, unknown> => ({
  ...prompt.toJSON(),
  apiKey: "",
  apiKeyConfigured: !!prompt.apiKey
});

interface TokenPayload {
  id: string;
  username: string;
  profile: string;
  companyId: number;
  iat: number;
  exp: number;
}

type IndexQuery = {
  searchParam?: string;
  pageNumber?: string | number;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { pageNumber, searchParam } = req.query as IndexQuery;
  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const decoded = verify(token, authConfig.secret);
  const { companyId } = decoded as TokenPayload;
  const { prompts, count, hasMore } = await ListPromptsService({ searchParam, pageNumber, companyId });

  return res.status(200).json({ prompts: prompts.map(maskPrompt), count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const decoded = verify(token, authConfig.secret);
  const { companyId } = decoded as TokenPayload;
  const {
    name,
    provider,
    apiKey,
    prompt,
    maxTokens,
    temperature,
    promptTokens,
    completionTokens,
    totalTokens,
    queueId,
    maxMessages,
    maxResponseMessages,
    voice,
    voiceKey,
    voiceRegion,
    model,
  } = req.body;

  const promptTable = await CreatePromptService({
    name,
    provider,
    apiKey,
    prompt,
    maxTokens,
    temperature,
    promptTokens,
    completionTokens,
    totalTokens,
    queueId,
    maxMessages,
    maxResponseMessages,
    companyId,
    voice,
    voiceKey,
    voiceRegion,
    model,
  });

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-prompt`, {
    action: "update",
    prompt: maskPrompt(promptTable),
  });

  return res.status(200).json(maskPrompt(promptTable));
};


export const show = async (req: Request, res: Response): Promise<Response> => {
  const { promptId } = req.params;
  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const decoded = verify(token, authConfig.secret);
  const { companyId } = decoded as TokenPayload;
  const prompt = await ShowPromptService({ promptId, companyId });

  return res.status(200).json(maskPrompt(prompt));
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { promptId } = req.params;
  const promptData = req.body;
  // "Deixe vazio pra manter" (mesmo padrão da Resend) — a API key nunca
  // volta em texto puro pro frontend (ver `maskPrompt`), então o campo
  // chega vazio no formulário quando já tem uma salva; se o usuário não
  // mexeu nele, salvar a tela inteira não pode apagar a chave existente.
  if (!promptData.apiKey) {
    delete promptData.apiKey;
  }
  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const decoded = verify(token, authConfig.secret);
  const { companyId } = decoded as TokenPayload;

  const prompt = await UpdatePromptService({ promptData, promptId, companyId });

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-prompt`, {
    action: "update",
    prompt: maskPrompt(prompt),
  });

  return res.status(200).json(maskPrompt(prompt));
};

export const test = async (req: Request, res: Response): Promise<Response> => {
  const { promptId } = req.params;
  const { message, history } = req.body;
  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const decoded = verify(token, authConfig.secret);
  const { companyId } = decoded as TokenPayload;

  const reply = await TestPromptService({ promptId, companyId, message, history });

  return res.status(200).json({ reply });
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { promptId } = req.params;
  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const decoded = verify(token, authConfig.secret);
  const { companyId } = decoded as TokenPayload;
  try {
    const { count } = await Whatsapp.findAndCountAll({ where: { promptId: +promptId, companyId } });

    if (count > 0) return res.status(200).json({ message: "Não foi possível excluir! Verifique se este prompt está sendo usado nas conexões Whatsapp!" });

    await DeletePromptService(promptId, companyId);

    const io = getIO();
    io.of(String(companyId))
  .emit(`company-${companyId}-prompt`, {
      action: "delete",
      intelligenceId: +promptId
    });

    return res.status(200).json({ message: "Prompt deleted" });
  } catch (err) {
    return res.status(500).json({ message: "Não foi possível excluir! Verifique se este prompt está sendo usado!" });
  }
};
