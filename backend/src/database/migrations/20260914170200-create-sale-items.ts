import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Itens de venda (Fase 3), ver docs/MANUAL_TECNICO.md, seção 6.2.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "SaleItems";
    const existingTables: ExistingTables = await queryInterface.showAllTables();

    if (!existingTables.includes(table)) {
      return queryInterface.createTable(table, {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        description: {
          type: DataTypes.STRING,
          allowNull: false
        },
        ncm: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        cfop: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "5102"
        },
        unit: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "UN"
        },
        quantity: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "1"
        },
        unitPrice: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "0"
        },
        totalPrice: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "0"
        },
        saleId: {
          type: DataTypes.INTEGER,
          references: { model: "Sales", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          allowNull: false
        },
        productId: {
          type: DataTypes.INTEGER,
          references: { model: "FinanceProducts", key: "id" },
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
    }
  },
  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("SaleItems");
  }
};
