import { QueryInterface } from "sequelize";

// SaleItem guarda uma cópia (snapshot) de descrição/NCM/CFOP no momento da
// venda — faltava o SKU/código do produto nesse snapshot, e o módulo de
// Vendas precisa exibi-lo (pedido do cliente) e a nota fiscal precisa
// emitir o código real do produto, não o id interno do banco (ver
// FocusNFeService.ts). Ver docs/MANUAL_TECNICO.md. `IF NOT EXISTS` de
// propósito — ver lição da migration de armas (seção 11 da skill
// atendeflow-dev, v2.3.97).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "sku" VARCHAR(255) DEFAULT '';
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("SaleItems", "sku");
  }
};
