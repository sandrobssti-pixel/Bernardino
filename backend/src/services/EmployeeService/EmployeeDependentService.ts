import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Employee from "../../models/Employee";
import EmployeeDependent from "../../models/EmployeeDependent";

interface DependentData {
  name: string;
  cpf?: string | null;
  birthDate?: string | null;
}

const sanitize = (data: DependentData): DependentData => {
  const sanitized: Record<string, unknown> = { ...data };
  if (sanitized.birthDate === "") sanitized.birthDate = null;
  return sanitized as unknown as DependentData;
};

const dependentSchema = Yup.object().shape({
  name: Yup.string().required("ERR_EMPLOYEE_DEPENDENT_INVALID_NAME").min(2)
});

// Dependentes do Funcionário (RH — Fase 2) — sempre escopado por
// companyId E employeeId, pra garantir que um dependente só seja
// acessado através do funcionário certo da empresa certa.
const ensureEmployee = async (employeeId: string | number, companyId: number): Promise<Employee> => {
  const employee = await Employee.findOne({ where: { id: employeeId, companyId } });
  if (!employee) {
    throw new AppError("ERR_EMPLOYEE_NOT_FOUND", 404);
  }
  return employee;
};

export const list = async (
  employeeId: string | number,
  companyId: number
): Promise<EmployeeDependent[]> => {
  await ensureEmployee(employeeId, companyId);
  return EmployeeDependent.findAll({
    where: { employeeId, companyId },
    order: [["name", "ASC"]]
  });
};

export const create = async (
  employeeId: string | number,
  data: DependentData,
  companyId: number
): Promise<EmployeeDependent> => {
  await ensureEmployee(employeeId, companyId);

  try {
    await dependentSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  return EmployeeDependent.create({
    ...sanitize(data),
    employeeId,
    companyId
  } as any);
};

export const update = async (
  employeeId: string | number,
  id: string | number,
  data: DependentData,
  companyId: number
): Promise<EmployeeDependent> => {
  await ensureEmployee(employeeId, companyId);

  const record = await EmployeeDependent.findOne({ where: { id, employeeId, companyId } });
  if (!record) {
    throw new AppError("ERR_EMPLOYEE_DEPENDENT_NOT_FOUND", 404);
  }

  try {
    await dependentSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await record.update(sanitize(data));
  return record;
};

export const remove = async (
  employeeId: string | number,
  id: string | number,
  companyId: number
): Promise<void> => {
  await ensureEmployee(employeeId, companyId);

  const record = await EmployeeDependent.findOne({ where: { id, employeeId, companyId } });
  if (!record) {
    throw new AppError("ERR_EMPLOYEE_DEPENDENT_NOT_FOUND", 404);
  }
  await record.destroy();
};
