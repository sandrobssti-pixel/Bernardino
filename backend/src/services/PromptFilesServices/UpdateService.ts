import * as Yup from "yup";
import fs from "fs";
import path from "path";

import AppError from "../../errors/AppError";
import PromptFiles from "../../models/PromptFiles";
import { TEXT_MEDIA_TYPE } from "../../helpers/quickMessagePromptFileSync";

interface Request {
  id: number | string;
  companyId: number;
  name: string;
  description: string;
  // novo arquivo (substitui o atual) — opcional, só quando o usuário troca o anexo
  newPath?: string;
  newMediaType?: string;
  // "Resposta" (v2.3.237) — texto enviado JUNTO com o arquivo (legenda),
  // igual Mensagem Rápida com anexo. Independente de newPath: se o item
  // já tem (ou está ganhando) um arquivo, o texto acompanha o arquivo;
  // se o item não tem arquivo nenhum (nem antes, nem agora), vira/
  // permanece um item "só texto" (mediaType "text", path null) — mesmo
  // comportamento de sempre pra esse caso.
  textContent?: string;
}

const removeFile = (companyId: number, fileName: string): void => {
  const filePath = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "public",
    `company${companyId}`,
    "promptFiles",
    fileName
  );
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.error("Erro ao remover arquivo físico anterior do PromptFiles:", err);
  }
};

// Edita nome/descrição de qualquer item, e opcionalmente troca o
// conteúdo (arquivo ou texto). Item espelhado de uma Mensagem Rápida
// (`sourceQuickMessageId` setado) que tem o conteúdo trocado aqui se
// desvincula da origem (vira um item manual) — senão a próxima edição da
// mensagem rápida original sobrescreveria a troca manual sem avisar.
const UpdateService = async ({
  id,
  companyId,
  name,
  description,
  newPath,
  newMediaType,
  textContent
}: Request): Promise<PromptFiles> => {
  const schema = Yup.object().shape({
    name: Yup.string().required().min(3),
    description: Yup.string().required().min(3)
  });

  try {
    await schema.validate({ name, description });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const promptFile = await PromptFiles.findOne({ where: { id, companyId } });

  if (!promptFile) {
    throw new AppError("ERR_NO_PROMPT_FILE_FOUND", 404);
  }

  const updateData: Record<string, unknown> = { name, description };
  let contentChanged = false;

  if (newPath) {
    // trocou o arquivo anexado
    if (promptFile.path) removeFile(companyId, promptFile.path);
    updateData.path = newPath;
    updateData.mediaType = newMediaType;
    contentChanged = true;
  }

  if (typeof textContent === "string") {
    const trimmed = textContent.trim();
    updateData.textContent = trimmed || null;
    // sem arquivo nenhum (nem o que já tinha, nem um novo sendo
    // anexado agora) — item "só texto", igual sempre foi.
    if (!newPath && !promptFile.path) {
      updateData.mediaType = TEXT_MEDIA_TYPE;
      updateData.path = null;
    }
    contentChanged = true;
  }

  if (contentChanged && promptFile.sourceQuickMessageId) {
    updateData.sourceQuickMessageId = null;
  }

  await promptFile.update(updateData);

  return promptFile;
};

export default UpdateService;
