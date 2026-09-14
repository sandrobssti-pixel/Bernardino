import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Contas a pagar (custos fixos e variados) do módulo Financeiro — Fase 2 do
// roadmap, ver docs/MANUAL_TECNICO.md, seção 6.2.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "FinanceExpenses";
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
          type: DataTypes.TEXT,
          allowNull: false
        },
        category: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "Outros"
        },
        costType: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "variable"
        },
        value: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "0"
        },
        dueDate: {
          type: DataTypes.DATEONLY,
          allowNull: true
        },
        paymentDate: {
          type: DataTypes.DATEONLY,
          allowNull: true
        },
        status: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "pending"
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
        supplierId: {
          type: DataTypes.INTEGER,
          references: { model: "FinanceSuppliers", key: "id" },
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
    return queryInterface.dropTable("FinanceExpenses");
  }
};
