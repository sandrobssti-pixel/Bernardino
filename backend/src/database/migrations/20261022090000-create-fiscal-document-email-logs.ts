import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Auditoria de envio/reenvio de nota fiscal por e-mail — ver
// backend/src/models/FiscalDocumentEmailLog.ts e docs/MANUAL_TECNICO.md.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "FiscalDocumentEmailLogs";
    const existingTables: ExistingTables = await queryInterface.showAllTables();

    if (existingTables.includes(table)) return;

    await queryInterface.createTable(table, {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      emails: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      success: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      fiscalDocumentId: {
        type: DataTypes.INTEGER,
        references: { model: "FiscalDocuments", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      requestedByUserId: {
        type: DataTypes.INTEGER,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
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
  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("FiscalDocumentEmailLogs");
  }
};
