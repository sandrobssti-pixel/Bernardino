import { QueryInterface, DataTypes } from "sequelize";

// Serviço Armaria — add-on separado do Despachante Bélico, mesmo padrão de
// useWeaponDispatch. Ver docs/MANUAL_TECNICO.md.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Plans", "useWeaponArmory", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Plans", "useWeaponArmory");
  }
};
