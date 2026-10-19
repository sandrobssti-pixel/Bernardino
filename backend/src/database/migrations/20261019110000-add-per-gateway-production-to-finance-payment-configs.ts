import { QueryInterface } from "sequelize";

// Continuação de 20261019100000: "e separa eles como um todo" — Produção
// (sandbox x produção) também deixa de ser um campo só pros dois gateways.
// `productionEnabled` fica na tabela sem uso novo (mesmo padrão de coluna
// descontinuada já usado em `provider`). Ver docs/MANUAL_TECNICO.md.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FinancePaymentConfigs" ADD COLUMN IF NOT EXISTS "mercadoPagoProductionEnabled" BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE "FinancePaymentConfigs" ADD COLUMN IF NOT EXISTS "asaasProductionEnabled" BOOLEAN NOT NULL DEFAULT false;
      UPDATE "FinancePaymentConfigs" SET "mercadoPagoProductionEnabled" = "productionEnabled";
      UPDATE "FinancePaymentConfigs" SET "asaasProductionEnabled" = "productionEnabled";
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FinancePaymentConfigs", "mercadoPagoProductionEnabled");
    await queryInterface.removeColumn("FinancePaymentConfigs", "asaasProductionEnabled");
  }
};
