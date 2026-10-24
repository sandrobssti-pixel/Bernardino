import { Op } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import FinanceProduct from "../../models/FinanceProduct";
import FinanceWeaponUnit from "../../models/FinanceWeaponUnit";
import FinanceWeaponUnitEvent from "../../models/FinanceWeaponUnitEvent";

// Unidade física de arma — sub-cadastro do Produto (SKU/modelo), uma
// linha por número de série. Etapa 1 autorizada (ver mensagem do Sandro
// via sessão "Manutenção VPS") — ver FinanceWeaponUnit.ts e
// docs/MANUAL_TECNICO.md, seção 184. Etapa 2 (integração com Venda —
// "reserved" abaixo, reserveForSale/releaseForSaleItem/
// markSoldForSaleItem) autorizada depois, em chat direto — seção 186.
// "separated" (v2.3.214, pedido do cliente) — diferente de "reserved"
// (automático, só existe linkado a uma venda em aberto): é uma marcação
// MANUAL pro operador separar uma arma pra alguém sem precisar criar a
// venda ainda (ex.: cliente reservou por telefone). Mesmo efeito de
// "sair do estoque disponível" que as outras situações não-"in_stock"
// já têm — `recalculateStockQuantity` só conta `status === "in_stock"`,
// nenhuma lógica nova precisou mudar pra isso funcionar.
export const STATUS_OPTIONS = ["in_stock", "reserved", "separated", "sold", "maintenance", "decommissioned"];

interface UnitData {
  serialNumber: string;
  sigmaRegistrationNumber?: string;
  status?: string;
  notes?: string;
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
  notes: Yup.string().nullable(),
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

// stockQuantity do produto-arma = contagem de unidades "em estoque"
// (pedido do Sandro — painel/aviso de estoque baixo já usam esse campo).
// Recalculado do zero a cada create/update/remove de unidade, nunca
// incrementado/decrementado na mão (evita desvio acumulado).
const recalculateStockQuantity = async (productId: string | number): Promise<void> => {
  const inStockCount = await FinanceWeaponUnit.count({
    where: { productId, status: "in_stock" }
  });
  await FinanceProduct.update({ stockQuantity: inStockCount }, { where: { id: productId } });
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
      status: data.status || "in_stock",
      notes: data.notes?.trim() || ""
    } as any);
    await FinanceWeaponUnitEvent.create({
      weaponUnitId: unit.id,
      type: "entrada",
      companyId
    } as any);
    await recalculateStockQuantity(productId);
    return unit;
  } catch (err: any) {
    if (err.name === "SequelizeUniqueConstraintError") {
      throw new AppError("ERR_FINANCE_WEAPON_UNIT_DUPLICATE_SERIAL");
    }
    throw err;
  }
};

// Cadastro em lote (colar lista, uma série por linha) — pedido do
// Sandro. Linhas em branco são ignoradas; duplicata (dentro do próprio
// lote OU já cadastrada) é recusada com mensagem clara listando quais,
// sem travar a criação das séries válidas do mesmo lote.
export const createBulk = async (
  productId: string | number,
  serialNumbersRaw: string[],
  companyId: number
): Promise<{ created: FinanceWeaponUnit[]; duplicates: string[] }> => {
  await ensureProduct(productId, companyId);

  const seen = new Set<string>();
  const duplicatesInBatch: string[] = [];
  const uniqueSerials: string[] = [];

  (serialNumbersRaw || [])
    .map(s => (s || "").trim())
    .filter(Boolean)
    .forEach(serial => {
      const key = serial.toLowerCase();
      if (seen.has(key)) {
        duplicatesInBatch.push(serial);
      } else {
        seen.add(key);
        uniqueSerials.push(serial);
      }
    });

  if (uniqueSerials.length === 0) {
    throw new AppError("ERR_FINANCE_WEAPON_UNIT_SERIAL_REQUIRED");
  }

  const existingUnits = await FinanceWeaponUnit.findAll({
    where: { companyId, serialNumber: { [Op.iLike]: { [Op.any]: uniqueSerials } } },
    attributes: ["serialNumber"]
  });
  const existingSerialsLower = new Set(existingUnits.map(u => u.serialNumber.toLowerCase()));

  const toCreate = uniqueSerials.filter(s => !existingSerialsLower.has(s.toLowerCase()));
  const alreadyExisting = uniqueSerials.filter(s => existingSerialsLower.has(s.toLowerCase()));

  const created: FinanceWeaponUnit[] = [];
  for (const serialNumber of toCreate) {
    const unit = await FinanceWeaponUnit.create({
      productId,
      companyId,
      serialNumber,
      sigmaRegistrationNumber: "",
      status: "in_stock",
      notes: ""
    } as any);
    await FinanceWeaponUnitEvent.create({
      weaponUnitId: unit.id,
      type: "entrada",
      companyId
    } as any);
    created.push(unit);
  }

  if (created.length > 0) {
    await recalculateStockQuantity(productId);
  }

  return { created, duplicates: [...duplicatesInBatch, ...alreadyExisting] };
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
      status: data.status || unit.status,
      notes: data.notes?.trim() ?? unit.notes
    });
    await recalculateStockQuantity(productId);
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
  // Unidade presa numa venda (reservada ou já vendida) não pode ser
  // excluída solta — perderia a rastreabilidade do item de venda que
  // aponta pra ela (v2.3.207/Etapa 2). Cancelar a venda primeiro libera.
  if (unit.status === "reserved" || unit.status === "sold") {
    throw new AppError("ERR_FINANCE_WEAPON_UNIT_LINKED_TO_SALE");
  }
  await unit.destroy();
  await recalculateStockQuantity(productId);
};

