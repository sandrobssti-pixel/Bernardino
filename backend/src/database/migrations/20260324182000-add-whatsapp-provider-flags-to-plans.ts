import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.addColumn("Plans", "useWhatsappBaileys", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }),
      queryInterface.addColumn("Plans", "useWhatsappWuzapi", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("Plans", "useWhatsappBaileys"),
      queryInterface.removeColumn("Plans", "useWhatsappWuzapi")
    ]);
  }
};
