import AppError from "../../errors/AppError";
import Employee from "../../models/Employee";
import EmployeeDependent from "../../models/EmployeeDependent";
import Payroll13thSalary from "../../models/Payroll13thSalary";
import { calculate13thSalary, calculateMonthsWorkedInYear } from "./PayrollCalculationService";

// 13º Salário (RH) — mesmo espírito de PayrollEntryService.ts, mas
// ANUAL (não mensal) — ver Payroll13thSalary.ts e a migration de
// criação pro raciocínio completo.

interface CalculateRequest {
  companyId: number;
  employeeId: number | string;
  year: number;
}

interface CalculateAllRequest {
  companyId: number;
  year: number;
}

interface ListRequest {
  companyId: number;
  employeeId?: number | string;
  year?: number | string;
  pageNumber?: number | string;
}

interface ListResponse {
  records: Payroll13thSalary[];
  count: number;
  hasMore: boolean;
}

export const validateYear = (year: number): void => {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new AppError("ERR_PAYROLL_13TH_INVALID_YEAR", 400);
  }
};

// Referência pra buscar a tabela de INSS/IRRF vigente: 1º de dezembro
// do ano-base — mês da 2ª parcela (com desconto), que é quando a
// tributação de verdade acontece.
const referenceDateForYear = (year: number): string => `${year}-12-01`;

export const calculateAndSave = async ({ companyId, employeeId, year }: CalculateRequest): Promise<Payroll13thSalary> => {
  validateYear(year);

  const employee = await Employee.findOne({ where: { id: employeeId, companyId } });
  if (!employee) {
    throw new AppError("ERR_EMPLOYEE_NOT_FOUND", 404);
  }

  const dependentsCount = await EmployeeDependent.count({
    where: { employeeId: employee.id, companyId }
  });

  const result = await calculate13thSalary(employee, dependentsCount, year, referenceDateForYear(year));

  const existing = await Payroll13thSalary.findOne({
    where: { employeeId: employee.id, year, companyId }
  });

  const payload = {
    companyId,
    employeeId: employee.id,
    year,
    monthsWorked: result.monthsWorked,
    grossSalarySnapshot: result.grossSalary,
    grossValue: result.grossValue,
    firstInstallmentValue: result.firstInstallmentValue,
    secondInstallmentValue: result.secondInstallmentValue,
    inssBase: result.inssBase,
    inssValue: result.inssValue,
    inssTableId: result.inssTableId,
    irrfBase: result.irrfBase,
    irrfValue: result.irrfValue,
    irrfReductionValue: result.irrfReductionValue,
    irrfTableId: result.irrfTableId,
    fgtsValue: result.fgtsValue,
    netValue: result.netValue,
    calculatedAt: new Date()
  };

  if (existing) {
    await existing.update(payload);
    return existing;
  }

  return Payroll13thSalary.create(payload as any);
};

// Calcula e grava o 13º de TODOS os funcionários CLT/Menor Aprendiz
// elegíveis naquele ano — NÃO filtra por `contractStatus` (diferente
// da folha mensal): um funcionário desligado durante o ano ainda tem
// direito ao 13º proporcional até a data de desligamento (só perde em
// caso de justa causa, distinção que o sistema não rastreia hoje — por
// segurança, assume sempre devido). Pré-filtra por avos > 0 (calculado
// sem acesso ao banco, função pura) antes de chamar `calculateAndSave`
// — evita poluir a lista de resultados com todo funcionário desligado
// em anos anteriores, que sempre teria 0 avos nesse ano.
export const calculateAndSaveAll = async ({
  companyId,
  year
}: CalculateAllRequest): Promise<{
  entries: Payroll13thSalary[];
  skipped: Array<{ employeeId: number; name: string; reason: string }>;
}> => {
  validateYear(year);

  const employees = await Employee.findAll({ where: { companyId } });

  const entries: Payroll13thSalary[] = [];
  const skipped: Array<{ employeeId: number; name: string; reason: string }> = [];

  for (const employee of employees) {
    if (employee.workRegime !== "clt" && employee.workRegime !== "young_apprentice") continue;

    const monthsWorked = calculateMonthsWorkedInYear(year, employee.admissionDate, employee.terminationDate);
    if (monthsWorked === 0) continue;

    try {
      const entry = await calculateAndSave({ companyId, employeeId: employee.id, year });
      entries.push(entry);
    } catch (err: any) {
      skipped.push({
        employeeId: employee.id,
        name: employee.name,
        reason: err?.message || "ERR_PAYROLL_13TH_CALCULATION_FAILED"
      });
    }
  }

  return { entries, skipped };
};

export const list = async ({ companyId, employeeId, year, pageNumber = "1" }: ListRequest): Promise<ListResponse> => {
  const limit = 50;
  const offset = limit * (+pageNumber - 1);

  const whereCondition: any = { companyId };
  if (employeeId) whereCondition.employeeId = employeeId;
  if (year) whereCondition.year = year;

  const { count, rows: records } = await Payroll13thSalary.findAndCountAll({
    where: whereCondition,
    include: [{ model: Employee, as: "employee", attributes: ["id", "name", "workRegime"] }],
    limit,
    offset,
    order: [
      ["year", "DESC"],
      ["id", "ASC"]
    ]
  });

  return { records, count, hasMore: count > offset + records.length };
};

export const remove = async (id: string | number, companyId: number): Promise<void> => {
  const record = await Payroll13thSalary.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_PAYROLL_13TH_NOT_FOUND", 404);
  }
  await record.destroy();
};
