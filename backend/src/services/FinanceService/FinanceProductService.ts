import { Op, Sequelize } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import FinanceProduct from "../../models/FinanceProduct";

interface ListRequest {
  companyId: number;
  searchParam?: string;
  pageNumber?: string | number;
}

interface ListResponse {
  records: FinanceProduct[];
  count: number;
  hasMore: boolean;
}

interface ProductData {
  name: string;
  type?: string;
  sku?: string;
  ncm?: string;
  unit?: string;
  price?: string;
  costPrice?: string;
  controlStock?: boolean;
  stockQuantity?: number;
  notes?: string;
  active?: boolean;
}

const productSchema = Yup.object().shape({
  name: Yup.string().required("ERR_FINANCE_PRODUCT_INVALID_NAME").min(2)
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
        Sequelize.fn("LOWER", Sequelize.col("FinanceProduct.name")),
        "LIKE",
        `%${searchParam.toLowerCase().trim()}%`
      ),
      { sku: { [Op.like]: `%${searchParam.trim()}%` } }
    ];
  }

  const { count, rows: records } = await FinanceProduct.findAndCountAll({
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
): Promise<FinanceProduct> => {
  const record = await FinanceProduct.findOne({ where: { id, companyId } });

  if (!record) {
    throw new AppError("ERR_FINANCE_PRODUCT_NOT_FOUND", 404);
  }

  return record;
};

export const create = async (
  data: ProductData,
  companyId: number
): Promise<FinanceProduct> => {
  try {
    await productSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const record = await FinanceProduct.create({ ...data, companyId } as any);
  return record;
};

export const update = async (
  id: string | number,
  data: ProductData,
  companyId: number
): Promise<FinanceProduct> => {
  const record = await show(id, companyId);

  try {
    await productSchema.validate(data);
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
