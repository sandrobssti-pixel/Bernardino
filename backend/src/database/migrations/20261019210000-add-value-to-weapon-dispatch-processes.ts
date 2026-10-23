import { QueryInterface } from "sequelize";

// Valor do serviço, pedido do cliente junto com o modelo de ficha real —
// cada processo (serviço solicitado) passa a guardar o valor combinado.
// Ver docs/MANUAL_TECNICO.md.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "WeaponDispatchProcesses" ADD COLUMN IF NOT EXISTS "value" VARCHAR(255) NOT NULL DEFAULT '0';
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("WeaponDispatchProcesses", "value");
  }
};
