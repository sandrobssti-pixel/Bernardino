import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "icmsExempt" BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "icmsSubstitution" BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "icmsOrigin" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "csosnContribuinte" VARCHAR(255) NOT NULL DEFAULT '101';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "csosnNaoContribuinte" VARCHAR(255) NOT NULL DEFAULT '102';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "icmsBcModality" VARCHAR(255) NOT NULL DEFAULT '3';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "icmsStBcModality" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "icmsRate" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "icmsEcf" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "icmsDesoneration" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "icmsStRate" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "icmsStMva" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "taxableUnit" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "cfopPrincipal" VARCHAR(255) NOT NULL DEFAULT '5102';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "cfopOutState" VARCHAR(255) NOT NULL DEFAULT '6102';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "taxArticle" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "fiscalBenefitCode" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "usesFcp" BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "conditionalDiscountNfe" BOOLEAN NOT NULL DEFAULT false;
    `);
  },
  down: async (queryInterface: QueryInterface) => {
    const columns = [
      "icmsExempt",
      "icmsSubstitution",
      "icmsOrigin",
      "csosnContribuinte",
      "csosnNaoContribuinte",
      "icmsBcModality",
      "icmsStBcModality",
      "icmsRate",
      "icmsEcf",
      "icmsDesoneration",
      "icmsStRate",
      "icmsStMva",
      "taxableUnit",
      "cfopPrincipal",
      "cfopOutState",
      "taxArticle",
      "fiscalBenefitCode",
      "usesFcp",
      "conditionalDiscountNfe"
    ];
    for (const column of columns) {
      await queryInterface.removeColumn("FinanceProducts", column);
    }
  }
};
