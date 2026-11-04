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

// 13º Salário — pesquisado via WebSearch extended (ver
// docs/MANUAL_TECNICO.md seção 225 pra pesquisa completa e fontes).
// Mecanismo confirmado:
// - Avos: fração >= 15 dias trabalhados no mês conta como mês integral
//   (CLT art. 487 §1º / Lei 4.090/1962) — vale tanto pra admissão
//   quanto pra desligamento dentro do ano-base.
// - 1ª parcela (até 30/11): METADE do valor bruto do 13º, SEM nenhum
//   desconto (simplificação: usa o salário bruto CADASTRADO, não a
//   "remuneração do mês anterior" que a lei pede pra quem tem parte
//   variável — o sistema não rastreia salário variável mês a mês).
// - 2ª parcela (até 20/12): o restante, COM INSS e IRRF descontados.
// - INSS e IRRF incidem sobre o valor INTEGRAL do 13º (nunca
//   fracionado entre as parcelas), usando a MESMA tabela progressiva
//   mensal já usada pro salário de CLT, calculados de forma SEPARADA/
//   INDEPENDENTE do INSS/IRRF do salário mensal normal daquele mês —
//   "tributação exclusiva na fonte" (não soma, não entra no ajuste
//   anual).
// - Lei 15.270/2025 se aplica igualmente (confirmado em comunicado
//   oficial da Receita Federal), mesma mecânica, base = 13º bruto.
// - FGTS (8% CLT / 2% Menor Aprendiz) incide sobre o valor INTEGRAL.
// - Só CLT/Menor Aprendiz têm direito — PJ/Estagiário não.
// - Funcionário desligado no ano (`contractStatus: "terminated"`)
//   ainda pode ter 13º proporcional a calcular daquele ano (só perde o
//   direito em caso de justa causa, distinção que o sistema não
//   rastreia hoje — por segurança, assume sempre devido quando há
//   avos > 0, em vez de tentar adivinhar).

// Dias de um mês — mesma lógica já usada em
// `PayrollExpenseService.lastDayOfCompetency`, local (sem parsing de
// string, sem ambiguidade de fuso horário).
const daysInMonthOf = (year: number, month: number): number => new Date(year, month, 0).getDate();

const parseDateOnlyParts = (value: string | null | undefined): { year: number; month: number; day: number } | null => {
  if (!value) return null;
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m, day: d };
};

// Meses trabalhados no ano (avos), considerando admissão E
// desligamento dentro do ano-base — sempre por comparação direta de
// componentes (ano/mês/dia), nunca via `new Date(string)` (evita
// ambiguidade de fuso horário ao interpretar uma data DATEONLY como
// UTC).
export const calculateMonthsWorkedInYear = (
  year: number,
  admissionDate: string | null | undefined,
  terminationDate: string | null | undefined
): number => {
  const admission = parseDateOnlyParts(admissionDate);
  const termination = parseDateOnlyParts(terminationDate);

  let months = 0;
  for (let month = 1; month <= 12; month++) {
    let workStartDay = 1;
    let workEndDay = daysInMonthOf(year, month);

    if (admission) {
      if (admission.year > year || (admission.year === year && admission.month > month)) continue;
      if (admission.year === year && admission.month === month) workStartDay = admission.day;
    }

    if (termination) {
      if (termination.year < year || (termination.year === year && termination.month < month)) continue;
      if (termination.year === year && termination.month === month) workEndDay = termination.day;
    }

    const daysWorked = workEndDay - workStartDay + 1;
    if (daysWorked >= 15) months += 1;
  }

  return months;
};

export interface Thirteenth13thSalaryResult {
  monthsWorked: number;
  grossSalary: number | null;
  grossValue: number;
  firstInstallmentValue: number;
  secondInstallmentValue: number;
  inssBase: number | null;
  inssValue: number;
  inssTableId: number | null;
  irrfBase: number | null;
  irrfValue: number;
  irrfReductionValue: number;
  irrfTableId: number | null;
  fgtsValue: number;
  netValue: number;
}

