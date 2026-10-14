// src/controllers/DocumentPreviewController.ts
//
// Converte sob demanda um documento (Word/Excel/PowerPoint/OpenDocument) de
// uma mensagem pra PDF, pra a caixa de "Visualizar" do chat mostrar o
// conteúdo real em vez de só "Visualização não disponível". Ver
// ConvertDocumentToPdfService pro porquê de usar LibreOffice local em vez
// de um visualizador externo.

import { Request, Response } from "express";
import path from "path";
import AppError from "../errors/AppError";
import ShowMessageService from "../services/MessageServices/ShowMessageService";
import ConvertDocumentToPdfService, {
  isConvertibleToPdf
} from "../services/DocumentServices/ConvertDocumentToPdfService";

const publicFolder = path.join(__dirname, "..", "..", "public");

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { messageId } = req.params;
  const { companyId } = req.user;

  const message = await ShowMessageService(messageId);
  if (!message) {
    throw new AppError("ERR_NO_MESSAGE_FOUND", 404);
  }

  // Multiempresa: nunca confiar só no id da mensagem, reconferir a empresa
  // do usuário autenticado contra a empresa dona da mensagem.
  if (message.companyId !== companyId) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const rawFileName = message.getDataValue("mediaUrl") as string | null;
  if (!rawFileName) {
    throw new AppError("ERR_MEDIA_FILE_NOT_FOUND", 404);
  }

  if (!isConvertibleToPdf(rawFileName)) {
    throw new AppError("ERR_DOCUMENT_PREVIEW_UNSUPPORTED", 400);
  }

  const companyFolder = path.join(publicFolder, `company${message.companyId}`);
  const sourcePath = path.join(companyFolder, rawFileName);
  const previewDir = path.join(companyFolder, "_previews");

  try {
    const outputPath = await ConvertDocumentToPdfService(sourcePath, previewDir);
    const previewUrl = `/public/company${message.companyId}/_previews/${path.basename(
      outputPath
    )}`;
    return res.json({ previewUrl });
  } catch (err: any) {
    console.error("Erro ao converter documento pra preview:", err);
    throw new AppError("ERR_DOCUMENT_PREVIEW_FAILED", 500);
  }
};
