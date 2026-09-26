// Login do painel: senha única (DASHBOARD_PASSWORD) e sessão em cookie
// assinado (HMAC), válido por 7 dias.

import crypto from "node:crypto";

const COOKIE = "ia_session";
const MAX_AGE_SECONDS = 7 * 24 * 3600;

const secret = () =>
  String(process.env.DASHBOARD_SECRET || "") ||
  crypto
    .createHash("sha256")
    .update(`${process.env.DASHBOARD_PASSWORD || ""}:${process.env.IG_ACCESS_TOKEN || ""}`)
    .digest("hex");

const sign = value => crypto.createHmac("sha256", secret()).update(value).digest("base64url");

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export const passwordConfigured = () => String(process.env.DASHBOARD_PASSWORD || "").length >= 6;

export const checkPassword = password =>
  passwordConfigured() && safeEqual(String(password || ""), String(process.env.DASHBOARD_PASSWORD));

export const sessionCookie = () => {
  const expires = String(Date.now() + MAX_AGE_SECONDS * 1000);
  return `${COOKIE}=${expires}.${sign(expires)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE_SECONDS}`;
};

export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export const isAuthenticated = request => {
  if (!passwordConfigured()) return false;
  const cookies = String(request.headers.get("cookie") || "");
  const value = cookies
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!value) return false;
  const [expires, signature] = value.split(".");
  return Boolean(expires && signature) && Number(expires) > Date.now() && safeEqual(signature, sign(expires));
};
