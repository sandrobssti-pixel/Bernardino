import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "Companies";

    await queryInterface.addColumn(table, "efiClientId", {
      type: DataTypes.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn(table, "efiClientSecret", {
      type: DataTypes.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn(table, "efiCertificate", {
      type: DataTypes.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn(table, "efiCertificatePassphrase", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await queryInterface.addColumn(table, "efiPixKey", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await queryInterface.addColumn(table, "efiSandbox", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn(table, "pushinPayToken", {
      type: DataTypes.TEXT,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    const table = "Companies";
    await queryInterface.removeColumn(table, "pushinPayToken");
    await queryInterface.removeColumn(table, "efiSandbox");
    await queryInterface.removeColumn(table, "efiPixKey");
    await queryInterface.removeColumn(table, "efiCertificatePassphrase");
    await queryInterface.removeColumn(table, "efiCertificate");
    await queryInterface.removeColumn(table, "efiClientSecret");
    await queryInterface.removeColumn(table, "efiClientId");
  }
};
