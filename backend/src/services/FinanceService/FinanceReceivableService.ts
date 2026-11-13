import { Op, Sequelize } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import FinanceReceivable from "../../models/FinanceReceivable";
import FinanceCustomer from "../../models/FinanceCustomer";
import { findEntityIdsByNameOrDocument } from "../../utils/findEntityIdsByNameOrDocument";
import { sumModelValue } from "../../utils/financeSum";

interface ListRequest {
  companyId: number;
  searchParam?: string;
  pageNumber?: string | number;
  status?: string;
  startDate?: string;
  endDate?: string;
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
  endDate
}: ListRequest): Promise<ListResponse> => {
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const whereCondition: any = { companyId };

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

  if (status) {
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
