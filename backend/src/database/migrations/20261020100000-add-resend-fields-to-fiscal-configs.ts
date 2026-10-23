import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FiscalConfigs" ADD COLUMN IF NOT EXISTS "resendEnabled" BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE "FiscalConfigs" ADD COLUMN IF NOT EXISTS "resendApiKey" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "FiscalConfigs" ADD COLUMN IF NOT EXISTS "resendFromEmail" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "FiscalConfigs" ADD COLUMN IF NOT EXISTS "resendFromName" VARCHAR(255) NOT NULL DEFAULT '';
    `);
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FiscalConfigs", "resendEnabled");
    await queryInterface.removeColumn("FiscalConfigs", "resendApiKey");
    await queryInterface.removeColumn("FiscalConfigs", "resendFromEmail");
    await queryInterface.removeColumn("FiscalConfigs", "resendFromName");
  }
};
