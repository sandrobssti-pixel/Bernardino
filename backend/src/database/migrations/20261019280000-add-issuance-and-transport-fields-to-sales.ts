import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "issuancePurpose" VARCHAR(255) NOT NULL DEFAULT 'normal';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "volumeQuantity" INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "volumeSpecies" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "volumeBrand" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "volumeNumber" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "volumeGrossWeight" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "volumeNetWeight" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "carrierName" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "carrierAddress" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "carrierCity" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "carrierState" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "carrierCnpj" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "carrierIe" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "deliveryName" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "deliveryAddress" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "deliveryNumber" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "deliveryComplement" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "deliveryNeighborhood" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "deliveryCity" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "deliveryState" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "deliveryZipCode" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "deliveryPhone" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "freightResponsibility" VARCHAR(255) NOT NULL DEFAULT '9';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "boardingLocation" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "boardingState" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "vehiclePlate" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "vehicleState" VARCHAR(255) NOT NULL DEFAULT '';
    `);
  },
  down: async (queryInterface: QueryInterface) => {
    const columns = [
      "issuancePurpose",
      "volumeQuantity",
      "volumeSpecies",
      "volumeBrand",
      "volumeNumber",
      "volumeGrossWeight",
      "volumeNetWeight",
      "carrierName",
      "carrierAddress",
      "carrierCity",
      "carrierState",
      "carrierCnpj",
      "carrierIe",
      "deliveryName",
      "deliveryAddress",
      "deliveryNumber",
      "deliveryComplement",
      "deliveryNeighborhood",
      "deliveryCity",
      "deliveryState",
      "deliveryZipCode",
      "deliveryPhone",
      "freightResponsibility",
      "boardingLocation",
      "boardingState",
      "vehiclePlate",
      "vehicleState"
    ];
    for (const column of columns) {
      await queryInterface.removeColumn("Sales", column);
    }
  }
};
