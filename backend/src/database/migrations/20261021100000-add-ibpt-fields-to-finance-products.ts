import { QueryInterface } from "sequelize";

// "Valor Aproximado dos Tributos" (Lei da Transparência) — ver comentário
// completo em FinanceProduct.ts.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "ibptRate" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "ibptSource" VARCHAR(255) NOT NULL DEFAULT '';
    `);
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FinanceProducts", "ibptRate");
    await queryInterface.removeColumn("FinanceProducts", "ibptSource");
  }
};
