import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Vendas (Fase 3 — módulo fiscal), ver docs/MANUAL_TECNICO.md, seção 6.2.
// Não referencia FinanceReceivable ainda aqui — essa FK é adicionada na
// migração seguinte (create-sale-items vem antes de precisar dela, e
// FinanceReceivable já existe desde a Fase 2).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "Sales";
    const existingTables: ExistingTables = await queryInterface.showAllTables();

    if (!existingTables.includes(table)) {
      return queryInterface.createTable(table, {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        saleDate: {
          type: DataTypes.DATEONLY,
          allowNull: true
        },
        status: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "draft"
        },
        totalValue: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "0"
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: false,
          defaultValue: ""
        },
        customerId: {
          type: DataTypes.INTEGER,
          references: { model: "FinanceCustomers", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
          allowNull: true
        },
        receivableId: {
          type: DataTypes.INTEGER,
          references: { model: "FinanceReceivables", key: "id" },
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
    }
  },
  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("Sales");
  }
};
