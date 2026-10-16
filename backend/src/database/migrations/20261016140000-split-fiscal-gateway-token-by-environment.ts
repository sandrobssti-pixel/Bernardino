import { QueryInterface } from "sequelize";

// Pedido do cliente (v2.3.109), olhando o próprio painel da Focus NFe: lá
// Homologação e Produção são dois blocos de credencial SEPARADOS (cada um
// com seu próprio token), não um único token + um seletor de ambiente como
// estava modelado aqui até agora. `gatewayToken` (coluna antiga) vira
// `gatewayTokenSandbox`/`gatewayTokenProduction`, cada ambiente com seu
// próprio liga/desliga (`sandboxEnabled`/`productionEnabled`). A coluna
// antiga `gatewayToken` NÃO é removida (só deixa de ser lida pelo código
// novo) — o valor que já estava lá é copiado pra `gatewayTokenSandbox`
// (homologação era o único ambiente usado até aqui) pra não perder o
// token que a empresa já tinha salvo. `IF NOT EXISTS` de propósito — ver
// lição da migration de armas (seção 11 da skill atendeflow-dev, v2.3.97).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FiscalConfigs" ADD COLUMN IF NOT EXISTS "gatewayTokenSandbox" VARCHAR(255) DEFAULT '';
      ALTER TABLE "FiscalConfigs" ADD COLUMN IF NOT EXISTS "gatewayTokenProduction" VARCHAR(255) DEFAULT '';
      ALTER TABLE "FiscalConfigs" ADD COLUMN IF NOT EXISTS "sandboxEnabled" BOOLEAN DEFAULT true;
      ALTER TABLE "FiscalConfigs" ADD COLUMN IF NOT EXISTS "productionEnabled" BOOLEAN DEFAULT false;

      UPDATE "FiscalConfigs"
      SET "gatewayTokenSandbox" = "gatewayToken"
      WHERE "gatewayToken" IS NOT NULL
        AND "gatewayToken" <> ''
        AND ("gatewayTokenSandbox" IS NULL OR "gatewayTokenSandbox" = '');
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FiscalConfigs", "gatewayTokenSandbox");
    await queryInterface.removeColumn("FiscalConfigs", "gatewayTokenProduction");
    await queryInterface.removeColumn("FiscalConfigs", "sandboxEnabled");
    await queryInterface.removeColumn("FiscalConfigs", "productionEnabled");
  }
};
