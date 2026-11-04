import AppError from "../../errors/AppError";
import Employee from "../../models/Employee";
import EmployeeDependent from "../../models/EmployeeDependent";
import PayrollVacation from "../../models/PayrollVacation";
import { calculateVacation, calculateFullYearsOfService } from "./PayrollCalculationService";

// Férias GOZADAS (RH) — mesmo espírito de Payroll13thSalaryService.ts,
// mas POR PERÍODO AQUISITIVO (não por ano civil) — ver
// PayrollVacation.ts e a migration de criação pro raciocínio
// completo.

interface CalculateRequest {
  companyId: number;
  employeeId: number | string;
  periodNumber: number | string;
  vacationStartDate: string;
  daysSold?: number | string;
}

interface ShowRequest {
  companyId: number;
  employeeId: number | string;
}

export const calculateAndSave = async ({
  companyId,
  employeeId,
  periodNumber,
  vacationStartDate,
  daysSold = 0
}: CalculateRequest): Promise<PayrollVacation> => {
  const employee = await Employee.findOne({ where: { id: employeeId, companyId } });
  if (!employee) {
    throw new AppError("ERR_EMPLOYEE_NOT_FOUND", 404);
  }

  const dependentsCount = await EmployeeDependent.count({ where: { employeeId: employee.id, companyId } });

  const result = await calculateVacation(employee, dependentsCount, Number(periodNumber), vacationStartDate, Number(daysSold) || 0);

  const payload = {
    companyId,
    employeeId: employee.id,
    periodNumber: Number(periodNumber),
    periodStart: result.periodStart,
    periodEnd: result.periodEnd,
    daysEntitled: result.daysEntitled,
    daysTaken: result.daysTaken,
    daysSold: result.daysSold,
    vacationStartDate: result.vacationStartDate,
    vacationEndDate: result.vacationEndDate,
    grossSalarySnapshot: result.grossSalary,
    vacationGrossValue: result.vacationGrossValue,
    vacationBonusValue: result.vacationBonusValue,
    soldValue: result.soldValue,
    soldBonusValue: result.soldBonusValue,
    inssBase: result.inssBase,
    inssValue: result.inssValue,
    inssTableId: result.inssTableId,
    irrfBase: result.irrfBase,
    irrfValue: result.irrfValue,
    irrfReductionValue: result.irrfReductionValue,
    irrfTableId: result.irrfTableId,
    netValue: result.netValue,
    calculatedAt: new Date()
  };

  const existing = await PayrollVacation.findOne({
    where: { employeeId: employee.id, periodNumber: Number(periodNumber), companyId }
  });

  if (existing) {
    await existing.update(payload);
    return existing;
  }

  return PayrollVacation.create(payload as any);
};

// Histórico de períodos de um funcionário + o próximo período
// aquisitivo já completo que ainda não tem registro — centraliza aqui
// a conta de "qual período está pendente" pra não duplicar a lógica
// de datas no frontend.
export const showByEmployee = async ({
  companyId,
  employeeId
}: ShowRequest): Promise<{ records: PayrollVacation[]; nextPendingPeriod: number | null }> => {
  const employee = await Employee.findOne({ where: { id: employeeId, companyId } });
  if (!employee) {
    throw new AppError("ERR_EMPLOYEE_NOT_FOUND", 404);
  }

  const records = await PayrollVacation.findAll({
    where: { employeeId, companyId },
    order: [["periodNumber", "ASC"]]
  });

  const today = new Date().toISOString().slice(0, 10);
  const completedCycles = calculateFullYearsOfService(employee.admissionDate, today);
  const lastRegistered = records.length > 0 ? Math.max(...records.map((r) => r.periodNumber)) : 0;
  const candidate = lastRegistered + 1;
  const nextPendingPeriod = candidate <= completedCycles ? candidate : null;

  return { records, nextPendingPeriod };
};

export const list = async (companyId: number): Promise<PayrollVacation[]> => {
  return PayrollVacation.findAll({
    where: { companyId },
    include: [{ model: Employee, as: "employee", attributes: ["id", "name"] }],
    order: [["vacationStartDate", "DESC"]]
  });
};

export const remove = async (id: string | number, companyId: number): Promise<void> => {
  const record = await PayrollVacation.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_PAYROLL_VACATION_NOT_FOUND", 404);
  }
  await record.destroy();
};
