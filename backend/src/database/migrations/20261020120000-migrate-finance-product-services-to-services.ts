import { QueryInterface } from "sequelize";

// Migração de DADOS (não só schema) — v2.3.175, pedido explícito do
// cliente ao decidir que "Serviços" vira um cadastro próprio: migrar
// automaticamente os Produtos já cadastrados com Tipo=Serviço (inclui
// os 37 serviços oficiais do Despachante Bélico, "CAC -"/"Civil -"/
// "Militar -", importados antes via planilha) pro cadastro de Serviço
// novo, sem precisar reimportar nada. Os registros de Produto NÃO são
// apagados — continuam existindo em Financeiro → Produtos (ainda
// necessários pra quem vende serviço com nota fiscal de verdade).
//
// Idempotente por `NOT EXISTS` (companyId + name) — rodar de novo (ex.:
// corrida/retry parcial) não duplica.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      INSERT INTO "Services" ("code", "name", "value", "paymentTerms", "description", "photoUrl", "active", "companyId", "createdAt", "updatedAt")
      SELECT fp."sku", fp."name", fp."price", '', COALESCE(fp."notes", ''), COALESCE(fp."photoUrl", ''), fp."active", fp."companyId", fp."createdAt", fp."updatedAt"
      FROM "FinanceProducts" fp
      WHERE fp."type" = 'service'
        AND NOT EXISTS (
          SELECT 1 FROM "Services" s
          WHERE s."companyId" = fp."companyId" AND s."name" = fp."name"
        );
    `);
  },
  down: async () => {
    // Migração de dados — não desfaz (apagar os Serviços migrados
    // arriscaria apagar edições feitas depois pelo usuário no cadastro
    // novo). Reverter o schema (migration anterior, create-services) já
    // remove a tabela inteira de qualquer forma.
  }
};
