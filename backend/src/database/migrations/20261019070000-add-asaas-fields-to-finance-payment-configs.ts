import { QueryInterface } from "sequelize";

// Fase 2 da cobrança via gateway (ver seção 134/135 do manual técnico) —
// Asaas como segundo gateway, ao lado do Mercado Pago (Fase 1). `provider`
// decide qual dos dois gera a próxima cobrança quando o Admin clica
// "Gerar Pix"/"Gerar boleto" numa Conta a Receber — mesmo padrão já usado
// em FiscalConfig.gatewayProvider (campo string simples, sem enum no
// banco, pra não precisar de migração nova se entrar um terceiro gateway).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FinancePaymentConfigs" ADD COLUMN IF NOT EXISTS "provider" VARCHAR(255) DEFAULT 'mercadopago';
      ALTER TABLE "FinancePaymentConfigs" ADD COLUMN IF NOT EXISTS "asaasApiKeySandbox" VARCHAR(255) DEFAULT '';
      ALTER TABLE "FinancePaymentConfigs" ADD COLUMN IF NOT EXISTS "asaasApiKeyProduction" VARCHAR(255) DEFAULT '';
      ALTER TABLE "FinancePaymentConfigs" ADD COLUMN IF NOT EXISTS "asaasWebhookToken" VARCHAR(255) DEFAULT '';
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FinancePaymentConfigs", "provider");
    await queryInterface.removeColumn("FinancePaymentConfigs", "asaasApiKeySandbox");
    await queryInterface.removeColumn("FinancePaymentConfigs", "asaasApiKeyProduction");
    await queryInterface.removeColumn("FinancePaymentConfigs", "asaasWebhookToken");
  }
};
