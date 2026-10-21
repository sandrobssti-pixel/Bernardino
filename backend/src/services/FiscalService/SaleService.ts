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
  // Filtro de período por `saleDate` (DATEONLY, "YYYY-MM-DD") — qualquer um
  // dos dois sozinho já filtra (ex.: só `startDate` = "a partir de"). Usado
  // pelo filtro "Hoje/Semana/Mês/Personalizado" da tela de Vendas.
  startDate?: string;
  endDate?: string;
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
  sigmaSinarm?: string;
  ammoLot?: string;
  packageId?: string;
}

interface SaleData {
  saleDate?: string | null;
  notes?: string;
  customerId?: number | null;
  items: SaleItemData[];
  // Campos fiscais pedidos pelo contador do cliente (v2.3.166) — ver
  // comentário completo em Sale.ts e a tabela de códigos em
  // FocusNFeService.ts.
  operationType?: string;
  operationNature?: string;
  consumerPresence?: string;
  intermediaryType?: string;
  finalConsumerType?: string;
  recipientType?: string;
  ieIndicator?: string;
  paymentMethod?: string;
  // "Finalidade da Emissão" + "Dados de Transporte" (v2.3.168) — ver
  // comentário completo em Sale.ts.
  issuancePurpose?: string;
  volumeQuantity?: number | string;
  volumeSpecies?: string;
  volumeBrand?: string;
  volumeNumber?: string;
  volumeGrossWeight?: string;
  volumeNetWeight?: string;
  carrierName?: string;
  carrierAddress?: string;
  carrierCity?: string;
  carrierState?: string;
  carrierCnpj?: string;
  carrierIe?: string;
  deliveryName?: string;
  deliveryAddress?: string;
  deliveryNumber?: string;
  deliveryComplement?: string;
  deliveryNeighborhood?: string;
  deliveryCity?: string;
  deliveryState?: string;
  deliveryZipCode?: string;
  deliveryPhone?: string;
  freightResponsibility?: string;
  boardingLocation?: string;
  boardingState?: string;
  vehiclePlate?: string;
  vehicleState?: string;
  // "Endereço completo" do destinatário (v2.3.171) — ver comentário
  // completo em Sale.ts.
  recipientZipCode?: string;
  recipientStreet?: string;
  recipientNumber?: string;
  recipientComplement?: string;
  recipientNeighborhood?: string;
  recipientCity?: string;
  recipientState?: string;
}

// Mesmo padrão de `fields`/defaultValue usado no resto do Financeiro —
// centraliza os defaults pra não duplicar entre `create`/`update`.
const FISCAL_FIELD_DEFAULTS: Record<string, string> = {
  operationType: "internal",
  operationNature: "Venda",
  consumerPresence: "1",
  intermediaryType: "none",
  finalConsumerType: "final",
  recipientType: "customer",
  ieIndicator: "non_contributor",
  paymentMethod: ""
};

const buildFiscalFields = (data: SaleData): Record<string, string> => {
  const fields: Record<string, string> = {};
  Object.keys(FISCAL_FIELD_DEFAULTS).forEach(key => {
    const value = (data as any)[key];
    fields[key] = value !== undefined && value !== null ? String(value) : FISCAL_FIELD_DEFAULTS[key];
  });
  return fields;
};

// "Finalidade da Emissão" + "Dados de Transporte" (v2.3.168) — mesmo
// padrão de `buildFiscalFields` acima (defaults centralizados, não
// duplicados entre create/update), separado só porque `volumeQuantity` é
// numérico (coluna INTEGER), não string como o resto.
const TRANSPORT_STRING_DEFAULTS: Record<string, string> = {
  issuancePurpose: "normal",
  volumeSpecies: "",
  volumeBrand: "",
  volumeNumber: "",
  volumeGrossWeight: "0",
  volumeNetWeight: "0",
  carrierName: "",
  carrierAddress: "",
  carrierCity: "",
  carrierState: "",
  carrierCnpj: "",
  carrierIe: "",
  deliveryName: "",
  deliveryAddress: "",
  deliveryNumber: "",
  deliveryComplement: "",
  deliveryNeighborhood: "",
  deliveryCity: "",
  deliveryState: "",
  deliveryZipCode: "",
  deliveryPhone: "",
  freightResponsibility: "9",
  boardingLocation: "",
  boardingState: "",
  vehiclePlate: "",
  vehicleState: ""
};

