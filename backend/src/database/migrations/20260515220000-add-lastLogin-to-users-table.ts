import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Users", "lastLogin", {
      type: DataTypes.DATE,
      allowNull: true,
    });
  },
  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Users", "lastLogin");
  },
};
