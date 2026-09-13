import { campaignQueue } from "../../queues";

const CAMPAIGN_JOB_STATES = ["wait", "paused", "delayed", "active"] as const;

const isCampaignJob = (job: any, campaignId: number): boolean => {
  if (!job) return false;

  if (job.name === "ProcessCampaign") {
    return Number(job?.data?.id) === Number(campaignId);
  }

  if (job.name === "PrepareContact" || job.name === "DispatchCampaign") {
    return Number(job?.data?.campaignId) === Number(campaignId);
  }

  return false;
};

export const ClearQueueJobsService = async (
  campaignId: number
): Promise<void> => {
  const jobs = await campaignQueue.getJobs(CAMPAIGN_JOB_STATES as any);
  const removePromises: Promise<any>[] = [];

  for (const job of jobs) {
    if (!isCampaignJob(job, campaignId)) continue;
    removePromises.push(
      job.remove().catch(() => {
        return null;
      })
    );
  }

  await Promise.all(removePromises);
};

