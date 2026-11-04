import { Op, Sequelize } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import CompanyPartner from "../../models/CompanyPartner";

interface ListRequest {
  companyId: number;
  searchParam?: string;
  pageNumber?: string | number;
  partnerStatus?: string;
}

interface ListResponse {
  records: CompanyPartner[];
  count: number;
  hasMore: boolean;
}

export const PARTNER_STATUSES = ["active", "withdrawn"];

interface CompanyPartnerData {
  name: string;
  photoUrl?: string | null;
  cpf?: string;
  rg?: string;
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
  partnershipStartDate?: string | null;
  partnershipEndDate?: string | null;
  ownershipPercentage?: number | string | null;
  isAdministrator?: boolean;
  prolaboreValue?: number | string | null;
  partnerStatus?: string;
}

// Mesmo bug/fix de EmployeeService.ts: o formulário genérico
// (FinanceRecordModal) manda "" pra todo campo de data/número que ficar
// vazio — Postgres rejeita "" em coluna DATE/DECIMAL.
const DATE_FIELDS = ["partnershipStartDate", "partnershipEndDate"];
const NUMERIC_FIELDS = ["ownershipPercentage", "prolaboreValue"];

const sanitizePartnerData = (data: CompanyPartnerData): CompanyPartnerData => {
  const sanitized: Record<string, unknown> = { ...data };
  [...DATE_FIELDS, ...NUMERIC_FIELDS].forEach(field => {
    if (sanitized[field] === "") sanitized[field] = null;
  });
  return sanitized as unknown as CompanyPartnerData;
};

const partnerSchema = Yup.object().shape({
  name: Yup.string().required("ERR_COMPANY_PARTNER_INVALID_NAME").min(2)
});

// Cadastro de Sócio (RH, ver docs/MANUAL_TECNICO.md). Mesmo padrão
// enxuto de validação do EmployeeService — só nome obrigatório.
//
// IMPORTANTE: `prolaboreValue` é só CADASTRO aqui — NÃO entra no motor
// de cálculo de folha (PayrollCalculationService). Pró-labore tem
// tributação de INSS diferente da CLT: o sócio que recebe pró-labore é
// "contribuinte individual" perante o INSS, com alíquota própria (não a
// tabela progressiva de 7,5%-14% usada pra CLT) — essa regra ainda não
// foi pesquisada/confirmada contra fonte oficial. Enquanto isso não for
// feito, NÃO calcule INSS/IRRF de sócio reaproveitando
// PayrollCalculationService.calculatePayroll — ele foi construído e
// validado só pra CLT/Menor Aprendiz/Estagiário.
export const list = async ({
  companyId,
  searchParam = "",
  pageNumber = "1",
  partnerStatus
}: ListRequest): Promise<ListResponse> => {
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const whereCondition: any = { companyId };

  if (searchParam) {
    whereCondition[Op.or] = [
      Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("CompanyPartner.name")),
        "LIKE",
        `%${searchParam.toLowerCase().trim()}%`
      ),
      { cpf: { [Op.like]: `%${searchParam.trim()}%` } }
    ];
  }

  if (partnerStatus) whereCondition.partnerStatus = partnerStatus;

  const { count, rows: records } = await CompanyPartner.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [["name", "ASC"]]
  });

  return { records, count, hasMore: count > offset + records.length };
};

export const show = async (id: string | number, companyId: number): Promise<CompanyPartner> => {
  const record = await CompanyPartner.findOne({ where: { id, companyId } });

  if (!record) {
    throw new AppError("ERR_COMPANY_PARTNER_NOT_FOUND", 404);
  }

  return record;
};

export const create = async (
  data: CompanyPartnerData,
  companyId: number
): Promise<CompanyPartner> => {
  try {
    await partnerSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const record = await CompanyPartner.create({
    ...sanitizePartnerData(data),
    companyId
  } as any);

  return show(record.id, companyId);
};

export const update = async (
  id: string | number,
  data: CompanyPartnerData,
  companyId: number
): Promise<CompanyPartner> => {
  await show(id, companyId);

  try {
    await partnerSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const record = await CompanyPartner.findOne({ where: { id, companyId } });
  await record!.update(sanitizePartnerData(data));
  return show(id, companyId);
};

export const remove = async (id: string | number, companyId: number): Promise<void> => {
  const record = await CompanyPartner.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_COMPANY_PARTNER_NOT_FOUND", 404);
  }
  await record.destroy();
};
