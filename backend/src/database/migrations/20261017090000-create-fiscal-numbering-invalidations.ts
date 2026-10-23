import { QueryInterface, DataTypes } from "sequelize";

// Guarda localmente as inutilizações de numeração de NF-e já confirmadas
// pelo gateway (status "ok" na resposta de `FocusNFeService.invalidateNumbering`)
// — a tela "Inutilizar numeração de NF-e" nunca listava nada depois de
// inutilizar porque dependia só de `GET /v2/nfe/inutilizacoes` na Focus
// NFe, um endpoint reconstruído por conhecimento geral (nunca confirmado
// contra a doc oficial, ver FocusNFeService.ts) que na prática não estava
// devolvendo as inutilizações feitas. Mesmo padrão já usado pro
// `FiscalDocument` (fonte de verdade local, não re-consultar o gateway a
// cada listagem).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("FiscalNumberingInvalidations", {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      series: {
        type: DataTypes.STRING,
        allowNull: false
      },
      numberStart: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      numberEnd: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      justification: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      protocol: {
        type: DataTypes.STRING,
        defaultValue: ""
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: ""
      },
      environment: {
        type: DataTypes.STRING,
        defaultValue: ""
      },
      raw: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("FiscalNumberingInvalidations");
  }
};
