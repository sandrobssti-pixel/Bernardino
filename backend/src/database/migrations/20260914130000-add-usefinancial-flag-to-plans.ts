import { QueryInterface, DataTypes } from "sequelize";

// Módulo Financeiro completo (cadastro de clientes/fornecedores/produtos,
// custos, relatórios, fiscal, contábil, RH) é um add-on pago, à parte do
// plano-base do AtendeFlow. O Master decide, por plano, se ele inclui o
// módulo Financeiro (ver docs/MANUAL_TECNICO.md, seção 6.2).
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Plans", "useFinancial", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Plans", "useFinancial");
  }
};
