import { Op, Sequelize } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import FinanceExpense from "../../models/FinanceExpense";
import FinanceSupplier from "../../models/FinanceSupplier";

interface ListRequest {
  companyId: number;
  searchParam?: string;
  pageNumber?: string | number;
  status?: string;
  startDate?: string;
  endDate?: string;
}

interface ListResponse {
  records: FinanceExpense[];
  count: number;
  hasMore: boolean;
}

interface ExpenseData {
  description: string;
  category?: string;
  costType?: string;
  value?: string;
  dueDate?: string | null;
  paymentDate?: string | null;
  status?: string;
  notes?: string;
  active?: boolean;
  supplierId?: number | null;
}

const expenseSchema = Yup.object().shape({
  description: Yup.string().required("ERR_FINANCE_EXPENSE_INVALID_DESCRIPTION").min(2)
});

const normalizeData = (data: ExpenseData): ExpenseData => ({
  ...data,
  supplierId: data.supplierId || null,
  dueDate: data.dueDate || null,
  paymentDate: data.paymentDate || null
});

export const list = async ({
  companyId,
  searchParam = "",
  pageNumber = "1",
  status,
  startDate,
  endDate
}: ListRequest): Promise<ListResponse> => {
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const whereCondition: any = { companyId };

  if (searchParam) {
    whereCondition[Op.or] = [
      Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("FinanceExpense.description")),
        "LIKE",
        `%${searchParam.toLowerCase().trim()}%`
      ),
      { category: { [Op.iLike]: `%${searchParam.trim()}%` } }
    ];
  }

  if (status) {
    whereCondition.status = status;
  }

  // Filtro de Período (Hoje/Semana/Mês/Personalizado, v2.3.258) — mesmo
  // padrão já usado em `SaleService.list`, filtrando pelo Vencimento
  // (`dueDate`), que é a data que a tela já usa pra ordenar/exibir a lista.
  if (startDate && endDate) {
    whereCondition.dueDate = { [Op.between]: [startDate, endDate] };
  } else if (startDate) {
    whereCondition.dueDate = { [Op.gte]: startDate };
  } else if (endDate) {
    whereCondition.dueDate = { [Op.lte]: endDate };
  }

  const { count, rows: records } = await FinanceExpense.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [["dueDate", "ASC"]],
    include: [{ model: FinanceSupplier, as: "supplier", attributes: ["id", "name"] }]
  });

  return { records, count, hasMore: count > offset + records.length };
};

export const show = async (
  id: string | number,
  companyId: number
): Promise<FinanceExpense> => {
  const record = await FinanceExpense.findOne({
    where: { id, companyId },
    include: [{ model: FinanceSupplier, as: "supplier", attributes: ["id", "name"] }]
  });

  if (!record) {
    throw new AppError("ERR_FINANCE_EXPENSE_NOT_FOUND", 404);
  }

  return record;
};

export const create = async (
  data: ExpenseData,
  companyId: number
): Promise<FinanceExpense> => {
  try {
    await expenseSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const record = await FinanceExpense.create({
    ...normalizeData(data),
    companyId
  } as any);
  return show(record.id, companyId);
};

export const update = async (
  id: string | number,
  data: ExpenseData,
  companyId: number
): Promise<FinanceExpense> => {
  const record = await show(id, companyId);

  try {
    await expenseSchema.validate(data);
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
