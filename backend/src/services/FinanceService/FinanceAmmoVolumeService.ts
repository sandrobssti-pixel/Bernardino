import { Op } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import FinanceProduct from "../../models/FinanceProduct";
import FinanceAmmoVolume from "../../models/FinanceAmmoVolume";

// Caixinha pequena de munição — sub-cadastro do Produto (a "caixa
// cheia"/SKU), uma linha por caixinha física aberta dela (v2.3.223,
// pedido do cliente). Mesmo ciclo de vida já usado pra arma por número
// de série (FinanceWeaponUnitService.ts) — ver comentário completo em
// FinanceAmmoVolume.ts e docs/MANUAL_TECNICO.md.
export const STATUS_OPTIONS = ["in_stock", "reserved", "sold"];

interface VolumeData {
  lotNumber: string;
  barcodeId: string;
  unitQuantity: number | string;
  status?: string;
  notes?: string;
}

const volumeSchema = Yup.object().shape({
  lotNumber: Yup.string().required("ERR_FINANCE_AMMO_VOLUME_LOT_REQUIRED").min(1),
  barcodeId: Yup.string().required("ERR_FINANCE_AMMO_VOLUME_BARCODE_REQUIRED").min(1),
  unitQuantity: Yup.number()
    .typeError("ERR_FINANCE_AMMO_VOLUME_QUANTITY_INVALID")
    .required("ERR_FINANCE_AMMO_VOLUME_QUANTITY_INVALID")
    .min(1, "ERR_FINANCE_AMMO_VOLUME_QUANTITY_INVALID"),
  notes: Yup.string().nullable(),
  status: Yup.string()
    .nullable()
    .oneOf([...STATUS_OPTIONS, "", null], "ERR_FINANCE_AMMO_VOLUME_INVALID_STATUS")
});

const ensureProduct = async (productId: string | number, companyId: number): Promise<FinanceProduct> => {
  const product = await FinanceProduct.findOne({ where: { id: productId, companyId } });
  if (!product) {
    throw new AppError("ERR_FINANCE_PRODUCT_NOT_FOUND", 404);
  }
  return product;
};

// stockQuantity do produto-munição = SOMA das unidades (cartuchos) das
// caixinhas "em estoque" — diferente da contagem simples usada pra
// arma (1 unidade = 1 arma), aqui cada caixinha carrega várias
// unidades dentro. Recalculado do zero a cada create/update/remove,
// nunca incrementado/decrementado na mão.
const recalculateStockQuantity = async (productId: string | number): Promise<void> => {
  const inStockVolumes = await FinanceAmmoVolume.findAll({
    where: { productId, status: "in_stock" },
    attributes: ["unitQuantity"]
  });
  const total = inStockVolumes.reduce((sum, v) => sum + (Number(v.unitQuantity) || 0), 0);
  await FinanceProduct.update({ stockQuantity: total }, { where: { id: productId } });
};

// Índice único (companyId, barcodeId) já cobre a corrida entre duas
// requisições simultâneas; esse checque prévio só existe pra devolver
// um erro amigável.
const ensureBarcodeIsUnique = async (
  barcodeId: string,
  companyId: number,
  ignoreId?: number
): Promise<void> => {
  const where: any = { companyId, barcodeId };
  if (ignoreId) {
    where.id = { [Op.ne]: ignoreId };
  }

  const existing = await FinanceAmmoVolume.findOne({ where });
  if (existing) {
    throw new AppError("ERR_FINANCE_AMMO_VOLUME_DUPLICATE_BARCODE");
  }
};

export const list = async (
  productId: string | number,
  companyId: number
): Promise<FinanceAmmoVolume[]> => {
  await ensureProduct(productId, companyId);

  return FinanceAmmoVolume.findAll({
    where: { productId, companyId },
    order: [["lotNumber", "ASC"], ["barcodeId", "ASC"]]
  });
};

