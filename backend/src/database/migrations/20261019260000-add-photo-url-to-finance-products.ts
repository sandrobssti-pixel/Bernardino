import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "photoUrl" VARCHAR(255) NOT NULL DEFAULT '';
    `);
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FinanceProducts", "photoUrl");
  }
};
