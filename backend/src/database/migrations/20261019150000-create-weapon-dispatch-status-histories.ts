import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Auditoria de troca de etapa — ver
// backend/src/models/WeaponDispatchStatusHistory.ts e docs/MANUAL_TECNICO.md.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "WeaponDispatchStatusHistories";
    const existingTables: ExistingTables = await queryInterface.showAllTables();

    if (existingTables.includes(table)) return;

    await queryInterface.createTable(table, {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      previousStage: {
        type: DataTypes.STRING,
        allowNull: true
      },
      newStage: {
        type: DataTypes.STRING,
        allowNull: false
      },
      changedAt: {
        type: DataTypes.DATE(6),
        allowNull: false
      },
      notificationSent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      notificationChannel: {
        type: DataTypes.STRING,
        allowNull: true
      },
      processId: {
        type: DataTypes.INTEGER,
        references: { model: "WeaponDispatchProcesses", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      // Nulo = mudança automática (robô de consulta de protocolo).
      changedByUserId: {
        type: DataTypes.INTEGER,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
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
    return queryInterface.dropTable("WeaponDispatchStatusHistories");
  }
};
