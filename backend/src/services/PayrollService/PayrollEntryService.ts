import AppError from "../../errors/AppError";
import Employee from "../../models/Employee";
import EmployeeDependent from "../../models/EmployeeDependent";
import PayrollEntry from "../../models/PayrollEntry";
import { calculatePayroll } from "./PayrollCalculationService";

interface CalculateRequest {
  companyId: number;
  employeeId: number | string;
  competencyMonth: number;
  competencyYear: number;
}

interface CalculateAllRequest {
  companyId: number;
  competencyMonth: number;
  competencyYear: number;
}

interface ListRequest {
  companyId: number;
  employeeId?: number | string;
  competencyMonth?: number | string;
  competencyYear?: number | string;
  pageNumber?: number | string;
}

interface ListResponse {
  records: PayrollEntry[];
  count: number;
  hasMore: boolean;
}

const validateCompetency = (month: number, year: number): void => {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new AppError("ERR_PAYROLL_INVALID_COMPETENCY", 400);
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new AppError("ERR_PAYROLL_INVALID_COMPETENCY", 400);
  }
};

const referenceDateFor = (month: number, year: number): string =>
  `${year}-${String(month).padStart(2, "0")}-01`;

// Calcula e grava (upsert) a folha de UM funcionário numa competência.
// Fase 2 — RH, ver docs/MANUAL_TECNICO.md.
export const calculateAndSave = async ({
  companyId,
  employeeId,
  competencyMonth,
  competencyYear
}: CalculateRequest): Promise<PayrollEntry> => {
  validateCompetency(competencyMonth, competencyYear);

  const employee = await Employee.findOne({ where: { id: employeeId, companyId } });
  if (!employee) {
    throw new AppError("ERR_EMPLOYEE_NOT_FOUND", 404);
  }

  const dependentsCount = await EmployeeDependent.count({
    where: { employeeId: employee.id, companyId }
  });

  const result = await calculatePayroll(
    employee,
    dependentsCount,
    referenceDateFor(competencyMonth, competencyYear)
  );

  const existing = await PayrollEntry.findOne({
    where: { employeeId: employee.id, competencyMonth, competencyYear, companyId }
  });

  const payload = {
    companyId,
    employeeId: employee.id,
    competencyMonth,
    competencyYear,
    workRegimeSnapshot: result.workRegime,
    grossSalarySnapshot: result.grossSalary,
    dependentsCountSnapshot: result.dependentsCount,
    inssBase: result.inssBase,
    inssValue: result.inssValue,
    inssTableId: result.inssTableId,
    irrfBase: result.irrfBase,
    irrfValue: result.irrfValue,
    irrfTableId: result.irrfTableId,
    fgtsValue: result.fgtsValue,
    vtDiscount: result.vtDiscount,
    netSalary: result.netSalary,
    calculatedAt: new Date()
  };

  if (existing) {
    await existing.update(payload);
    return existing;
  }

  return PayrollEntry.create(payload as any);
};

// Calcula e grava a folha de TODOS os funcionários ativos (CLT, Menor
// Aprendiz, Estagiário) da empresa numa competência — pula PJ em
// silêncio (é batch, não uma tentativa manual num funcionário
// específico) e pula funcionário que der erro individual, retornando o
// motivo em `skipped` em vez de derrubar o lote inteiro.
export const calculateAndSaveAll = async ({
  companyId,
  competencyMonth,
  competencyYear
}: CalculateAllRequest): Promise<{
  entries: PayrollEntry[];
  skipped: Array<{ employeeId: number; name: string; reason: string }>;
}> => {
  validateCompetency(competencyMonth, competencyYear);

  const employees = await Employee.findAll({
    where: { companyId, contractStatus: "active" }
  });

  const entries: PayrollEntry[] = [];
  const skipped: Array<{ employeeId: number; name: string; reason: string }> = [];

  for (const employee of employees) {
    if (employee.workRegime === "pj") continue;

    try {
      const entry = await calculateAndSave({
        companyId,
        employeeId: employee.id,
        competencyMonth,
        competencyYear
      });
      entries.push(entry);
    } catch (err: any) {
      skipped.push({
        employeeId: employee.id,
        name: employee.name,
        reason: err?.message || "ERR_PAYROLL_CALCULATION_FAILED"
      });
    }
  }

  return { entries, skipped };
};

export const list = async ({
  companyId,
  employeeId,
  competencyMonth,
  competencyYear,
  pageNumber = "1"
}: ListRequest): Promise<ListResponse> => {
  const limit = 50;
  const offset = limit * (+pageNumber - 1);

  const whereCondition: any = { companyId };
  if (employeeId) whereCondition.employeeId = employeeId;
  if (competencyMonth) whereCondition.competencyMonth = competencyMonth;
  if (competencyYear) whereCondition.competencyYear = competencyYear;

  const { count, rows: records } = await PayrollEntry.findAndCountAll({
    where: whereCondition,
    include: [{ model: Employee, as: "employee", attributes: ["id", "name", "workRegime"] }],
    limit,
    offset,
    order: [
      ["competencyYear", "DESC"],
      ["competencyMonth", "DESC"],
      ["id", "ASC"]
    ]
  });

  return { records, count, hasMore: count > offset + records.length };
};

export const remove = async (id: string | number, companyId: number): Promise<void> => {
  const record = await PayrollEntry.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_PAYROLL_ENTRY_NOT_FOUND", 404);
  }
  await record.destroy();
};
