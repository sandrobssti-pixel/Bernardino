const WEBPUSH_VAPID_PUBLIC_KEY = process.env.WEBPUSH_VAPID_PUBLIC_KEY || "";
const WEBPUSH_VAPID_PRIVATE_KEY = process.env.WEBPUSH_VAPID_PRIVATE_KEY || "";
const WEBPUSH_SUBJECT =
  process.env.WEBPUSH_SUBJECT || "mailto:admin@example.com";

export const hasPushConfig = (): boolean =>
  Boolean(WEBPUSH_VAPID_PUBLIC_KEY && WEBPUSH_VAPID_PRIVATE_KEY);

export const getPushConfig = () => ({
  publicKey: WEBPUSH_VAPID_PUBLIC_KEY,
  privateKey: WEBPUSH_VAPID_PRIVATE_KEY,
  subject: WEBPUSH_SUBJECT
});