export const calculate13thSalary = async (
  employee: Employee,
  dependentsCount: number,
  year: number,
  referenceDate: string
): Promise<Thirteenth13thSalaryResult> => {
  if (employee.workRegime !== "clt" && employee.workRegime !== "young_apprentice") {
    throw new AppError("ERR_PAYROLL_13TH_NOT_SUPPORTED_FOR_WORK_REGIME", 400);
  }

  const monthsWorked = calculateMonthsWorkedInYear(year, employee.admissionDate, employee.terminationDate);
  const grossSalary = Number(employee.grossSalary) || 0;
  const grossValue = round2((grossSalary / 12) * monthsWorked);

  if (grossValue <= 0) {
    return {
      monthsWorked,
      grossSalary: employee.grossSalary ?? null,
      grossValue: 0,
      firstInstallmentValue: 0,
      secondInstallmentValue: 0,
      inssBase: null,
      inssValue: 0,
      inssTableId: null,
      irrfBase: null,
      irrfValue: 0,
      irrfReductionValue: 0,
      irrfTableId: null,
      fgtsValue: 0,
      netValue: 0
    };
  }

  const inssTable = await getInssTableForDate(referenceDate);
  const irrfTable = await getIrrfTableForDate(referenceDate);

  const inss = calculateInss(grossValue, inssTable);
  const irrf = calculateIrrf(grossValue, inss.value, dependentsCount, irrfTable);
  const irrfReduction = calculateLei15270Reduction(grossValue, irrf.value, irrfTable);
  const finalIrrfValue = round2(Math.max(irrf.value - irrfReduction, 0));

  const fgtsRate = employee.workRegime === "young_apprentice" ? 0.02 : 0.08;
  const fgtsValue = round2(grossValue * fgtsRate);

  const firstInstallmentValue = round2(grossValue / 2);
  const netValue = round2(grossValue - inss.value - finalIrrfValue);
  const secondInstallmentValue = round2(netValue - firstInstallmentValue);

  return {
    monthsWorked,
    grossSalary: employee.grossSalary ?? null,
    grossValue,
    firstInstallmentValue,
    secondInstallmentValue,
    inssBase: inss.base,
    inssValue: inss.value,
    inssTableId: inssTable.id,
    irrfBase: irrf.base,
    irrfValue: finalIrrfValue,
    irrfReductionValue: irrfReduction,
    irrfTableId: irrfTable.id,
    fgtsValue,
    netValue
  };
};

// Rescisão de Contrato (verbas rescisórias) — pesquisado via WebSearch
// extended (ver docs/MANUAL_TECNICO.md seção 226 pra pesquisa completa
// e fontes). Mecanismo confirmado:
// - Saldo de salário: dias corridos do mês até o desligamento ÷ 30 ×
//   salário mensal, com INSS/IRRF normais (mesma tabela do salário).
// - Aviso prévio PROPORCIONAL (Lei 12.506/2011): 30 dias + 3 dias por
//   ano completo de serviço, teto de 90 dias — só devido pela EMPRESA
//   em dispensa sem justa causa (integral) ou acordo/distrato (pela
//   metade). Pedido de demissão e justa causa NÃO geram aviso prévio a
//   pagar. Indenizado = isento de INSS e IRRF (natureza indenizatória).
// - 13º proporcional: REAPROVEITA `calculate13thSalary` sem alteração
//   — INSS/IRRF normais, já implementado.
// - Férias proporcionais + 1/3: 1/12 do salário por mês completo do
//   PERÍODO AQUISITIVO EM CURSO (não desde a admissão — reinicia a
//   cada aniversário de admissão), mesma regra de fração >=15 dias.
//   ISENTAS de INSS/IRRF (Súmula 386 STJ). "Férias vencidas" (período
//   aquisitivo já completo e não gozado) NÃO são calculadas — o
//   sistema não rastreia férias já gozadas, não dá pra saber se existe
//   esse saldo sem esse controle (limitação documentada).
// - Multa do FGTS: 40% (dispensa sem justa causa) ou 20% (acordo),
//   sobre o SALDO TOTAL depositado durante todo o vínculo — o sistema
//   só sabe com certeza o que ELE MESMO já calculou (histórico de
//   PayrollEntry/Payroll13thSalary + o FGTS desta própria rescisão);
//   se o saldo real no FGTS for maior (período anterior ao uso do
//   sistema, outro vínculo, etc.), o valor sugerido fica incompleto —
//   por isso o campo é EDITÁVEL (`fgtsBalanceOverride`), com o valor
//   calculado pelo sistema como sugestão, nunca travado.

// Anos completos de serviço — usado na fórmula do aviso prévio
// proporcional (Lei 12.506/2011). Mesma comparação por componentes
// ano/mês/dia já usada em `calculateMonthsWorkedInYear` (nunca via
// `new Date(string)`).
export const calculateFullYearsOfService = (
  admissionDate: string | null | undefined,
  terminationDate: string
): number => {
  const admission = parseDateOnlyParts(admissionDate);
  const termination = parseDateOnlyParts(terminationDate);
  if (!admission || !termination) return 0;

  let years = termination.year - admission.year;
  const terminationIsBeforeAnniversary =
    termination.month < admission.month || (termination.month === admission.month && termination.day < admission.day);
  if (terminationIsBeforeAnniversary) years -= 1;

  return Math.max(years, 0);
};

