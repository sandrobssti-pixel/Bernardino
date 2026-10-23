import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Auditoria de leitura da senha do gov.br decifrada — ver
// backend/src/models/WeaponDispatchGovPasswordAccessLog.ts e
// docs/MANUAL_TECNICO.md.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "WeaponDispatchGovPasswordAccessLogs";
    const existingTables: ExistingTables = await queryInterface.showAllTables();

    if (existingTables.includes(table)) return;

    await queryInterface.createTable(table, {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      accessedAt: {
        type: DataTypes.DATE(6),
        allowNull: false
      },
      reason: {
        type: DataTypes.STRING,
        allowNull: true
      },
      clientId: {
        type: DataTypes.INTEGER,
        references: { model: "WeaponDispatchClients", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      accessedByUserId: {
        type: DataTypes.INTEGER,
        references: { model: "Users", key: "id" },
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
  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("WeaponDispatchGovPasswordAccessLogs");
  }
};
