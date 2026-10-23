import { QueryInterface } from "sequelize";

// Endereço do emitente (a própria empresa-cliente) nunca existiu em lugar
// nenhum do sistema (nem Company, nem FiscalConfig) — só o endereço do
// DESTINATÁRIO (cliente da venda) é coletado hoje. Endereço do emitente é
// campo obrigatório no XML da NF-e/NFC-e (enderEmit) — causa raiz
// confirmada do "Erro na validação do Schema XML" no primeiro teste real
// contra a Focus NFe (homologação), comparando com uma nota modelo (NF-e
// nº 491, emitida por outro sistema) que o cliente mandou. Campos texto
// livre (cidade/UF), não derivados do `cityCode` (IBGE) já existente —
// mesmo padrão já usado pro endereço do destinatário
// (FocusNFeService.buildDestinatario) e pro FinanceCustomer, pra não
// precisar de uma tabela de lookup IBGE->nome no backend. `IF NOT EXISTS`
// de propósito (skill atendeflow-dev, seção 11).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FiscalConfigs" ADD COLUMN IF NOT EXISTS "emitterZipCode" VARCHAR(255) DEFAULT '';
      ALTER TABLE "FiscalConfigs" ADD COLUMN IF NOT EXISTS "emitterStreet" VARCHAR(255) DEFAULT '';
      ALTER TABLE "FiscalConfigs" ADD COLUMN IF NOT EXISTS "emitterNumber" VARCHAR(255) DEFAULT '';
      ALTER TABLE "FiscalConfigs" ADD COLUMN IF NOT EXISTS "emitterComplement" VARCHAR(255) DEFAULT '';
      ALTER TABLE "FiscalConfigs" ADD COLUMN IF NOT EXISTS "emitterNeighborhood" VARCHAR(255) DEFAULT '';
      ALTER TABLE "FiscalConfigs" ADD COLUMN IF NOT EXISTS "emitterCity" VARCHAR(255) DEFAULT '';
      ALTER TABLE "FiscalConfigs" ADD COLUMN IF NOT EXISTS "emitterState" VARCHAR(255) DEFAULT '';
      ALTER TABLE "FiscalConfigs" ADD COLUMN IF NOT EXISTS "emitterPhone" VARCHAR(255) DEFAULT '';
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FiscalConfigs", "emitterZipCode");
    await queryInterface.removeColumn("FiscalConfigs", "emitterStreet");
    await queryInterface.removeColumn("FiscalConfigs", "emitterNumber");
    await queryInterface.removeColumn("FiscalConfigs", "emitterComplement");
    await queryInterface.removeColumn("FiscalConfigs", "emitterNeighborhood");
    await queryInterface.removeColumn("FiscalConfigs", "emitterCity");
    await queryInterface.removeColumn("FiscalConfigs", "emitterState");
    await queryInterface.removeColumn("FiscalConfigs", "emitterPhone");
  }
};
