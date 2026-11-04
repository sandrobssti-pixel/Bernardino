import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Employee from "../../models/Employee";
import CompanyPartner from "../../models/CompanyPartner";
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
// Redutor adicional da Lei 15.270/2025 (em vigor desde jan/2026) — ver
// `calculateLei15270Reduction` abaixo. Mecanismo confirmado contra um
// exemplo numérico atribuído diretamente à página oficial da Receita
// Federal (gov.br/receitafederal — "exemplos de aplicação da Lei
// 15.270/2025"), que resolve explicitamente o ponto que ficou em
// aberto na primeira pesquisa: a faixa/fórmula do redutor usa o
// RENDIMENTO BRUTO mensal (rendimento tributável, antes do desconto de
// INSS) — não a base de cálculo do IRRF já líquida de INSS/dependentes.
// Citação do "ponto de atenção" da própria Receita Federal: "se utiliza
// nessa tabela de redução o valor do salário [bruto], e não o da base
// de cálculo." Ver docs/MANUAL_TECNICO.md seção 219 para a pesquisa
// completa e os exemplos de referência conferidos à mão.

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

// INSS do pró-labore de Sócio (CompanyPartner) — "contribuinte
// individual" perante o INSS (Lei 8.212/1991 art. 12, V, "f"), regime
// DIFERENTE do CLT: alíquota FIXA de 11% (não a tabela progressiva
// 7,5%-14% de CLT), sem piso/faixa isenta (incide desde o primeiro
// real), limitada ao MESMO teto de contribuição do RGPS que o INSS de
// CLT já usa (R$8.475,55 em jan/2026 → contribuição máxima R$932,31).
// Os 20% restantes da alíquota-base (art. 21) são cota PATRONAL, paga
// pela empresa, não descontada do sócio — fora do escopo aqui (mesmo
// gap que já existe hoje pro INSS patronal de CLT, nunca calculado
// neste sistema). Pesquisado via WebSearch extended — múltiplas fontes
// contábeis convergem no valor e citam a mesma base legal, mas, ao
// contrário da Lei 15.270/2025, não foi encontrada uma página oficial
// gov.br citável diretamente (só fontes secundárias, ainda que sem
// divergência real entre si — ver docs/MANUAL_TECNICO.md seção 222).
// 11% mantido como CONSTANTE no código (não versionado por
// `effectiveFrom`, mesmo tratamento já dado ao FGTS) — é a alíquota em
// si que é estável/não-tabelada; o TETO usado no cálculo continua
// vindo da tabela de INSS do banco (reaproveita a mesma versão vigente
// do CLT), então uma atualização futura do teto já se propaga sozinha.
const PROLABORE_INSS_RATE = 0.11;

// Teto de contribuição (último valor de `maxSalary` da última faixa) —
// mesma lógica já usada em `calculateInss` pro caso "salário acima do
// teto", extraída aqui pra reaproveitar no cálculo do pró-labore.
export const getInssCeilingBase = (inssTable: PayrollInssTable): number => {
  const brackets = inssTable.brackets || [];
  const sorted = [...brackets].sort((a, b) => a.sortOrder - b.sortOrder);
  const lastBracket = sorted[sorted.length - 1];
  return lastBracket ? Number(lastBracket.maxSalary) : 0;
};

