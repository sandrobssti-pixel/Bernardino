import * as Yup from "yup";
import AppError from "../../errors/AppError";
import FinanceCashRegister from "../../models/FinanceCashRegister";
import { sumModelValue } from "../../utils/financeSum";

// "Caixa Registradora" — lembrete de valores físicos dentro da empresa
// (dinheiro em espécie, promissórias, cheques, venda sem nota fiscal),
// sem vínculo nenhum com o resto do Financeiro. Ver FinanceCashRegister.ts.

interface ListRequest {
  companyId: number;
  pageNumber?: string | number;
}

interface ListResponse {
  records: FinanceCashRegister[];
  count: number;
  hasMore: boolean;
  totalValue: number;
}

interface CashRegisterData {
  type?: string;
  value?: string;
  notes?: string;
}

const VALID_TYPES = ["physical_cash", "promissory_note", "check", "sale_without_invoice"];

const cashRegisterSchema = Yup.object().shape({
  type: Yup.string()
    .oneOf(VALID_TYPES, "ERR_FINANCE_CASH_REGISTER_INVALID_TYPE")
    .required("ERR_FINANCE_CASH_REGISTER_INVALID_TYPE")
});

export const list = async ({
  companyId,
  pageNumber = "1"
}: ListRequest): Promise<ListResponse> => {
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const whereCondition = { companyId };

  const [{ count, rows: records }, totalValue] = await Promise.all([
    FinanceCashRegister.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [["createdAt", "DESC"]]
    }),
    // "Soma total" — pedido do cliente (v2.3.289): soma de TODOS os
    // registros (dinheiro físico + promissória + cheque juntos), não só
    // os 20 da página. Mesmo padrão já usado em Contas a Pagar/Receber.
    sumModelValue(FinanceCashRegister, whereCondition)
  ]);

  return { records, count, hasMore: count > offset + records.length, totalValue };
};

export const show = async (
  id: string | number,
  companyId: number
): Promise<FinanceCashRegister> => {
  const record = await FinanceCashRegister.findOne({ where: { id, companyId } });

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

  const record = await FinanceCashRegister.create({
    ...data,
    companyId
  } as any);
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

  await record.update(data);
  return show(id, companyId);
};

export const remove = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const record = await show(id, companyId);
  await record.destroy();
};
