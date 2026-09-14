import { QueryInterface, DataTypes } from "sequelize";

// Permite que o Admin de uma empresa conceda/revogue, usuário a usuário, o
// acesso ao módulo Financeiro — só tem efeito quando o plano da empresa
// inclui o módulo (Plan.useFinancial). Ver docs/MANUAL_TECNICO.md, seção 6.2.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Users", "financialAccess", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Users", "financialAccess");
  }
};
