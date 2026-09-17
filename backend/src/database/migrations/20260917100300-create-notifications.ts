import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Notificações persistidas do Painel Vigia (alertas de risco/atraso de SLA e
// mensagens ao vivo de um supervisor pra um atendente). Diferente do sino
// "normal" do sistema (derivado de tickets em memória no frontend), estas
// ficam gravadas pra poder ser listadas/apagadas pelo Admin.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "Notifications";
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
        title: {
          type: DataTypes.STRING,
          allowNull: false
        },
        message: {
          type: DataTypes.TEXT,
          allowNull: false,
          defaultValue: ""
        },
        userId: {
          type: DataTypes.INTEGER,
          references: { model: "Users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          allowNull: true
        },
        ticketId: {
          type: DataTypes.INTEGER,
          references: { model: "Tickets", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
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
    return queryInterface.dropTable("Notifications");
  }
};
