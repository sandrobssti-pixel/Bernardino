import { Op, Sequelize } from "sequelize";
import moment from "moment";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import FinanceReceivable from "../../models/FinanceReceivable";
import FinanceCustomer from "../../models/FinanceCustomer";
import Sale from "../../models/Sale";
import FiscalDocument from "../../models/FiscalDocument";
import { findEntityIdsByNameOrDocument } from "../../utils/findEntityIdsByNameOrDocument";
import { sumModelValue } from "../../utils/financeSum";

// "Venda com nota"/"Venda sem nota fiscal" (pedido do cliente, v2.3.290)
// — "nota fiscal de verdade" é a mesma régua já usada em
// `SaleService.assertSaleEditable` (`hasRealFiscalDocument`), só que
// restrita a `status: "authorized"` (a nota foi de fato emitida/
// autorizada pela Sefaz, não "processing"/"error"/"cancelled") e
// `environment: "production"` (nunca conta nota de teste/Homologação
// como "nota fiscal de verdade" — mesmo critério já usado no Dashboard
// de Lucro, ver FinanceReportService.getProfitDashboard). Devolve os
// ids de FinanceReceivable cuja Venda ligada tem pelo menos uma nota
// assim.
const findReceivableIdsWithInvoice = async (companyId: number): Promise<number[]> => {
  const sales = await Sale.findAll({
    where: { companyId, receivableId: { [Op.ne]: null } },
    attributes: ["receivableId"],
    include: [
      {
        model: FiscalDocument,
        as: "fiscalDocuments",
        attributes: [],
        where: { status: "authorized", environment: "production" },
        required: true
      }
    ],
    raw: true
  });
  // Dedup — uma Venda com mais de uma nota autorizada (reemissão) geraria
  // o mesmo receivableId repetido; inofensivo num Op.in, mas sem sentido
  // manter duplicado.
  return [...new Set(sales.map((row: any) => row.receivableId))];
};

interface ListRequest {
  companyId: number;
  searchParam?: string;
  pageNumber?: string | number;
  status?: string;
  startDate?: string;
  endDate?: string;
  // "yes" = só Vendas com nota fiscal (autorizada, em Produção) | "no" =
  // só Vendas sem nota fiscal (inclui contas a receber criadas direto,
  // sem Venda nenhuma por trás — essas também não têm nota).
  hasInvoice?: string;
}

interface ListResponse {
  records: FinanceReceivable[];
  count: number;
  hasMore: boolean;
  totalValue: number;
}

interface ReceivableData {
  description: string;
  value?: string;
  dueDate?: string | null;
  receivedDate?: string | null;
  status?: string;
  notes?: string;
  active?: boolean;
  customerId?: number | null;
  paymentMethod?: string;
}

const receivableSchema = Yup.object().shape({
  description: Yup.string().required("ERR_FINANCE_RECEIVABLE_INVALID_DESCRIPTION").min(2)
});

const normalizeData = (data: ReceivableData): ReceivableData => ({
  ...data,
  customerId: data.customerId || null,
  dueDate: data.dueDate || null,
  receivedDate: data.receivedDate || null
});

