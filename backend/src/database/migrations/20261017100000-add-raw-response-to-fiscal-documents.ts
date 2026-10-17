import { QueryInterface } from "sequelize";

// Guarda a resposta BRUTA do gateway (Focus NFe) junto com cada tentativa
// de emissão — até aqui só `errorMessage` (já processado/resumido) era
// salvo, e não dava pra conferir o payload completo que a Focus NFe
// devolveu quando a mensagem genérica de erro ("Erro na validação do
// Schema XML, verifique o detalhamento dos erros") não vinha acompanhada
// de detalhamento nenhum (v2.3.122) — sem o bruto, não tinha como saber se
// o gateway realmente não mandou mais detalhe, ou se o parser estava
// perdendo algum campo. `IF NOT EXISTS` de propósito (skill
// atendeflow-dev, seção 11).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FiscalDocuments" ADD COLUMN IF NOT EXISTS "raw" JSONB;
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FiscalDocuments", "raw");
  }
};
