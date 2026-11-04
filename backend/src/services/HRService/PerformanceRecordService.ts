import AppError from "../../errors/AppError";
import Employee from "../../models/Employee";
import PerformanceRecord from "../../models/PerformanceRecord";
import { canAccessEmployeePerformance } from "./PerformanceAccessService";

interface RequestUser {
  id: number;
  companyId: number;
  profile: string;
  super?: boolean;
}

interface ListRequest {
  companyId: number;
  employeeId: number | string;
  recordType?: string;
  pageNumber?: number | string;
}

interface ListResponse {
  records: PerformanceRecord[];
  count: number;
  hasMore: boolean;
}

const RECORD_TYPES = ["evaluation", "okr", "feedback_1_1", "promotion_readiness"];

interface RecordData {
  employeeId: number | string;
  recordType: string;
  recordDate: string;
  notes?: string;
  overallRating?: number | string;
  strengths?: string;
  improvementAreas?: string;
  goals?: string;
  objective?: string;
  keyResult1?: string;
  kr1Progress?: number | string;
  keyResult2?: string;
  kr2Progress?: number | string;
  keyResult3?: string;
  kr3Progress?: number | string;
  overallProgress?: number | string;
  topics?: string;
  actionItems?: string;
  nextMeetingDate?: string;
  targetRole?: string;
  technicalSkillScore?: number | string;
  leadershipScore?: number | string;
  communicationScore?: number | string;
  resultsScore?: number | string;
  readinessLevel?: string;
}

// Mesmo bug/fix já corrigido em EmployeeService/CompanyPartnerService:
// o formulário genérico manda "" pra todo campo escondido pelo
// `visibleWhen` (ex.: campos de OKR ficam "" quando `recordType` é
// "evaluation") — Postgres rejeita "" em coluna DATE/INTEGER.
const DATE_FIELDS = ["recordDate", "nextMeetingDate"];
const NUMERIC_FIELDS = [
  "overallRating",
  "kr1Progress",
  "kr2Progress",
  "kr3Progress",
  "overallProgress",
  "technicalSkillScore",
  "leadershipScore",
  "communicationScore",
  "resultsScore"
];

const sanitizeRecordData = (data: RecordData): RecordData => {
  const sanitized: Record<string, unknown> = { ...data };
  [...DATE_FIELDS, ...NUMERIC_FIELDS].forEach(field => {
    if (sanitized[field] === "") sanitized[field] = null;
  });
  return sanitized as unknown as RecordData;
};

const findAccessibleEmployee = async (
  user: RequestUser,
  employeeId: number | string,
  companyId: number
): Promise<Employee> => {
  const employee = await Employee.findOne({ where: { id: employeeId, companyId } });
  if (!employee) {
    throw new AppError("ERR_EMPLOYEE_NOT_FOUND", 404);
  }
  if (!canAccessEmployeePerformance(user, employee)) {
    throw new AppError("ERR_NO_PERFORMANCE_ACCESS", 403);
  }
  return employee;
};

// Funcionários que o usuário logado pode ver o desempenho — Admin/
// Master vê todos os ativos da empresa; qualquer outro usuário (mesmo
// com `hrAccess`) só vê os que ele é `managerId`. Alimenta o seletor
// de funcionário da tela do Painel de Desempenho.
export const listManageableEmployees = async (user: RequestUser, companyId: number): Promise<Employee[]> => {
  const whereCondition: any = { companyId, contractStatus: "active" };
  if (!(user.super || user.profile === "admin")) {
    whereCondition.managerId = user.id;
  }
  return Employee.findAll({ where: whereCondition, order: [["name", "ASC"]] });
};

export const list = async (user: RequestUser, { companyId, employeeId, recordType, pageNumber = "1" }: ListRequest): Promise<ListResponse> => {
  if (!employeeId) {
    throw new AppError("ERR_PERFORMANCE_EMPLOYEE_REQUIRED", 400);
  }
  await findAccessibleEmployee(user, employeeId, companyId);

  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const whereCondition: any = { companyId, employeeId };
  if (recordType) whereCondition.recordType = recordType;

  const { count, rows: records } = await PerformanceRecord.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [
      ["recordDate", "DESC"],
      ["id", "DESC"]
    ]
  });

  return { records, count, hasMore: count > offset + records.length };
};

export const create = async (user: RequestUser, companyId: number, data: RecordData): Promise<PerformanceRecord> => {
  if (!data.employeeId) {
    throw new AppError("ERR_PERFORMANCE_EMPLOYEE_REQUIRED", 400);
  }
  if (!data.recordType || !RECORD_TYPES.includes(data.recordType)) {
    throw new AppError("ERR_PERFORMANCE_INVALID_RECORD_TYPE", 400);
  }
  if (!data.recordDate) {
    throw new AppError("ERR_PERFORMANCE_INVALID_DATE", 400);
  }
  await findAccessibleEmployee(user, data.employeeId, companyId);

  const record = await PerformanceRecord.create({
    ...sanitizeRecordData(data),
    companyId,
    createdByUserId: user.id
  } as any);
  return record;
};

export const update = async (
  user: RequestUser,
  id: string | number,
  companyId: number,
  data: RecordData
): Promise<PerformanceRecord> => {
  const record = await PerformanceRecord.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_PERFORMANCE_RECORD_NOT_FOUND", 404);
  }
  await findAccessibleEmployee(user, record.employeeId, companyId);

  if (data.recordType && !RECORD_TYPES.includes(data.recordType)) {
    throw new AppError("ERR_PERFORMANCE_INVALID_RECORD_TYPE", 400);
  }

  await record.update(sanitizeRecordData(data));
  return record;
};

export const remove = async (user: RequestUser, id: string | number, companyId: number): Promise<void> => {
  const record = await PerformanceRecord.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_PERFORMANCE_RECORD_NOT_FOUND", 404);
  }
  await findAccessibleEmployee(user, record.employeeId, companyId);
  await record.destroy();
};
