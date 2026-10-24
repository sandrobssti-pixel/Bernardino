import { QueryInterface } from "sequelize";

// Pedido do cliente: "dados fiscais não é pra estar em cadastro de
// produto" — os 13 campos de ICMS/CSOSN/IBPT que até aqui só existiam
// no FinanceProduct (lidos exclusivamente de lá por
// FocusNFeService.buildItemIcms/buildAdditionalInfo, sem equivalente
// nenhum na Venda) ganham uma cópia editável por item de Venda, mesmo
// padrão de "snapshot no momento da venda" já usado em description/sku/
// ncm/cfop/costPrice/taxRate em SaleItem — "se o cadastro do produto
// mudar depois, a venda e a nota fiscal já emitida não devem mudar
// retroativamente". Valores default idênticos aos de FinanceProduct
// (ver models/FinanceProduct.ts), pra uma venda nova nascer pré-
// preenchida com o mesmo valor que o produto já tinha. Puramente
// aditiva. Ver docs/MANUAL_TECNICO.md, seção 187.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "icmsExempt" BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "icmsSubstitution" BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "icmsOrigin" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "csosnContribuinte" VARCHAR(255) NOT NULL DEFAULT '101';
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "csosnNaoContribuinte" VARCHAR(255) NOT NULL DEFAULT '102';
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "icmsBcModality" VARCHAR(255) NOT NULL DEFAULT '3';
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "icmsStBcModality" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "icmsRate" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "icmsStRate" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "icmsStMva" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "icmsDesoneration" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "ibptRate" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "ibptSource" VARCHAR(255) NOT NULL DEFAULT '';
    `);
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("SaleItems", "icmsExempt");
    await queryInterface.removeColumn("SaleItems", "icmsSubstitution");
    await queryInterface.removeColumn("SaleItems", "icmsOrigin");
    await queryInterface.removeColumn("SaleItems", "csosnContribuinte");
    await queryInterface.removeColumn("SaleItems", "csosnNaoContribuinte");
    await queryInterface.removeColumn("SaleItems", "icmsBcModality");
    await queryInterface.removeColumn("SaleItems", "icmsStBcModality");
    await queryInterface.removeColumn("SaleItems", "icmsRate");
    await queryInterface.removeColumn("SaleItems", "icmsStRate");
    await queryInterface.removeColumn("SaleItems", "icmsStMva");
    await queryInterface.removeColumn("SaleItems", "icmsDesoneration");
    await queryInterface.removeColumn("SaleItems", "ibptRate");
    await queryInterface.removeColumn("SaleItems", "ibptSource");
  }
};
