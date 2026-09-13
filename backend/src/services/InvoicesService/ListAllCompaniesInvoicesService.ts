import { Op, WhereOptions } from "sequelize";
import moment from "moment";
import Invoices from "../../models/Invoices";
import Company from "../../models/Company";

type StatusFilter = "all" | "paid" | "open" | "overdue";

interface Request {
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
  status?: StatusFilter;
  companyId?: number;
  searchParam?: string;
}

interface Response {
  invoices: Invoices[];
  count: number;
  hasMore: boolean;
}

const ListAllCompaniesInvoicesService = async ({
  page = 1,
  pageSize = 20,
  startDate,
  endDate,
  status = "all",
  companyId,
  searchParam
}: Request): Promise<Response> => {
  const safePage = page > 0 ? page : 1;
  const safePageSize = Math.min(pageSize > 0 ? pageSize : 20, 100);

  const where: WhereOptions = {};

  if (companyId) {
    (where as any).companyId = companyId;
  }

  // dueDate é STRING "YYYY-MM-DD..." — comparar sempre como texto.
  if (startDate || endDate) {
    const dueDateFilter: any = {};
    if (startDate) dueDateFilter[Op.gte] = startDate;
    if (endDate) dueDateFilter[Op.lte] = `${endDate}T23:59:59`;
    (where as any).dueDate = dueDateFilter;
  }

  const todayIso = moment().format("YYYY-MM-DD");
  const existingDueDateFilter = (where as any).dueDate || {};

  if (status === "paid") {
    (where as any).status = "paid";
  } else if (status === "open") {
    (where as any).status = "open";
    (where as any).dueDate = { ...existingDueDateFilter, [Op.gte]: todayIso };
  } else if (status === "overdue") {
    (where as any).status = "open";
    (where as any).dueDate = { ...existingDueDateFilter, [Op.lt]: todayIso };
  }

  if (searchParam) {
    (where as any)[Op.or] = [
      { detail: { [Op.iLike]: `%${searchParam}%` } },
      { "$company.name$": { [Op.iLike]: `%${searchParam}%` } }
    ];
  }

  const { count, rows: invoices } = await Invoices.findAndCountAll({
    where,
    include: [{ model: Company, attributes: ["id", "name"] }],
    order: [["dueDate", "DESC"]],
    limit: safePageSize,
    offset: (safePage - 1) * safePageSize,
    distinct: true
  });

  const hasMore = count > safePage * safePageSize;

  return { invoices, count, hasMore };
};

export default ListAllCompaniesInvoicesService;
