import { Response } from "express";

const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

export const getRefreshTokenCookieOptions = () => {
  const secureByEnv =
    String(process.env.COOKIE_SECURE || "").toLowerCase() === "true";

  const sameSiteEnv = String(process.env.COOKIE_SAMESITE || "").toLowerCase();
  const sameSite =
    sameSiteEnv === "none" || sameSiteEnv === "strict" || sameSiteEnv === "lax"
      ? sameSiteEnv
      : "lax";

  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

  return {
    httpOnly: true,
    secure: secureByEnv,
    sameSite: sameSite as "none" | "lax" | "strict",
    maxAge: sevenDaysInMs,
    path: "/",
    ...(cookieDomain ? { domain: cookieDomain } : {})
  };
};

export const getRefreshTokenClearCookieOptions = () => {
  const { maxAge, ...cookieOptions } = getRefreshTokenCookieOptions();
  return cookieOptions;
};

export const SendRefreshToken = (res: Response, token: string): void => {
  res.cookie("jrt", token, getRefreshTokenCookieOptions());
};
