import { Op } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Sale from "../../models/Sale";
import SaleItem from "../../models/SaleItem";
import FinanceCustomer from "../../models/FinanceCustomer";
import FinanceProduct from "../../models/FinanceProduct";
import FinanceReceivable from "../../models/FinanceReceivable";
import FiscalConfig from "../../models/FiscalConfig";
import FiscalDocument from "../../models/FiscalDocument";
import * as Iva2027Service from "./Iva2027Service";
import { isProductionActive } from "./FiscalConfigService";

interface ListRequest {
  companyId: number;
  searchParam?: string;
  pageNumber?: string | number;
  status?: string;
}

interface ListResponse {
  records: Sale[];
  count: number;
  hasMore: boolean;
}

interface SaleItemData {
  productId?: number | null;
  description: string;
  sku?: string;
  ncm?: string;
  cfop?: string;
  unit?: string;
  quantity: string | number;
  unitPrice: string | number;
}

interface SaleData {
  saleDate?: string | null;
  notes?: string;
  customerId?: number | null;
  items: SaleItemData[];
}

const includeOptions = [
  { model: FinanceCustomer, as: "customer", attributes: ["id", "name", "document", "documentType", "email"] },
  {
    model: SaleItem,
    as: "items",
    include: [
      { model: FinanceProduct, as: "product", attributes: ["id", "name", "sku", "controlStock", "stockQuantity"] }
    ]
  },
  { model: FinanceReceivable, as: "receivable", attributes: ["id", "status", "dueDate"] },
  { model: FiscalDocument, as: "fiscalDocuments", attributes: ["id", "type", "status", "environment"] }
];

const saleSchema = Yup.object().shape({
  items: Yup.array().min(1, "ERR_SALE_REQUIRES_ITEMS")
});

// Soma os itens pra obter o total da venda — sempre recalculado a partir dos
// itens de verdade, nunca aceito como campo solto vindo do frontend (evita
// um total divergente da soma real dos itens).
const calculateTotal = (items: SaleItemData[]): number =>
  items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

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
    whereCondition[Op.or] = [{ notes: { [Op.iLike]: `%${searchParam.trim()}%` } }];
  }

  if (status) {
    whereCondition.status = status;
  }

  const { count, rows: records } = await Sale.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [["id", "DESC"]],
    include: includeOptions,
    distinct: true
  });

  return { records, count, hasMore: count > offset + records.length };
};

export const show = async (id: string | number, companyId: number): Promise<Sale> => {
  const record = await Sale.findOne({
    where: { id, companyId },
    include: includeOptions
  });

  if (!record) {
    throw new AppError("ERR_SALE_NOT_FOUND", 404);
  }

  return record;
};

