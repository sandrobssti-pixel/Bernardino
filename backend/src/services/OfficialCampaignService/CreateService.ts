import * as Yup from "yup";
import AppError from "../../errors/AppError";
import OfficialCampaign from "../../models/OfficialCampaign";
import ContactList from "../../models/ContactList";
import Whatsapp from "../../models/Whatsapp";

interface Data {
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

const CreateService = async (data: Data): Promise<OfficialCampaign> => {
  const schema = Yup.object().shape({
    name: Yup.string().min(3, "ERR_CAMPAIGN_INVALID_NAME").required("ERR_CAMPAIGN_REQUIRED"),
    contactListId: Yup.number().required(),
    whatsappId: Yup.number().required(),
    templateIdMeta: Yup.string().required(),
    templateName: Yup.string().required(),
    templateLanguage: Yup.string().required()
  });

  try {
    await schema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  if (data.scheduledAt) {
    data.status = "PROGRAMADA";
  }

  const record = await OfficialCampaign.create(data);

  await record.reload({
    include: [
      { model: ContactList },
      { model: Whatsapp, attributes: ["id", "name", "channel"] }
    ]
  });

  return record;
};

export default CreateService;
