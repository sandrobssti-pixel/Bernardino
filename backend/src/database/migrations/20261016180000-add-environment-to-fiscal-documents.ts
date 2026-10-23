import { QueryInterface } from "sequelize";

// Rastreia em qual ambiente (Homologação/Produção) cada documento fiscal
// foi emitido — necessário pra saber quais notas são só teste e podem ser
// excluídas de verdade (pedido do cliente: limpar as notas/vendas feitas
// em Homologação antes/depois de passar pra Produção). Documentos
// emitidos antes desta coluna existir ficam com "" (desconhecido) —
// tratado como não-produção pra fins de exclusão, já que até aqui todo
// teste deste cliente foi feito em Homologação. `IF NOT EXISTS` de
// propósito — ver lição da migration de armas (seção 11 da skill
// atendeflow-dev, v2.3.97).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FiscalDocuments" ADD COLUMN IF NOT EXISTS "environment" VARCHAR(255) DEFAULT '';
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FiscalDocuments", "environment");
  }
};
