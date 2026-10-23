import { QueryInterface } from "sequelize";
import fs from "fs";
import path from "path";

// Migração de DADOS (v2.3.198) — espelha pra "Arquivos da IA" (PromptFiles)
// toda Mensagem Rápida já marcada como "geral" que ainda não tenha um
// espelho. Daqui pra frente o SyncFromQuickMessageService mantém isso
// atualizado sozinho a cada criação/edição; essa migração só traz de uma
// vez as que já existiam antes dessa versão. Idempotente — só grava o que
// ainda não tem "sourceQuickMessageId" correspondente em PromptFiles.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {
      inferMimeTypeFromFilename,
      buildSyncedName,
      buildSyncedDescription,
      TEXT_MEDIA_TYPE
    } = require("../../helpers/quickMessagePromptFileSync");

    const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

    const [quickMessages] = await queryInterface.sequelize.query(
      `SELECT id, "companyId", shortcode, message, "mediaPath" FROM "QuickMessages" WHERE geral = true`
    );

    const [alreadySynced] = await queryInterface.sequelize.query(
      `SELECT "sourceQuickMessageId" FROM "PromptFiles" WHERE "sourceQuickMessageId" IS NOT NULL`
    );
    const syncedIds = new Set(
      (alreadySynced as Array<{ sourceQuickMessageId: number }>).map(
        row => row.sourceQuickMessageId
      )
    );

    for (const qm of quickMessages as Array<{
      id: number;
      companyId: number;
      shortcode: string;
      message: string | null;
      mediaPath: string | null;
    }>) {
      if (syncedIds.has(qm.id)) continue;

      const hasMedia = !!qm.mediaPath;
      const hasText = !!(qm.message && qm.message.trim());
      if (!hasMedia && !hasText) continue;

      const name = buildSyncedName(qm);
      const description = buildSyncedDescription(qm);

      if (hasMedia) {
        const sourceFilePath = path.resolve(
          publicFolder,
          `company${qm.companyId}`,
          "quickMessage",
          qm.mediaPath as string
        );
        if (!fs.existsSync(sourceFilePath)) {
          // eslint-disable-next-line no-console
          console.error(
            `[BACKFILL_PROMPT_FILES] arquivo físico não encontrado pra quickMessageId=${qm.id}: ${sourceFilePath}`
          );
          continue;
        }

        const destFolder = path.resolve(
          publicFolder,
          `company${qm.companyId}`,
          "promptFiles"
        );
        if (!fs.existsSync(destFolder)) {
          fs.mkdirSync(destFolder, { recursive: true });
        }

        const destFileName = `qm${qm.id}_${qm.mediaPath}`;
        fs.copyFileSync(sourceFilePath, path.resolve(destFolder, destFileName));

        const mediaType = inferMimeTypeFromFilename(qm.mediaPath as string);

        await queryInterface.sequelize.query(
          `INSERT INTO "PromptFiles" ("companyId", "sourceQuickMessageId", name, description, path, "mediaType", "createdAt", "updatedAt")
           VALUES (:companyId, :sourceQuickMessageId, :name, :description, :path, :mediaType, NOW(), NOW())`,
          {
            replacements: {
              companyId: qm.companyId,
              sourceQuickMessageId: qm.id,
              name,
              description,
              path: destFileName,
              mediaType
            }
          }
        );
      } else {
        await queryInterface.sequelize.query(
          `INSERT INTO "PromptFiles" ("companyId", "sourceQuickMessageId", name, description, path, "mediaType", "textContent", "createdAt", "updatedAt")
           VALUES (:companyId, :sourceQuickMessageId, :name, :description, NULL, :mediaType, :textContent, NOW(), NOW())`,
          {
            replacements: {
              companyId: qm.companyId,
              sourceQuickMessageId: qm.id,
              name,
              description,
              mediaType: TEXT_MEDIA_TYPE,
              textContent: (qm.message as string).trim()
            }
          }
        );
      }
    }
  },

  down: async (queryInterface: QueryInterface) => {
    // Remove só os espelhos (mantém os itens cadastrados manualmente).
    await queryInterface.sequelize.query(
      `DELETE FROM "PromptFiles" WHERE "sourceQuickMessageId" IS NOT NULL`
    );
  }
};
