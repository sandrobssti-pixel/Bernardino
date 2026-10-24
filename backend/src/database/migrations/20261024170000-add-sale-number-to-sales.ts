import { QueryInterface } from "sequelize";

// Número sequencial da venda (v2.3.218, pedido do cliente: o "#" da lista
// de Vendas mostrava o `id` interno do banco, confuso — queria algo
// sequencial "bonito", igual o código do cliente, mas PRÓPRIO da venda
// (reaproveitar o código do cliente repetiria o número em toda venda
// daquele cliente). Mesmo padrão da migration de `FinanceCustomers.code`
// (20261024150000): coluna aditiva + backfill das vendas que já existiam,
// numeradas na ordem em que foram criadas (id ASC), por empresa.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "saleNumber" VARCHAR(255) NOT NULL DEFAULT '';
    `);

    await queryInterface.sequelize.query(`
      UPDATE "Sales" AS s
      SET "saleNumber" = LPAD(numbered.rn::text, 5, '0')
      FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY id ASC) AS rn
        FROM "Sales"
      ) AS numbered
      WHERE s.id = numbered.id AND s."saleNumber" = '';
    `);
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Sales", "saleNumber");
  }
};
