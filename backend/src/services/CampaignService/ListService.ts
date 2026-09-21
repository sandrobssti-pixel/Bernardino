import { Op, fn, col, where } from "sequelize";
import Campaign from "../../models/Campaign";
import { isEmpty } from "lodash";
import ContactList from "../../models/ContactList";
import Whatsapp from "../../models/Whatsapp";
import CampaignShipping from "../../models/CampaignShipping";

interface Request {
  companyId: number | string;
  searchParam?: string;
  pageNumber?: string;
  status?: string;
  whatsappId?: string;
  contactListName?: string;
  scheduledDate?: string;
}

interface Response {
  records: Campaign[];
  count: number;
  hasMore: boolean;
}

const ListService = async ({
  searchParam = "",
  pageNumber = "1",
  status = "",
  whatsappId = "",
  contactListName = "",
  scheduledDate = "",
  companyId
}: Request): Promise<Response> => {
  let whereCondition: any = {
    companyId
  };

  if (!isEmpty(searchParam)) {
    whereCondition = {
      ...whereCondition,
      [Op.or]: [
        {
          name: where(
            fn("LOWER", col("Campaign.name")),
            "LIKE",
            `%${searchParam.toLowerCase().trim()}%`
          )
        }
      ]
    };
  }

  if (!isEmpty(status)) {
    whereCondition = {
      ...whereCondition,
      status
    };
  }

  if (!isEmpty(whatsappId)) {
    whereCondition = {
      ...whereCondition,
      whatsappId: Number(whatsappId)
    };
  }

  if (!isEmpty(scheduledDate)) {
    const startDate = new Date(`${scheduledDate}T00:00:00.000`);
    const endDate = new Date(`${scheduledDate}T23:59:59.999`);

    if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
      whereCondition = {
        ...whereCondition,
        scheduledAt: {
          [Op.between]: [startDate, endDate]
        }
      };
    }
  }

  const contactListInclude: any = { model: ContactList };
  if (!isEmpty(contactListName)) {
    contactListInclude.where = {
      name: where(
        fn("LOWER", col("contactList.name")),
        "LIKE",
        `%${contactListName.toLowerCase().trim()}%`
      )
    };
  }

  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: records } = await Campaign.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [["status", "ASC"], ["scheduledAt", "DESC"]],
    include: [
      contactListInclude,
      { model: Whatsapp, attributes: ["id", "name"] }
    ]
  });

  const hasMore = count > offset + records.length;

  // Resumo de envio por campanha (quantos disparos foram feitos e quantos
  // realmente confirmaram entrega) — usado na listagem pra mostrar a
  // bolinha de status (verde = enviou, vermelha = não enviou) sem precisar
  // abrir o relatório de cada campanha. Consulta separada e leve (só id +
  // deliveredAt, no máximo 20 campanhas por página), em vez de um JOIN
  // pesado na consulta principal.
  const campaignIds = records.map(r => r.id);
  if (campaignIds.length > 0) {
    const shippingRows = await CampaignShipping.findAll({
      where: { campaignId: { [Op.in]: campaignIds } },
      attributes: ["campaignId", "deliveredAt"]
    });

    const summaryByCampaignId = new Map<number, { total: number; delivered: number }>();
    shippingRows.forEach(row => {
      const current = summaryByCampaignId.get(row.campaignId) || { total: 0, delivered: 0 };
      current.total += 1;
      if (row.deliveredAt) current.delivered += 1;
      summaryByCampaignId.set(row.campaignId, current);
    });

    records.forEach(record => {
      const summary = summaryByCampaignId.get(record.id) || { total: 0, delivered: 0 };
      record.setDataValue("shippingTotal" as any, summary.total);
      record.setDataValue("shippingDelivered" as any, summary.delivered);
    });
  }

  return {
    records,
    count,
    hasMore
  };
};

export default ListService;
