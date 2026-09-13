import { Request, Response } from "express";
import AppError from "../errors/AppError";
import PushSubscription from "../models/PushSubscription";
import { getPushConfig, hasPushConfig } from "../services/PushNotificationServices/PushConfig";

export const publicKey = async (_req: Request, res: Response): Promise<Response> => {
  if (!hasPushConfig()) {
    return res.status(200).json({ publicKey: null, enabled: false });
  }

  const { publicKey: key } = getPushConfig();
  return res.status(200).json({ publicKey: key, enabled: true });
};

export const upsert = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user;
  const { subscription } = req.body || {};

  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  const expirationTime = subscription?.expirationTime;

  if (!endpoint || !p256dh || !auth) {
    throw new AppError("Dados de inscrição push inválidos.", 400);
  }

  const payload = {
    companyId,
    userId,
    endpoint,
    p256dh,
    auth,
    expirationTime: expirationTime ? String(expirationTime) : null,
    userAgent: req.headers["user-agent"] || "",
    lastSeenAt: new Date()
  };

  const existing = await PushSubscription.findOne({
    where: { endpoint }
  });

  if (existing) {
    await existing.update(payload);
    return res.status(200).json({ id: existing.id });
  }

  const created = await PushSubscription.create(payload as any);
  return res.status(201).json({ id: created.id });
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user;
  const endpoint = req.body?.endpoint;

  if (endpoint) {
    await PushSubscription.destroy({
      where: { companyId, endpoint }
    });
  } else {
    // fallback de segurança: remove inscrições do usuário atual ao deslogar
    await PushSubscription.destroy({
      where: { companyId, userId }
    });
  }

  return res.status(204).send();
};
