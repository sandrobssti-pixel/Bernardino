import { QueryInterface } from "sequelize";

// Integração com o módulo Financeiro que já existe (confirmado com o
// cliente: reaproveitar, não construir um controle separado) —
// "financeCustomerId" vincula o associado a um FinanceCustomer (mesmo
// padrão opcional de Member.contactId); "filiationValidUntil" é a
// validade calculada da filiação ("Declaração de Filiação", tela de
// referência) — estendida automaticamente quando uma cobrança de
// filiação (MemberMembershipCharge) é paga. Ver
// docs/MANUAL_TECNICO.md.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      'ALTER TABLE "Members" ADD COLUMN IF NOT EXISTS "financeCustomerId" INTEGER REFERENCES "FinanceCustomers"(id) ON UPDATE CASCADE ON DELETE SET NULL;'
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE "Members" ADD COLUMN IF NOT EXISTS "filiationValidUntil" DATE;'
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Members", "financeCustomerId");
    await queryInterface.removeColumn("Members", "filiationValidUntil");
  }
};
