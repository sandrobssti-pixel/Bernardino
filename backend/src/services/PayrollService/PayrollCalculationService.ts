import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Employee from "../../models/Employee";
import PayrollInssTable from "../../models/PayrollInssTable";
import PayrollInssBracket from "../../models/PayrollInssBracket";
import PayrollIrrfTable from "../../models/PayrollIrrfTable";
import PayrollIrrfBracket from "../../models/PayrollIrrfBracket";

// Motor de cálculo de folha (RH — Fase 2, ver docs/MANUAL_TECNICO.md).
// Funções puras e testáveis — nenhuma delas grava nada no banco (quem
// persiste é o PayrollEntryService). As tabelas de INSS/IRRF são
// SEMPRE lidas do banco (nunca hardcoded aqui), versionadas por
// `effectiveFrom`, pra poderem ser atualizadas sem deploy quando a
// Receita Federal/Previdência mudar os valores oficiais.
//
// Arredondamento: 2 casas decimais, "round half up" (Math.round padrão
// do JS já é half-up pra números positivos) — ex. 9,97575 arredonda pra
// 9,98. Todos os valores aqui são sempre >= 0 (desconto/benefício nunca
// é negativo), então não há ambiguidade de arredondamento em torno do
// zero.
//
// Arredondamento em DUAS etapas (primeiro pra 10 casas, depois pra 2) —
// necessário por um caso de borda real encontrado durante o
// desenvolvimento: `2751.40 × 0.075 - 182.16` deveria dar exatamente
// 24,195 (que arredonda pra 24,20), mas a aritmética de ponto flutuante
// do JS calcula 24,194999999999993 — arredondar direto pra 2 casas dava
// 24,19 (1 centavo errado). Arredondar primeiro pra 10 casas elimina
// esse ruído de ponto flutuante antes do arredondamento final pra 2
// casas, sem precisar de uma lib de decimal arbitrário.
//
// LIMITAÇÃO CONHECIDA: o cálculo de IRRF usa só a tabela progressiva
// tradicional — NÃO inclui o redutor adicional da Lei 15.270/2025
// (isenção efetiva até R$5.000/mês, redução decrescente até R$7.350,
// vigente desde jan/2026). Ver comentário completo em
// PayrollIrrfTable.ts e na migration de criação da tabela de IRRF. Até
// esse redutor ser confirmado contra o texto oficial da lei e
// implementado, o IRRF calculado aqui fica ACIMA do valor legalmente
// devido pra quem ganha até R$7.350/mês.

export const round2 = (value: number): number => {
  const denoised = Math.round(value * 1e10) / 1e10;
  return Math.round(denoised * 100) / 100;
};

interface BracketLike {
  minSalary?: number;
  minBase?: number;
  maxSalary?: number | null;
  maxBase?: number | null;
  rate: number;
  deduction: number;
  sortOrder: number;
}

const findBracket = <T extends BracketLike>(value: number, brackets: T[]): T | null => {
  const sorted = [...brackets].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const bracket of sorted) {
    const min = Number(bracket.minSalary ?? bracket.minBase ?? 0);
    const maxRaw = bracket.maxSalary ?? bracket.maxBase;
    const max = maxRaw === null || maxRaw === undefined ? null : Number(maxRaw);
    if (value >= min && (max === null || value <= max)) return bracket;
  }
  return null;
};

// Busca a versão da tabela vigente numa data de referência — a mais
// recente com `effectiveFrom <= referenceDate`. Usa a data da
// COMPETÊNCIA sendo calculada (não "hoje"), pra recálculos futuros de
// competências antigas continuarem usando a tabela que valia naquele
// mês, mesmo que a tabela tenha sido atualizada depois.
export const getInssTableForDate = async (referenceDate: string): Promise<PayrollInssTable> => {
  const table = await PayrollInssTable.findOne({
    where: { effectiveFrom: { [Op.lte]: referenceDate } },
    order: [["effectiveFrom", "DESC"]],
    include: [{ model: PayrollInssBracket, as: "brackets" }]
  });
  if (!table) {
    throw new AppError("ERR_PAYROLL_INSS_TABLE_NOT_FOUND", 400);
  }
  return table;
};

export const getIrrfTableForDate = async (referenceDate: string): Promise<PayrollIrrfTable> => {
  const table = await PayrollIrrfTable.findOne({
    where: { effectiveFrom: { [Op.lte]: referenceDate } },
    order: [["effectiveFrom", "DESC"]],
    include: [{ model: PayrollIrrfBracket, as: "brackets" }]
  });
  if (!table) {
    throw new AppError("ERR_PAYROLL_IRRF_TABLE_NOT_FOUND", 400);
  }
  return table;
};

export interface InssResult {
  base: number;
  value: number;
}

