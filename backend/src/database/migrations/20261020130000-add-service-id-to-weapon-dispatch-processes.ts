import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "WeaponDispatchProcesses" ADD COLUMN IF NOT EXISTS "serviceId" INTEGER REFERENCES "Services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    `);
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("WeaponDispatchProcesses", "serviceId");
  }
};
