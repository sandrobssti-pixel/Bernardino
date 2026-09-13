import { Op } from "sequelize";
import PushSubscription from "../../models/PushSubscription";
import User from "../../models/User";
import Queue from "../../models/Queue";
import logger from "../../utils/logger";
import { getPushConfig, hasPushConfig } from "./PushConfig";

const webpush = require("web-push");

interface TicketFilter {
  queueId?: number | null;
  userId?: number | null;
}

interface Request {
  companyId: number;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  ticket?: TicketFilter;
}

// Espelha a checagem `canAccessTicket` do NotificationsPopOver no frontend,
// para que o push nativo só chegue a quem também veria a notificação no app.
const getEligibleUserIds = async (
  companyId: number,
  ticket: TicketFilter
): Promise<number[]> => {
  const users = await User.findAll({
    where: { companyId },
    attributes: ["id", "profile", "allTicket", "allUserChat"],
    include: [{ model: Queue, as: "queues", attributes: ["id"] }]
  });

  const { queueId, userId } = ticket;

  return users
    .filter(user => {
      const isAdmin = String(user.profile).toLowerCase() === "admin";
      if (isAdmin) return true;

      const canAccessByQueue = queueId == null
        ? user.allTicket === "enable"
        : user.queues?.some(q => q.id === queueId);
      if (!canAccessByQueue) return false;

      const canAccessByUser =
        user.allUserChat === "enabled" ||
        !userId ||
        userId === user.id;

      return canAccessByUser;
    })
    .map(user => user.id);
};

let vapidConfigured = false;

const ensureVapid = () => {
  if (vapidConfigured) return true;
  if (!hasPushConfig()) return false;

  const { publicKey, privateKey, subject } = getPushConfig();
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
};

const SendWebPushNotificationService = async ({
  companyId,
  title,
  body,
  url = "/",
  tag,
  ticket
}: Request): Promise<void> => {
  if (!ensureVapid()) {
    return;
  }

  const where: any = { companyId };

  if (ticket) {
    const eligibleUserIds = await getEligibleUserIds(companyId, ticket);
    if (!eligibleUserIds.length) return;
    where.userId = { [Op.in]: eligibleUserIds };
  }

  const subscriptions = await PushSubscription.findAll({ where });

  if (!subscriptions.length) return;

  const payload = JSON.stringify({
    title,
    body,
    url,
    tag: tag || `company-${companyId}`,
    data: { url }
  });

  await Promise.all(
    subscriptions.map(async (sub) => {
      const subscriptionObject = {
        endpoint: sub.endpoint,
        expirationTime: sub.expirationTime ? Number(sub.expirationTime) : null,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(subscriptionObject, payload);
      } catch (error: any) {
        const statusCode = error?.statusCode;

        // 404/410 = inscrição expirada/inválida.
        if (statusCode === 404 || statusCode === 410) {
          await PushSubscription.destroy({
            where: { id: sub.id }
          });
          return;
        }

        logger.warn(
          `Falha ao enviar web push (company ${companyId}): ${error?.message || error}`
        );
      }
    })
  );
};

export default SendWebPushNotificationService;

