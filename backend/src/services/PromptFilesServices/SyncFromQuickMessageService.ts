import fs from "fs";
import path from "path";

import PromptFiles from "../../models/PromptFiles";
import QuickMessage from "../../models/QuickMessage";
import {
  inferMimeTypeFromFilename,
  buildSyncedName,
  buildSyncedDescription,
  TEXT_MEDIA_TYPE
} from "../../helpers/quickMessagePromptFileSync";

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

const removeMirrorFile = (companyId: number, fileName: string): void => {
  const filePath = path.resolve(
    publicFolder,
    `company${companyId}`,
    "promptFiles",
    fileName
  );
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.error("Erro ao remover espelho físico de Arquivos da IA:", err);
  }
};

// Espelha (replica — nunca move) uma Mensagem Rápida marcada como "geral"
// pro catálogo "Arquivos da IA" (PromptFiles), mantendo os dois em
// sincronia a cada criação/edição de texto ou mídia. Chamado pelos
// services de QuickMessage e pelos endpoints de upload/remoção de mídia.
// Idempotente via sourceQuickMessageId: sempre atualiza o mesmo item em
// vez de duplicar. Nunca sobrescreve "description" depois de criado —
// esse campo é o "quando a IA deve enviar", editável manualmente.
const SyncFromQuickMessageService = async (
  quickMessage: QuickMessage
): Promise<void> => {
  const existing = await PromptFiles.findOne({
    where: { sourceQuickMessageId: quickMessage.id }
  });

  const rawMediaPath = quickMessage.getDataValue("mediaPath") as string | null;
  const hasMedia = !!rawMediaPath;
  const hasText = !!(quickMessage.message && quickMessage.message.trim());

  if (!quickMessage.geral || (!hasMedia && !hasText)) {
    if (existing) {
      if (existing.path) removeMirrorFile(quickMessage.companyId, existing.path);
      await existing.destroy();
    }
    return;
  }

  const name = buildSyncedName(quickMessage);

  if (hasMedia) {
    const sourceFilePath = path.resolve(
      publicFolder,
      `company${quickMessage.companyId}`,
      "quickMessage",
      rawMediaPath
    );

    if (!fs.existsSync(sourceFilePath)) {
      console.error(
        `Arquivo físico da mensagem rápida não encontrado pra espelhar (quickMessageId=${quickMessage.id}): ${sourceFilePath}`
      );
      return;
    }

    const destFolder = path.resolve(
      publicFolder,
      `company${quickMessage.companyId}`,
      "promptFiles"
    );
    if (!fs.existsSync(destFolder)) {
      fs.mkdirSync(destFolder, { recursive: true });
    }

    const destFileName = `qm${quickMessage.id}_${rawMediaPath}`;
    fs.copyFileSync(sourceFilePath, path.resolve(destFolder, destFileName));

    // troca de mídia (tirou o arquivo antigo, subiu outro) — remove o
    // espelho físico anterior pra não acumular lixo em disco.
    if (existing?.path && existing.path !== destFileName) {
      removeMirrorFile(quickMessage.companyId, existing.path);
    }

    const mediaType = inferMimeTypeFromFilename(rawMediaPath);

    if (existing) {
      await existing.update({ name, path: destFileName, mediaType, textContent: null });
    } else {
      await PromptFiles.create({
        companyId: quickMessage.companyId,
        sourceQuickMessageId: quickMessage.id,
        name,
        description: buildSyncedDescription(quickMessage),
        path: destFileName,
        mediaType,
        textContent: null
      });
    }
    return;
  }

  // só texto (sem mídia anexada)
  const textContent = (quickMessage.message || "").trim();

  if (existing) {
    if (existing.path) removeMirrorFile(quickMessage.companyId, existing.path);
    await existing.update({
      name,
      path: null,
      mediaType: TEXT_MEDIA_TYPE,
      textContent
    });
  } else {
    await PromptFiles.create({
      companyId: quickMessage.companyId,
      sourceQuickMessageId: quickMessage.id,
      name,
      description: buildSyncedDescription(quickMessage),
      path: null,
      mediaType: TEXT_MEDIA_TYPE,
      textContent
    });
  }
};

export default SyncFromQuickMessageService;
