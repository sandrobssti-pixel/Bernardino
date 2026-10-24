import { QueryInterface } from "sequelize";

// Mesmos 13 campos de ICMS/CSOSN/IBPT que já existem em FinanceProducts
// (v2.3.167), agora também no Fornecedor — pedido do cliente: preencher
// uma vez por fornecedor (baseado numa nota real dele) pra servir de
// valor padrão/autofill no cadastro de Produto, em vez de digitar os
// mesmos 13 campos em cada produto novo. Mesmos defaults da tabela de
// Produtos. Puramente aditiva. Ver docs/MANUAL_TECNICO.md, seção 191.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FinanceSuppliers" ADD COLUMN IF NOT EXISTS "icmsExempt" BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE "FinanceSuppliers" ADD COLUMN IF NOT EXISTS "icmsSubstitution" BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE "FinanceSuppliers" ADD COLUMN IF NOT EXISTS "icmsOrigin" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "FinanceSuppliers" ADD COLUMN IF NOT EXISTS "csosnContribuinte" VARCHAR(255) NOT NULL DEFAULT '101';
      ALTER TABLE "FinanceSuppliers" ADD COLUMN IF NOT EXISTS "csosnNaoContribuinte" VARCHAR(255) NOT NULL DEFAULT '102';
      ALTER TABLE "FinanceSuppliers" ADD COLUMN IF NOT EXISTS "icmsBcModality" VARCHAR(255) NOT NULL DEFAULT '3';
      ALTER TABLE "FinanceSuppliers" ADD COLUMN IF NOT EXISTS "icmsStBcModality" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "FinanceSuppliers" ADD COLUMN IF NOT EXISTS "icmsRate" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "FinanceSuppliers" ADD COLUMN IF NOT EXISTS "icmsStRate" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "FinanceSuppliers" ADD COLUMN IF NOT EXISTS "icmsStMva" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "FinanceSuppliers" ADD COLUMN IF NOT EXISTS "icmsDesoneration" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "FinanceSuppliers" ADD COLUMN IF NOT EXISTS "ibptRate" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "FinanceSuppliers" ADD COLUMN IF NOT EXISTS "ibptSource" VARCHAR(255) NOT NULL DEFAULT '';
    `);
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FinanceSuppliers", "icmsExempt");
    await queryInterface.removeColumn("FinanceSuppliers", "icmsSubstitution");
    await queryInterface.removeColumn("FinanceSuppliers", "icmsOrigin");
    await queryInterface.removeColumn("FinanceSuppliers", "csosnContribuinte");
    await queryInterface.removeColumn("FinanceSuppliers", "csosnNaoContribuinte");
    await queryInterface.removeColumn("FinanceSuppliers", "icmsBcModality");
    await queryInterface.removeColumn("FinanceSuppliers", "icmsStBcModality");
    await queryInterface.removeColumn("FinanceSuppliers", "icmsRate");
    await queryInterface.removeColumn("FinanceSuppliers", "icmsStRate");
    await queryInterface.removeColumn("FinanceSuppliers", "icmsStMva");
    await queryInterface.removeColumn("FinanceSuppliers", "icmsDesoneration");
    await queryInterface.removeColumn("FinanceSuppliers", "ibptRate");
    await queryInterface.removeColumn("FinanceSuppliers", "ibptSource");
  }
};
