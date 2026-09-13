import { Request, Response } from "express";
import logger from "../utils/logger";

const truncate = (value: unknown, max = 800) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

export const ingest = async (req: Request, res: Response): Promise<Response> => {
  try {
    const payload = req.body || {};
    const type = truncate(payload?.type || "unknown", 120);
    const stage = truncate(payload?.stage || "runtime", 120);
    const route = truncate(payload?.route || req.headers.referer || "", 200);
    const userAgent = truncate(req.headers["user-agent"] || "", 280);
    const message = truncate(payload?.message || payload?.reason || payload?.error || "", 1200);

    logger.warn(
      `[FRONTEND_DEBUG] type=${type} stage=${stage} route=${route} ua=${userAgent} message=${message}`
    );

    return res.status(204).send();
  } catch (error) {
    logger.error({ error }, "[FRONTEND_DEBUG] ingest failed");
    return res.status(204).send();
  }
};

