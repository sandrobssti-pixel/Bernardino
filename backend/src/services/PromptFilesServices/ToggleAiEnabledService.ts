import AppError from "../../errors/AppError";
import PromptFiles from "../../models/PromptFiles";

interface Request {
  id: number | string;
  companyId: number;
  aiEnabled: boolean;
}

// Liga/desliga o botão "a IA manda esse arquivo automaticamente?" sem
// mexer em nome/descrição/conteúdo — endpoint separado de UpdateService
// de propósito: o botão precisa responder na hora (clique único), sem
// reenviar nome/descrição nem acionar a lógica de "desvincula da
// Mensagem Rápida de origem" que UpdateService dispara ao trocar
// conteúdo (ver v2.3.228).
const ToggleAiEnabledService = async ({
  id,
  companyId,
  aiEnabled
}: Request): Promise<PromptFiles> => {
  const promptFile = await PromptFiles.findOne({ where: { id, companyId } });

  if (!promptFile) {
    throw new AppError("ERR_NO_PROMPT_FILE_FOUND", 404);
  }

  await promptFile.update({ aiEnabled });

  return promptFile;
};

export default ToggleAiEnabledService;
