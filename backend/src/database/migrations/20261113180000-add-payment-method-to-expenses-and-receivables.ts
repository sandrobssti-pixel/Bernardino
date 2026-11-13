import { QueryInterface, DataTypes } from "sequelize";

// Pedido do cliente: "coloque em contas a pagar e contas a receber
// forma de pagamento, igual do modulo vendas" — mesmas opções do
// campo "Forma de pagamento" das Vendas (ver SALE_PAYMENT_METHOD_OPTIONS
// no frontend), sem o desdobramento em 3 campos de valor que "mixed"
// tem na Venda.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.addColumn("FinanceExpenses", "paymentMethod", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: ""
      }),
      queryInterface.addColumn("FinanceReceivables", "paymentMethod", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: ""
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("FinanceExpenses", "paymentMethod"),
      queryInterface.removeColumn("FinanceReceivables", "paymentMethod")
    ]);
  }
};
