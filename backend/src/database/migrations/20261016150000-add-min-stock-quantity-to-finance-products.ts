import { QueryInterface } from "sequelize";

// Módulo de estoque (v2.3.114) — "quantidade mínima" configurável por
// produto, usada pro aviso de estoque baixo no Painel Financeiro. `0` (o
// default) significa "sem aviso configurado" — produto não entra na lista
// de estoque baixo mesmo zerado, até o cliente definir um mínimo de
// propósito. `IF NOT EXISTS` de propósito — ver lição da migration de
// armas (seção 11 da skill atendeflow-dev, v2.3.97).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "minStockQuantity" INTEGER DEFAULT 0;
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FinanceProducts", "minStockQuantity");
  }
};
