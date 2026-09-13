import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";

// Rate limiting em memória (sem dependência nova) para as rotas públicas do
// webchat (/webchat/public/:widgetId/*), que não têm autenticação de usuário
// e por isso ficam expostas a abuso/spam. A chave combina IP + widgetId para
// não deixar um visitante barulhento em um site derrubar o limite de outro.
// Observação: por rodar em memória do processo, o limite não é compartilhado
// entre instâncias em cluster/PM2 — cada processo mantém sua própria contagem.

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitEntry>();

const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets.entries()) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}, SWEEP_INTERVAL_MS).unref();

const getClientIp = (req: Request): string =>
  (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
  req.socket.remoteAddress ||
  "unknown";

interface WebchatRateLimitOptions {
  windowMs: number;
  max: number;
  routeName: string;
}

export const webchatRateLimit = ({
  windowMs,
  max,
  routeName
}: WebchatRateLimitOptions) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const widgetId = req.params.widgetId || "unknown";
    const key = `${routeName}:${getClientIp(req)}:${widgetId}`;
    const now = Date.now();

    let entry = buckets.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      throw new AppError("Muitas requisições, tente novamente em instantes", 429);
    }

    next();
  };
};
