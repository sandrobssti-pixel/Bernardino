import { Op, Sequelize } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import FinanceExpense from "../../models/FinanceExpense";
import FinanceSupplier from "../../models/FinanceSupplier";
import { findEntityIdsByNameOrDocument } from "../../utils/findEntityIdsByNameOrDocument";

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
    // v2.3.262 — pedido do cliente: buscar também pelo nome/CNPJ do
    // fornecedor ligado à conta, não só pela descrição/categoria.
    const supplierIds = await findEntityIdsByNameOrDocument(FinanceSupplier, companyId, searchParam);
    whereCondition[Op.or] = [
      Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("FinanceExpense.description")),
        "LIKE",
        `%${searchParam.toLowerCase().trim()}%`
      ),
      { category: { [Op.iLike]: `%${searchParam.trim()}%` } },
      ...(supplierIds.length ? [{ supplierId: { [Op.in]: supplierIds } }] : [])
    ];
  }

  if (status) {
    whereCondition.status = status;
  }

  // Filtro de Período (Hoje/Semana/Mês/Personalizado, v2.3.258/259) —
  // filtra pela DATA DE LANÇAMENTO (`createdAt`, quando o registro foi
  // cadastrado), não pelo Vencimento: a primeira versão filtrava por
  // `dueDate` e o cliente reportou que lançar 14 contas num dia só
  // mostrava 3 no filtro "Hoje" — a maioria tinha vencimento em data
  // futura (prazo/parcelamento), mesmo lançada no mesmo dia. Confirmado
  // com o cliente que o esperado é ver o que foi LANÇADO no período,
  // independente de quando vence. `createdAt` é timestamp (não
  // DATEONLY como `dueDate`), por isso o range cobre o dia inteiro.
  if (startDate) {
    whereCondition.createdAt = {
      ...(whereCondition.createdAt || {}),
      [Op.gte]: `${startDate} 00:00:00`
    };
  }
  if (endDate) {
    whereCondition.createdAt = {
      ...(whereCondition.createdAt || {}),
      [Op.lte]: `${endDate} 23:59:59.999`
    };
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
