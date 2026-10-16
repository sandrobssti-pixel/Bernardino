import { QueryInterface } from "sequelize";

// Tipo de documento fiscal emitido automaticamente ao confirmar uma venda
// (NF-e/NFC-e/NFS-e) — em branco significa "não emitir automaticamente",
// mantendo o fluxo manual (botões em SaleDetailModal) como está hoje. Ver
// docs/MANUAL_TECNICO.md. `IF NOT EXISTS` de propósito — ver lição da
// migration de armas (seção 11 da skill atendeflow-dev, v2.3.97).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FiscalConfigs" ADD COLUMN IF NOT EXISTS "defaultDocumentType" VARCHAR(255) DEFAULT '';
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FiscalConfigs", "defaultDocumentType");
  }
};
