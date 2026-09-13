import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import { campaignQueue } from "../../queues";
import { ClearQueueJobsService } from "./ClearQueueJobsService";

export async function CancelService(id: number) {
  const campaign = await Campaign.findByPk(id);
  if (!campaign) {
    throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
  }

  await campaign.update({ status: "CANCELADA" });
  await ClearQueueJobsService(campaign.id);

  const recordsToCancel = await CampaignShipping.findAll({
    where: {
      campaignId: campaign.id,
      jobId: { [Op.not]: null },
      deliveredAt: null
    }
  });

  const promises = [];

  for (let record of recordsToCancel) {
    const job = await campaignQueue.getJob(+record.jobId);
    if (job) {
      promises.push(job.remove());
    }
  }

  await Promise.all(promises);
}
