import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "mainSupplierId" INTEGER REFERENCES "FinanceSuppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "productionLeadTime" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "designCode" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "productionScale" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "manufacturerCnpj" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "barcodeGtin" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "supplierCode" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "originalCode" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "similarProductCode" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "colorSizeFlavor" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "weight" FLOAT;
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "category" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "subcategory" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "packaging" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "productFamily" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "storageLocation" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "priceTable2" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "priceTable3" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "priceTable4" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "priceTable5" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "reservedStock" INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "idealStock" INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "stockByLot" INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "lotControl" BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "isComposite" BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "isRawMaterial" BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "isEquipment" BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "soldByWeight" BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "commissionRate" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "maxDiscountMargin" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "loyaltyPoints" INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "redemptionPoints" INTEGER NOT NULL DEFAULT 0;
    `);
  },
  down: async (queryInterface: QueryInterface) => {
    const columns = [
      "mainSupplierId",
      "productionLeadTime",
      "designCode",
      "productionScale",
      "manufacturerCnpj",
      "barcodeGtin",
      "supplierCode",
      "originalCode",
      "similarProductCode",
      "colorSizeFlavor",
      "weight",
      "category",
      "subcategory",
      "packaging",
      "productFamily",
      "storageLocation",
      "priceTable2",
      "priceTable3",
      "priceTable4",
      "priceTable5",
      "reservedStock",
      "idealStock",
      "stockByLot",
      "lotControl",
      "isComposite",
      "isRawMaterial",
      "isEquipment",
      "soldByWeight",
      "commissionRate",
      "maxDiscountMargin",
      "loyaltyPoints",
      "redemptionPoints"
    ];
    for (const column of columns) {
      await queryInterface.removeColumn("FinanceProducts", column);
    }
  }
};
