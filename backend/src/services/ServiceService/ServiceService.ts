import { Op, Sequelize } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Service from "../../models/Service";

interface ListRequest {
  companyId: number;
  searchParam?: string;
  pageNumber?: string | number;
}

interface ListResponse {
  records: Service[];
  count: number;
  hasMore: boolean;
}

interface ServiceData {
  code?: string;
  name: string;
  value?: string;
  paymentTerms?: string;
  description?: string;
  active?: boolean;
}

const serviceSchema = Yup.object().shape({
  name: Yup.string().required("ERR_SERVICE_INVALID_NAME").min(2)
});

// Cadastro de Serviço (v2.3.175) — CRUD simples, mesmo padrão de
// FinanceCustomer/FinanceSupplier, só que bem mais enxuto (sem nada
// fiscal/tributário). Ver Service.ts e docs/MANUAL_TECNICO.md.
export const list = async ({
  companyId,
  searchParam = "",
  pageNumber = "1"
}: ListRequest): Promise<ListResponse> => {
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const whereCondition: any = { companyId };

  if (searchParam) {
    whereCondition[Op.or] = [
      Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("Service.name")),
        "LIKE",
        `%${searchParam.toLowerCase().trim()}%`
      ),
      { code: { [Op.like]: `%${searchParam.trim()}%` } }
    ];
  }

  const { count, rows: records } = await Service.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    // Ordenado por código (pedido do cliente: "deixa o código por ordem
    // numérica") — os códigos reais são zero-padded ("001".."037"), então
    // ordenação alfabética de texto já bate com ordem numérica; nome como
    // critério de desempate quando o código estiver vazio/repetido.
    order: [["code", "ASC"], ["name", "ASC"]]
  });

  return { records, count, hasMore: count > offset + records.length };
};

export const show = async (id: string | number, companyId: number): Promise<Service> => {
  const record = await Service.findOne({ where: { id, companyId } });

  if (!record) {
    throw new AppError("ERR_SERVICE_NOT_FOUND", 404);
  }

  return record;
};

export const create = async (data: ServiceData, companyId: number): Promise<Service> => {
  try {
    await serviceSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  return Service.create({ ...data, companyId } as any);
};

export const update = async (
  id: string | number,
  data: ServiceData,
  companyId: number
): Promise<Service> => {
  const record = await show(id, companyId);

  try {
    await serviceSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await record.update(data);
  return record;
};

export const remove = async (id: string | number, companyId: number): Promise<void> => {
  const record = await show(id, companyId);
  await record.destroy();
};
