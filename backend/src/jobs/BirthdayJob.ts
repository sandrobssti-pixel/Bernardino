import { CronJob } from "cron";
import logger from "../utils/logger";
import BirthdayService from "../services/BirthdayService";

export const initializeBirthdayJob = () => {
  const job = new CronJob(
    "0 * * * * *",
    async () => {
      try {
        await BirthdayService.processAutomaticBirthdayMessages();
      } catch (error) {
        logger.error("BirthdayJob error", error);
      }
    },
    null,
    true,
    "America/Sao_Paulo"
  );

  logger.info("Birthday job initialized (every minute).");
  return job;
};