export const calculateInss = (grossSalary: number, inssTable: PayrollInssTable): InssResult => {
  const salary = Number(grossSalary) || 0;
  const brackets = inssTable.brackets || [];
  const bracket = findBracket(salary, brackets as unknown as BracketLike[]);

  if (!bracket) {
    // Salário acima do teto de contribuição — desconto fica fixo no teto
    // (`ceilingValue`), não extrapola a última faixa.
    const sorted = [...brackets].sort((a, b) => a.sortOrder - b.sortOrder);
    const lastBracket = sorted[sorted.length - 1];
    const cappedBase = lastBracket ? Number(lastBracket.maxSalary) : salary;
    return { base: cappedBase, value: round2(Number(inssTable.ceilingValue)) };
  }

  const raw = salary * (Number(bracket.rate) / 100) - Number(bracket.deduction);
  return { base: salary, value: round2(Math.max(raw, 0)) };
};

export interface IrrfResult {
  base: number;
  value: number;
}

export const calculateIrrf = (
  grossSalary: number,
  inssValue: number,
  dependentsCount: number,
  irrfTable: PayrollIrrfTable
): IrrfResult => {
  const salary = Number(grossSalary) || 0;
  const dependentDeduction = Number(irrfTable.dependentDeductionValue) * (Number(dependentsCount) || 0);
  const base = Math.max(round2(salary - (Number(inssValue) || 0) - dependentDeduction), 0);

  const brackets = irrfTable.brackets || [];
  const bracket = findBracket(base, brackets as unknown as BracketLike[]);

  if (!bracket) {
    // Não deveria acontecer — a última faixa do IRRF não tem limite
    // superior (maxBase null), cobre qualquer base positiva.
    throw new AppError("ERR_PAYROLL_IRRF_BRACKET_NOT_FOUND", 400);
  }

  const raw = base * (Number(bracket.rate) / 100) - Number(bracket.deduction);
  return { base, value: round2(Math.max(raw, 0)) };
};

export interface PayrollCalculationResult {
  workRegime: string;
  grossSalary: number | null;
  dependentsCount: number;
  inssBase: number | null;
  inssValue: number;
  inssTableId: number | null;
  irrfBase: number | null;
  irrfValue: number;
  irrfTableId: number | null;
  fgtsValue: number;
  vtDiscount: number;
  netSalary: number;
}

// Decide a lógica de cálculo pelo `workRegime` do funcionário. PJ é
// rejeitado — o "cálculo" de PJ é retenção manual por nota fiscal
// (IRRF/CSRF/ISS conforme código de serviço), não uma tabela
// progressiva, e fica fora do escopo desta fase.
export const calculatePayroll = async (
  employee: Employee,
  dependentsCount: number,
  referenceDate: string
): Promise<PayrollCalculationResult> => {
  if (employee.workRegime === "pj") {
    throw new AppError("ERR_PAYROLL_NOT_SUPPORTED_FOR_PJ", 400);
  }

  if (employee.workRegime === "intern") {
    // Estagiário é isento de INSS/IRRF/FGTS — líquido é a bolsa-auxílio
    // direta, sem nenhum desconto. `transportAidValue` (auxílio
    // transporte do estagiário) é um valor pago a mais, não um desconto
    // — não entra nesta conta, fica só informativo no cadastro.
    const stipend = Number(employee.stipendValue) || 0;
    return {
      workRegime: employee.workRegime,
      grossSalary: employee.stipendValue ?? null,
      dependentsCount: 0,
      inssBase: null,
      inssValue: 0,
      inssTableId: null,
      irrfBase: null,
      irrfValue: 0,
      irrfTableId: null,
      fgtsValue: 0,
      vtDiscount: 0,
      netSalary: round2(stipend)
    };
  }

  if (employee.workRegime !== "clt" && employee.workRegime !== "young_apprentice") {
    throw new AppError("ERR_PAYROLL_NOT_SUPPORTED_FOR_WORK_REGIME", 400);
  }

  const grossSalary = Number(employee.grossSalary) || 0;

  const inssTable = await getInssTableForDate(referenceDate);
  const irrfTable = await getIrrfTableForDate(referenceDate);

  const inss = calculateInss(grossSalary, inssTable);
  const irrf = calculateIrrf(grossSalary, inss.value, dependentsCount, irrfTable);

  const fgtsRate = employee.workRegime === "young_apprentice" ? 0.02 : 0.08;
  const fgtsValue = round2(grossSalary * fgtsRate);

  const vtDiscount = employee.transportVoucher ? round2(grossSalary * 0.06) : 0;

  const netSalary = round2(grossSalary - inss.value - irrf.value - vtDiscount);

  return {
    workRegime: employee.workRegime,
    grossSalary: employee.grossSalary ?? null,
    dependentsCount: Number(dependentsCount) || 0,
    inssBase: inss.base,
    inssValue: inss.value,
    inssTableId: inssTable.id,
    irrfBase: irrf.base,
    irrfValue: irrf.value,
    irrfTableId: irrfTable.id,
    fgtsValue,
    vtDiscount,
    netSalary
  };
};
