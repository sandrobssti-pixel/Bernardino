import { Op } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import FinanceProduct from "../../models/FinanceProduct";
import FinanceWeaponUnit from "../../models/FinanceWeaponUnit";

// Unidade física de arma — sub-cadastro do Produto (SKU/modelo), uma
// linha por número de série. Ver FinanceWeaponUnit.ts e
// docs/MANUAL_TECNICO.md, seção 183.
export const STATUS_OPTIONS = ["in_stock", "sold", "maintenance", "decommissioned"];

interface UnitData {
  serialNumber: string;
  sigmaRegistrationNumber?: string;
  status?: string;
}

// Único campo realmente obrigatório pra cadastrar uma arma é o número de
// série (o SKU/modelo já vem resolvido por `productId`, pedido explícito
// do cliente — "quando eu for lançar uma agora não dar erro interno,
// campo obrigatório só SKU e número de série").
const unitSchema = Yup.object().shape({
  serialNumber: Yup.string()
    .required("ERR_FINANCE_WEAPON_UNIT_SERIAL_REQUIRED")
    .min(1, "ERR_FINANCE_WEAPON_UNIT_SERIAL_REQUIRED"),
  sigmaRegistrationNumber: Yup.string().nullable(),
  status: Yup.string()
    .nullable()
    .oneOf([...STATUS_OPTIONS, "", null], "ERR_FINANCE_WEAPON_UNIT_INVALID_STATUS")
});

const ensureProduct = async (productId: string | number, companyId: number): Promise<FinanceProduct> => {
  const product = await FinanceProduct.findOne({ where: { id: productId, companyId } });
  if (!product) {
    throw new AppError("ERR_FINANCE_PRODUCT_NOT_FOUND", 404);
  }
  return product;
};

// Índice único (companyId, serialNumber) já cobre a corrida entre duas
// requisições simultâneas; esse checque prévio só existe pra devolver um
// erro amigável (mesmo padrão de FinanceProductService.
// ensureSerialNumberIsUnique).
const ensureSerialNumberIsUnique = async (
  serialNumber: string,
  companyId: number,
  ignoreId?: number
): Promise<void> => {
  const where: any = { companyId, serialNumber };
  if (ignoreId) {
    where.id = { [Op.ne]: ignoreId };
  }

  const existing = await FinanceWeaponUnit.findOne({ where });
  if (existing) {
    throw new AppError("ERR_FINANCE_WEAPON_UNIT_DUPLICATE_SERIAL");
  }
};

export const list = async (
  productId: string | number,
  companyId: number
): Promise<FinanceWeaponUnit[]> => {
  await ensureProduct(productId, companyId);

  return FinanceWeaponUnit.findAll({
    where: { productId, companyId },
    order: [["serialNumber", "ASC"]]
  });
};

export const create = async (
  productId: string | number,
  data: UnitData,
  companyId: number
): Promise<FinanceWeaponUnit> => {
  await ensureProduct(productId, companyId);

  try {
    await unitSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const serialNumber = data.serialNumber.trim();
  await ensureSerialNumberIsUnique(serialNumber, companyId);

  try {
    const unit = await FinanceWeaponUnit.create({
      productId,
      companyId,
      serialNumber,
      sigmaRegistrationNumber: data.sigmaRegistrationNumber?.trim() || "",
      status: data.status || "in_stock"
    } as any);
    return unit;
  } catch (err: any) {
    if (err.name === "SequelizeUniqueConstraintError") {
      throw new AppError("ERR_FINANCE_WEAPON_UNIT_DUPLICATE_SERIAL");
    }
    throw err;
  }
};

export const update = async (
  id: string | number,
  productId: string | number,
  data: UnitData,
  companyId: number
): Promise<FinanceWeaponUnit> => {
  await ensureProduct(productId, companyId);

  const unit = await FinanceWeaponUnit.findOne({ where: { id, productId, companyId } });
  if (!unit) {
    throw new AppError("ERR_FINANCE_WEAPON_UNIT_NOT_FOUND", 404);
  }

  try {
    await unitSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const serialNumber = data.serialNumber.trim();
  await ensureSerialNumberIsUnique(serialNumber, companyId, unit.id);

  try {
    await unit.update({
      serialNumber,
      sigmaRegistrationNumber: data.sigmaRegistrationNumber?.trim() || "",
      status: data.status || unit.status
    });
    return unit;
  } catch (err: any) {
    if (err.name === "SequelizeUniqueConstraintError") {
      throw new AppError("ERR_FINANCE_WEAPON_UNIT_DUPLICATE_SERIAL");
    }
    throw err;
  }
};

export const remove = async (
  id: string | number,
  productId: string | number,
  companyId: number
): Promise<void> => {
  const unit = await FinanceWeaponUnit.findOne({ where: { id, productId, companyId } });
  if (!unit) {
    throw new AppError("ERR_FINANCE_WEAPON_UNIT_NOT_FOUND", 404);
  }
  await unit.destroy();
};

// Busca pra Venda (Fase 2) e pra qualquer tela que precise achar uma arma
// específica pelo nome do modelo, pelo SKU ou pelo número de série —
// pedido do cliente ("quando vender pode consultar pelo nome do produto,
// pelo código sku ou pelo numero de serie"). Só traz unidade "em
// estoque" por padrão (não oferece pra vender o que já foi vendido/está
// em manutenção/baixado).
export const search = async ({
  companyId,
  searchParam = "",
  onlyInStock = true
}: {
  companyId: number;
  searchParam?: string;
  onlyInStock?: boolean;
}): Promise<FinanceWeaponUnit[]> => {
  const term = searchParam.trim();

  const unitWhere: any = { companyId };
  if (onlyInStock) {
    unitWhere.status = "in_stock";
  }

  if (!term) {
    return FinanceWeaponUnit.findAll({
      where: unitWhere,
      include: [{ model: FinanceProduct, as: "product", attributes: ["id", "name", "sku", "price"] }],
      order: [["serialNumber", "ASC"]],
      limit: 20
    });
  }

  // Produto (modelo) cujo nome/SKU bate com a busca — unidades dele
  // entram no resultado mesmo sem o serial bater.
  const matchingProducts = await FinanceProduct.findAll({
    where: {
      companyId,
      type: "weapon",
      [Op.or]: [{ name: { [Op.iLike]: `%${term}%` } }, { sku: { [Op.iLike]: `%${term}%` } }]
    },
    attributes: ["id"]
  });
  const matchingProductIds = matchingProducts.map(p => p.id);

  unitWhere[Op.or] = [
    { serialNumber: { [Op.iLike]: `%${term}%` } },
    ...(matchingProductIds.length ? [{ productId: { [Op.in]: matchingProductIds } }] : [])
  ];

  return FinanceWeaponUnit.findAll({
    where: unitWhere,
    include: [{ model: FinanceProduct, as: "product", attributes: ["id", "name", "sku", "price"] }],
    order: [["serialNumber", "ASC"]],
    limit: 20
  });
};
