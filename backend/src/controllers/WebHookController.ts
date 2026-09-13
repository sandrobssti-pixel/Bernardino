import { Request, Response } from "express";
import Whatsapp from "../models/Whatsapp";
import { handleMessage } from "../services/FacebookServices/facebookMessageListener";
import handleWuzapiWebhook from "../services/WuzapiServices/HandleWuzapiWebhook";
import logger from "../utils/logger";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "whaticket";
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
  }

  return res.status(403).json({ message: "Forbidden" });
};

export const webHook = async (req: Request, res: Response): Promise<Response> => {
  const { body } = req;
  // PASSO 1: Responda imediatamente para evitar timeout da plataforma.
  res.status(200).json({ message: "EVENT_RECEIVED" });

  try {
    if (body.object === "page" || body.object === "instagram") {
      const channel = body.object === "page" ? "facebook" : "instagram";

      // MUDANÇA 1: Trocando forEach por um loop for...of para lidar corretamente com async/await.
      for (const entry of body.entry) {
        try {
          const getTokenPage = await Whatsapp.findOne({
            where: {
              facebookPageUserId: entry.id,
              channel
            }
          });

          if (getTokenPage) {
            const events: any[] = Array.isArray(entry.messaging)
              ? entry.messaging
              : Array.isArray(entry.changes)
                ? entry.changes
                    .map(change => change?.value)
                    .filter(Boolean)
                : [];

            // MUDANÇA 2: Usando for...of aqui também.
            for (const data of events) {
              // MUDANÇA 3: Adicionando try...catch para capturar erros específicos do handleMessage
              // e evitar que o servidor inteiro quebre.
              try {
                await handleMessage(getTokenPage, data, channel, getTokenPage.companyId);
              } catch (handleError) {
                console.error("Erro capturado dentro do handleMessage:", handleError);
              }
            }
          } else {
            console.warn(
              "[webhook] Conexão não encontrada para entrada recebida:",
              { entryId: entry?.id, channel }
            );
          }
        } catch (dbError) {
          console.error("Erro ao consultar o Whatsapp no banco de dados:", dbError);
        }
      }
    }
  } catch (error) {
    console.error("Erro geral no processamento do webhook:", error);
  }

  // A resposta já foi enviada no início, então não retornamos nada aqui.
  return;
};

export const webHookWuzapi = async (
  req: Request,
  res: Response
): Promise<Response> => {
  res.status(200).json({ message: "EVENT_RECEIVED" });

  try {
    logger.info(
      `[WUZAPI_WEBHOOK] recebido | type=${String(req.body?.type || "sem-type")} | instance=${String(
        req.body?.instanceName || "sem-instance"
      )}`
    );
    await handleWuzapiWebhook(req.body);
  } catch (error) {
    console.error("Erro no processamento do webhook WuzAPI:", error);
  }

  return;
};
