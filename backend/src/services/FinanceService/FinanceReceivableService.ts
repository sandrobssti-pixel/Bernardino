import { Op, Sequelize } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import FinanceReceivable from "../../models/FinanceReceivable";
import FinanceCustomer from "../../models/FinanceCustomer";

interface ListRequest {
  companyId: number;
  searchParam?: string;
  pageNumber?: string | number;
  status?: string;
}

interface ListResponse {
  records: FinanceReceivable[];
  count: number;
  hasMore: boolean;
}

interface ReceivableData {
  description: string;
  value?: string;
  dueDate?: string | null;
  receivedDate?: string | null;
  status?: string;
  notes?: string;
  active?: boolean;
  customerId?: number | null;
}

const receivableSchema = Yup.object().shape({
  description: Yup.string().required("ERR_FINANCE_RECEIVABLE_INVALID_DESCRIPTION").min(2)
});

const normalizeData = (data: ReceivableData): ReceivableData => ({
  ...data,
  customerId: data.customerId || null,
  dueDate: data.dueDate || null,
  receivedDate: data.receivedDate || null
});

export const list = async ({
  companyId,
  searchParam = "",
  pageNumber = "1",
  status
}: ListRequest): Promise<ListResponse> => {
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const whereCondition: any = { companyId };

  if (searchParam) {
    whereCondition[Op.or] = [
      Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("FinanceReceivable.description")),
        "LIKE",
        `%${searchParam.toLowerCase().trim()}%`
      )
    ];
  }

  if (status) {
    whereCondition.status = status;
  }

  const { count, rows: records } = await FinanceReceivable.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [["dueDate", "ASC"]],
    include: [{ model: FinanceCustomer, as: "customer", attributes: ["id", "name"] }]
  });

  return { records, count, hasMore: count > offset + records.length };
};

export const show = async (
  id: string | number,
  companyId: number
): Promise<FinanceReceivable> => {
  const record = await FinanceReceivable.findOne({
    where: { id, companyId },
    include: [{ model: FinanceCustomer, as: "customer", attributes: ["id", "name"] }]
  });

  if (!record) {
    throw new AppError("ERR_FINANCE_RECEIVABLE_NOT_FOUND", 404);
  }

  return record;
};

export const create = async (
  data: ReceivableData,
  companyId: number
): Promise<FinanceReceivable> => {
  try {
    await receivableSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const record = await FinanceReceivable.create({
    ...normalizeData(data),
    companyId
  } as any);
  return show(record.id, companyId);
};

export const update = async (
  id: string | number,
  data: ReceivableData,
  companyId: number
): Promise<FinanceReceivable> => {
  const record = await show(id, companyId);

  try {
    await receivableSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await record.update(normalizeData(data));
  return show(id, companyId);
};

export const remove = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const record = await show(id, companyId);
  await record.destroy();
};
