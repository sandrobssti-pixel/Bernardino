import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Cadastro de produtos/serviços do módulo Financeiro (Fase 1 do roadmap —
// ver docs/MANUAL_TECNICO.md, seção 6.2).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "FinanceProducts";
    const existingTables: ExistingTables = await queryInterface.showAllTables();

    if (!existingTables.includes(table)) {
      return queryInterface.createTable(table, {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        name: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        type: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "product"
        },
        sku: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        ncm: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        unit: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "UN"
        },
        price: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "0"
        },
        costPrice: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "0"
        },
        controlStock: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        stockQuantity: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        notes: {
          type: DataTypes.TEXT,
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
    }
  },
  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("FinanceProducts");
  }
};
