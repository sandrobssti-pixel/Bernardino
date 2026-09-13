import { Op } from "sequelize";
import { FindOptions } from "sequelize/types";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";
import Prompt from "../../models/Prompt";
import { syncWuzapiStatusFromProvider } from "../WuzapiServices/wuzapiClient";

interface Request {
  companyId: number;
  session?: number | string;
}

const ListWhatsAppsService = async ({
  session,
  companyId
}: Request): Promise<Whatsapp[]> => {
  const options: FindOptions = {
    where: {
      companyId,
      [Op.or]: [
        { session: null },
        { session: { [Op.notLike]: "meta_connection:%" } }
      ]
    },
    include: [
      {
        model: Queue,
        as: "queues",
        attributes: ["id", "name", "color", "greetingMessage"]
      },
      {
        model: Prompt,
        as: "prompt",
      }
    ]
  };

  if (session !== undefined && session == 0) {
    options.attributes = { exclude: ["session"] };
  }

  const whatsapps = await Whatsapp.findAll(options);
  await Promise.all(
    whatsapps.map(async whatsapp => {
      await syncWuzapiStatusFromProvider(whatsapp);
    })
  );

  return whatsapps;
};



export default ListWhatsAppsService;
