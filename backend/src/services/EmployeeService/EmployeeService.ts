import { Op, Sequelize } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Employee from "../../models/Employee";
import User from "../../models/User";

interface ListRequest {
  companyId: number;
  searchParam?: string;
  pageNumber?: string | number;
  workRegime?: string;
  contractStatus?: string;
}

interface ListResponse {
  records: Employee[];
  count: number;
  hasMore: boolean;
}

export const WORK_REGIMES = ["clt", "pj", "intern", "young_apprentice"];
export const CONTRACT_STATUSES = ["active", "leave", "terminated"];

interface EmployeeData {
  managerId?: number | string | null;
  name: string;
  photoUrl?: string | null;
  cpf?: string;
  rg?: string;
  pisPasep?: string;
  voterTitle?: string;
  email?: string;
  phone?: string;
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  bankName?: string;
  bankAgency?: string;
  bankAccount?: string;
  bankAccountType?: string;
  pixKey?: string;
  workRegime: string;
  contractStatus?: string;
  ctps?: string;
  ctpsSeries?: string;
  admissionDate?: string | null;
  terminationDate?: string | null;
  grossSalary?: number | string | null;
  role?: string;
  weeklyHours?: number | string | null;
  transportVoucher?: boolean;
  mealVoucher?: boolean;
  healthInsurance?: boolean;
  healthInsuranceValue?: number | string | null;
  foodVoucher?: boolean;
  foodVoucherValue?: number | string | null;
  mealVoucherValue?: number | string | null;
  overtimePolicy?: string | null;
  overtimeHourValue?: number | string | null;
  overtimeHoursBalance?: number | string | null;
  companyName?: string;
  cnpj?: string;
  municipalRegistration?: string;
  monthlyContractValue?: number | string | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  contractScope?: string;
  school?: string;
  course?: string;
  stipendValue?: number | string | null;
  transportAidValue?: number | string | null;
  internshipStartDate?: string | null;
  internshipEndDate?: string | null;
  lifeInsurancePolicy?: string;
}

// Campos DATE/DECIMAL — o formulário genérico do frontend
// (FinanceRecordModal.stripHiddenFieldValues) manda "" (string vazia,
// nunca null/undefined) pra todo campo que ficou escondido ao trocar de
// regime (ex.: saiu de CLT pra PJ) ou que o usuário só deixou em branco.
// Postgres rejeita "" em coluna DATE/DECIMAL ("invalid input syntax") —
// sem essa normalização, criar um funcionário novo sem preencher a data
// de admissão (campo opcional) já quebrava o cadastro.
const DATE_FIELDS = [
  "admissionDate",
  "terminationDate",
  "contractStartDate",
  "contractEndDate",
  "internshipStartDate",
  "internshipEndDate"
];
const NUMERIC_FIELDS = [
  "grossSalary",
  "weeklyHours",
  "monthlyContractValue",
  "stipendValue",
  "transportAidValue",
  "healthInsuranceValue",
  "foodVoucherValue",
  "mealVoucherValue",
  "overtimeHourValue",
  "overtimeHoursBalance"
];

const sanitizeEmployeeData = (data: EmployeeData): EmployeeData => {
  const sanitized: Record<string, unknown> = { ...data };
  [...DATE_FIELDS, ...NUMERIC_FIELDS].forEach(field => {
    if (sanitized[field] === "") sanitized[field] = null;
  });
  return sanitized as unknown as EmployeeData;
};

const employeeSchema = Yup.object().shape({
  name: Yup.string().required("ERR_EMPLOYEE_INVALID_NAME").min(2),
  workRegime: Yup.string()
    .required("ERR_EMPLOYEE_INVALID_WORK_REGIME")
    .oneOf(WORK_REGIMES, "ERR_EMPLOYEE_INVALID_WORK_REGIME")
});

const includeManager = [{ model: User, as: "manager", attributes: ["id", "name"] }];

// Cadastro de Funcionário (RH — Fase 1, ver docs/MANUAL_TECNICO.md).
// Mesmo padrão enxuto de validação do ServiceService/JobPostingService —
// só nome e regime são obrigatórios, resto fica livre pro cadastro não
// travar (ex.: funcionário ainda sem CPF cadastrado no dia da contratação).
export const list = async ({
  companyId,
  searchParam = "",
  pageNumber = "1",
  workRegime,
  contractStatus
}: ListRequest): Promise<ListResponse> => {
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const whereCondition: any = { companyId };

  if (searchParam) {
    whereCondition[Op.or] = [
      Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("Employee.name")),
        "LIKE",
        `%${searchParam.toLowerCase().trim()}%`
      ),
      { cpf: { [Op.like]: `%${searchParam.trim()}%` } }
    ];
  }

  if (workRegime) whereCondition.workRegime = workRegime;
  if (contractStatus) whereCondition.contractStatus = contractStatus;

  const { count, rows: records } = await Employee.findAndCountAll({
    where: whereCondition,
    include: includeManager,
    limit,
    offset,
    order: [["name", "ASC"]]
  });

  return { records, count, hasMore: count > offset + records.length };
};

export const show = async (id: string | number, companyId: number): Promise<Employee> => {
  const record = await Employee.findOne({
    where: { id, companyId },
    include: includeManager
  });

  if (!record) {
    throw new AppError("ERR_EMPLOYEE_NOT_FOUND", 404);
  }

  return record;
};

export const create = async (data: EmployeeData, companyId: number): Promise<Employee> => {
  try {
    await employeeSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const record = await Employee.create({
    ...sanitizeEmployeeData(data),
    managerId: data.managerId || null,
    companyId
  } as any);

  return show(record.id, companyId);
};

export const update = async (
  id: string | number,
  data: EmployeeData,
  companyId: number
): Promise<Employee> => {
  const record = await show(id, companyId);

  try {
    await employeeSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await record.update({ ...sanitizeEmployeeData(data), managerId: data.managerId || null });
  return show(id, companyId);
};

export const remove = async (id: string | number, companyId: number): Promise<void> => {
  const record = await Employee.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_EMPLOYEE_NOT_FOUND", 404);
  }
  await record.destroy();
};
