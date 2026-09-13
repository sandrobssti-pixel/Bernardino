import AppError from "../../errors/AppError";
import OfficialCampaign from "../../models/OfficialCampaign";

const DeleteService = async (id: string | number): Promise<void> => {
  const record = await OfficialCampaign.findByPk(id);

  if (!record) {
    throw new AppError("ERR_NO_OFFICIAL_CAMPAIGN_FOUND", 404);
  }

  await record.destroy();
};

export default DeleteService;
