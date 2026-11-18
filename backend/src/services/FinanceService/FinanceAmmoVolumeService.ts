import { Op } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import FinanceProduct from "../../models/FinanceProduct";
import FinanceAmmoVolume from "../../models/FinanceAmmoVolume";
import FinanceAmmoBigBox from "../../models/FinanceAmmoBigBox";
import SaleItem from "../../models/SaleItem";

// Caixinha pequena de munição — sub-cadastro do Produto (a "caixa
// cheia"/SKU), uma linha por caixinha física aberta dela (v2.3.223,
// pedido do cliente). Mesmo ciclo de vida já usado pra arma por número
// de série (FinanceWeaponUnitService.ts) — ver comentário completo em
// FinanceAmmoVolume.ts e docs/MANUAL_TECNICO.md.
//
// `bigBoxId` (v2.3.300, opcional) — vincula a caixinha à "caixa
// grande" de onde ela veio. Quando informado, o lote NÃO é digitado
// manualmente aqui — vem automaticamente da caixa grande (LE/LF),
// gravado em `lotNumber` como snapshot (`"LE/LF"`) no momento do
// vínculo, mesmo princípio de snapshot já usado em todo o projeto
// (Sale.sku/ncm/cfop etc.) — editar o lote da caixa grande depois não
// muda retroativamente caixinha já criada. Caixinha SEM `bigBoxId`
// (cadastro antigo, ou nova caixinha avulsa) continua exigindo
// `lotNumber` digitado à mão, exatamente como antes desta versão.
export const STATUS_OPTIONS = ["in_stock", "reserved", "sold"];

interface VolumeData {
  lotNumber?: string;
  bigBoxId?: number | string | null;
  barcodeId: string;
  unitQuantity: number | string;
  status?: string;
  notes?: string;
}

const volumeSchema = Yup.object().shape({
  lotNumber: Yup.string().when("bigBoxId", {
    is: (value: any) => !value,
    then: Yup.string().required("ERR_FINANCE_AMMO_VOLUME_LOT_REQUIRED").min(1),
    otherwise: Yup.string().nullable()
  }),
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

// Confere que a caixa grande existe, pertence ao MESMO produto/empresa
// (nunca deixar vincular caixinha de um produto a caixa grande de
// outro), e devolve o lote dela pra snapshot em `lotNumber`.
const resolveBigBoxLot = async (
  bigBoxId: number | string | null | undefined,
  productId: string | number,
  companyId: number
): Promise<string | null> => {
  if (!bigBoxId) return null;
  const bigBox = await FinanceAmmoBigBox.findOne({ where: { id: bigBoxId, productId, companyId } });
  if (!bigBox) {
    throw new AppError("ERR_FINANCE_AMMO_BIG_BOX_NOT_FOUND", 404);
  }
  return `${bigBox.lotLE}/${bigBox.lotLF}`;
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
    include: [{ model: FinanceAmmoBigBox, as: "bigBox" }],
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
  const bigBoxLot = await resolveBigBoxLot(data.bigBoxId, productId, companyId);

  try {
    const volume = await FinanceAmmoVolume.create({
      productId,
      companyId,
      bigBoxId: data.bigBoxId || null,
      lotNumber: bigBoxLot ?? data.lotNumber?.trim(),
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
  const bigBoxLot = await resolveBigBoxLot(data.bigBoxId, productId, companyId);

  try {
    await volume.update({
      bigBoxId: data.bigBoxId || null,
      lotNumber: bigBoxLot ?? data.lotNumber?.trim(),
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
  companyId: number,
  force = false
): Promise<void> => {
  const volume = await FinanceAmmoVolume.findOne({ where: { id, productId, companyId } });
  if (!volume) {
    throw new AppError("ERR_FINANCE_AMMO_VOLUME_NOT_FOUND", 404);
  }
  // Caixinha presa numa venda não pode ser excluída solta — perderia a
  // rastreabilidade do item de venda que aponta pra ela. Cancelar a
  // venda primeiro libera (ou usar `force`, ver abaixo).
  //
  // Bug real corrigido (v2.3.303): a checagem antiga confiava só no
  // texto de `status` ("reserved"/"sold"), sem checar se existe de
  // verdade um `SaleItem`. Lançamento antigo podia ficar "Vendida" pra
  // sempre, sem jeito de remover, mesmo sem NENHUMA venda real por
  // trás.
  //
  // Bug real corrigido (v2.3.305): o vínculo pode existir em QUALQUER
  // UMA das duas direções — o `saleItemId` guardado na própria
  // caixinha, OU um `SaleItem.ammoVolumeId` apontando pra cá sem a
  // caixinha ter o `saleItemId` correspondente (dado inconsistente
  // real encontrado em produção). Checar só uma direção (como a
  // v2.3.303 fazia) deixava passar esse segundo caso até o
  // `volume.destroy()`, que então colidia com a restrição de chave
  // estrangeira do Postgres (`SaleItems.ammoVolumeId` não tem `ON
  // DELETE`) e virava um 500 cru, sem mensagem nenhuma — em vez do
  // erro amigável `ERR_FINANCE_AMMO_VOLUME_LINKED_TO_SALE`.
  const linkedSaleItem = await SaleItem.findOne({
    where: {
      [Op.or]: [
        ...(volume.saleItemId ? [{ id: volume.saleItemId }] : []),
        { ammoVolumeId: volume.id }
      ]
    }
  });

  if (linkedSaleItem && !force) {
    throw new AppError("ERR_FINANCE_AMMO_VOLUME_LINKED_TO_SALE");
  }

  // Exclusão forçada (só Admin, depois de confirmar explicitamente que
  // quer mesmo) — desvincula a referência do item de venda antigo
  // (zera `ammoVolumeId`), SEM apagar a venda/item de venda em si. Só
  // a rastreabilidade "esse item veio desta caixinha física" se perde
  // — aceitável pra lançamento antigo/incorreto que o cliente confirmou
  // explicitamente querer limpar.
  if (linkedSaleItem && force) {
    await SaleItem.update({ ammoVolumeId: null }, { where: { id: linkedSaleItem.id } });
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
