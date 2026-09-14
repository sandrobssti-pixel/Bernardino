import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Documentos fiscais emitidos (Fase 3), ver docs/MANUAL_TECNICO.md, seção 6.2.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "FiscalDocuments";
    const existingTables: ExistingTables = await queryInterface.showAllTables();

    if (!existingTables.includes(table)) {
      return queryInterface.createTable(table, {
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
        status: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "processing"
        },
        externalRef: {
          type: DataTypes.STRING,
          allowNull: false
        },
        number: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        series: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        accessKey: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        xmlUrl: {
          type: DataTypes.TEXT,
          allowNull: false,
          defaultValue: ""
        },
        pdfUrl: {
          type: DataTypes.TEXT,
          allowNull: false,
          defaultValue: ""
        },
        errorMessage: {
          type: DataTypes.TEXT,
          allowNull: false,
          defaultValue: ""
        },
        issuedAt: {
          type: DataTypes.DATE(6),
          allowNull: true
        },
        saleId: {
          type: DataTypes.INTEGER,
          references: { model: "Sales", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          allowNull: false
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
    }
  },
  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("FiscalDocuments");
  }
};
