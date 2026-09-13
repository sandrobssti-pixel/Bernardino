import { Op } from "sequelize";
import { FindOptions } from "sequelize/types";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";
import Prompt from "../../models/Prompt";
import { syncWuzapiStatusFromProvider } from "../WuzapiServices/wuzapiClient";

interface Request {
  companyId: number;
  session?: number | string;
  channel?: string;
}

const ListFilterWhatsAppsService = async ({
  session,
  companyId,
  channel = "whatsapp"
}: Request): Promise<Whatsapp[]> => {
  const options: FindOptions = {
    where: {
      companyId,
      channel,
      [Op.or]: [
        { session: null },
        { session: { [Op.notLike]: "meta_connection:%" } }
      ]
    }
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



export default ListFilterWhatsAppsService;
