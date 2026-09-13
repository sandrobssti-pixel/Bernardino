import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "Companies";

    await queryInterface.addColumn(table, "paymentGateway", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "mercadopago"
    });

    await queryInterface.addColumn(table, "asaasApiKey", {
      type: DataTypes.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn(table, "asaasWebhookSecret", {
      type: DataTypes.STRING,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    const table = "Companies";
    await queryInterface.removeColumn(table, "asaasWebhookSecret");
    await queryInterface.removeColumn(table, "asaasApiKey");
    await queryInterface.removeColumn(table, "paymentGateway");
  }
};
