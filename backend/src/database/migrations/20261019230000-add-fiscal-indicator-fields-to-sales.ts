import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "operationType" VARCHAR(255) NOT NULL DEFAULT 'internal';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "operationNature" VARCHAR(255) NOT NULL DEFAULT 'Venda';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "consumerPresence" VARCHAR(255) NOT NULL DEFAULT '1';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "intermediaryType" VARCHAR(255) NOT NULL DEFAULT 'none';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "finalConsumerType" VARCHAR(255) NOT NULL DEFAULT 'final';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "recipientType" VARCHAR(255) NOT NULL DEFAULT 'customer';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "ieIndicator" VARCHAR(255) NOT NULL DEFAULT 'non_contributor';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "paymentMethod" VARCHAR(255) NOT NULL DEFAULT '';
    `);
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Sales", "operationType");
    await queryInterface.removeColumn("Sales", "operationNature");
    await queryInterface.removeColumn("Sales", "consumerPresence");
    await queryInterface.removeColumn("Sales", "intermediaryType");
    await queryInterface.removeColumn("Sales", "finalConsumerType");
    await queryInterface.removeColumn("Sales", "recipientType");
    await queryInterface.removeColumn("Sales", "ieIndicator");
    await queryInterface.removeColumn("Sales", "paymentMethod");
  }
};
