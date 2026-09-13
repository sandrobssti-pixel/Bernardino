import { Request, Response } from "express";
import MetaConnection from "../models/MetaConnection";
import Whatsapp from "../models/Whatsapp";
import { handleMessage } from "../services/FacebookServices/facebookMessageListener";
import logger from "../utils/logger";

const buildWebhookSummary = (body: any) => {
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  return {
    object: String(body?.object || ""),
    entryCount: entries.length,
    entryIds: entries
      .map((entry: any) => String(entry?.id || "").trim())
      .filter(Boolean)
      .slice(0, 20),
    receivedAt: new Date().toISOString()
  };
};

export const verify = async (req: Request, res: Response): Promise<Response> => {
  const { metaConnectionId } = req.params;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const connection = await MetaConnection.findByPk(metaConnectionId);

  if (!connection || connection.isActive === false) {
    return res.status(404).json({ message: "Meta connection not found" });
  }

  if (mode === "subscribe" && token === connection.verifyToken) {
    await connection.update({
      status: "PENDING_WEBHOOK",
      metadata: {
        ...(connection.metadata || {}),
        lastWebhookVerificationAt: new Date().toISOString()
      }
    });

    return res.status(200).send(challenge);
  }

  return res.status(403).json({ message: "Forbidden" });
};

export const receive = async (req: Request, res: Response): Promise<Response> => {
  const { metaConnectionId } = req.params;
  const connection = await MetaConnection.findByPk(metaConnectionId);

  if (!connection || connection.isActive === false) {
    return res.status(404).json({ message: "Meta connection not found" });
  }

  res.status(200).json({ message: "EVENT_RECEIVED" });

  try {
    const summary = buildWebhookSummary(req.body);
    const runtime = (connection.metadata as any)?.__runtime || {};
    const objectType = String(req.body?.object || "");

    await connection.update({
      status: "CONNECTED",
      metadata: {
        ...(connection.metadata || {}),
        lastWebhookEvent: summary
      }
    });

    logger.info(
      `[META_WEBHOOK] recebido | metaConnectionId=${connection.id} | companyId=${connection.companyId} | channel=${connection.channel} | object=${summary.object} | entries=${summary.entryCount}`
    );

    if (objectType === "page" || objectType === "instagram") {
      const channel = objectType === "page" ? "facebook" : "instagram";
      const runtimeWhatsappId = Number(
        channel === "facebook"
          ? runtime.facebookWhatsappId
          : runtime.instagramWhatsappId
      );

      if (!runtimeWhatsappId) {
        logger.warn(
          `[META_WEBHOOK] sem conexao runtime para metaConnectionId=${connection.id} channel=${channel}`
        );
        return;
      }

      const runtimeWhatsapp = await Whatsapp.findOne({
        where: {
          id: runtimeWhatsappId,
          companyId: connection.companyId,
          channel
        }
      });

      if (!runtimeWhatsapp) {
        logger.warn(
          `[META_WEBHOOK] conexao runtime nao encontrada | metaConnectionId=${connection.id} | runtimeWhatsappId=${runtimeWhatsappId} | channel=${channel}`
        );
        return;
      }

      for (const entry of Array.isArray(req.body?.entry) ? req.body.entry : []) {
        const events: any[] = Array.isArray(entry?.messaging)
          ? entry.messaging
          : Array.isArray(entry?.changes)
            ? entry.changes.map((change: any) => change?.value).filter(Boolean)
            : [];

        for (const data of events) {
          try {
            await handleMessage(runtimeWhatsapp, data, channel, connection.companyId);
          } catch (handleError) {
            logger.error("[META_WEBHOOK] erro no handleMessage da MetaConnection", handleError);
          }
        }
      }
    }
  } catch (error) {
    logger.error("[META_WEBHOOK] erro ao registrar evento recebido", error);
  }

  return;
};
