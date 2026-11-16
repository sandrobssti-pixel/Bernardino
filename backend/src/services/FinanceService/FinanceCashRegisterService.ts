import { Op, Sequelize } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import FinanceCashRegister from "../../models/FinanceCashRegister";
import FinanceCashRegisterItem from "../../models/FinanceCashRegisterItem";
import { sumModelValue } from "../../utils/financeSum";

// "Caixa Registradora" — virou um mini frente de caixa pra vendas sem
// nota fiscal (pedido do cliente, v2.3.292), além do lembrete original
// de valores físicos (dinheiro em espécie, promissórias, cheques). Sem
// vínculo nenhum com o resto do Financeiro — nunca entra no Painel
// Financeiro/fechamento de caixa oficial (pedido explícito do cliente:
// "no campo registradora não afeta os valores do painel financeiro...
// fica independente"). Ver FinanceCashRegister.ts/FinanceCashRegisterItem.ts.

interface ListRequest {
  companyId: number;
  searchParam?: string;
  pageNumber?: string | number;
  type?: string;
  customerLinked?: string;
  startDate?: string;
  endDate?: string;
}

interface ListResponse {
  records: FinanceCashRegister[];
  count: number;
  hasMore: boolean;
  totalValue: number;
}

interface CashRegisterItemData {
  itemType?: string;
  description: string;
  unit?: string;
  quantity?: string;
  unitPrice?: string;
}

interface CashRegisterData {
  type?: string;
  customerId?: number | null;
  name?: string;
  document?: string;
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  notes?: string;
  items?: CashRegisterItemData[];
}

const VALID_TYPES = [
  "physical_cash",
  "promissory_note",
  "check",
  "sale_without_invoice",
  "credit_card_sale",
];

const cashRegisterSchema = Yup.object().shape({
  type: Yup.string()
    .oneOf(VALID_TYPES, "ERR_FINANCE_CASH_REGISTER_INVALID_TYPE")
    .required("ERR_FINANCE_CASH_REGISTER_INVALID_TYPE"),
  items: Yup.array()
    .of(
      Yup.object().shape({
        description: Yup.string().required("ERR_FINANCE_CASH_REGISTER_ITEM_DESCRIPTION_REQUIRED")
      })
    )
    .min(1, "ERR_FINANCE_CASH_REGISTER_ITEM_REQUIRED")
});

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
};

// Recalcula totalPrice de cada item (quantity * unitPrice) e o total do
// lançamento (soma dos itens) — nunca confia no que o frontend mandou
// pronto, sempre reconfere no backend (mesma régua de Sale/SaleItem).
const buildItemRows = (items: CashRegisterItemData[], cashRegisterId: number) =>
  items.map((item) => {
    const quantity = toNumber(item.quantity ?? 1) || 1;
    const unitPrice = toNumber(item.unitPrice ?? 0);
    return {
      itemType: item.itemType || "",
      description: item.description,
      unit: item.unit || "UN",
      quantity: String(quantity),
      unitPrice: String(unitPrice),
      totalPrice: String(quantity * unitPrice),
      cashRegisterId
    };
  });

const sumItemsTotal = (items: CashRegisterItemData[]): number =>
  items.reduce((total, item) => {
    const quantity = toNumber(item.quantity ?? 1) || 1;
    const unitPrice = toNumber(item.unitPrice ?? 0);
    return total + quantity * unitPrice;
  }, 0);