export const calculateProlaboreInss = (prolaboreValue: number, inssTable: PayrollInssTable): InssResult => {
  const value = Number(prolaboreValue) || 0;
  const ceilingBase = getInssCeilingBase(inssTable);
  const base = ceilingBase > 0 ? Math.min(value, ceilingBase) : value;
  return { base, value: round2(base * PROLABORE_INSS_RATE) };
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

// Redutor adicional da Lei 15.270/2025 (ver comentário no topo do
// arquivo). Recebe o IRRF JÁ calculado pela tabela tradicional
// (`irrfTabelaValue`) e devolve quanto dele deve ser abatido — nunca
// mais do que o próprio IRRF tabelado (o redutor zera o imposto, não
// gera "imposto negativo"). Faixas/valores vêm sempre de `irrfTable`
// (nunca hardcoded), pra poderem ser atualizados por uma nova versão
// da tabela sem deploy.
export const calculateLei15270Reduction = (
  grossSalary: number,
  irrfTabelaValue: number,
  irrfTable: PayrollIrrfTable
): number => {
  const gross = Number(grossSalary) || 0;
  const tier1 = Number(irrfTable.lei15270Tier1Limit);
  const tier2 = Number(irrfTable.lei15270Tier2Limit);
  const maxReduction = Number(irrfTable.lei15270MaxReduction);
  const formulaConstant = Number(irrfTable.lei15270FormulaConstant);
  const formulaRate = Number(irrfTable.lei15270FormulaRate);

  let candidate = 0;
  if (gross <= tier1) {
    candidate = maxReduction;
  } else if (gross <= tier2) {
    candidate = formulaConstant - formulaRate * gross;
  }
  candidate = Math.max(candidate, 0);

  return round2(Math.min(Number(irrfTabelaValue) || 0, candidate));
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
  irrfReductionValue: number;
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
      irrfReductionValue: 0,
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
  const irrfReduction = calculateLei15270Reduction(grossSalary, irrf.value, irrfTable);
  const finalIrrfValue = round2(Math.max(irrf.value - irrfReduction, 0));

  const fgtsRate = employee.workRegime === "young_apprentice" ? 0.02 : 0.08;
  const fgtsValue = round2(grossSalary * fgtsRate);

  const vtDiscount = employee.transportVoucher ? round2(grossSalary * 0.06) : 0;

  const netSalary = round2(grossSalary - inss.value - finalIrrfValue - vtDiscount);

  return {
    workRegime: employee.workRegime,
    grossSalary: employee.grossSalary ?? null,
    dependentsCount: Number(dependentsCount) || 0,
    inssBase: inss.base,
    inssValue: inss.value,
    inssTableId: inssTable.id,
    irrfBase: irrf.base,
    irrfValue: finalIrrfValue,
    irrfReductionValue: irrfReduction,
    irrfTableId: irrfTable.id,
    fgtsValue,
    vtDiscount,
    netSalary
  };
};

export interface PartnerPayrollResult {
  prolaboreValue: number | null;
  inssBase: number | null;
  inssValue: number;
  inssTableId: number | null;
  irrfBase: number | null;
  irrfValue: number;
  irrfReductionValue: number;
  irrfTableId: number | null;
  netValue: number;
}

// Pró-labore de Sócio (CompanyPartner) — ver `calculateProlaboreInss`
// acima pro INSS (alíquota fixa 11%, não a tabela progressiva de CLT) e
// docs/MANUAL_TECNICO.md seção 222 pra pesquisa completa. IRRF usa a
// MESMA tabela progressiva e a MESMA lógica (inclusive o redutor da Lei
// 15.270/2025, que a pesquisa confirmou se aplicar igualmente, mesma
// base de rendimento bruto) já usadas pro CLT — só o INSS muda.
//
// LIMITAÇÃO CONHECIDA: sócio não tem cadastro de dependentes (diferente
// de Employee/EmployeeDependent) — `dependentsCount` sempre 0 aqui. Sem
// efeito pra quem não tem dependentes; pra quem tem, o IRRF calculado
// fica um pouco ACIMA do valor real (falta abater a dedução por
// dependente), nunca abaixo — erro sempre pro lado seguro (não
// subestima o imposto devido). Se precisar ficar exato, adicionar um
// cadastro de dependentes de sócio é trabalho futuro, fora do escopo
// desta entrega.
//
// FGTS: não incide sobre pró-labore (padrão, sem previsão contratual
// explícita) — nem calculado aqui, diferente de `calculatePayroll`.
export const calculatePartnerPayroll = async (
  partner: CompanyPartner,
  referenceDate: string
): Promise<PartnerPayrollResult> => {
  const prolabore = Number(partner.prolaboreValue) || 0;

  const inssTable = await getInssTableForDate(referenceDate);
  const irrfTable = await getIrrfTableForDate(referenceDate);

  const inss = calculateProlaboreInss(prolabore, inssTable);
  const irrf = calculateIrrf(prolabore, inss.value, 0, irrfTable);
  const irrfReduction = calculateLei15270Reduction(prolabore, irrf.value, irrfTable);
  const finalIrrfValue = round2(Math.max(irrf.value - irrfReduction, 0));

  const netValue = round2(prolabore - inss.value - finalIrrfValue);

  return {
    prolaboreValue: partner.prolaboreValue ?? null,
    inssBase: inss.base,
    inssValue: inss.value,
    inssTableId: inssTable.id,
    irrfBase: irrf.base,
    irrfValue: finalIrrfValue,
    irrfReductionValue: irrfReduction,
    irrfTableId: irrfTable.id,
    netValue
  };
};
