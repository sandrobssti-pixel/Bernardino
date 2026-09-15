import { Request, Response } from "express";

const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

// Valida se o domínio configurado em COOKIE_DOMAIN é compatível com o host
// da requisição atual. Um valor desatualizado/errado (ex.: "localhost"
// copiado do .env.example e nunca trocado ao subir pra produção) faz o
// navegador REJEITAR o cookie inteiro — o atributo Domain de um cookie
// precisa ser o próprio host ou um sufixo dele, senão o Set-Cookie é
// ignorado silenciosamente (sem erro nenhum visível). O resultado prático:
// o cookie de refresh token ("jrt") nunca é salvo, e a primeira vez que o
// token de acesso precisa ser renovado (ex.: depois de alguns minutos de
// uso, ao clicar em qualquer tela que dispare uma leva de requisições),
// `req.cookies.jrt` chega undefined no backend e a sessão é encerrada à
// força — o usuário é deslogado do nada. Ver docs/MANUAL_TECNICO.md,
// seção 13, para o incidente real que motivou essa validação.
const resolveCookieDomain = (req?: Request): string | undefined => {
  const configuredDomain = process.env.COOKIE_DOMAIN;
  if (!configuredDomain) return undefined;

  const requestHost = req?.hostname || "";
  const normalizedDomain = configuredDomain.replace(/^\./, "");
  const isValidForHost =
    requestHost === normalizedDomain ||
    requestHost.endsWith(`.${normalizedDomain}`);

  if (!isValidForHost) {
    // eslint-disable-next-line no-console
    console.warn(
      `[SendRefreshToken] COOKIE_DOMAIN="${configuredDomain}" não é compatível com o host da requisição ("${requestHost}") — ignorando essa configuração para não quebrar o cookie de sessão (o navegador rejeitaria o cookie inteiro). Corrija ou remova COOKIE_DOMAIN no .env do backend.`
    );
    return undefined;
  }

  return configuredDomain;
};

export const getRefreshTokenCookieOptions = (req?: Request) => {
  const secureByEnv =
    String(process.env.COOKIE_SECURE || "").toLowerCase() === "true";

  const sameSiteEnv = String(process.env.COOKIE_SAMESITE || "").toLowerCase();
  const sameSite =
    sameSiteEnv === "none" || sameSiteEnv === "strict" || sameSiteEnv === "lax"
      ? sameSiteEnv
      : "lax";

  const cookieDomain = resolveCookieDomain(req);

  return {
    httpOnly: true,
    secure: secureByEnv,
    sameSite: sameSite as "none" | "lax" | "strict",
    maxAge: sevenDaysInMs,
    path: "/",
    ...(cookieDomain ? { domain: cookieDomain } : {})
  };
};

export const getRefreshTokenClearCookieOptions = (req?: Request) => {
  const { maxAge, ...cookieOptions } = getRefreshTokenCookieOptions(req);
  return cookieOptions;
};

export const SendRefreshToken = (
  res: Response,
  token: string,
  req?: Request
): void => {
  res.cookie("jrt", token, getRefreshTokenCookieOptions(req));
};
