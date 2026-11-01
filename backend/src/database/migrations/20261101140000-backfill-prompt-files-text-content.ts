import { QueryInterface } from "sequelize";

// Migração de DADOS (v2.3.236) — corrige itens de "Arquivos da IA" que já
// foram sincronizados de uma Mensagem Rápida com mídia ANTES da correção
// do SyncFromQuickMessageService: até aqui, todo item com arquivo físico
// (`path` preenchido) tinha o texto original descartado (`textContent`
// = NULL), mesmo quando a mensagem rápida de origem tinha texto junto
// com o anexo (ex.: preço, condições de pagamento) — a IA mandava só o
// arquivo puro, sem essa informação. Essa migração recupera o texto a
// partir da Mensagem Rápida de origem, que continua existindo.
// Idempotente — só atualiza quem ainda está com textContent NULL.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE "PromptFiles" pf
      SET "textContent" = TRIM(qm.message)
      FROM "QuickMessages" qm
      WHERE pf."sourceQuickMessageId" = qm.id
        AND pf.path IS NOT NULL
        AND pf."textContent" IS NULL
        AND qm.message IS NOT NULL
        AND TRIM(qm.message) <> ''
    `);
  },

  down: async (): Promise<void> => {
    // Não reverte — desfazer apagaria texto que pode ter sido editado
    // manualmente em Arquivos da IA depois deste backfill.
  }
};