// Conta meses completos (fração >=15 dias) entre duas datas
// QUAISQUER, sem travar num ano-calendário — usado pro período
// aquisitivo de férias (que não alinha com Jan-Dez). Diferente de
// `calculateMonthsWorkedInYear` (que é específica do 13º, limitada ao
// ano civil) — mantidas separadas de propósito, cada uma testada no
// seu próprio contexto, em vez de uma generalização prematura que
// arriscaria quebrar o 13º já em produção.
const countFullMonthsBetweenDates = (
  start: { year: number; month: number; day: number },
  end: { year: number; month: number; day: number }
): number => {
  let months = 0;
  let cursorYear = start.year;
  let cursorMonth = start.month;

  while (cursorYear < end.year || (cursorYear === end.year && cursorMonth <= end.month)) {
    const monthDays = daysInMonthOf(cursorYear, cursorMonth);
    const isStartMonth = cursorYear === start.year && cursorMonth === start.month;
    const isEndMonth = cursorYear === end.year && cursorMonth === end.month;
    const workStartDay = isStartMonth ? start.day : 1;
    const workEndDay = isEndMonth ? end.day : monthDays;

    if (workEndDay - workStartDay + 1 >= 15) months += 1;

    cursorMonth += 1;
    if (cursorMonth > 12) {
      cursorMonth = 1;
      cursorYear += 1;
    }
  }

  return months;
};

// Início do período aquisitivo de férias EM CURSO no momento do
// desligamento — o aniversário de admissão mais recente que seja
// <= data de desligamento (ou a própria admissão, se ainda não
// completou 1 ano).
export const calculateCurrentVacationPeriodStart = (
  admissionDate: string | null | undefined,
  terminationDate: string
): { year: number; month: number; day: number } | null => {
  const admission = parseDateOnlyParts(admissionDate);
  const termination = parseDateOnlyParts(terminationDate);
  if (!admission || !termination) return null;

  let anniversaryYear = termination.year;
  const terminationIsBeforeAnniversaryThisYear =
    termination.month < admission.month || (termination.month === admission.month && termination.day < admission.day);
  if (terminationIsBeforeAnniversaryThisYear) anniversaryYear -= 1;

  const anniversary = { year: anniversaryYear, month: admission.month, day: admission.day };

  // Se o "aniversário" calculado ainda é anterior à própria admissão
  // (funcionário com menos de 1 ano de casa), o período aquisitivo
  // começa na admissão mesmo.
  const admissionIsAfterAnniversary =
    admission.year > anniversary.year ||
    (admission.year === anniversary.year &&
      (admission.month > anniversary.month || (admission.month === anniversary.month && admission.day > anniversary.day)));

  return admissionIsAfterAnniversary ? admission : anniversary;
};

export interface TerminationResult {
  yearsOfService: number;
  balanceSalaryDays: number;
  balanceSalaryGross: number;
  balanceSalaryInss: number;
  balanceSalaryIrrf: number;
  balanceSalaryIrrfReduction: number;
  noticeDays: number;
  noticeValue: number;
  thirteenthMonthsWorked: number;
  thirteenthGrossValue: number;
  thirteenthInssValue: number;
  thirteenthIrrfValue: number;
  thirteenthIrrfReductionValue: number;
  vacationMonthsWorked: number;
  vacationGrossValue: number;
  vacationBonusValue: number;
  fgtsSystemCalculatedBalance: number;
  fgtsBalanceUsed: number;
  fgtsFineRate: number;
  fgtsFineValue: number;
  netValue: number;
}

const NOTICE_BASE_DAYS = 30;
const NOTICE_DAYS_PER_YEAR = 3;
const NOTICE_MAX_DAYS = 90;

