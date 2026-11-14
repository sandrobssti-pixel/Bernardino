import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Itens de um lançamento do Caixa Registradora (pedido do cliente,
// v2.3.292: "vai ser um frente de caixa que só lança vendas sem nota
// fiscal", com vários itens por venda) — mesmos nomes de coluna já
// usados em SaleItem (unit/quantity/unitPrice/totalPrice), pra manter
// consistência com o módulo Vendas, mais `itemType` (tipo do item,
// texto livre digitado na hora — não é um catálogo fixo, diferente do
// campo "type" do FinanceCashRegister, que continua sendo a lista fixa
// Dinheiro físico/Promissória/Cheque/Venda sem nota fiscal).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "FinanceCashRegisterItems";
    const existingTables: ExistingTables = await queryInterface.showAllTables();

    if (!existingTables.includes(table)) {
      return queryInterface.createTable(table, {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        itemType: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        description: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
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
        cashRegisterId: {
          type: DataTypes.INTEGER,
          references: { model: "FinanceCashRegisters", key: "id" },
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
    return queryInterface.dropTable("FinanceCashRegisterItems");
  }
};
