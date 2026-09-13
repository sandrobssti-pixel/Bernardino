import { Op, WhereOptions } from "sequelize";
import moment from "moment";
import Invoices from "../../models/Invoices";

interface Request {
  startDate?: string;
  endDate?: string;
  companyId?: number;
}

interface Response {
  totalBilled: number;
  totalReceived: number;
  totalOpen: number;
  totalOverdue: number;
}

const FinancialSummaryService = async ({
  startDate,
  endDate,
  companyId
}: Request): Promise<Response> => {
  const baseWhere: WhereOptions = {};

  if (companyId) {
    (baseWhere as any).companyId = companyId;
  }

  // dueDate é armazenada como STRING no formato "YYYY-MM-DD..." — comparar
  // sempre como texto (nunca converter para Date antes de ir para o SQL).
  if (startDate || endDate) {
    const dueDateFilter: any = {};
    if (startDate) dueDateFilter[Op.gte] = startDate;
    if (endDate) dueDateFilter[Op.lte] = `${endDate}T23:59:59`;
    (baseWhere as any).dueDate = dueDateFilter;
  }

  const todayIso = moment().format("YYYY-MM-DD");

  // ISO "YYYY-MM-DD" ordena corretamente como string, então dá para combinar
  // os limites do usuário com o corte de "hoje" só com comparação de texto.
  const openLowerBound = startDate && startDate > todayIso ? startDate : todayIso;
  const overdueUpperBound = endDate && endDate < todayIso ? `${endDate}T23:59:59` : todayIso;

  const [totalBilled, totalReceived, totalOpen, totalOverdue] = await Promise.all([
    Invoices.sum("value", { where: baseWhere }),
    Invoices.sum("value", { where: { ...baseWhere, status: "paid" } }),
    Invoices.sum("value", {
      where: {
        ...baseWhere,
        status: "open",
        dueDate: { ...(endDate ? { [Op.lte]: `${endDate}T23:59:59` } : {}), [Op.gte]: openLowerBound }
      }
    }),
    Invoices.sum("value", {
      where: {
        ...baseWhere,
        status: "open",
        dueDate: { ...(startDate ? { [Op.gte]: startDate } : {}), [Op.lt]: overdueUpperBound }
      }
    })
  ]);

  return {
    totalBilled: totalBilled || 0,
    totalReceived: totalReceived || 0,
    totalOpen: totalOpen || 0,
    totalOverdue: totalOverdue || 0
  };
};

export default FinancialSummaryService;