const buildTransportFields = (data: SaleData): Record<string, unknown> => {
  const fields: Record<string, unknown> = {
    volumeQuantity: Number(data.volumeQuantity) || 0
  };
  Object.keys(TRANSPORT_STRING_DEFAULTS).forEach(key => {
    const value = (data as any)[key];
    fields[key] = value !== undefined && value !== null ? String(value) : TRANSPORT_STRING_DEFAULTS[key];
  });
  return fields;
};

// "Endereço completo" do destinatário (v2.3.171) — snapshot do endereço
// do Cliente no momento da venda, mesmo padrão de `buildFiscalFields`
// acima. Ver comentário completo em Sale.ts.
const RECIPIENT_ADDRESS_FIELDS = [
  "recipientZipCode",
  "recipientStreet",
  "recipientNumber",
  "recipientComplement",
  "recipientNeighborhood",
  "recipientCity",
  "recipientState"
];

const buildRecipientAddressFields = (data: SaleData): Record<string, string> => {
  const fields: Record<string, string> = {};
  RECIPIENT_ADDRESS_FIELDS.forEach(key => {
    const value = (data as any)[key];
    fields[key] = value !== undefined && value !== null ? String(value) : "";
  });
  return fields;
};

const includeOptions = [
  {
    model: FinanceCustomer,
    as: "customer",
    // A lista de attributes limitava os campos do cliente que vêm junto da
    // venda — faltavam TODOS os campos de endereço + telefone, usados pelo
    // payload da nota fiscal (buildDestinatario, FocusNFeService.ts). Não
    // importava o quão completo o cadastro do cliente estivesse: o
    // Sequelize nem buscava essas colunas, então a nota sempre ia sem
    // endereço do destinatário (v2.3.125).
    attributes: [
      "id",
      "name",
      "document",
      "documentType",
      "email",
      "phone",
      "zipCode",
      "street",
      "number",
      "complement",
      "neighborhood",
      "city",
      "state"
    ]
  },
  {
    model: SaleItem,
    as: "items",
    include: [
      {
        model: FinanceProduct,
        as: "product",
        // Campos fiscais da aba "Dados Fiscais" do Produto (v2.3.167) —
        // precisam vir junto pra `FocusNFeService.buildItemsPayload`
        // conseguir montar o ICMS/CSOSN/CFOP de verdade por item, em vez
        // de hardcoded.
        attributes: [
          "id",
          "name",
          "sku",
          "controlStock",
          "stockQuantity",
          "icmsExempt",
          "icmsSubstitution",
          "icmsOrigin",
          "csosnContribuinte",
          "csosnNaoContribuinte",
          "icmsBcModality",
          "icmsStBcModality",
          "icmsRate",
          "icmsStRate",
          "icmsStMva"
        ]
      }
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
  status,
  startDate,
  endDate
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

  if (startDate || endDate) {
    whereCondition.saleDate = {};
    if (startDate) whereCondition.saleDate[Op.gte] = startDate;
    if (endDate) whereCondition.saleDate[Op.lte] = endDate;
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
      taxRate: product?.taxRate ?? "0",
      sigmaSinarm: item.sigmaSinarm || "",
      ammoLot: item.ammoLot || "",
      packageId: item.packageId || ""
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
    ...buildFiscalFields(data),
    ...buildTransportFields(data),
    ...buildRecipientAddressFields(data),
    companyId
  } as any);

  await SaleItem.bulkCreate(await buildItemRows(data.items, sale.id, companyId, data.customerId) as any);

  return show(sale.id, companyId);
};

// v2.3.188 — pedido do cliente: depois de ver o "olhinho"
// (pré-visualização) e achar um erro, dar pra corrigir a venda SEM
// precisar cancelar e refazer tudo, mesmo já tendo clicado em "Confirmar
// venda". Antes disso, editar só era possível em "draft" — confirmar
// travava os itens pra sempre. Continua bloqueado quando:
// - a venda já tem nota fiscal autorizada ou em processamento (aí já é
//   um documento fiscal de verdade — corrigir precisa ser carta de
//   correção/cancelamento, não editar a venda por baixo);
// - a conta a receber gerada na confirmação já tem cobrança criada ou
//   paga num gateway (Asaas/Mercado Pago) — editar o valor da venda
//   desencontraria do que já foi cobrado do cliente. Nesse caso, cancelar
//   a venda (devolve estoque) e criar outra.
const assertSaleEditable = async (sale: Sale): Promise<void> => {
  if (sale.status === "cancelled") {
    throw new AppError("ERR_SALE_NOT_EDITABLE");
  }

  if (sale.status !== "confirmed") return;

  const hasRealFiscalDocument = (sale.fiscalDocuments || []).some(doc =>
    ["authorized", "processing"].includes(doc.status)
  );
  if (hasRealFiscalDocument) {
    throw new AppError("ERR_SALE_HAS_FISCAL_DOCUMENT");
  }

  if (sale.receivableId) {
    const receivable = await FinanceReceivable.findByPk(sale.receivableId);
    if (receivable && (receivable.status === "received" || receivable.paymentExternalId)) {
      throw new AppError("ERR_SALE_RECEIVABLE_HAS_PAYMENT");
    }
  }
};

export const update = async (
  id: string | number,
  data: SaleData,
  companyId: number
): Promise<Sale> => {
  const sale = await show(id, companyId);

  await assertSaleEditable(sale);

  try {
    await saleSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const total = calculateTotal(data.items);
  const wasConfirmed = sale.status === "confirmed";

  // Devolve o estoque da composição ANTIGA antes de trocar os itens —
  // só quando a venda já estava confirmada (em "draft" o estoque nunca
  // foi mexido, ver `confirm` abaixo).
  if (wasConfirmed) {
    await adjustStock(sale, -1);
  }

  await sale.update({
    saleDate: data.saleDate || null,
    notes: data.notes || "",
    customerId: data.customerId || null,
    totalValue: String(total),
    ...buildFiscalFields(data),
    ...buildTransportFields(data),
    ...buildRecipientAddressFields(data)
  });

  // Substitui os itens inteiros (mais simples e seguro que tentar
  // diff/merge item a item) — a venda não tem nota fiscal de verdade
  // nem cobrança ativa nesse ponto (`assertSaleEditable` já garantiu),
  // então não há histórico fiscal/financeiro real sendo descartado.
  await SaleItem.destroy({ where: { saleId: sale.id } });
  await SaleItem.bulkCreate(await buildItemRows(data.items, sale.id, companyId, data.customerId) as any);

  const updated = await show(id, companyId);

  if (wasConfirmed) {
    // Checa disponibilidade e desconta a composição NOVA só depois de já
    // ter devolvido a antiga — mesma ordem usada em `confirm` (valida
    // antes de mexer de verdade), mas aqui o "devolver antes" já é uma
    // mutação; se faltar estoque pra nova composição, a venda fica
    // consistente (itens novos gravados, estoque da antiga já devolvido,
    // só falta descontar a nova) — repetir a edição com quantidade
    // menor resolve, sem duplicar desconto.
    ensureStockAvailable(updated);
    await adjustStock(updated, 1);

    if (updated.receivableId) {
      await FinanceReceivable.update(
        { value: String(total) },
        { where: { id: updated.receivableId } }
      );
    }
  }

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
// `force` (v2.3.143): bypassa as duas checagens de "nota de Produção"
// abaixo — só é honrado quando quem pediu é Admin/Master (checado no
// CONTROLLER, antes de chegar aqui, não neste service). Pedido explícito do
// cliente pra conseguir limpar vendas reais já emitidas (ex.: notas 492/493,
// lançadas direto no painel da Focus antes do fluxo normal do AtendeFlow)
// numa limpeza de módulo — o documento fiscal de verdade (XML já autorizado
// pela Sefaz) mora na Focus, não aqui; apagar o registro local não desfaz
// nem afeta a nota em si, só faz o AtendeFlow "esquecer" dela. Sem `force`,
// o comportamento de sempre continua intacto (nunca deixa apagar).
export const remove = async (
  id: string | number,
  companyId: number,
  force = false
): Promise<void> => {
  const sale = await show(id, companyId);

  if (sale.status === "draft") {
    await sale.destroy();
    return;
  }

  const documents = sale.fiscalDocuments || [];
  const hasProductionDocument = documents.some(doc => doc.environment === "production");

  if (hasProductionDocument && !force) {
    throw new AppError("ERR_SALE_NOT_EDITABLE");
  }

  if (documents.length === 0 && !force) {
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
