import { QueryInterface, DataTypes } from "sequelize";

// Painel Vigia (monitoramento em tempo real de atrasos/risco de atraso no
// atendimento) é um add-on, à parte do plano-base do AtendeFlow. O Master
// decide, por plano, se ele inclui o módulo (ver docs/MANUAL_TECNICO.md).
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Plans", "useSupervisorPanel", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Plans", "useSupervisorPanel");
  }
};
