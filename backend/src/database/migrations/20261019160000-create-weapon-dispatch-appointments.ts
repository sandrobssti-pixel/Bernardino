import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Agendamento (psicoteste/laudo de tiro) — ver
// backend/src/models/WeaponDispatchAppointment.ts e docs/MANUAL_TECNICO.md.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "WeaponDispatchAppointments";
    const existingTables: ExistingTables = await queryInterface.showAllTables();

    if (existingTables.includes(table)) return;

    await queryInterface.createTable(table, {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false
      },
      scheduledAt: {
        type: DataTypes.DATE(6),
        allowNull: false
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "scheduled"
      },
      observations: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      processId: {
        type: DataTypes.INTEGER,
        references: { model: "WeaponDispatchProcesses", key: "id" },
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
    return queryInterface.dropTable("WeaponDispatchAppointments");
  }
};
