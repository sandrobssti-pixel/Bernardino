import AppError from "../../errors/AppError";
import PayrollInssTable from "../../models/PayrollInssTable";
import PayrollInssBracket from "../../models/PayrollInssBracket";
import PayrollIrrfTable from "../../models/PayrollIrrfTable";
import PayrollIrrfBracket from "../../models/PayrollIrrfBracket";

// Administração das tabelas de INSS/IRRF (RH — Fase 2) — só Master
// (`user.super`), ver PayrollController. NUNCA edita uma versão já
// existente (preservaria o histórico de cálculos antigos de forma
// incorreta) — só permite cadastrar uma versão NOVA, com
// `effectiveFrom` a partir de quando os novos valores valem.

interface BracketInput {
  min: number;
  max: number | null;
  rate: number;
  deduction: number;
}

interface CreateInssTableRequest {
  effectiveFrom: string;
  ceilingValue: number;
  sourceReference?: string;
  brackets: BracketInput[];
}

interface CreateIrrfTableRequest {
  effectiveFrom: string;
  dependentDeductionValue: number;
  sourceReference?: string;
  brackets: BracketInput[];
  // Redutor adicional da Lei 15.270/2025 (ver PayrollCalculationService.ts)
  // — opcionais aqui: se omitidos, a coluna usa o DEFAULT do banco (os
  // valores oficiais vigentes), mas uma nova versão da tabela pode
  // sobrescrevê-los se a lei/valores mudarem no futuro.
  lei15270Tier1Limit?: number;
  lei15270Tier2Limit?: number;
  lei15270MaxReduction?: number;
  lei15270FormulaConstant?: number;
  lei15270FormulaRate?: number;
}

const validateBrackets = (brackets: BracketInput[]): void => {
  if (!Array.isArray(brackets) || brackets.length === 0) {
    throw new AppError("ERR_PAYROLL_TABLE_BRACKETS_REQUIRED", 400);
  }
};

export const listInssTables = async (): Promise<PayrollInssTable[]> =>
  PayrollInssTable.findAll({
    include: [{ model: PayrollInssBracket, as: "brackets" }],
    order: [["effectiveFrom", "DESC"]]
  });

export const createInssTable = async ({
  effectiveFrom,
  ceilingValue,
  sourceReference,
  brackets
}: CreateInssTableRequest): Promise<PayrollInssTable> => {
  validateBrackets(brackets);

  const table = await PayrollInssTable.create({
    effectiveFrom,
    ceilingValue,
    sourceReference
  } as any);

  await Promise.all(
    brackets.map((b, index) =>
      PayrollInssBracket.create({
        inssTableId: table.id,
        minSalary: b.min,
        maxSalary: b.max,
        rate: b.rate,
        deduction: b.deduction,
        sortOrder: index + 1
      } as any)
    )
  );

  const created = await PayrollInssTable.findByPk(table.id, {
    include: [{ model: PayrollInssBracket, as: "brackets" }]
  });
  return created as PayrollInssTable;
};

export const listIrrfTables = async (): Promise<PayrollIrrfTable[]> =>
  PayrollIrrfTable.findAll({
    include: [{ model: PayrollIrrfBracket, as: "brackets" }],
    order: [["effectiveFrom", "DESC"]]
  });

export const createIrrfTable = async ({
  effectiveFrom,
  dependentDeductionValue,
  sourceReference,
  brackets,
  lei15270Tier1Limit,
  lei15270Tier2Limit,
  lei15270MaxReduction,
  lei15270FormulaConstant,
  lei15270FormulaRate
}: CreateIrrfTableRequest): Promise<PayrollIrrfTable> => {
  validateBrackets(brackets);

  const table = await PayrollIrrfTable.create({
    effectiveFrom,
    dependentDeductionValue,
    sourceReference,
    lei15270Tier1Limit,
    lei15270Tier2Limit,
    lei15270MaxReduction,
    lei15270FormulaConstant,
    lei15270FormulaRate
  } as any);

  await Promise.all(
    brackets.map((b, index) =>
      PayrollIrrfBracket.create({
        irrfTableId: table.id,
        minBase: b.min,
        maxBase: b.max,
        rate: b.rate,
        deduction: b.deduction,
        sortOrder: index + 1
      } as any)
    )
  );

  const created = await PayrollIrrfTable.findByPk(table.id, {
    include: [{ model: PayrollIrrfBracket, as: "brackets" }]
  });
  return created as PayrollIrrfTable;
};
