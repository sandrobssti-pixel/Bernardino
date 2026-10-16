import { Op, fn, col, literal } from "sequelize";
import moment from "moment";
import FinanceExpense from "../../models/FinanceExpense";
import FinanceReceivable from "../../models/FinanceReceivable";
import FinanceProduct from "../../models/FinanceProduct";
import Sale from "../../models/Sale";
import SaleItem from "../../models/SaleItem";
import FiscalConfig from "../../models/FiscalConfig";
import { isProductionActive } from "../FiscalService/FiscalConfigService";

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
};

// "value" é salvo como string (evita imprecisão de ponto flutuante), então
// todo SUM precisa de um CAST explícito pra numeric — o Postgres não soma
// varchar direto (42883: function sum(character varying) does not exist).
//
// ⚠️ Bug real encontrado em produção (v2.3.24): o campo "Valor (R$)" dos
// formulários de conta a pagar/receber/produto aceitava texto livre — um
// valor digitado no formato brasileiro ("150,00", com vírgula) ficava salvo
// como string não-numérica. Um CAST direto pra numeric QUEBRA com erro se a
// string não for um número válido pro Postgres (ex.: "150,00" tem vírgula,
// não é numeric válido) — isso derrubava o Painel Financeiro inteiro com
// 500 assim que existisse UM registro com valor mal formatado. Corrigido
// aqui com um CASE WHEN que só faz o CAST se o valor bater um regex de
// número válido, tratando qualquer outra coisa como 0 (não quebra, só não
// soma esse registro — o valor mal formatado precisa ser corrigido editando
// o registro na tela, agora com o campo já sendo um input numérico).
const sumValue = () =>
  literal(
    `SUM(CASE WHEN "value" ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN CAST("value" AS NUMERIC) ELSE 0 END)`
  );

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

// Saúde do estoque (módulo de estoque, v2.3.114) — só considera produtos
// com `controlStock` ligado (os demais nunca entram nessa conta, igual já
// vale pra validação/desconto na confirmação da venda em `SaleService`).
// "Baixo" = estoque <= mínimo configurado E mínimo > 0 (0 significa "sem
// aviso configurado" pro produto, não "estoque zerado é o mínimo").
// "Zerado" é sempre destacado (<= 0), mesmo sem mínimo configurado.
export const getStockHealth = async (companyId: number) => {
  const products = await FinanceProduct.findAll({
    where: { companyId, controlStock: true, active: true },
    attributes: ["id", "name", "sku", "stockQuantity", "minStockQuantity"],
    order: [["name", "ASC"]],
    raw: true
  });

  const outOfStock = (products as any[]).filter((p) => p.stockQuantity <= 0);
  const lowStock = (products as any[]).filter(
    (p) => p.stockQuantity > 0 && p.minStockQuantity > 0 && p.stockQuantity <= p.minStockQuantity
  );

  return {
    trackedCount: products.length,
    outOfStock,
    lowStock
  };
};

// Dashboard de lucro (v2.3.117) — compra x imposto x venda x lucro, por
// produto e por mês. Pedido do cliente ("não tem uma visão se está gerando
// lucro ou não na precificação"), confirmado via questionário: custo/
// imposto vêm do cadastro do produto (snapshot no item no momento da
// venda — ver SaleService.buildItemRows), um % de imposto único por
// produto (não o detalhamento de ICMS/PIS/COFINS/IPI/ISS), e o painel só
// aparece quando a empresa está com a Focus NFe em modo Produção (não
// conta vendas de teste em Homologação nem o histórico importado da
// migração de ERP enquanto a empresa ainda não "foi pra produção" de
// verdade).
export const getProfitDashboard = async (companyId: number) => {
  const config = await FiscalConfig.findOne({ where: { companyId } });
  if (!config || !isProductionActive(config)) {
    return { enabled: false };
  }

  const items = await SaleItem.findAll({
    attributes: ["productId", "description", "sku", "quantity", "unitPrice", "totalPrice", "costPrice", "taxRate"],
    include: [
      {
        model: Sale,
        as: "sale",
        attributes: ["saleDate"],
        where: { companyId, status: "confirmed" },
        required: true
      }
    ]
  });

  const byProductMap = new Map<string, any>();
  const byMonthMap = new Map<string, any>();
  const totals = { gross: 0, cost: 0, tax: 0, profit: 0 };

  (items as any[]).forEach((item) => {
    const quantity = toNumber(item.quantity);
    const gross = toNumber(item.totalPrice);
    const cost = toNumber(item.costPrice) * quantity;
    const tax = gross * (toNumber(item.taxRate) / 100);
    const profit = gross - cost - tax;

    totals.gross += gross;
    totals.cost += cost;
    totals.tax += tax;
    totals.profit += profit;

    const productKey = item.productId ? `p${item.productId}` : `d:${item.description}`;
    const existing = byProductMap.get(productKey) || {
      productId: item.productId || null,
      name: item.description,
      sku: item.sku || "",
      quantity: 0,
      gross: 0,
      cost: 0,
      tax: 0,
      profit: 0
    };
    existing.quantity += quantity;
    existing.gross += gross;
    existing.cost += cost;
    existing.tax += tax;
    existing.profit += profit;
    byProductMap.set(productKey, existing);

    const monthKey = moment(item.sale?.saleDate).isValid()
      ? moment(item.sale.saleDate).format("YYYY-MM")
      : "sem-data";
    const monthExisting = byMonthMap.get(monthKey) || { month: monthKey, gross: 0, cost: 0, tax: 0, profit: 0 };
    monthExisting.gross += gross;
    monthExisting.cost += cost;
    monthExisting.tax += tax;
    monthExisting.profit += profit;
    byMonthMap.set(monthKey, monthExisting);
  });

  const byProduct = Array.from(byProductMap.values())
    .map((p) => ({ ...p, margin: p.gross > 0 ? (p.profit / p.gross) * 100 : 0 }))
    .sort((a, b) => b.profit - a.profit);

  const monthly = Array.from(byMonthMap.values())
    .filter((m) => m.month !== "sem-data")
    .sort((a, b) => (a.month > b.month ? 1 : -1))
    .map((m) => ({ ...m, monthLabel: moment(m.month, "YYYY-MM").format("MMM/YY") }));

  return {
    enabled: true,
    totals: { ...totals, margin: totals.gross > 0 ? (totals.profit / totals.gross) * 100 : 0 },
    byProduct,
    monthly
  };
};
