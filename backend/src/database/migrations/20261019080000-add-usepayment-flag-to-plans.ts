import { QueryInterface, DataTypes } from "sequelize";

// Cobrança via gateway (Pix/boleto, Mercado Pago/Asaas — seções 134/135 do
// manual técnico) é um add-on SEPARADO do Financeiro (mesmo padrão de
// `useFiscal`) — o Master decide, por plano, se o cliente paga por esse
// serviço extra. Sempre exige `useFinancial` também ativo (checado em
// EnsurePaymentAccess), já que a cobrança é gerada a partir de uma Conta a
// Receber, que pertence ao próprio Financeiro.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Plans", "usePayment", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Plans", "usePayment");
  }
};