export const create = async (
  productId: string | number,
  data: VolumeData,
  companyId: number
): Promise<FinanceAmmoVolume> => {
  await ensureProduct(productId, companyId);

  try {
    await volumeSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const barcodeId = data.barcodeId.trim();
  await ensureBarcodeIsUnique(barcodeId, companyId);

  try {
    const volume = await FinanceAmmoVolume.create({
      productId,
      companyId,
      lotNumber: data.lotNumber.trim(),
      barcodeId,
      unitQuantity: Number(data.unitQuantity) || 0,
      status: data.status || "in_stock",
      notes: data.notes?.trim() || ""
    } as any);
    await recalculateStockQuantity(productId);
    return volume;
  } catch (err: any) {
    if (err.name === "SequelizeUniqueConstraintError") {
      throw new AppError("ERR_FINANCE_AMMO_VOLUME_DUPLICATE_BARCODE");
    }
    throw err;
  }
};

// Cadastro em lote (uma remessa de caixa cheia vira várias caixinhas de
// uma vez) — mesmo Lote e mesma Quantidade por caixinha pra todas,
// colando só a lista de IDs (um por linha); cada linha pode também vir
// "ID,quantidade" pra sobrescrever a quantidade padrão numa caixinha
// específica (pedido implícito do cliente: "as vezes pode acontecer
// que tem uma caixa" com quantidade diferente da padrão).
export const createBulk = async (
  productId: string | number,
  lotNumber: string,
  defaultUnitQuantity: number | string,
  linesRaw: string[],
  companyId: number
): Promise<{ created: FinanceAmmoVolume[]; duplicates: string[] }> => {
  await ensureProduct(productId, companyId);

  const trimmedLot = (lotNumber || "").trim();
  if (!trimmedLot) {
    throw new AppError("ERR_FINANCE_AMMO_VOLUME_LOT_REQUIRED");
  }

  const seen = new Set<string>();
  const duplicatesInBatch: string[] = [];
  const parsed: { barcodeId: string; unitQuantity: number }[] = [];

  (linesRaw || [])
    .map(line => (line || "").trim())
    .filter(Boolean)
    .forEach(line => {
      const [rawBarcode, rawQuantity] = line.split(",").map(part => part.trim());
      const barcodeId = rawBarcode;
      if (!barcodeId) return;
      const key = barcodeId.toLowerCase();
      if (seen.has(key)) {
        duplicatesInBatch.push(barcodeId);
        return;
      }
      seen.add(key);
      parsed.push({
        barcodeId,
        unitQuantity: rawQuantity ? Number(rawQuantity) || 0 : Number(defaultUnitQuantity) || 0
      });
    });

  if (parsed.length === 0) {
    throw new AppError("ERR_FINANCE_AMMO_VOLUME_BARCODE_REQUIRED");
  }

  const barcodeIds = parsed.map(p => p.barcodeId);
  const existingVolumes = await FinanceAmmoVolume.findAll({
    where: { companyId, barcodeId: { [Op.iLike]: { [Op.any]: barcodeIds } } },
    attributes: ["barcodeId"]
  });
  const existingLower = new Set(existingVolumes.map(v => v.barcodeId.toLowerCase()));

  const toCreate = parsed.filter(p => !existingLower.has(p.barcodeId.toLowerCase()));
  const alreadyExisting = parsed
    .filter(p => existingLower.has(p.barcodeId.toLowerCase()))
    .map(p => p.barcodeId);

  const created: FinanceAmmoVolume[] = [];
  for (const { barcodeId, unitQuantity } of toCreate) {
    if (unitQuantity <= 0) {
      duplicatesInBatch.push(`${barcodeId} (quantidade inválida, ignorado)`);
      continue;
    }
    const volume = await FinanceAmmoVolume.create({
      productId,
      companyId,
      lotNumber: trimmedLot,
      barcodeId,
      unitQuantity,
      status: "in_stock",
      notes: ""
    } as any);
    created.push(volume);
  }

  if (created.length > 0) {
    await recalculateStockQuantity(productId);
  }

  return { created, duplicates: [...duplicatesInBatch, ...alreadyExisting] };
};

export const update = async (
  id: string | number,
  productId: string | number,
  data: VolumeData,
  companyId: number
): Promise<FinanceAmmoVolume> => {
  await ensureProduct(productId, companyId);

  const volume = await FinanceAmmoVolume.findOne({ where: { id, productId, companyId } });
  if (!volume) {
    throw new AppError("ERR_FINANCE_AMMO_VOLUME_NOT_FOUND", 404);
  }

  try {
    await volumeSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const barcodeId = data.barcodeId.trim();
  await ensureBarcodeIsUnique(barcodeId, companyId, volume.id);

  try {
    await volume.update({
      lotNumber: data.lotNumber.trim(),
      barcodeId,
      unitQuantity: Number(data.unitQuantity) || 0,
      status: data.status || volume.status,
      notes: data.notes?.trim() ?? volume.notes
    });
    await recalculateStockQuantity(productId);
    return volume;
  } catch (err: any) {
    if (err.name === "SequelizeUniqueConstraintError") {
      throw new AppError("ERR_FINANCE_AMMO_VOLUME_DUPLICATE_BARCODE");
    }
    throw err;
  }
};

export const remove = async (
  id: string | number,
  productId: string | number,
  companyId: number
): Promise<void> => {
  const volume = await FinanceAmmoVolume.findOne({ where: { id, productId, companyId } });
  if (!volume) {
    throw new AppError("ERR_FINANCE_AMMO_VOLUME_NOT_FOUND", 404);
  }
  // Caixinha presa numa venda (reservada ou já vendida) não pode ser
  // excluída solta — perderia a rastreabilidade do item de venda que
  // aponta pra ela. Cancelar a venda primeiro libera.
  if (volume.status === "reserved" || volume.status === "sold") {
    throw new AppError("ERR_FINANCE_AMMO_VOLUME_LINKED_TO_SALE");
  }
  await volume.destroy();
  await recalculateStockQuantity(productId);
};

// --------------------------------------------------------------------
// Integração com a Venda — mesmo princípio já usado pra arma por
// número de série (ver SaleService.ts): a caixinha só sai de "em
// estoque" (disponível pra outra venda) quando reservada numa venda
// confirmada; só vira "sold" de verdade quando a nota fiscal daquela
// venda for REALMENTE autorizada pelo gateway.
// --------------------------------------------------------------------

export const reserveForSale = async (
  ammoVolumeId: number,
  saleItemId: number,
  companyId: number
): Promise<void> => {
  const volume = await FinanceAmmoVolume.findOne({ where: { id: ammoVolumeId, companyId } });
  if (!volume) {
    throw new AppError("ERR_FINANCE_AMMO_VOLUME_NOT_FOUND", 404);
  }
  if (volume.status !== "in_stock") {
    throw new AppError("ERR_FINANCE_AMMO_VOLUME_NOT_AVAILABLE");
  }
  await volume.update({ status: "reserved", saleItemId });
  await recalculateStockQuantity(volume.productId);
};

export const releaseForSaleItem = async (saleItemId: number, companyId: number): Promise<void> => {
  const volume = await FinanceAmmoVolume.findOne({ where: { saleItemId, companyId } });
  if (!volume) return;
  await volume.update({ status: "in_stock", saleItemId: null, soldAt: null });
  await recalculateStockQuantity(volume.productId);
};

export const markSoldForSaleItem = async (saleItemId: number, companyId: number): Promise<void> => {
  const volume = await FinanceAmmoVolume.findOne({ where: { saleItemId, companyId } });
  if (!volume || volume.status === "sold") return;
  await volume.update({ status: "sold", soldAt: new Date() });
  await recalculateStockQuantity(volume.productId);
};
