import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Configuração fiscal por empresa — Fase 3 do roadmap (módulo fiscal), ver
// docs/MANUAL_TECNICO.md, seção 6.2.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "FiscalConfigs";
    const existingTables: ExistingTables = await queryInterface.showAllTables();

    if (!existingTables.includes(table)) {
      return queryInterface.createTable(table, {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        taxRegime: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "simples"
        },
        stateRegistration: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        stateRegistrationExempt: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        municipalRegistration: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        cnae: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        cityCode: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        gatewayProvider: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "focusnfe"
        },
        gatewayToken: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        gatewayEnvironment: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "sandbox"
        },
        nfeSeries: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "1"
        },
        nfceSeries: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "1"
        },
        nfseSeries: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "1"
        },
        defaultCfop: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "5102"
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: false,
          defaultValue: ""
        },
        companyId: {
          type: DataTypes.INTEGER,
          references: { model: "Companies", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          allowNull: false,
          unique: true
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
    }
  },
  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("FiscalConfigs");
  }
};
