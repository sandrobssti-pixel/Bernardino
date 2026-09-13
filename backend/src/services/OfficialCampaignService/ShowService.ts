import AppError from "../../errors/AppError";
import OfficialCampaign from "../../models/OfficialCampaign";
import OfficialCampaignShipping from "../../models/OfficialCampaignShipping";
import ContactList from "../../models/ContactList";
import ContactListItem from "../../models/ContactListItem";
import Whatsapp from "../../models/Whatsapp";

const ShowService = async (id: string | number): Promise<OfficialCampaign> => {
  const record = await OfficialCampaign.findByPk(id, {
    include: [
      { model: OfficialCampaignShipping },
      { model: ContactList, include: [{ model: ContactListItem }] },
      { model: Whatsapp, attributes: ["id", "name", "channel"] }
    ]
  });

  if (!record) {
    throw new AppError("ERR_NO_OFFICIAL_CAMPAIGN_FOUND", 404);
  }

  return record;
};

export default ShowService;
