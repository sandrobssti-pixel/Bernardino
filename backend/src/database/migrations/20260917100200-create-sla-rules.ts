import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Regras de SLA do Painel Vigia: quantos minutos de atendimento em aberto
// contam como "risco de atraso" e como "fora do prazo". Pode haver uma regra
// por fila (queueId) ou uma regra padrão da empresa (queueId null).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "SlaRules";
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
          type: DataTypes.STRING,
          allowNull: false
        },
        riskMinutes: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 15
        },
        overdueMinutes: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 20
        },
        queueId: {
          type: DataTypes.INTEGER,
          references: { model: "Queues", key: "id" },
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
    return queryInterface.dropTable("SlaRules");
  }
};
