import { Op } from "sequelize";
import BillingIntegration from "../../models/BillingIntegration";
import { sanitizeBillingIntegration } from "./utils";

interface Request {
  companyId: number;
  searchParam?: string;
  pageNumber?: string;
  activeOnly?: boolean;
}

interface Response {
  billingIntegrations: BillingIntegration[];
  count: number;
  hasMore: boolean;
}

const ListBillingIntegrationService = async ({
  companyId,
  searchParam = "",
  pageNumber = "1",
  activeOnly = false
}: Request): Promise<Response> => {
  const pageSize = 20;
  const offset = pageSize * (Number(pageNumber) - 1);

  const where: Record<string, unknown> = { companyId };
  if (activeOnly) {
    where.isActive = true;
  }
  if (searchParam.trim()) {
    where.name = {
      [Op.iLike]: `%${searchParam.trim()}%`
    };
  }

  const { count, rows } = await BillingIntegration.findAndCountAll({
    where,
    limit: pageSize,
    offset,
    order: [["name", "ASC"]]
  });

  return {
    billingIntegrations: rows
      .map(item => sanitizeBillingIntegration(item))
      .filter(Boolean) as BillingIntegration[],
    count,
    hasMore: count > offset + rows.length
  };
};

export default ListBillingIntegrationService;
