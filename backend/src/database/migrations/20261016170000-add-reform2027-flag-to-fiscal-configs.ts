import { QueryInterface } from "sequelize";

// Chave global de ativação da Reforma Tributária 2027 (CBS/IBS) — enquanto
// `false` (padrão), nenhuma regra/campo novo da Reforma tem efeito algum no
// faturamento atual; é o único jeito de ligar o motor de cálculo em
// `Iva2027Service.ts`. Pedido do cliente: pré-configurar a estrutura agora,
// sem impacto nenhum nas regras atuais, aguardando o gatilho desta chave
// quando a reforma entrar em vigor. `IF NOT EXISTS` de propósito — ver
// lição da migration de armas (seção 11 da skill atendeflow-dev, v2.3.97).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FiscalConfigs" ADD COLUMN IF NOT EXISTS "reform2027Enabled" BOOLEAN DEFAULT false;
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FiscalConfigs", "reform2027Enabled");
  }
};
