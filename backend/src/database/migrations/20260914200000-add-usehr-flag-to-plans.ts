import { QueryInterface, DataTypes } from "sequelize";

// Módulo de RH/recrutamento (vagas, candidaturas, efetivação — Fase 5 do
// roadmap, ver docs/MANUAL_TECNICO.md, seção 6.2) é um add-on separado dos
// outros (Financeiro/Fiscal) — o Master decide, por plano, se ele inclui.
// Independente do Financeiro (diferente do Fiscal, que exige o Financeiro
// também ativo) — RH não usa nenhum cadastro do módulo Financeiro.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Plans", "useHR", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Plans", "useHR");
  }
};