// Custo/alíquota de imposto não vêm do formulário de venda (o vendedor não
// precisa ver/editar isso) — são sempre lidos do cadastro do produto no
// momento da venda e gravados como snapshot no item (dashboard de lucro,
// v2.3.117), mesma lógica de snapshot já usada pra sku/ncm/cfop.
//
// Reforma Tributária 2027 (CBS/IBS, v2.3.118): os 9 campos `iva*` do item
// só são calculados (via `Iva2027Service.calculate`) quando
// `FiscalConfig.reform2027Enabled` estiver true — com o flag desligado
// (padrão), nem a config nem o cliente são consultados pra isso, e os
// campos ficam no default "0", sem nenhum impacto no faturamento atual.
const buildItemRows = async (items: SaleItemData[], saleId: number, companyId: number, customerId?: number | null) => {
  const productIds = items.map(item => item.productId).filter((id): id is number => !!id);
  const products = productIds.length
    ? await FinanceProduct.findAll({
        where: { id: productIds, companyId },
        attributes: ["id", "costPrice", "taxRate", "ivaCbsRate", "ivaIbsRate", "ivaEducationReduction"]
      })
    : [];
  const productById = new Map(products.map(p => [p.id, p]));

  const fiscalConfig = await FiscalConfig.findOne({ where: { companyId } });
  const reformEnabled = !!fiscalConfig?.reform2027Enabled;

  const customer = reformEnabled && customerId
    ? await FinanceCustomer.findOne({
        where: { id: customerId, companyId },
        attributes: ["id", "ivaTaxpayerProfile", "ivaGovExempt"]
      })
    : null;

  return items.map(item => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const totalPrice = quantity * unitPrice;
    const product = item.productId ? productById.get(item.productId) : undefined;

    const row: Record<string, unknown> = {
      saleId,
      productId: item.productId || null,
      description: item.description,
      sku: item.sku || "",
      ncm: item.ncm || "",
      cfop: item.cfop || "5102",
      unit: item.unit || "UN",
      quantity: String(quantity),
      unitPrice: String(unitPrice),
      totalPrice: String(totalPrice),
      costPrice: product?.costPrice ?? "0",
      taxRate: product?.taxRate ?? "0"
    };

    if (reformEnabled) {
      const result = Iva2027Service.calculate({
        customerProfile: (customer?.ivaTaxpayerProfile as Iva2027Service.IvaTaxpayerProfile) || "B2C",
        customerGovExempt: !!customer?.ivaGovExempt,
        baseNetPrice: totalPrice,
        cbsRate: Number(product?.ivaCbsRate) || 0,
        ibsRate: Number(product?.ivaIbsRate) || 0,
        educationReduction: !!product?.ivaEducationReduction
      });

      row.ivaNetUnitPrice = String(quantity > 0 ? result.netPrice / quantity : 0);
      row.ivaNetTotalPrice = String(result.netPrice);
      row.ivaCbsBase = String(result.netPrice);
      row.ivaIbsBase = String(result.netPrice);
      row.ivaCbsRateApplied = String(result.cbsRateApplied);
      row.ivaIbsRateApplied = String(result.ibsRateApplied);
      row.ivaCbsValue = String(result.cbsValue);
      row.ivaIbsStateValue = String(result.ibsStateValue);
      row.ivaIbsCityValue = String(result.ibsCityValue);
    }

    return row;
  });
};

