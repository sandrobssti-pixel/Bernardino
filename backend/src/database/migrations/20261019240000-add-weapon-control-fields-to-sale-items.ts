import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "sigmaSinarm" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "ammoLot" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "packageId" VARCHAR(255) NOT NULL DEFAULT '';
    `);
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("SaleItems", "sigmaSinarm");
    await queryInterface.removeColumn("SaleItems", "ammoLot");
    await queryInterface.removeColumn("SaleItems", "packageId");
  }
};
