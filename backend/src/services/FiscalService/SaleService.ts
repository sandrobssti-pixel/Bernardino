import { Op } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Sale from "../../models/Sale";
import SaleItem from "../../models/SaleItem";
import FinanceCustomer from "../../models/FinanceCustomer";
import FinanceProduct from "../../models/FinanceProduct";
import FinanceReceivable from "../../models/FinanceReceivable";
import FinanceWeaponUnit from "../../models/FinanceWeaponUnit";
import FiscalConfig from "../../models/FiscalConfig";
import FiscalDocument from "../../models/FiscalDocument";
import * as Iva2027Service from "./Iva2027Service";
import * as FinanceWeaponUnitService from "../FinanceService/FinanceWeaponUnitService";
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
  // Unidade física de arma (nº de série) escolhida pra esse item —
  // Etapa 2, ver docs/MANUAL_TECNICO.md seção 186.
  weaponUnitId?: number | null;
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
  paymentCashValue?: string;
  paymentPixValue?: string;
  paymentCardValue?: string;
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
  paymentMethod: "",
  paymentCashValue: "0",
  paymentPixValue: "0",
  paymentCardValue: "0"
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
        // de hardcoded. Campos técnicos de arma (brand/model/...,
        // v2.3.212) — precisam vir junto pra
        // `FocusNFeService.buildItemAdditionalInfo` montar a descrição
        // técnica completa em "Informações Complementares", igual a
        // nota real de arma traz.
        attributes: [
          "id",
          "name",
          "sku",
          "type",
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
          "icmsStMva",
          "brand",
          "model",
          "weaponType",
          "caliber",
          "cartridgeCapacity",
          "operatingMode",
          "barrelCount",
          "barrelLength",
          "boreType",
          "origin"
        ]
      },
      {
        model: FinanceWeaponUnit,
        as: "weaponUnit",
        attributes: ["id", "serialNumber"]
      }
    ]
  },
  { model: FinanceReceivable, as: "receivable", attributes: ["id", "status", "dueDate"] },
  {
    model: FiscalDocument,
    as: "fiscalDocuments",
    // "number" incluído (v2.3.217, pedido do cliente: mostrar o número da
    // nota fiscal na lista de Vendas) — antes só vinha nos outros 4
    // campos, já usados pra decidir status/ícones de ação da linha; agora
    // a própria lista (SaleList.js) também lê pra mostrar o número sem
    // precisar de uma chamada extra por venda.
    attributes: ["id", "type", "status", "environment", "number"]
  }
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
      packageId: item.packageId || "",
      weaponUnitId: item.weaponUnitId || null
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
    await releaseWeaponUnits(sale, companyId);
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
    await ensureWeaponUnitsAvailable(updated, companyId);
    await adjustStock(updated, 1);
    await reserveWeaponUnits(updated, companyId);

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
// Item de arma com `weaponUnitId` fica de fora dessa conta por
// quantidade — a disponibilidade dele é por unidade (`serialNumber`),
// checada em `ensureWeaponUnitsAvailable` (v2.3.207/Etapa 2).
const ensureStockAvailable = (sale: Sale): void => {
  const shortages = (sale.items || [])
    .filter(item => !item.weaponUnitId && item.product?.controlStock)
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
// tem produto + controla estoque". Item com `weaponUnitId` nunca entra
// aqui — o `stockQuantity` do produto-arma já é recalculado à parte por
// `FinanceWeaponUnitService.recalculateStockQuantity` (contagem de
// unidades "em estoque"); somar/subtrair aqui também duplicaria a conta.
const adjustStock = async (sale: Sale, direction: 1 | -1): Promise<void> => {
  for (const item of sale.items || []) {
    if (item.weaponUnitId) continue;
    if (!item.product?.controlStock) continue;
    const quantity = Number(item.quantity) || 0;
    if (quantity === 0) continue;
    await FinanceProduct.increment("stockQuantity", {
      by: direction * quantity,
      where: { id: item.product.id }
    });
  }
};

// --------------------------------------------------------------------
// Etapa 2 — integração de arma (por número de série) com a Venda,
// autorizada pelo Sandro em chat direto. Pedido explícito: a unidade só
// sai de "disponível" quando a VENDA é confirmada (fica "reservada" —
// ninguém mais pode escolhê-la enquanto isso), e só vira "vendida" de
// verdade (baixa definitiva) quando a NOTA FISCAL daquela venda for
// REALMENTE autorizada pelo gateway — não antes. Ver
// `markWeaponUnitsSold` (chamado por FiscalDocumentService.emit/
// refreshStatus) e docs/MANUAL_TECNICO.md, seção 186.
// --------------------------------------------------------------------

const ensureWeaponUnitsAvailable = async (sale: Sale, companyId: number): Promise<void> => {
  const weaponItems = (sale.items || []).filter(item => item.weaponUnitId);
  if (weaponItems.length === 0) return;

  const units = await FinanceWeaponUnit.findAll({
    where: { id: weaponItems.map(item => item.weaponUnitId), companyId }
  });
  const unitById = new Map(units.map(unit => [unit.id, unit]));

  const unavailable = weaponItems.filter(item => unitById.get(item.weaponUnitId as number)?.status !== "in_stock");
  if (unavailable.length > 0) {
    const details = unavailable
      .map(item => unitById.get(item.weaponUnitId as number)?.serialNumber || item.description)
      .join(", ");
    throw new AppError(`Arma(s) não disponível(is) pra venda (já reservada/vendida/baixada): ${details}`);
  }
};

const reserveWeaponUnits = async (sale: Sale, companyId: number): Promise<void> => {
  for (const item of sale.items || []) {
    if (!item.weaponUnitId) continue;
    await FinanceWeaponUnitService.reserveForSale(item.weaponUnitId, item.id, companyId);
  }
};

const releaseWeaponUnits = async (sale: Sale, companyId: number): Promise<void> => {
  for (const item of sale.items || []) {
    if (!item.weaponUnitId) continue;
    await FinanceWeaponUnitService.releaseForSaleItem(item.id, companyId);
  }
};

// Chamado por FiscalDocumentService.emit/refreshStatus quando a nota
// fiscal da venda é autorizada de verdade pelo gateway — só nesse
// momento a(s) unidade(s) de arma da venda realmente "saem" do estoque
// (ver comentário da seção acima).
export const markWeaponUnitsSold = async (saleId: string | number, companyId: number): Promise<void> => {
  const sale = await show(saleId, companyId);
  for (const item of sale.items || []) {
    if (!item.weaponUnitId) continue;
    await FinanceWeaponUnitService.markSoldForSaleItem(item.id, companyId);
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
  await ensureWeaponUnitsAvailable(sale, companyId);

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
  await reserveWeaponUnits(sale, companyId);
  await sale.update({ status: "confirmed", receivableId: receivable.id });

  return show(id, companyId);
};

// Devolve o estoque descontado na confirmação — só quando a venda
// REALMENTE estava confirmada (nunca mexeu no estoque se ainda era
// rascunho, então nada a devolver nesse caso).
//
// v2.3.189 — pedido do cliente: cancelar a venda (seja direto por aqui,
// seja via `FiscalDocumentService.cancel` ao cancelar a nota fiscal
// autorizada) também cancela a conta a receber vinculada, não só
// devolve estoque. Reembolso de verdade (chamar a API do gateway) ainda
// NÃO está implementado — fica só uma anotação clara em `notes` pra
// quem for conferir manualmente. O cliente confirmou que, quando tiver
// a documentação oficial do Asaas, o reembolso via Pix vai ser
// automatizado (ver aviso de confiança no topo de FocusNFeService.ts
// pro mesmo padrão já usado com a Focus NFe — nunca implementar endpoint
// que move dinheiro sem doc oficial ou risco aceito explicitamente).
export const cancel = async (id: string | number, companyId: number): Promise<Sale> => {
  const sale = await show(id, companyId);

  if (sale.status === "cancelled") {
    return sale;
  }

  if (sale.status === "confirmed") {
    await adjustStock(sale, -1);
    await releaseWeaponUnits(sale, companyId);
  }

  if (sale.receivableId) {
    const receivable = await FinanceReceivable.findByPk(sale.receivableId);
    if (receivable && receivable.status !== "cancelled") {
      const wasReceived = receivable.status === "received";
      const refundNote = !wasReceived
        ? "[Venda cancelada] Cobrança cancelada antes de ser paga."
        : sale.paymentMethod === "pix"
        ? "[Venda cancelada] Já estava pago via Pix — reembolso automático ainda não implementado neste sistema; reembolsar manualmente pelo painel do Asaas/Mercado Pago."
        : "[Venda cancelada] Já estava pago — reembolso precisa ser solicitado manualmente (cartão: pedir estorno à operadora; outros meios: fora do sistema).";
      await receivable.update({
        status: "cancelled",
        notes: [receivable.notes, refundNote].filter(Boolean).join("\n\n")
      });
    }
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
