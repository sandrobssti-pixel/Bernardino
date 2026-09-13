import { Op, fn, col, where } from "sequelize";
import { isEmpty } from "lodash";
import OfficialCampaign from "../../models/OfficialCampaign";
import ContactList from "../../models/ContactList";
import Whatsapp from "../../models/Whatsapp";

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
  records: OfficialCampaign[];
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
  let whereCondition: any = { companyId };

  if (!isEmpty(searchParam)) {
    whereCondition = {
      ...whereCondition,
      [Op.or]: [
        {
          name: where(
            fn("LOWER", col("OfficialCampaign.name")),
            "LIKE",
            `%${searchParam.toLowerCase().trim()}%`
          )
        },
        {
          templateName: where(
            fn("LOWER", col("OfficialCampaign.templateName")),
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

  const { count, rows: records } = await OfficialCampaign.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [["status", "ASC"], ["scheduledAt", "DESC"]],
    include: [
      contactListInclude,
      { model: Whatsapp, attributes: ["id", "name", "channel"] }
    ]
  });

  return {
    records,
    count,
    hasMore: count > offset + records.length
  };
};

export default ListService;
