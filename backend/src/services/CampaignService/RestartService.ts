import Campaign from "../../models/Campaign";
import { campaignQueue } from "../../queues";
import AppError from "../../errors/AppError";
import { ClearQueueJobsService } from "./ClearQueueJobsService";

export async function RestartService(id: number) {
  const campaign = await Campaign.findByPk(id);
  if (!campaign) {
    throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
  }

  // Mantém o horário configurado da campanha e apenas retoma o processamento.
  await campaign.update({ status: "EM_ANDAMENTO" });
  await ClearQueueJobsService(campaign.id);

  await campaignQueue.add("ProcessCampaign", { id: campaign.id });
}
