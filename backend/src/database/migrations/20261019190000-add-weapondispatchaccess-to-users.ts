import { QueryInterface, DataTypes } from "sequelize";

// Permite que o Admin de uma empresa conceda/revogue, usuário a usuário, o
// acesso ao Despachante Bélico — só tem efeito quando o plano da empresa
// inclui o módulo (Plan.useWeaponDispatch). Mesmo padrão de
// financialAccess/hrAccess/supervisorPanelAccess. Ver docs/MANUAL_TECNICO.md.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Users", "weaponDispatchAccess", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Users", "weaponDispatchAccess");
  }
};
