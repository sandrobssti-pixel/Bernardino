import AppError from "../../errors/AppError";
import PayrollEntry from "../../models/PayrollEntry";
import PayrollExpenseLaunch from "../../models/PayrollExpenseLaunch";
import FinanceExpense from "../../models/FinanceExpense";
import { round2 } from "./PayrollCalculationService";
import { validateCompetency } from "./PayrollEntryService";

// Lançamento da Folha Mensal em Contas a Pagar (RH — pedido do cliente
// desde a Fase 2: "quando lance todos os valores seja incluidos em
// contas a pagar como custos fixos"). Decisões fechadas com o cliente
// antes de codar (ver docs/MANUAL_TECNICO.md):
// - Valor por funcionário = líquido + FGTS (o que o sistema REALMENTE
//   calcula de verdade — não inclui INSS patronal, que nunca foi
//   pesquisado/implementado neste sistema; inventar esse valor seria
//   pior do que não incluir).
// - UMA conta a pagar CONSOLIDADA por competência (não uma por
//   funcionário) — "Folha de pagamento — MM/AAAA", igual um contador
//   lança de verdade.
// Botão manual (sem geração automática) — mesma filosofia de revisão
// humana já usada em "Calcular folha deste mês".

interface LaunchRequest {
  companyId: number;
  competencyMonth: number;
  competencyYear: number;
}

// Último dia da competência — default razoável de vencimento (editável
// depois, como qualquer Conta a Pagar; o sistema não tem como saber o
// dia de pagamento de folha específico de cada empresa).
const lastDayOfCompetency = (month: number, year: number): string => {
  const lastDay = new Date(year, month, 0);
  const mm = String(lastDay.getMonth() + 1).padStart(2, "0");
  const dd = String(lastDay.getDate()).padStart(2, "0");
  return `${lastDay.getFullYear()}-${mm}-${dd}`;
};

export const getLaunchStatus = async ({
  companyId,
  competencyMonth,
  competencyYear
}: LaunchRequest): Promise<PayrollExpenseLaunch | null> => {
  validateCompetency(competencyMonth, competencyYear);

  return PayrollExpenseLaunch.findOne({
    where: { companyId, competencyMonth, competencyYear },
    include: [{ model: FinanceExpense, as: "financeExpense" }]
  });
};

// Cria (ou resincroniza) a conta a pagar consolidada da competência.
// Idempotente por competência (índice único) — chamar de novo depois de
// recalcular a folha ATUALIZA o valor da conta já lançada, não duplica.
// Recusa resincronizar se a conta já foi marcada como paga (mudar o
// valor de uma conta já paga seria incoerente/perigoso — nesse caso o
// usuário ajusta manualmente na tela de Contas a Pagar se precisar).
export const launch = async ({
  companyId,
  competencyMonth,
  competencyYear
}: LaunchRequest): Promise<PayrollExpenseLaunch> => {
  validateCompetency(competencyMonth, competencyYear);

  const entries = await PayrollEntry.findAll({
    where: { companyId, competencyMonth, competencyYear }
  });

  if (entries.length === 0) {
    throw new AppError("ERR_PAYROLL_EXPENSE_NO_ENTRIES", 400);
  }

  const totalValue = round2(
    entries.reduce((sum, entry) => sum + (Number(entry.netSalary) || 0) + (Number(entry.fgtsValue) || 0), 0)
  );

  const description = `Folha de pagamento — ${String(competencyMonth).padStart(2, "0")}/${competencyYear}`;

  const existing = await PayrollExpenseLaunch.findOne({
    where: { companyId, competencyMonth, competencyYear },
    include: [{ model: FinanceExpense, as: "financeExpense" }]
  });

  if (existing) {
    if (existing.financeExpense?.status === "paid") {
      throw new AppError("ERR_PAYROLL_EXPENSE_ALREADY_PAID", 400);
    }
    await existing.financeExpense.update({ value: String(totalValue), description });
    await existing.update({ totalValue });
    return getLaunchStatus({ companyId, competencyMonth, competencyYear }) as Promise<PayrollExpenseLaunch>;
  }

  const financeExpense = await FinanceExpense.create({
    companyId,
    description,
    category: "Salários",
    costType: "fixed",
    value: String(totalValue),
    dueDate: lastDayOfCompetency(competencyMonth, competencyYear),
    status: "pending"
  } as any);

  await PayrollExpenseLaunch.create({
    companyId,
    competencyMonth,
    competencyYear,
    financeExpenseId: financeExpense.id,
    totalValue
  } as any);

  return getLaunchStatus({ companyId, competencyMonth, competencyYear }) as Promise<PayrollExpenseLaunch>;
};
