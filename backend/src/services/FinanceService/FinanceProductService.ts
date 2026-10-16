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
  minStockQuantity?: number;
  notes?: string;
  active?: boolean;
  // Cadastro de armas/munições/insumos (clube de tiro, loja de armas,
  // armaria) — type "weapon"/"ammunition". Ver docs/MANUAL_TECNICO.md.
  weaponType?: string;
  brand?: string;
  model?: string;
  caliber?: string;
  serialNumber?: string;
  cartridgeCapacity?: number;
  operatingMode?: string;
  barrelCount?: number;
  barrelLength?: number;
  boreType?: string;
  kineticEnergyJ?: number;
  useClassification?: string;
  sigmaRegistrationNumber?: string;
  origin?: string;
  weaponStatus?: string;
  manufacturingLotNumber?: string;
  packageBarcode?: string;
}

// Tipos de produto que exigem número de série (arma física, único por
// empresa). Munição/insumo não tem número de série individual.
const SERIAL_NUMBER_REQUIRED_TYPES = ["weapon"];

const productSchema = Yup.object().shape({
  name: Yup.string().required("ERR_FINANCE_PRODUCT_INVALID_NAME").min(2),
  serialNumber: Yup.string().when("type", {
    is: (type: string) => SERIAL_NUMBER_REQUIRED_TYPES.includes(type),
    then: Yup.string()
      .required("ERR_FINANCE_PRODUCT_SERIAL_REQUIRED")
      .min(1, "ERR_FINANCE_PRODUCT_SERIAL_REQUIRED"),
    otherwise: Yup.string().nullable()
  })
});

// Índice único parcial (companyId, serialNumber) cobre a corrida entre duas
// requisições simultâneas; esse checque prévio só existe pra devolver um
// erro amigável (em vez do SequelizeUniqueConstraintError genérico) no
// caminho normal (sem corrida).
const ensureSerialNumberIsUnique = async (
  serialNumber: string | undefined,
  companyId: number,
  ignoreId?: number
): Promise<void> => {
  if (!serialNumber) return;

  const where: any = { companyId, serialNumber };
  if (ignoreId) {
    where.id = { [Op.ne]: ignoreId };
  }

  const existing = await FinanceProduct.findOne({ where });
  if (existing) {
    throw new AppError("ERR_FINANCE_PRODUCT_DUPLICATE_SERIAL");
  }
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

  await ensureSerialNumberIsUnique(data.serialNumber, companyId);

  try {
    const record = await FinanceProduct.create({ ...data, companyId } as any);
    return record;
  } catch (err: any) {
    if (err.name === "SequelizeUniqueConstraintError") {
      throw new AppError("ERR_FINANCE_PRODUCT_DUPLICATE_SERIAL");
    }
    throw err;
  }
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

  await ensureSerialNumberIsUnique(data.serialNumber, companyId, record.id);

  try {
    await record.update(data);
    return record;
  } catch (err: any) {
    if (err.name === "SequelizeUniqueConstraintError") {
      throw new AppError("ERR_FINANCE_PRODUCT_DUPLICATE_SERIAL");
    }
    throw err;
  }
};

export const remove = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const record = await show(id, companyId);
  await record.destroy();
};
