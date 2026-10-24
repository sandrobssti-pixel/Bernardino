import { QueryInterface } from "sequelize";

// "Venda Mista" (v2.3.217, pedido do cliente: "as vezes o cliente paga em
// dinheiro, pix e cartão de crédito") — 3 colunas de valor, uma por forma
// de pagamento, só usadas quando `Sale.paymentMethod === "mixed"`. Mesmo
// padrão string (não numeric/decimal) já usado pros outros valores
// monetários da tabela (`totalValue` etc.). Puramente aditiva.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "paymentCashValue" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "paymentPixValue" VARCHAR(255) NOT NULL DEFAULT '0';
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "paymentCardValue" VARCHAR(255) NOT NULL DEFAULT '0';
    `);
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Sales", "paymentCashValue");
    await queryInterface.removeColumn("Sales", "paymentPixValue");
    await queryInterface.removeColumn("Sales", "paymentCardValue");
  }
};
