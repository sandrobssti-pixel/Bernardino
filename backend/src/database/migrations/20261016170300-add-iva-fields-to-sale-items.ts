import { QueryInterface } from "sequelize";

// Reforma Tributária 2027 (CBS/IBS) — snapshot do cálculo no item da venda
// (mesma lógica de snapshot já usada pra sku/ncm/cfop/costPrice/taxRate):
// preço líquido (sem imposto por dentro), base de cálculo, alíquota
// aplicada e valor calculado de CBS/IBS (IBS dividido em parte estadual e
// municipal). Populado só quando `FiscalConfig.reform2027Enabled` for
// true (`Iva2027Service.ts` via `SaleService.buildItemRows`) — até lá,
// fica tudo no default "0", sem efeito no faturamento atual. `IF NOT
// EXISTS` de propósito — ver lição da migration de armas (seção 11 da
// skill atendeflow-dev, v2.3.97).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "ivaNetUnitPrice" VARCHAR(255) DEFAULT '0';
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "ivaNetTotalPrice" VARCHAR(255) DEFAULT '0';
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "ivaCbsBase" VARCHAR(255) DEFAULT '0';
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "ivaIbsBase" VARCHAR(255) DEFAULT '0';
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "ivaCbsRateApplied" VARCHAR(255) DEFAULT '0';
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "ivaIbsRateApplied" VARCHAR(255) DEFAULT '0';
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "ivaCbsValue" VARCHAR(255) DEFAULT '0';
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "ivaIbsStateValue" VARCHAR(255) DEFAULT '0';
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "ivaIbsCityValue" VARCHAR(255) DEFAULT '0';
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("SaleItems", "ivaNetUnitPrice");
    await queryInterface.removeColumn("SaleItems", "ivaNetTotalPrice");
    await queryInterface.removeColumn("SaleItems", "ivaCbsBase");
    await queryInterface.removeColumn("SaleItems", "ivaIbsBase");
    await queryInterface.removeColumn("SaleItems", "ivaCbsRateApplied");
    await queryInterface.removeColumn("SaleItems", "ivaIbsRateApplied");
    await queryInterface.removeColumn("SaleItems", "ivaCbsValue");
    await queryInterface.removeColumn("SaleItems", "ivaIbsStateValue");
    await queryInterface.removeColumn("SaleItems", "ivaIbsCityValue");
  }
};
