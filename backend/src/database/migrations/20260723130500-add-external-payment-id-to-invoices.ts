import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "Invoices";

    await queryInterface.addColumn(table, "externalPaymentId", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await queryInterface.addColumn(table, "pixPayload", {
      type: DataTypes.TEXT,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    const table = "Invoices";
    await queryInterface.removeColumn(table, "pixPayload");
    await queryInterface.removeColumn(table, "externalPaymentId");
  }
};
