import { QueryInterface } from "sequelize";

// Campo separado de `phone` — pedido do cliente (Despachante Bélico): o
// WhatsApp é o número usado pra disparo de cobrança/lembrete automático
// (campanha de inadimplência, notificação de troca de status), nem sempre
// é o mesmo telefone de contato geral já cadastrado. Ver
// docs/MANUAL_TECNICO.md.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FinanceCustomers" ADD COLUMN IF NOT EXISTS "whatsapp" VARCHAR(255) NOT NULL DEFAULT '';
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FinanceCustomers", "whatsapp");
  }
};
