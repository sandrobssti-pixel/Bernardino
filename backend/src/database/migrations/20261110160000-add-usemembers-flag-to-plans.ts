import { QueryInterface, DataTypes } from "sequelize";

// Módulo Associados (cadastro de membros/filiados, reconhecimento facial e
// check-in com geolocalização) é um add-on separado, mesmo padrão de
// useFinancial/useWeaponDispatch/useWeaponArmory — o Master decide, por
// plano, se o cliente paga por esse módulo. Ver docs/MANUAL_TECNICO.md.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Plans", "useMembers", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Plans", "useMembers");
  }
};
