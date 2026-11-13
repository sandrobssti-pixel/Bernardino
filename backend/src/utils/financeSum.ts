import { literal } from "sequelize";

// "value" é salvo como string (evita imprecisão de ponto flutuante) em
// todo o módulo Financeiro (FinanceExpense/FinanceReceivable) — todo SUM
// precisa de CAST explícito pra numeric, e esse CAST só pode rodar em
// cima de valores que já batem um regex de número válido (ver bug real
// documentado em FinanceReportService.ts, v2.3.24: um valor digitado no
// formato brasileiro com vírgula quebrava o SUM direto com erro 42883,
// derrubando o Painel Financeiro inteiro). Extraído pra cá pra ser
// reaproveitado tanto pelos relatórios quanto pelo "Saldo total" das
// listas de Contas a Pagar/Receber (v2.3.284), sem duplicar a lógica.
export const sumValueLiteral = () =>
  literal(
    `SUM(CASE WHEN "value" ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN CAST("value" AS NUMERIC) ELSE 0 END)`
  );

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
};

// Soma a coluna "value" de um model (FinanceExpense/FinanceReceivable)
// filtrado por `where` — mesmo `where` usado em list()/findAndCountAll,
// sem paginação, pra somar TODOS os registros que batem o filtro (não só
// a página atual).
export const sumModelValue = async (
  model: any,
  where: Record<string, unknown>
): Promise<number> => {
  const row: any = await model.findOne({
    attributes: [[sumValueLiteral(), "total"]],
    where,
    raw: true
  });
  return toNumber(row?.total);
};
