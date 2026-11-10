import { Op, QueryTypes, Sequelize } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Member from "../../models/Member";

interface ListRequest {
  companyId: number;
  searchParam?: string;
  pageNumber?: string | number;
}

interface ListResponse {
  records: Member[];
  count: number;
  hasMore: boolean;
}

interface MemberData {
  name: string;
  document?: string;
  rg?: string;
  birthDate?: string | null;
  email?: string;
  phone?: string;
  whatsapp?: string;
  category?: string;
  cacCategory?: string;
  status?: string;
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  notes?: string;
  contactId?: number | null;
}

const memberSchema = Yup.object().shape({
  name: Yup.string().required("ERR_MEMBER_INVALID_NAME").min(2)
});

// "document" é único por empresa quando preenchido (índice parcial, ver
// migration 20261110160200-create-members.ts) — findOne prévio devolve
// erro amigável; o try/catch em create/update é rede de segurança contra
// corrida entre duas requisições simultâneas (mesmo padrão de
// FinanceWeaponUnitService, docs/MANUAL_TECNICO.md seção 11).
const ensureDocumentNotTaken = async (
  document: string | undefined,
  companyId: number,
  excludeId?: string | number
): Promise<void> => {
  if (!document) return;
  const whereCondition: any = { companyId, document };
  if (excludeId) whereCondition.id = { [Op.ne]: excludeId };

  const existing = await Member.findOne({ where: whereCondition });
  if (existing) {
    throw new AppError("ERR_MEMBER_DUPLICATE_DOCUMENT");
  }
};

// Próximo código sequencial do associado, por empresa (mesmo padrão de
// FinanceCustomer.nextCustomerCode/Sale — ver docs/MANUAL_TECNICO.md,
// seção 20 da skill atendeflow-dev).
const nextMemberCode = async (companyId: number): Promise<string> => {
  const [result]: any[] = await Member.sequelize!.query(
    `SELECT COALESCE(MAX(CAST("code" AS INTEGER)), 0) AS "maxCode"
     FROM "Members"
     WHERE "companyId" = :companyId AND "code" ~ '^[0-9]+$'`,
    { replacements: { companyId }, type: QueryTypes.SELECT }
  );
  const maxCode = Number(result?.maxCode) || 0;
  return String(maxCode + 1).padStart(5, "0");
};

// Cadastro nasce/fica "pending" até ter documento e foto — espelha o
// conceito de "Dados Pendentes" do sistema de referência. Só promove
// automaticamente de "pending" pra "active"; nunca mexe quando o status já
// foi definido explicitamente pelo chamador ou já está "inactive" (saída
// deliberada do associado).
const withAutoStatus = (record: Member, explicitStatus?: string): string => {
  if (explicitStatus) return explicitStatus;
  if (record.status !== "pending") return record.status;
  const complete = !!record.document && !!record.photoUrl;
  return complete ? "active" : "pending";
};

export const list = async ({
  companyId,
  searchParam = "",
  pageNumber = "1"
}: ListRequest): Promise<ListResponse> => {
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const whereCondition: any = { companyId };

  if (searchParam) {
    whereCondition[Op.or] = [
      Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("Member.name")),
        "LIKE",
        `%${searchParam.toLowerCase().trim()}%`
      ),
      { document: { [Op.like]: `%${searchParam.trim()}%` } },
      { phone: { [Op.like]: `%${searchParam.trim()}%` } },
      { whatsapp: { [Op.like]: `%${searchParam.trim()}%` } }
    ];
  }

  const { count, rows: records } = await Member.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [["code", "ASC"]]
  });

  return { records, count, hasMore: count > offset + records.length };
};

export const show = async (
  id: string | number,
  companyId: number
): Promise<Member> => {
  const record = await Member.findOne({ where: { id, companyId } });

  if (!record) {
    throw new AppError("ERR_MEMBER_NOT_FOUND", 404);
  }

  return record;
};

export const create = async (
  data: MemberData,
  companyId: number
): Promise<Member> => {
  try {
    await memberSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await ensureDocumentNotTaken(data.document, companyId);

  const code = await nextMemberCode(companyId);
  try {
    const record = await Member.create({
      ...data,
      status: data.status || "pending",
      code,
      companyId
    } as any);
    return record;
  } catch (err: any) {
    if (err.name === "SequelizeUniqueConstraintError") {
      throw new AppError("ERR_MEMBER_DUPLICATE_DOCUMENT");
    }
    throw err;
  }
};

export const update = async (
  id: string | number,
  data: MemberData,
  companyId: number
): Promise<Member> => {
  const record = await show(id, companyId);

  try {
    await memberSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await ensureDocumentNotTaken(data.document, companyId, id);

  try {
    await record.update(data);
  } catch (err: any) {
    if (err.name === "SequelizeUniqueConstraintError") {
      throw new AppError("ERR_MEMBER_DUPLICATE_DOCUMENT");
    }
    throw err;
  }
  record.status = withAutoStatus(record, data.status);
  await record.save();
  return record;
};

export const remove = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const record = await show(id, companyId);
  await record.destroy();
};

export const setPhoto = async (
  id: string | number,
  companyId: number,
  photoUrl: string
): Promise<Member> => {
  const record = await show(id, companyId);
  record.photoUrl = photoUrl;
  record.status = withAutoStatus(record);
  await record.save();
  return record;
};
