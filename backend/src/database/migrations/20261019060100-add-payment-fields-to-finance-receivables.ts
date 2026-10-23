import { QueryInterface } from "sequelize";

// Suporte a gerar cobrança (Pix/boleto) direto numa Conta a Receber via
// gateway de pagamento (Mercado Pago, Fase 1) — pedido do cliente. Campos
// guardam o resultado da ÚLTIMA cobrança gerada pra esse registro (gera de
// novo sobrescreve, não há histórico de cobranças múltiplas por enquanto).
// Diferente de `asaasPaymentId`/`splitIvaRetido`/`netReceivedViaAsaas`
// (já existentes, reservados pro Split Payment do IVA da Reforma 2027) —
// esses continuam intocados, sem uso aqui.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FinanceReceivables" ADD COLUMN IF NOT EXISTS "paymentProvider" VARCHAR(255) DEFAULT '';
      ALTER TABLE "FinanceReceivables" ADD COLUMN IF NOT EXISTS "paymentExternalId" VARCHAR(255) DEFAULT '';
      ALTER TABLE "FinanceReceivables" ADD COLUMN IF NOT EXISTS "paymentStatus" VARCHAR(255) DEFAULT '';
      ALTER TABLE "FinanceReceivables" ADD COLUMN IF NOT EXISTS "pixQrCode" TEXT DEFAULT '';
      ALTER TABLE "FinanceReceivables" ADD COLUMN IF NOT EXISTS "pixQrCodeBase64" TEXT DEFAULT '';
      ALTER TABLE "FinanceReceivables" ADD COLUMN IF NOT EXISTS "pixExpiresAt" TIMESTAMP NULL;
      ALTER TABLE "FinanceReceivables" ADD COLUMN IF NOT EXISTS "boletoUrl" VARCHAR(500) DEFAULT '';
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FinanceReceivables", "paymentProvider");
    await queryInterface.removeColumn("FinanceReceivables", "paymentExternalId");
    await queryInterface.removeColumn("FinanceReceivables", "paymentStatus");
    await queryInterface.removeColumn("FinanceReceivables", "pixQrCode");
    await queryInterface.removeColumn("FinanceReceivables", "pixQrCodeBase64");
    await queryInterface.removeColumn("FinanceReceivables", "pixExpiresAt");
    await queryInterface.removeColumn("FinanceReceivables", "boletoUrl");
  }
};
