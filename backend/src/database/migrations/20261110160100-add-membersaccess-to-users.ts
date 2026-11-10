import { QueryInterface, DataTypes } from "sequelize";

// Permite que o Admin de uma empresa conceda/revogue, usuário a usuário, o
// acesso ao módulo Associados — só tem efeito quando o plano da empresa
// inclui o módulo (Plan.useMembers). Mesmo padrão de
// financialAccess/weaponDispatchAccess/weaponArmoryAccess.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Users", "membersAccess", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Users", "membersAccess");
  }
};
