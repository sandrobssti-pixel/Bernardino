import BillingIntegration from "../../models/BillingIntegration";

export const SECRET_KEYS = [
  "apiKey",
  "token",
  "password",
  "secret",
  "clientSecret",
  "accessToken"
];

export const isSecretKey = (key: string): boolean =>
  SECRET_KEYS.some(secretKey =>
    String(key || "").toLowerCase().includes(secretKey.toLowerCase())
  );

const maskValue = (value: unknown): string => {
  const raw = String(value || "");
  if (!raw) return "";
  if (raw.length <= 6) return "*".repeat(raw.length);
  return `${raw.slice(0, 2)}${"*".repeat(Math.max(raw.length - 4, 2))}${raw.slice(-2)}`;
};

export const sanitizeBillingIntegration = (
  integration: BillingIntegration | null
): BillingIntegration | null => {
  if (!integration) return integration;

  const json = integration.toJSON() as BillingIntegration & {
    credentials?: Record<string, unknown>;
  };
  const sanitizedCredentials = Object.entries(json.credentials || {}).reduce(
    (acc, [key, value]) => {
      acc[key] = SECRET_KEYS.some(secretKey =>
        key.toLowerCase().includes(secretKey.toLowerCase())
      )
        ? maskValue(value)
        : value;
      return acc;
    },
    {} as Record<string, unknown>
  );

  return {
    ...(json as any),
    credentials: sanitizedCredentials
  } as BillingIntegration;
};

export const normalizeJsonObject = (
  value: unknown
): Record<string, unknown> => {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  return typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};
