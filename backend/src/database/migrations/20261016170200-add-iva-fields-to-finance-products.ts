import { QueryInterface } from "sequelize";

// Reforma Tributária 2027 (CBS/IBS) — CST e alíquotas estimadas por
// produto/serviço, mais o indicador de redução de 60% pra cursos/
// treinamentos (Lei da reforma). Sem efeito nenhum enquanto
// `FiscalConfig.reform2027Enabled` for false — ver `Iva2027Service.ts`.
// `IF NOT EXISTS` de propósito — ver lição da migration de armas (seção
// 11 da skill atendeflow-dev, v2.3.97).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "ivaCstCbs" VARCHAR(255) DEFAULT '';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "ivaCstIbs" VARCHAR(255) DEFAULT '';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "ivaCbsRate" VARCHAR(255) DEFAULT '0';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "ivaIbsRate" VARCHAR(255) DEFAULT '0';
      ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "ivaEducationReduction" BOOLEAN DEFAULT false;
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FinanceProducts", "ivaCstCbs");
    await queryInterface.removeColumn("FinanceProducts", "ivaCstIbs");
    await queryInterface.removeColumn("FinanceProducts", "ivaCbsRate");
    await queryInterface.removeColumn("FinanceProducts", "ivaIbsRate");
    await queryInterface.removeColumn("FinanceProducts", "ivaEducationReduction");
  }
};
