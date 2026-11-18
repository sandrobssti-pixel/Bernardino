import { QueryInterface, DataTypes } from "sequelize";

// "Caixa grande" de munição (v2.3.300, pedido do cliente) — nível ACIMA
// da caixinha pequena (FinanceAmmoVolume, v2.3.223): a compra chega
// numa caixa fechada (a "caixa grande"), e dentro dela vêm várias
// caixinhas/cartelas menores, todas com o MESMO lote da caixa grande,
// mas cada uma com o próprio ID (código de barras). Fluxo real do
// cliente: "começa cadastrando" a caixa grande (produto + lote + total
// de unidades), depois cadastra as caixinhas de dentro, vinculadas a
// ela. Lote vem em DOIS campos (LE/LF — nomenclatura do próprio
// fabricante/munição, não é um só número) — ver FinanceAmmoBigBox.ts.
// Puramente aditiva — tabela nova, sem tocar em FinanceAmmoVolumes
// (ver migration irmã que só adiciona a coluna `bigBoxId` nela).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "FinanceAmmoBigBoxes";
    const existingTables = await queryInterface.showAllTables();

    if (!existingTables.includes(table)) {
      await queryInterface.createTable(table, {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        productId: {
          type: DataTypes.INTEGER,
          references: { model: "FinanceProducts", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          allowNull: false
        },
        lotLE: {
          type: DataTypes.STRING,
          allowNull: false
        },
        lotLF: {
          type: DataTypes.STRING,
          allowNull: false
        },
        totalUnits: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: false,
          defaultValue: ""
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

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("FinanceAmmoBigBoxes");
  }
};
