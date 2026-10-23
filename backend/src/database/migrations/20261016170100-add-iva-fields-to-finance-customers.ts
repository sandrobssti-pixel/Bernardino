import { QueryInterface } from "sequelize";

// Reforma Tributária 2027 (CBS/IBS) — perfil do destinatário da nota, usado
// pelo motor de cálculo (`Iva2027Service.ts`) pra decidir o regime (B2C =
// Simples dentro do DAS, B2B = híbrido por fora, B2G = isenção quando
// aplicável). Sem efeito nenhum enquanto `FiscalConfig.reform2027Enabled`
// for false. `IF NOT EXISTS` de propósito — ver lição da migration de
// armas (seção 11 da skill atendeflow-dev, v2.3.97).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FinanceCustomers" ADD COLUMN IF NOT EXISTS "ivaTaxpayerProfile" VARCHAR(255) DEFAULT 'B2C';
      ALTER TABLE "FinanceCustomers" ADD COLUMN IF NOT EXISTS "ivaGovExempt" BOOLEAN DEFAULT false;
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FinanceCustomers", "ivaTaxpayerProfile");
    await queryInterface.removeColumn("FinanceCustomers", "ivaGovExempt");
  }
};
