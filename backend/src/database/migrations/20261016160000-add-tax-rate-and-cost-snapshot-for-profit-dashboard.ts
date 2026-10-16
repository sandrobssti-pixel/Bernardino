import { QueryInterface } from "sequelize";

// Dashboard de lucro (v2.3.117) — alíquota de imposto única por produto
// (`FinanceProduct.taxRate`, %) e snapshot de custo/imposto no item da
// venda no momento em que ela é feita (`SaleItem.costPrice`/`taxRate`),
// mesma lógica de snapshot já usada pra sku/ncm/cfop: se o cadastro do
// produto mudar depois (custo, alíquota), vendas já feitas não devem ter
// o lucro recalculado retroativamente. `IF NOT EXISTS` de propósito — ver
// lição da migration de armas (seção 11 da skill atendeflow-dev, v2.3.97).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "taxRate" VARCHAR(255) DEFAULT '0';
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "costPrice" VARCHAR(255) DEFAULT '0';
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "taxRate" VARCHAR(255) DEFAULT '0';
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FinanceProducts", "taxRate");
    await queryInterface.removeColumn("SaleItems", "costPrice");
    await queryInterface.removeColumn("SaleItems", "taxRate");
  }
};
