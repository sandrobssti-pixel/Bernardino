import AppError from "../../errors/AppError";
import OfficialCampaign from "../../models/OfficialCampaign";

export const RestartService = async (id: number): Promise<void> => {
  const record = await OfficialCampaign.findByPk(id);

  if (!record) {
    throw new AppError("ERR_NO_OFFICIAL_CAMPAIGN_FOUND", 404);
  }

  const nextStatus = record.scheduledAt ? "PROGRAMADA" : "EM_ANDAMENTO";
  await record.update({ status: nextStatus, completedAt: null });
};
