import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "Services";
    const tables = await queryInterface.showAllTables();
    if (tables.includes(table)) return;

    await queryInterface.createTable(table, {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      code: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      value: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "0"
      },
      paymentTerms: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      photoUrl: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      companyId: {
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      createdAt: {
        type: DataTypes.DATE(6),
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE(6),
        allowNull: false
      }
    });
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("Services");
  }
};
