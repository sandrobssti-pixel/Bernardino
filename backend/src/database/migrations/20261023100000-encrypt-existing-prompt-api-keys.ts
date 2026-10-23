import { QueryInterface } from "sequelize";

// Migração de DADOS (v2.3.196) — cifra toda API key de Assistente IA que
// ainda está em texto puro no banco (`Prompts.apiKey`), usando o mesmo
// util que o model (`Prompt.ts`, hooks @BeforeCreate/@BeforeUpdate/
// @AfterFind) passa a usar daqui pra frente — ver
// backend/src/utils/promptApiKeyCrypto.ts. Idempotente:
// `encryptApiKey`/`isEncryptedApiKey` já reconhecem um valor que já está
// cifrado e não mexem nele de novo, então rodar essa migration mais de
// uma vez (ou numa linha já cifrada por um `UPDATE` feito pelo próprio
// app entre uma tentativa e outra) não corrompe nada.
//
// ⚠️ Se `PROMPT_API_KEY_ENCRYPTION_KEY` não estiver configurada no
// momento desse deploy, `encryptApiKey` devolve o texto como veio (sem
// cifrar, só avisa no log) — a migration ainda roda e marca como
// concluída, mas as chaves continuam em texto puro até a variável
// existir E alguém rodar `db:migrate` de novo (ou editar/salvar cada
// Assistente IA manualmente, o que já cifra via hook do model).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { encryptApiKey, isEncryptedApiKey } = require("../../utils/promptApiKeyCrypto");

    const [rows] = await queryInterface.sequelize.query(
      `SELECT id, "apiKey" FROM "Prompts" WHERE "apiKey" IS NOT NULL AND "apiKey" != ''`
    );

    for (const row of rows as Array<{ id: number; apiKey: string }>) {
      if (isEncryptedApiKey(row.apiKey)) continue;
      const encrypted = encryptApiKey(row.apiKey);
      if (encrypted === row.apiKey) continue;
      await queryInterface.sequelize.query(
        `UPDATE "Prompts" SET "apiKey" = :encrypted WHERE id = :id`,
        { replacements: { encrypted, id: row.id } }
      );
    }
  },
  down: async () => {
    // Não desfaz — decifrar em massa de volta pra texto puro no banco
    // seria reintroduzir o problema que essa migration resolve. Quem
    // precisar do valor em texto puro usa o próprio sistema (que já
    // decifra automaticamente ao carregar, via @AfterFind).
  }
};
