import * as Yup from "yup";
import AppError from "../../errors/AppError";
import FinanceProduct from "../../models/FinanceProduct";
import FinanceAmmoBigBox from "../../models/FinanceAmmoBigBox";
import FinanceAmmoVolume from "../../models/FinanceAmmoVolume";

// "Caixa grande" de munição — sub-cadastro do Produto (a "caixa
// cheia"/SKU), nível ACIMA da caixinha pequena (v2.3.300, pedido do
// cliente). Fluxo: cadastra a caixa grande primeiro (produto + lote
// LE/LF + total de unidades), depois cadastra cada caixinha de dentro,
// vinculada a ela (ver FinanceAmmoVolumeService.ts). Mesmo ciclo de
// vida/padrão dos outros sub-cadastros deste módulo (ensureProduct,
// escopo por companyId). Ver docs/MANUAL_TECNICO.md.

interface BigBoxData {
  lotLE: string;
  lotLF: string;
  totalUnits: number | string;
  notes?: string;
}

// Lote LE aceita letras e números (ex.: "LE123A"); lote LF é só
// números (ex.: "4567") — pedido explícito do cliente, formato real
// usado pelo fabricante da munição.
const bigBoxSchema = Yup.object().shape({
  lotLE: Yup.string()
    .required("ERR_FINANCE_AMMO_BIG_BOX_LOT_LE_REQUIRED")
    .matches(/^[A-Za-z0-9]+$/, "ERR_FINANCE_AMMO_BIG_BOX_LOT_LE_INVALID"),
  lotLF: Yup.string()
    .required("ERR_FINANCE_AMMO_BIG_BOX_LOT_LF_REQUIRED")
    .matches(/^[0-9]+$/, "ERR_FINANCE_AMMO_BIG_BOX_LOT_LF_INVALID"),
  totalUnits: Yup.number()
    .typeError("ERR_FINANCE_AMMO_BIG_BOX_TOTAL_UNITS_INVALID")
    .required("ERR_FINANCE_AMMO_BIG_BOX_TOTAL_UNITS_INVALID")
    .min(1, "ERR_FINANCE_AMMO_BIG_BOX_TOTAL_UNITS_INVALID"),
  notes: Yup.string().nullable()
});

const ensureProduct = async (productId: string | number, companyId: number): Promise<FinanceProduct> => {
  const product = await FinanceProduct.findOne({ where: { id: productId, companyId } });
  if (!product) {
    throw new AppError("ERR_FINANCE_PRODUCT_NOT_FOUND", 404);
  }
  return product;
};

export const list = async (
  productId: string | number,
  companyId: number
): Promise<FinanceAmmoBigBox[]> => {
  await ensureProduct(productId, companyId);

  return FinanceAmmoBigBox.findAll({
    where: { productId, companyId },
    include: [{ model: FinanceAmmoVolume, as: "volumes" }],
    order: [["createdAt", "DESC"]]
  });
};

export const show = async (
  id: string | number,
  productId: string | number,
  companyId: number
): Promise<FinanceAmmoBigBox> => {
  const bigBox = await FinanceAmmoBigBox.findOne({ where: { id, productId, companyId } });
  if (!bigBox) {
    throw new AppError("ERR_FINANCE_AMMO_BIG_BOX_NOT_FOUND", 404);
  }
  return bigBox;
};

export const create = async (
  productId: string | number,
  data: BigBoxData,
  companyId: number
): Promise<FinanceAmmoBigBox> => {
  await ensureProduct(productId, companyId);

  try {
    await bigBoxSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  return FinanceAmmoBigBox.create({
    productId,
    companyId,
    lotLE: data.lotLE.trim(),
    lotLF: data.lotLF.trim(),
    totalUnits: Number(data.totalUnits) || 0,
    notes: data.notes?.trim() || ""
  } as any);
};

export const update = async (
  id: string | number,
  productId: string | number,
  data: BigBoxData,
  companyId: number
): Promise<FinanceAmmoBigBox> => {
  const bigBox = await show(id, productId, companyId);

  try {
    await bigBoxSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await bigBox.update({
    lotLE: data.lotLE.trim(),
    lotLF: data.lotLF.trim(),
    totalUnits: Number(data.totalUnits) || 0,
    notes: data.notes?.trim() ?? bigBox.notes
  });
  return bigBox;
};

export const remove = async (
  id: string | number,
  productId: string | number,
  companyId: number
): Promise<void> => {
  const bigBox = await show(id, productId, companyId);

  // Nunca excluir uma caixa grande que ainda tenha caixinha vinculada —
  // perderia a referência do lote (LE/LF) dessas caixinhas. Excluir (ou
  // desvincular) as caixinhas primeiro.
  const linkedVolumesCount = await FinanceAmmoVolume.count({ where: { bigBoxId: bigBox.id } });
  if (linkedVolumesCount > 0) {
    throw new AppError("ERR_FINANCE_AMMO_BIG_BOX_HAS_VOLUMES");
  }

  await bigBox.destroy();
};
