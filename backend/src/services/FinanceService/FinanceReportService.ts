import { Op, fn, col, cast, literal } from "sequelize";
import moment from "moment";
import FinanceExpense from "../../models/FinanceExpense";
import FinanceReceivable from "../../models/FinanceReceivable";

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
};

// "value" é salvo como string (evita imprecisão de ponto flutuante), então
// todo SUM precisa de um CAST explícito pra numeric — o Postgres não soma
// varchar direto (42883: function sum(character varying) does not exist).
const sumValue = () => fn("SUM", cast(col("value"), "numeric"));

// Substitui Model.sum("value", ...) — esse helper do Sequelize gera
// SUM("value") sem cast e quebra (42883) porque "value" é varchar.
const sumWhere = async (
  model: typeof FinanceExpense | typeof FinanceReceivable,
  where: Record<string, unknown>
): Promise<number> => {
  const row: any = await (model as any).findOne({
    attributes: [[sumValue(), "total"]],
    where,
    raw: true
  });
  return toNumber(row?.total);
};

// Cartões de resumo do Painel Financeiro: pendências, vencidos, pago/
// recebido no mês corrente, saldo previsto.
export const getSummary = async (companyId: number) => {
  const today = moment().format("YYYY-MM-DD");
  const monthStart = moment().startOf("month").format("YYYY-MM-DD");
  const monthEnd = moment().endOf("month").format("YYYY-MM-DD");

  const [
    pendingExpensesNum,
    overdueExpensesNum,
    pendingReceivablesNum,
    overdueReceivablesNum,
    paidThisMonthNum,
    receivedThisMonthNum
  ] = await Promise.all([
    sumWhere(FinanceExpense, { companyId, status: "pending" }),
    sumWhere(FinanceExpense, {
      companyId,
      status: "pending",
      dueDate: { [Op.lt]: today }
    }),
    sumWhere(FinanceReceivable, { companyId, status: "pending" }),
    sumWhere(FinanceReceivable, {
      companyId,
      status: "pending",
      dueDate: { [Op.lt]: today }
    }),
    sumWhere(FinanceExpense, {
      companyId,
      status: "paid",
      paymentDate: { [Op.between]: [monthStart, monthEnd] }
    }),
    sumWhere(FinanceReceivable, {
      companyId,
      status: "received",
      receivedDate: { [Op.between]: [monthStart, monthEnd] }
    })
  ]);

  return {
    pendingExpenses: pendingExpensesNum,
    overdueExpenses: overdueExpensesNum,
    pendingReceivables: pendingReceivablesNum,
    overdueReceivables: overdueReceivablesNum,
    paidThisMonth: paidThisMonthNum,
    receivedThisMonth: receivedThisMonthNum,
    projectedBalance: pendingReceivablesNum - pendingExpensesNum
  };
};

// Fluxo de caixa (entradas x saídas) dos últimos N meses, com base na data
// real de pagamento/recebimento (não na data de vencimento) — é o que
// efetivamente entrou/saiu do caixa em cada mês.
export const getCashFlow = async (companyId: number, months = 6) => {
  const start = moment().subtract(months - 1, "months").startOf("month");
  const end = moment().endOf("month");

  const [expenseRows, receivableRows] = await Promise.all([
    FinanceExpense.findAll({
      attributes: [
        [fn("to_char", col("paymentDate"), "YYYY-MM"), "month"],
        [sumValue(), "total"]
      ],
      where: {
        companyId,
        status: "paid",
        paymentDate: { [Op.between]: [start.format("YYYY-MM-DD"), end.format("YYYY-MM-DD")] }
      } as any,
      group: [literal('1') as any],
      raw: true
    }),
    FinanceReceivable.findAll({
      attributes: [
        [fn("to_char", col("receivedDate"), "YYYY-MM"), "month"],
        [sumValue(), "total"]
      ],
      where: {
        companyId,
        status: "received",
        receivedDate: { [Op.between]: [start.format("YYYY-MM-DD"), end.format("YYYY-MM-DD")] }
      } as any,
      group: [literal('1') as any],
      raw: true
    })
  ]);

  const expenseByMonth: Record<string, number> = {};
  (expenseRows as any[]).forEach((row) => {
    expenseByMonth[row.month] = toNumber(row.total);
  });

  const incomeByMonth: Record<string, number> = {};
  (receivableRows as any[]).forEach((row) => {
    incomeByMonth[row.month] = toNumber(row.total);
  });

  const series = [];
  for (let i = 0; i < months; i += 1) {
    const monthMoment = moment(start).add(i, "months");
    const key = monthMoment.format("YYYY-MM");
    series.push({
      month: key,
      monthLabel: monthMoment.format("MMM/YY"),
      income: incomeByMonth[key] || 0,
      expense: expenseByMonth[key] || 0
    });
  }

  return series;
};

// Despesas por categoria (pendentes + pagas) — pro gráfico de composição de
// custos. Sem filtro de período por padrão: mostra o panorama geral das
// categorias cadastradas.
export const getExpensesByCategory = async (companyId: number) => {
  const rows = await FinanceExpense.findAll({
    attributes: ["category", [sumValue(), "total"]],
    where: { companyId },
    group: ["category"],
    order: [[literal("total"), "DESC"]],
    raw: true
  });

  return (rows as any[]).map((row) => ({
    category: row.category || "Outros",
    total: toNumber(row.total)
  }));
};
