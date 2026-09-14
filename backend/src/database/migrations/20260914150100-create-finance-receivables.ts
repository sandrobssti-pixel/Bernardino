import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Contas a receber, ligadas aos clientes cadastrados — módulo Financeiro,
// Fase 2 do roadmap, ver docs/MANUAL_TECNICO.md, seção 6.2.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "FinanceReceivables";
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
        value: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "0"
        },
        dueDate: {
          type: DataTypes.DATEONLY,
          allowNull: true
        },
        receivedDate: {
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
        customerId: {
          type: DataTypes.INTEGER,
          references: { model: "FinanceCustomers", key: "id" },
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
    return queryInterface.dropTable("FinanceReceivables");
  }
};
