import AppError from "../../errors/AppError";
import OfficialCampaign from "../../models/OfficialCampaign";

export const CancelService = async (id: number): Promise<void> => {
  const record = await OfficialCampaign.findByPk(id);

  if (!record) {
    throw new AppError("ERR_NO_OFFICIAL_CAMPAIGN_FOUND", 404);
  }

  await record.update({ status: "CANCELADA" });
};