export const list = async ({
  companyId,
  searchParam = "",
  pageNumber = "1",
  status,
  startDate,
  endDate,
  hasInvoice
}: ListRequest): Promise<ListResponse> => {
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const whereCondition: any = { companyId };

  if (hasInvoice === "yes" || hasInvoice === "no") {
    const invoicedIds = await findReceivableIdsWithInvoice(companyId);
    if (hasInvoice === "yes") {
      // Lista vazia (nenhuma Venda com nota ainda) — `Op.in: []` sozinho
      // já não bate com nada, mas o sentinela deixa explícito (nunca
      // depende de como o Sequelize monta `IN ()` vazio).
      whereCondition.id = { [Op.in]: invoicedIds.length ? invoicedIds : [-1] };
    } else {
      // `Op.notIn` com array VAZIO é uma pegadinha real de SQL: o
      // Postgres gera "id NOT IN (NULL)", que avalia pra UNKNOWN em
      // TODA linha (nunca TRUE) — excluiria tudo, não "nada tem nota
      // então tudo entra", que é o comportamento certo aqui.
      whereCondition.id = invoicedIds.length ? { [Op.notIn]: invoicedIds } : { [Op.ne]: null };
    }
  }

  if (searchParam) {
    // v2.3.262 — pedido do cliente: buscar também pelo nome/CPF-CNPJ do
    // cliente ligado à conta, não só pela descrição.
    const customerIds = await findEntityIdsByNameOrDocument(FinanceCustomer, companyId, searchParam);
    whereCondition[Op.or] = [
      Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("FinanceReceivable.description")),
        "LIKE",
        `%${searchParam.toLowerCase().trim()}%`
      ),
      ...(customerIds.length ? [{ customerId: { [Op.in]: customerIds } }] : [])
    ];
  }

  // "Vencido" não é um status gravado de verdade — é derivado (pending +
  // vencimento no passado, mesma definição usada no chip da tabela,
  // `isOverdue` em financeConfig.js). Pedido do cliente (v2.3.314):
  // "coloque vencido na lista em contas a receber" — filtro novo no
  // dropdown de Status, ao lado de Pendente/Recebido/Cancelado.
  if (status === "overdue") {
    whereCondition.status = "pending";
    whereCondition.dueDate = {
      ...(whereCondition.dueDate || {}),
      [Op.lt]: moment().format("YYYY-MM-DD")
    };
  } else if (status) {
    whereCondition.status = status;
  }

  // Filtro de Período (Hoje/Semana/Mês/Personalizado) — filtra pelo
  // VENCIMENTO (`dueDate`). Histórico (v2.3.258→v2.3.259→v2.3.265): já
  // filtrou por Vencimento, depois por Lançamento (`createdAt` — cliente
  // relatou que lançar 14 contas num dia só mostrava 3 em "Hoje", porque
  // a maioria vencia no futuro), e agora voltou pra Vencimento de novo —
  // cliente reportou o problema inverso: contas com vencimento essa
  // semana (ex.: importadas/cadastradas em outra data) não apareciam no
  // filtro "Esta semana" por terem sido LANÇADAS antes. Confirmado
  // explicitamente com o cliente qual dos dois quer: Vencimento. Ver
  // docs/MANUAL_TECNICO.md, seção 237, pra não repetir esse ciclo nos
  // dois sentidos sem registrar.
  if (startDate) {
    whereCondition.dueDate = {
      ...(whereCondition.dueDate || {}),
      [Op.gte]: startDate
    };
  }
  if (endDate) {
    whereCondition.dueDate = {
      ...(whereCondition.dueDate || {}),
      [Op.lte]: endDate
    };
  }

  const [{ count, rows: records }, totalValue] = await Promise.all([
    FinanceReceivable.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [["dueDate", "ASC"]],
      include: [{ model: FinanceCustomer, as: "customer", attributes: ["id", "name"] }]
    }),
    // "Saldo total" — pedido do cliente (v2.3.284): soma de TODOS os
    // registros que batem o filtro atual (busca/status/período), não só
    // os 20 da página — pra bater com o que o cliente soma manualmente
    // quando filtra, por exemplo, "Pendente".
    sumModelValue(FinanceReceivable, whereCondition)
  ]);

  return { records, count, hasMore: count > offset + records.length, totalValue };
};

export const show = async (
  id: string | number,
  companyId: number
): Promise<FinanceReceivable> => {
  const record = await FinanceReceivable.findOne({
    where: { id, companyId },
    include: [{ model: FinanceCustomer, as: "customer", attributes: ["id", "name"] }]
  });

  if (!record) {
    throw new AppError("ERR_FINANCE_RECEIVABLE_NOT_FOUND", 404);
  }

  return record;
};

export const create = async (
  data: ReceivableData,
  companyId: number
): Promise<FinanceReceivable> => {
  try {
    await receivableSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const record = await FinanceReceivable.create({
    ...normalizeData(data),
    companyId
  } as any);
  return show(record.id, companyId);
};

export const update = async (
  id: string | number,
  data: ReceivableData,
  companyId: number
): Promise<FinanceReceivable> => {
  const record = await show(id, companyId);

  try {
    await receivableSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await record.update(normalizeData(data));
  return show(id, companyId);
};

export const remove = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const record = await show(id, companyId);
  await record.destroy();
};
