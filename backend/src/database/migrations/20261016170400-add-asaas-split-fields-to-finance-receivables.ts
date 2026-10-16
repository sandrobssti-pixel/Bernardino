import { QueryInterface } from "sequelize";

// Preparação pra "Split Payment" do IVA (Reforma 2027) via Asaas — quando a
// API do Asaas liberar o split automático do imposto no pagamento online, o
// valor líquido que efetivamente cair na conta já tem onde ser registrado
// aqui, pra bater com a conciliação das notas emitidas. Puramente estrutural
// por enquanto: nenhum código escreve nesses campos ainda (não existe
// integração com o Asaas no módulo Financeiro/Fiscal — o `AsaasBillingProvider`
// que já existe no projeto é de outro domínio, a cobrança da própria
// assinatura do AtendeFlow, não a venda ao cliente final da empresa-cliente).
// `IF NOT EXISTS` de propósito — ver lição da migration de armas (seção 11
// da skill atendeflow-dev, v2.3.97).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FinanceReceivables" ADD COLUMN IF NOT EXISTS "asaasPaymentId" VARCHAR(255) DEFAULT '';
      ALTER TABLE "FinanceReceivables" ADD COLUMN IF NOT EXISTS "splitIvaRetido" BOOLEAN DEFAULT false;
      ALTER TABLE "FinanceReceivables" ADD COLUMN IF NOT EXISTS "netReceivedViaAsaas" VARCHAR(255) DEFAULT '0';
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FinanceReceivables", "asaasPaymentId");
    await queryInterface.removeColumn("FinanceReceivables", "splitIvaRetido");
    await queryInterface.removeColumn("FinanceReceivables", "netReceivedViaAsaas");
  }
};
