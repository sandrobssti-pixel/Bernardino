import { QueryInterface } from "sequelize";

module.exports = {
  up: async (
    queryInterface: QueryInterface,
    Sequelize: typeof import("sequelize")
  ) => {
    const table = "Users";
    const column = "canDeleteTickets";

    const desc = await queryInterface.describeTable(table);
    if (!desc[column]) {
      await queryInterface.addColumn(table, column, {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "disabled"
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const table = "Users";
    const column = "canDeleteTickets";

    const desc = await queryInterface.describeTable(table);
    if (desc[column]) {
      await queryInterface.removeColumn(table, column);
    }
  }
};