export const create = async (data: SaleData, companyId: number): Promise<Sale> => {
  try {
    await saleSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const total = calculateTotal(data.items);

  const sale = await Sale.create({
    saleDate: data.saleDate || null,
    notes: data.notes || "",
    customerId: data.customerId || null,
    totalValue: String(total),
    status: "draft",
    companyId
  } as any);

  await SaleItem.bulkCreate(await buildItemRows(data.items, sale.id, companyId, data.customerId) as any);

  return show(sale.id, companyId);
};

export const update = async (
  id: string | number,
  data: SaleData,
  companyId: number
): Promise<Sale> => {
  const sale = await show(id, companyId);

  if (sale.status !== "draft") {
    throw new AppError("ERR_SALE_NOT_EDITABLE");
  }

  try {
    await saleSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const total = calculateTotal(data.items);

  await sale.update({
    saleDate: data.saleDate || null,
    notes: data.notes || "",
    customerId: data.customerId || null,
    totalValue: String(total)
  });

  // Substitui os itens inteiros (mais simples e seguro que tentar
  // diff/merge item a item) — venda só é editável em "draft", então não há
  // risco de descartar histórico de itens de uma venda já confirmada.
  await SaleItem.destroy({ where: { saleId: sale.id } });
  await SaleItem.bulkCreate(await buildItemRows(data.items, sale.id, companyId, data.customerId) as any);

  return show(id, companyId);
};

// Estoque só é checado/mexido pra item com produto vinculado E
// `controlStock` ligado nesse produto — item avulso (sem produto
// cadastrado) ou produto que não controla estoque (ex.: serviço) nunca
// entram nessa conta. Pedido do cliente (v2.3.114): "não venda se não
// tiver disponível" — bloqueia a confirmação, não só avisa.
const ensureStockAvailable = (sale: Sale): void => {
  const shortages = (sale.items || [])
    .filter(item => item.product?.controlStock)
    .map(item => ({ item, product: item.product, needed: Number(item.quantity) || 0 }))
    .filter(({ product, needed }) => needed > product.stockQuantity);

  if (shortages.length > 0) {
    const details = shortages
      .map(({ product, needed }) => `${product.name} (disponível: ${product.stockQuantity}, pedido: ${needed})`)
      .join("; ");
    throw new AppError(`Estoque insuficiente: ${details}`);
  }
};

// `direction` 1 = desconta (confirmar), -1 = devolve (cancelar) — mesma
// função nos dois sentidos pra não duplicar a lógica de "só mexe quando
// tem produto + controla estoque".
const adjustStock = async (sale: Sale, direction: 1 | -1): Promise<void> => {
  for (const item of sale.items || []) {
    if (!item.product?.controlStock) continue;
    const quantity = Number(item.quantity) || 0;
    if (quantity === 0) continue;
    await FinanceProduct.increment("stockQuantity", {
      by: direction * quantity,
      where: { id: item.product.id }
    });
  }
};

// Confirma a venda: trava a edição dos itens e gera a conta a receber
// correspondente (Fase 2) — é o "gancho" entre o módulo de vendas e o
// financeiro operacional. Emitir a nota fiscal em si é uma ação separada
// (FiscalDocumentService), porque a empresa pode querer confirmar a venda
// sem emitir nota na hora (ex.: emitir só depois do pagamento confirmado).
// Desde a v2.3.114, também valida e desconta estoque dos itens com produto
// vinculado que controla estoque — ver `ensureStockAvailable`/`adjustStock`.
export const confirm = async (id: string | number, companyId: number): Promise<Sale> => {
  const sale = await show(id, companyId);

  if (sale.status !== "draft") {
    throw new AppError("ERR_SALE_ALREADY_CONFIRMED");
  }

  if (!sale.items || sale.items.length === 0) {
    throw new AppError("ERR_SALE_REQUIRES_ITEMS");
  }

  ensureStockAvailable(sale);

  const description = `Venda #${sale.id}${sale.customer ? ` - ${sale.customer.name}` : ""}`;

  const receivable = await FinanceReceivable.create({
    description,
    value: sale.totalValue,
    dueDate: sale.saleDate || null,
    status: "pending",
    customerId: sale.customerId || null,
    companyId
  } as any);

  await adjustStock(sale, 1);
  await sale.update({ status: "confirmed", receivableId: receivable.id });

  return show(id, companyId);
};

// Devolve o estoque descontado na confirmação — só quando a venda
// REALMENTE estava confirmada (nunca mexeu no estoque se ainda era
// rascunho, então nada a devolver nesse caso).
export const cancel = async (id: string | number, companyId: number): Promise<Sale> => {
  const sale = await show(id, companyId);

  if (sale.status === "cancelled") {
    return sale;
  }

  if (sale.status === "confirmed") {
    await adjustStock(sale, -1);
  }

  await sale.update({ status: "cancelled" });
  return show(id, companyId);
};

// Pedido do cliente (v2.3.118): poder excluir de verdade (não só cancelar)
// uma venda confirmada/cancelada feita em Homologação, pra limpar o teste
// antes/depois de passar pra Produção. Só permitido quando a venda NUNCA
// teve um FiscalDocument de Produção (nota real) — caso contrário seria
// apagar uma venda de verdade, e o caminho correto ali é cancelar
// (`cancel`), não excluir. Explicitamente SEM tocar em estoque, mesmo que
// a venda tenha "descontado" ao confirmar — pedido do cliente: a limpeza
// de teste não deve alterar o estoque atual.
export const remove = async (id: string | number, companyId: number): Promise<void> => {
  const sale = await show(id, companyId);

  if (sale.status === "draft") {
    await sale.destroy();
    return;
  }

  const documents = sale.fiscalDocuments || [];
  const hasProductionDocument = documents.some(doc => doc.environment === "production");

  if (hasProductionDocument) {
    throw new AppError("ERR_SALE_NOT_EDITABLE");
  }

  if (documents.length === 0) {
    const config = await FiscalConfig.findOne({ where: { companyId } });
    if (config && isProductionActive(config)) {
      throw new AppError("ERR_SALE_NOT_EDITABLE");
    }
  }

  await FiscalDocument.destroy({ where: { saleId: sale.id, companyId } });
  await SaleItem.destroy({ where: { saleId: sale.id } });
  if (sale.receivableId) {
    await FinanceReceivable.destroy({ where: { id: sale.receivableId, companyId } });
  }
  await sale.destroy();
};
