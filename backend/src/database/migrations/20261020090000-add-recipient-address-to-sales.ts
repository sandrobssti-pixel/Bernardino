import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "recipientZipCode" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "recipientStreet" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "recipientNumber" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "recipientComplement" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "recipientNeighborhood" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "recipientCity" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "recipientState" VARCHAR(255) NOT NULL DEFAULT '';
    `);
  },
  down: async (queryInterface: QueryInterface) => {
    const columns = [
      "recipientZipCode",
      "recipientStreet",
      "recipientNumber",
      "recipientComplement",
      "recipientNeighborhood",
      "recipientCity",
      "recipientState"
    ];
    for (const column of columns) {
      await queryInterface.removeColumn("Sales", column);
    }
  }
};
