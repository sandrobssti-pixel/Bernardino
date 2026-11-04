import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Lançamento da Folha Mensal em Contas a Pagar (RH, v2.3.248 — pedido do
// cliente desde a Fase 2: "quando lance todos os valores seja incluidos
// em contas a pagar como custos fixos"). UMA conta a pagar CONSOLIDADA
// por competência (não uma por funcionário — ver
// PayrollExpenseService.ts), rastreada aqui pra saber se já foi lançada
// (evita duplicar ao clicar de novo) e permitir resincronizar o valor se
// a folha for recalculada antes do pagamento. Índice único
// (companyId, competencyMonth, competencyYear) — só pode haver UM
// lançamento por competência por empresa. `financeExpenseId` com
// `onDelete: CASCADE`: se a conta a pagar for excluída direto na tela de
// Contas a Pagar, este registro de rastreamento some junto, liberando a
// competência pra ser lançada de novo.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "PayrollExpenseLaunches";
    const existingTables: ExistingTables = await queryInterface.showAllTables();
    if (existingTables.includes(table)) return;

    await queryInterface.createTable(table, {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      competencyMonth: { type: DataTypes.INTEGER, allowNull: false },
      competencyYear: { type: DataTypes.INTEGER, allowNull: false },
      financeExpenseId: {
        type: DataTypes.INTEGER,
        references: { model: "FinanceExpenses", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      // Snapshot do total lançado (líquido + FGTS somados de todos os
      // PayrollEntry da competência) — útil pra exibir na tela sem
      // precisar reconsultar o FinanceExpense; o valor "oficial" de
      // verdade continua sendo o do FinanceExpense (editável à parte).
      totalValue: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      createdAt: { type: DataTypes.DATE(6), allowNull: false },
      updatedAt: { type: DataTypes.DATE(6), allowNull: false }
    });

    await queryInterface.addIndex(table, ["companyId", "competencyMonth", "competencyYear"], {
      unique: true,
      name: "payroll_expense_launches_company_competency_unique"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("PayrollExpenseLaunches");
  }
};
