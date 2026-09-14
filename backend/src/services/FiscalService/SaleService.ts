import { Op } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Sale from "../../models/Sale";
import SaleItem from "../../models/SaleItem";
import FinanceCustomer from "../../models/FinanceCustomer";
import FinanceProduct from "../../models/FinanceProduct";
import FinanceReceivable from "../../models/FinanceReceivable";

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
    include: [{ model: FinanceProduct, as: "product", attributes: ["id", "name"] }]
  },
  { model: FinanceReceivable, as: "receivable", attributes: ["id", "status", "dueDate"] }
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

const buildItemRows = (items: SaleItemData[], saleId: number) =>
  items.map(item => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    return {
      saleId,
      productId: item.productId || null,
      description: item.description,
      ncm: item.ncm || "",
      cfop: item.cfop || "5102",
      unit: item.unit || "UN",
      quantity: String(quantity),
      unitPrice: String(unitPrice),
      totalPrice: String(quantity * unitPrice)
    };
  });

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

  await SaleItem.bulkCreate(buildItemRows(data.items, sale.id) as any);

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
  await SaleItem.bulkCreate(buildItemRows(data.items, sale.id) as any);

  return show(id, companyId);
};

// Confirma a venda: trava a edição dos itens e gera a conta a receber
// correspondente (Fase 2) — é o "gancho" entre o módulo de vendas e o
// financeiro operacional. Emitir a nota fiscal em si é uma ação separada
// (FiscalDocumentService), porque a empresa pode querer confirmar a venda
// sem emitir nota na hora (ex.: emitir só depois do pagamento confirmado).
export const confirm = async (id: string | number, companyId: number): Promise<Sale> => {
  const sale = await show(id, companyId);

  if (sale.status !== "draft") {
    throw new AppError("ERR_SALE_ALREADY_CONFIRMED");
  }

  if (!sale.items || sale.items.length === 0) {
    throw new AppError("ERR_SALE_REQUIRES_ITEMS");
  }

  const description = `Venda #${sale.id}${sale.customer ? ` - ${sale.customer.name}` : ""}`;

  const receivable = await FinanceReceivable.create({
    description,
    value: sale.totalValue,
    dueDate: sale.saleDate || null,
    status: "pending",
    customerId: sale.customerId || null,
    companyId
  } as any);

  await sale.update({ status: "confirmed", receivableId: receivable.id });

  return show(id, companyId);
};

export const cancel = async (id: string | number, companyId: number): Promise<Sale> => {
  const sale = await show(id, companyId);

  if (sale.status === "cancelled") {
    return sale;
  }

  await sale.update({ status: "cancelled" });
  return show(id, companyId);
};

export const remove = async (id: string | number, companyId: number): Promise<void> => {
  const sale = await show(id, companyId);

  if (sale.status !== "draft") {
    throw new AppError("ERR_SALE_NOT_EDITABLE");
  }

  await sale.destroy();
};
