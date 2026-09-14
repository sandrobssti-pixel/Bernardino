import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Cadastro de clientes do módulo Financeiro (Fase 1 do roadmap — ver
// docs/MANUAL_TECNICO.md, seção 6.2).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "FinanceCustomers";
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
        documentType: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "cpf"
        },
        document: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        email: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        phone: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        zipCode: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        street: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        number: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        complement: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        neighborhood: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        city: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        state: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
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
        contactId: {
          type: DataTypes.INTEGER,
          references: { model: "Contacts", key: "id" },
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
    return queryInterface.dropTable("FinanceCustomers");
  }
};
