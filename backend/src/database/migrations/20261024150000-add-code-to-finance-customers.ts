import { QueryInterface } from "sequelize";

// Código sequencial do cliente (v2.3.217, pedido do cliente: "colocar o
// código do cliente começando por 00001 em ordem crescente") — coluna
// aditiva, mais um UPDATE de backfill pros clientes que já existiam antes
// desta versão: numera cada um na ordem em que foi cadastrado (id
// ascendente), POR EMPRESA (multi-tenant — cada empresa começa do 00001
// de novo), com `ROW_NUMBER()` formatado em 5 dígitos. Daqui pra frente,
// todo cliente novo ganha o próximo código em
// `FinanceCustomerService.nextCustomerCode`.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FinanceCustomers" ADD COLUMN IF NOT EXISTS "code" VARCHAR(255) NOT NULL DEFAULT '';
    `);

    await queryInterface.sequelize.query(`
      UPDATE "FinanceCustomers" AS fc
      SET "code" = LPAD(numbered.rn::text, 5, '0')
      FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY id ASC) AS rn
        FROM "FinanceCustomers"
      ) AS numbered
      WHERE fc.id = numbered.id AND fc."code" = '';
    `);
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FinanceCustomers", "code");
  }
};
