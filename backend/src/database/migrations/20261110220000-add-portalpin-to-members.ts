import { QueryInterface } from "sequelize";

// PIN de acesso ao Portal do Associado (hash, nunca texto puro) — o
// Admin gera e repassa ao associado fora do sistema (presencialmente/
// WhatsApp). Ver docs/MANUAL_TECNICO.md.
// Mais de uma coluna no mesmo arquivo de migration — SQL com
// IF NOT EXISTS, não addColumn padrão (se uma falhar no meio por
// qualquer motivo transitório, uma nova tentativa não trava em "column
// already exists" — ver docs/MANUAL_TECNICO.md, seção 11 da skill
// atendeflow-dev).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      'ALTER TABLE "Members" ADD COLUMN IF NOT EXISTS "portalPinHash" TEXT;'
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE "Members" ADD COLUMN IF NOT EXISTS "portalPinSetAt" TIMESTAMP WITH TIME ZONE;'
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Members", "portalPinHash");
    await queryInterface.removeColumn("Members", "portalPinSetAt");
  }
};
