import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "WeaponDispatchProcesses" ADD COLUMN IF NOT EXISTS "paymentMethod" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "WeaponDispatchProcesses" ADD COLUMN IF NOT EXISTS "productId" INTEGER REFERENCES "FinanceProducts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    `);
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("WeaponDispatchProcesses", "paymentMethod");
    await queryInterface.removeColumn("WeaponDispatchProcesses", "productId");
  }
};
