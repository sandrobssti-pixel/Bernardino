import { Op, Sequelize } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import FinanceCustomer from "../../models/FinanceCustomer";
import Contact from "../../models/Contact";

interface ListRequest {
  companyId: number;
  searchParam?: string;
  pageNumber?: string | number;
}

interface ListResponse {
  records: FinanceCustomer[];
  count: number;
  hasMore: boolean;
}

interface CustomerData {
  name: string;
  documentType?: string;
  document?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  notes?: string;
  active?: boolean;
  contactId?: number | null;
}

const customerSchema = Yup.object().shape({
  name: Yup.string().required("ERR_FINANCE_CUSTOMER_INVALID_NAME").min(2)
});

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
        Sequelize.fn("LOWER", Sequelize.col("FinanceCustomer.name")),
        "LIKE",
        `%${searchParam.toLowerCase().trim()}%`
      ),
      { document: { [Op.like]: `%${searchParam.trim()}%` } },
      { email: { [Op.like]: `%${searchParam.trim()}%` } }
    ];
  }

  const { count, rows: records } = await FinanceCustomer.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [["name", "ASC"]]
  });

  return { records, count, hasMore: count > offset + records.length };
};

export const show = async (
  id: string | number,
  companyId: number
): Promise<FinanceCustomer> => {
  const record = await FinanceCustomer.findOne({ where: { id, companyId } });

  if (!record) {
    throw new AppError("ERR_FINANCE_CUSTOMER_NOT_FOUND", 404);
  }

  return record;
};

export const create = async (
  data: CustomerData,
  companyId: number
): Promise<FinanceCustomer> => {
  try {
    await customerSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const record = await FinanceCustomer.create({ ...data, companyId } as any);
  return record;
};

export const update = async (
  id: string | number,
  data: CustomerData,
  companyId: number
): Promise<FinanceCustomer> => {
  const record = await show(id, companyId);

  try {
    await customerSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await record.update(data);
  return record;
};

export const remove = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const record = await show(id, companyId);
  await record.destroy();
};

// Vínculo Contato (Atendimento) <-> Cliente (Financeiro) — pedido do
// cliente pra virar "uma base só": o atendente marca um Contato existente
// como cliente financeiro, em vez de cadastrar tudo de novo. Direção da
// sincronia decidida com o cliente: o Contato manda (nome/telefone sempre
// vêm de lá); CPF/CNPJ/endereço/demais campos fiscais só existem e só são
// editáveis no FinanceCustomer. Sem atualização automática depois do
// vínculo inicial nesses dois campos — ver docs/MANUAL_TECNICO.md.
export const showByContact = async (
  contactId: string | number,
  companyId: number
): Promise<FinanceCustomer> => {
  const record = await FinanceCustomer.findOne({
    where: { contactId, companyId }
  });

  if (!record) {
    throw new AppError("ERR_FINANCE_CUSTOMER_NOT_FOUND", 404);
  }

  return record;
};

export const linkFromContact = async (
  contactId: string | number,
  companyId: number
): Promise<FinanceCustomer> => {
  const contact = await Contact.findOne({ where: { id: contactId, companyId } });
  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  const existing = await FinanceCustomer.findOne({
    where: { contactId: contact.id, companyId }
  });
  if (existing) return existing;

  const documentDigits = String(contact.document || "").replace(/\D/g, "");
  const documentType = documentDigits.length === 14 ? "cnpj" : "cpf";

  const record = await FinanceCustomer.create({
    name: contact.name,
    phone: contact.number,
    email: contact.email || "",
    document: contact.document || "",
    documentType,
    contactId: contact.id,
    companyId
  } as any);

  return record;
};
