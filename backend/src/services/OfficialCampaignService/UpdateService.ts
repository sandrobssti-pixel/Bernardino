import AppError from "../../errors/AppError";
import OfficialCampaign from "../../models/OfficialCampaign";
import ContactList from "../../models/ContactList";
import Whatsapp from "../../models/Whatsapp";

interface Data {
  id: number | string;
  name: string;
  status: string;
  scheduledAt: string;
  companyId: number;
  contactListId: number;
  whatsappId: number;
  templateIdMeta: string;
  templateName: string;
  templateLanguage: string;
  templateCategory?: string;
  templateComponents?: any[];
  headerVariables?: string[];
  bodyVariables?: string[];
  headerMediaUrl?: string;
  statusTicket?: string;
}

const UpdateService = async (data: Data): Promise<OfficialCampaign> => {
  const record = await OfficialCampaign.findByPk(data.id);

  if (!record) {
    throw new AppError("ERR_NO_OFFICIAL_CAMPAIGN_FOUND", 404);
  }

  if (["INATIVA", "PROGRAMADA", "CANCELADA"].indexOf(data.status) === -1) {
    throw new AppError(
      "So e permitido alterar campanha oficial Inativa, Programada ou Cancelada",
      400
    );
  }

  if (data.scheduledAt && data.status === "INATIVA") {
    data.status = "PROGRAMADA";
  }

  await record.update(data);

  await record.reload({
    include: [
      { model: ContactList },
      { model: Whatsapp, attributes: ["id", "name", "channel"] }
    ]
  });

  return record;
};

export default UpdateService;