export const calculateTermination = async (
  employee: Employee,
  dependentsCount: number,
  terminationType: string,
  terminationDate: string,
  noticeWorked: boolean,
  fgtsHistoricalBalance: number,
  fgtsBalanceOverride: number | null
): Promise<TerminationResult> => {
  if (employee.workRegime !== "clt" && employee.workRegime !== "young_apprentice") {
    throw new AppError("ERR_PAYROLL_TERMINATION_NOT_SUPPORTED_FOR_WORK_REGIME", 400);
  }

  const validTypes = ["resignation", "dismissal_without_cause", "dismissal_with_cause", "mutual_agreement"];
  if (!validTypes.includes(terminationType)) {
    throw new AppError("ERR_PAYROLL_TERMINATION_INVALID_TYPE", 400);
  }

  const termination = parseDateOnlyParts(terminationDate);
  if (!termination) {
    throw new AppError("ERR_PAYROLL_TERMINATION_INVALID_DATE", 400);
  }

  // `calculate13thSalary` lê `employee.terminationDate` pra limitar os
  // avos — mas nesse ponto o funcionário ainda está ativo no banco (o
  // `Employee.update` que registra o desligamento só acontece DEPOIS,
  // no service, usando o resultado deste cálculo). Força aqui em
  // memória, senão o 13º proporcional saía contando o ano inteiro.
  employee.terminationDate = terminationDate;

  const grossSalary = Number(employee.grossSalary) || 0;
  const inssTable = await getInssTableForDate(terminationDate);
  const irrfTable = await getIrrfTableForDate(terminationDate);

  // Saldo de salário — dias corridos do mês até o desligamento ÷ 30.
  const balanceSalaryDays = termination.day;
  const balanceSalaryGross = round2((grossSalary / 30) * balanceSalaryDays);
  const balanceInss = calculateInss(balanceSalaryGross, inssTable);
  const balanceIrrf = calculateIrrf(balanceSalaryGross, balanceInss.value, dependentsCount, irrfTable);
  const balanceIrrfReduction = calculateLei15270Reduction(balanceSalaryGross, balanceIrrf.value, irrfTable);
  const balanceFinalIrrf = round2(Math.max(balanceIrrf.value - balanceIrrfReduction, 0));

  // Aviso prévio proporcional — só devido pela empresa em dispensa sem
  // justa causa (integral) ou acordo (pela metade). Indenizado = isento.
  const yearsOfService = calculateFullYearsOfService(employee.admissionDate, terminationDate);
  const fullNoticeDays = Math.min(NOTICE_BASE_DAYS + NOTICE_DAYS_PER_YEAR * yearsOfService, NOTICE_MAX_DAYS);

  let noticeDays = 0;
  if (terminationType === "dismissal_without_cause") noticeDays = fullNoticeDays;
  else if (terminationType === "mutual_agreement") noticeDays = round2(fullNoticeDays / 2);

  const noticeValue = noticeWorked ? 0 : round2((grossSalary / 30) * noticeDays);

  // 13º proporcional — reaproveita calculate13thSalary sem alteração.
  const terminationYear = termination.year;
  const thirteenth = await calculate13thSalary(employee, dependentsCount, terminationYear, terminationDate);

  // Férias proporcionais + 1/3 — período aquisitivo EM CURSO, isentas.
  const vacationPeriodStart = calculateCurrentVacationPeriodStart(employee.admissionDate, terminationDate);
  const vacationMonthsWorked = vacationPeriodStart ? countFullMonthsBetweenDates(vacationPeriodStart, termination) : 0;
  const vacationGrossValue = round2((grossSalary / 12) * vacationMonthsWorked);
  const vacationBonusValue = round2(vacationGrossValue / 3);

  // Multa do FGTS — 40% (sem justa causa) ou 20% (acordo), sobre o
  // saldo TOTAL depositado (histórico que o sistema já calculou +
  // FGTS desta própria rescisão: saldo de salário + 13º). Editável.
  const fgtsOnBalanceSalary = round2(balanceSalaryGross * (employee.workRegime === "young_apprentice" ? 0.02 : 0.08));
  const fgtsSystemCalculatedBalance = round2(fgtsHistoricalBalance + fgtsOnBalanceSalary + thirteenth.fgtsValue);
  const fgtsBalanceUsed = fgtsBalanceOverride != null ? round2(fgtsBalanceOverride) : fgtsSystemCalculatedBalance;

  let fgtsFineRate = 0;
  if (terminationType === "dismissal_without_cause") fgtsFineRate = 0.4;
  else if (terminationType === "mutual_agreement") fgtsFineRate = 0.2;
  const fgtsFineValue = round2(fgtsBalanceUsed * fgtsFineRate);

  const netValue = round2(
    balanceSalaryGross -
      balanceInss.value -
      balanceFinalIrrf +
      noticeValue +
      (thirteenth.grossValue - thirteenth.inssValue - thirteenth.irrfValue) +
      vacationGrossValue +
      vacationBonusValue +
      fgtsFineValue
  );

  return {
    yearsOfService,
    balanceSalaryDays,
    balanceSalaryGross,
    balanceSalaryInss: balanceInss.value,
    balanceSalaryIrrf: balanceFinalIrrf,
    balanceSalaryIrrfReduction: balanceIrrfReduction,
    noticeDays,
    noticeValue,
    thirteenthMonthsWorked: thirteenth.monthsWorked,
    thirteenthGrossValue: thirteenth.grossValue,
    thirteenthInssValue: thirteenth.inssValue,
    thirteenthIrrfValue: thirteenth.irrfValue,
    thirteenthIrrfReductionValue: thirteenth.irrfReductionValue,
    vacationMonthsWorked,
    vacationGrossValue,
    vacationBonusValue,
    fgtsSystemCalculatedBalance,
    fgtsBalanceUsed,
    fgtsFineRate,
    fgtsFineValue,
    netValue
  };
};