// Busca por nome do modelo, SKU do produto OU número de série — "no
// mínimo na listagem de produtos/unidades" (Etapa 1). Busca na tela de
// Venda fica pra etapa separada.
export const search = async ({
  companyId,
  searchParam = "",
  onlyInStock = false
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

// --------------------------------------------------------------------
// Etapa 2 (integração com Venda), autorizada em chat direto com o
// Sandro — não por relay cross-session como a Etapa 1 (ver seção 184).
// Pedido do cliente: a unidade só sai de "em estoque" (disponível pra
// outra venda) quando reservada numa venda confirmada; só vira "sold"
// de verdade quando a nota fiscal daquela venda for REALMENTE
// autorizada (não na confirmação da venda em si) — ver
// FiscalDocumentService.emit/refreshStatus, que chamam
// SaleService.markWeaponUnitsSold depois de confirmado o `authorized`
// do gateway. Ver docs/MANUAL_TECNICO.md, seção 186.
// --------------------------------------------------------------------

// Chamado por SaleService.confirm/update ao confirmar uma venda com item
// de arma vinculado a uma unidade. Falha se a unidade não estiver mais
// "em estoque" (já reservada/vendida por outra venda, ou em manutenção/
// baixada) — mesma checagem de corrida que o índice único já cobria pro
// SKU único, agora pro status da unidade.
export const reserveForSale = async (
  weaponUnitId: number,
  saleItemId: number,
  companyId: number
): Promise<void> => {
  const unit = await FinanceWeaponUnit.findOne({ where: { id: weaponUnitId, companyId } });
  if (!unit) {
    throw new AppError("ERR_FINANCE_WEAPON_UNIT_NOT_FOUND", 404);
  }
  if (unit.status !== "in_stock") {
    throw new AppError("ERR_FINANCE_WEAPON_UNIT_NOT_AVAILABLE");
  }
  await unit.update({ status: "reserved", saleItemId });
  await recalculateStockQuantity(unit.productId);
};

// Chamado por SaleService.cancel/update ao cancelar uma venda ou trocar
// a composição de uma já confirmada — devolve a unidade pra "em
// estoque", esteja ela "reservada" (nota nunca chegou a ser emitida) ou
// já "sold" (nota autorizada, mas a venda foi cancelada depois — mesma
// regra de "devolve estoque" já aplicada ao resto do sistema). Nunca
// falha quando não acha a unidade (item de venda sem arma vinculada, ou
// unidade já excluída) — mesmo padrão tolerante de
// FinanceImportService.upsertProductRecord.
export const releaseForSaleItem = async (saleItemId: number, companyId: number): Promise<void> => {
  const unit = await FinanceWeaponUnit.findOne({ where: { saleItemId, companyId } });
  if (!unit) return;
  await unit.update({ status: "in_stock", saleItemId: null, soldAt: null });
  await recalculateStockQuantity(unit.productId);
};

// Chamado por SaleService.markWeaponUnitsSold quando a NF-e da venda é
// autorizada de verdade pelo gateway (Focus NFe) — a baixa definitiva do
// estoque disponível. Idempotente: já "sold" (segunda chamada, ex.:
// refreshStatus confirmando de novo um status já tratado) é um no-op.
export const markSoldForSaleItem = async (saleItemId: number, companyId: number): Promise<void> => {
  const unit = await FinanceWeaponUnit.findOne({ where: { saleItemId, companyId } });
  if (!unit || unit.status === "sold") return;
  await unit.update({ status: "sold", soldAt: new Date() });
  await recalculateStockQuantity(unit.productId);
};
