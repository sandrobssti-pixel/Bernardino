import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Employee from "../../models/Employee";
import EmployeeDependent from "../../models/EmployeeDependent";
import PayrollEntry from "../../models/PayrollEntry";
import Payroll13thSalary from "../../models/Payroll13thSalary";
import PayrollTermination from "../../models/PayrollTermination";
import { calculateTermination } from "./PayrollCalculationService";

// Rescisão de Contrato (RH) — ver PayrollCalculationService.ts e a
// migration de criação de PayrollTerminations pro raciocínio completo.
// Calcular a rescisão é o ato que registra oficialmente o
// desligamento — atualiza `Employee.terminationDate`/`contractStatus`
// como efeito colateral, não é uma simulação separada.

interface CalculateRequest {
  companyId: number;
  employeeId: number | string;
  terminationType: string;
  terminationDate: string;
  noticeWorked?: boolean;
  fgtsBalanceOverride?: number | string | null;
}

interface ShowRequest {
  companyId: number;
  employeeId: number | string;
}

// Soma de TODO o FGTS que o PRÓPRIO sistema já calculou e gravou pro
// funcionário (Folha Mensal + 13º de anos anteriores) — sugestão de
// saldo pra multa, NUNCA a verdade absoluta (ver comentário em
// PayrollCalculationService.ts sobre a limitação de não ter o extrato
// oficial da Caixa). EXCLUI o 13º do ANO DA RESCISÃO — `
// calculateTermination` já recalcula o 13º proporcional desse ano do
// zero (`calculate13thSalary`) e soma o FGTS dele por conta própria;
// incluir aqui TAMBÉM duplicaria esse valor se o 13º daquele ano já
// tivesse sido calculado/salvo separadamente antes (botão "Calcular
// 13º do ano").
const sumHistoricalFgts = async (employeeId: number, companyId: number, excludeYear: number): Promise<number> => {
  const entries = await PayrollEntry.findAll({ where: { employeeId, companyId } });
  const thirteenths = await Payroll13thSalary.findAll({
    where: { employeeId, companyId, year: { [Op.ne]: excludeYear } }
  });

  const entriesTotal = entries.reduce((sum, entry) => sum + (Number(entry.fgtsValue) || 0), 0);
  const thirteenthsTotal = thirteenths.reduce((sum, t) => sum + (Number(t.fgtsValue) || 0), 0);

  return entriesTotal + thirteenthsTotal;
};

export const calculateAndSave = async ({
  companyId,
  employeeId,
  terminationType,
  terminationDate,
  noticeWorked = false,
  fgtsBalanceOverride
}: CalculateRequest): Promise<PayrollTermination> => {
  const employee = await Employee.findOne({ where: { id: employeeId, companyId } });
  if (!employee) {
    throw new AppError("ERR_EMPLOYEE_NOT_FOUND", 404);
  }

  const dependentsCount = await EmployeeDependent.count({ where: { employeeId: employee.id, companyId } });
  const terminationYear = Number(String(terminationDate).slice(0, 4));
  const fgtsHistoricalBalance = await sumHistoricalFgts(employee.id, companyId, terminationYear);

  const override =
    fgtsBalanceOverride === undefined || fgtsBalanceOverride === null || fgtsBalanceOverride === ("" as any)
      ? null
      : Number(fgtsBalanceOverride);

  const result = await calculateTermination(
    employee,
    dependentsCount,
    terminationType,
    terminationDate,
    !!noticeWorked,
    fgtsHistoricalBalance,
    override
  );

  // Calcular a rescisão registra oficialmente o desligamento.
  await employee.update({ terminationDate, contractStatus: "terminated" });

  const payload = {
    companyId,
    employeeId: employee.id,
    terminationType,
    terminationDate,
    noticeWorked: !!noticeWorked,
    yearsOfService: result.yearsOfService,
    balanceSalaryDays: result.balanceSalaryDays,
    balanceSalaryGross: result.balanceSalaryGross,
    balanceSalaryInss: result.balanceSalaryInss,
    balanceSalaryIrrf: result.balanceSalaryIrrf,
    balanceSalaryIrrfReduction: result.balanceSalaryIrrfReduction,
    noticeDays: result.noticeDays,
    noticeValue: result.noticeValue,
    thirteenthMonthsWorked: result.thirteenthMonthsWorked,
    thirteenthGrossValue: result.thirteenthGrossValue,
    thirteenthInssValue: result.thirteenthInssValue,
    thirteenthIrrfValue: result.thirteenthIrrfValue,
    thirteenthIrrfReductionValue: result.thirteenthIrrfReductionValue,
    vacationMonthsWorked: result.vacationMonthsWorked,
    vacationGrossValue: result.vacationGrossValue,
    vacationBonusValue: result.vacationBonusValue,
    fgtsSystemCalculatedBalance: result.fgtsSystemCalculatedBalance,
    fgtsBalanceUsed: result.fgtsBalanceUsed,
    fgtsFineRate: result.fgtsFineRate,
    fgtsFineValue: result.fgtsFineValue,
    netValue: result.netValue,
    calculatedAt: new Date()
  };

  const existing = await PayrollTermination.findOne({ where: { employeeId: employee.id, companyId } });

  if (existing) {
    await existing.update(payload);
    return existing;
  }

  return PayrollTermination.create(payload as any);
};

export const show = async ({ companyId, employeeId }: ShowRequest): Promise<PayrollTermination | null> => {
  return PayrollTermination.findOne({
    where: { employeeId, companyId },
    include: [{ model: Employee, as: "employee", attributes: ["id", "name"] }]
  });
};

export const list = async (companyId: number): Promise<PayrollTermination[]> => {
  return PayrollTermination.findAll({
    where: { companyId },
    include: [{ model: Employee, as: "employee", attributes: ["id", "name"] }],
    order: [["terminationDate", "DESC"]]
  });
};

export const remove = async (id: string | number, companyId: number): Promise<void> => {
  const record = await PayrollTermination.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_PAYROLL_TERMINATION_NOT_FOUND", 404);
  }
  await record.destroy();
};
