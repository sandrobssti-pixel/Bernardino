import { QueryInterface } from "sequelize";

// Cliente pediu pra cada gateway (Mercado Pago/Asaas) ligar/desligar
// SOZINHO, independente um do outro (os dois podem ficar ativos ao mesmo
// tempo) — substitui o campo `provider` (seletor único, "qual é o
// ativo"), que fica na tabela sem uso novo (mesmo padrão de coluna
// descontinuada já usado em FiscalConfig.gatewayToken). Ver
// docs/MANUAL_TECNICO.md.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FinancePaymentConfigs" ADD COLUMN IF NOT EXISTS "mercadoPagoEnabled" BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE "FinancePaymentConfigs" ADD COLUMN IF NOT EXISTS "asaasEnabled" BOOLEAN NOT NULL DEFAULT false;
      UPDATE "FinancePaymentConfigs" SET "mercadoPagoEnabled" = (provider = 'mercadopago' OR provider IS NULL OR provider = '');
      UPDATE "FinancePaymentConfigs" SET "asaasEnabled" = (COALESCE(provider, '') = 'asaas');
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FinancePaymentConfigs", "mercadoPagoEnabled");
    await queryInterface.removeColumn("FinancePaymentConfigs", "asaasEnabled");
  }
};
