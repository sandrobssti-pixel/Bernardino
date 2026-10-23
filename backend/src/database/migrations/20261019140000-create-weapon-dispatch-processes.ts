import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Processo (card da esteira) do Despachante Bélico — ver
// backend/src/models/WeaponDispatchProcess.ts e docs/MANUAL_TECNICO.md.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "WeaponDispatchProcesses";
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
      track: {
        type: DataTypes.STRING,
        allowNull: false
      },
      stage: {
        type: DataTypes.STRING,
        allowNull: false
      },
      priority: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      isAffiliatedClub: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      hasPsychTest: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      hasShootingCert: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      documentsComplete: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      protocolNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      protocolDate: {
        type: DataTypes.DATE(6),
        allowNull: true
      },
      productOrService: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      pendingReason: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      observations: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      driveUrl: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      startedAt: {
        type: DataTypes.DATE(6),
        allowNull: true
      },
      clientId: {
        type: DataTypes.INTEGER,
        references: { model: "WeaponDispatchClients", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      assignedUserId: {
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
    return queryInterface.dropTable("WeaponDispatchProcesses");
  }
};
