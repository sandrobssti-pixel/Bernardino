import { QueryInterface, DataTypes } from "sequelize";

// Permite que o Admin de uma empresa conceda/revogue, usuário a usuário, o
// acesso ao Serviço Armaria — só tem efeito quando o plano da empresa
// inclui o módulo (Plan.useWeaponArmory). Mesmo padrão de
// weaponDispatchAccess. Ver docs/MANUAL_TECNICO.md.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Users", "weaponArmoryAccess", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Users", "weaponArmoryAccess");
  }
};
