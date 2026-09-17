import { QueryInterface, DataTypes } from "sequelize";

// Permite que o Admin de uma empresa conceda/revogue, usuário a usuário, o
// acesso ao Painel Vigia — só tem efeito quando o plano da empresa inclui o
// módulo (Plan.useSupervisorPanel). Mesmo padrão do financialAccess/hrAccess.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Users", "supervisorPanelAccess", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Users", "supervisorPanelAccess");
  }
};