export const list = async ({
  companyId,
  searchParam = "",
  pageNumber = "1",
  type,
  customerLinked,
  startDate,
  endDate
}: ListRequest): Promise<ListResponse> => {
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  // Busca pelo nome/CPF-CNPJ do cliente — campos que já vêm preenchidos
  // automaticamente a partir do cadastro único de clientes do Financeiro
  // ao escolher o cliente no lançamento (snapshot, ver FinanceCustomer/
  // CashRegisterEntryDialog.js). Antes desta correção, a caixa de busca
  // da tela (FinanceRecordList) já mandava `searchParam`, mas o backend
  // simplesmente ignorava — o filtro nunca filtrava nada.
  const whereCondition: any = { companyId };
  if (searchParam) {
    whereCondition[Op.or] = [
      Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("FinanceCashRegister.name")),
        "LIKE",
        `%${searchParam.toLowerCase().trim()}%`
      ),
      { document: { [Op.like]: `%${searchParam.trim()}%` } }
    ];
  }

  // "Forma de pagamento" — mesmo filtro categórico já usado em "Status"
  // de Contas a Pagar/Receber, pedido do cliente pra deixar a tela de
  // Caixa Registradora com o mesmo padrão de filtro das outras.
  if (type) {
    whereCondition.type = type;
  }

  // "Cliente vinculado" — se o lançamento tem ou não um FinanceCustomer
  // ligado (`customerId`), mesma ideia do filtro "Nota Fiscal" de Contas
  // a Receber (ter ou não algo vinculado).
  if (customerLinked === "yes") {
    whereCondition.customerId = { [Op.ne]: null };
  } else if (customerLinked === "no") {
    whereCondition.customerId = null;
  }

  // Filtro de Período — filtra por data/hora do LANÇAMENTO (`createdAt`,
  // única data que existe neste recurso, mostrada na coluna "Registrado
  // em"). `startDate`/`endDate` chegam como "YYYY-MM-DD" (ver
  // utils/periodFilter.js no frontend); como `createdAt` é timestamp
  // completo, usa início/fim do dia pra não cortar registros do próprio
  // dia (mesmo padrão de SaleService.listForReport).
  if (startDate || endDate) {
    whereCondition.createdAt = {};
    if (startDate) whereCondition.createdAt[Op.gte] = new Date(`${startDate}T00:00:00`);
    if (endDate) whereCondition.createdAt[Op.lte] = new Date(`${endDate}T23:59:59`);
  }

  const [{ count, rows: records }, totalValue] = await Promise.all([
    FinanceCashRegister.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
      include: [{ model: FinanceCashRegisterItem, as: "items" }]
    }),
    // "Soma total" — pedido do cliente (v2.3.289): soma de TODOS os
    // registros (dinheiro físico + promissória + cheque + venda sem
    // nota, juntos), não só os 20 da página. Mesmo padrão já usado em
    // Contas a Pagar/Receber — nunca soma nada do resto do Financeiro.
    sumModelValue(FinanceCashRegister, whereCondition)
  ]);

  return { records, count, hasMore: count > offset + records.length, totalValue };
};

export const show = async (
  id: string | number,
  companyId: number
): Promise<FinanceCashRegister> => {
  const record = await FinanceCashRegister.findOne({
    where: { id, companyId },
    include: [{ model: FinanceCashRegisterItem, as: "items" }]
  });

  if (!record) {
    throw new AppError("ERR_FINANCE_CASH_REGISTER_NOT_FOUND", 404);
  }

  return record;
};

export const create = async (
  data: CashRegisterData,
  companyId: number
): Promise<FinanceCashRegister> => {
  try {
    await cashRegisterSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const { items, ...headerData } = data;

  const record = await FinanceCashRegister.create({
    ...headerData,
    customerId: headerData.customerId || null,
    value: String(sumItemsTotal(items as CashRegisterItemData[])),
    companyId
  } as any);

  await FinanceCashRegisterItem.bulkCreate(
    buildItemRows(items as CashRegisterItemData[], record.id) as any
  );

  return show(record.id, companyId);
};

export const update = async (
  id: string | number,
  data: CashRegisterData,
  companyId: number
): Promise<FinanceCashRegister> => {
  const record = await show(id, companyId);

  try {
    await cashRegisterSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const { items, ...headerData } = data;

  await record.update({
    ...headerData,
    customerId: headerData.customerId || null,
    value: String(sumItemsTotal(items as CashRegisterItemData[]))
  });

  // Substitui os itens inteiros (apaga + recria) — mesmo padrão já
  // usado em SaleService pra editar os itens de uma Venda, mais simples
  // que tentar diferenciar o que mudou item a item.
  await FinanceCashRegisterItem.destroy({ where: { cashRegisterId: record.id } });
  await FinanceCashRegisterItem.bulkCreate(
    buildItemRows(items as CashRegisterItemData[], record.id) as any
  );

  return show(id, companyId);
};

export const remove = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const record = await show(id, companyId);
  await record.destroy();
};
