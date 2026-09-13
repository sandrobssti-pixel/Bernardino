import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Prompts", "maxResponseMessages", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Prompts", "maxResponseMessages");
  }
};
