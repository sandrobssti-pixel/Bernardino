import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Tags", "timeLaneUnit", {
      type: DataTypes.ENUM("hours", "minutes"),
      defaultValue: "hours",
      allowNull: false
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Tags", "timeLaneUnit");
  }
};
