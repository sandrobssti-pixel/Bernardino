export const sanitizeDigits = (value?: string): string =>
  String(value || "").replace(/\D/g, "");

export const isValidCpfCnpj = (value?: string): boolean => {
  const digits = sanitizeDigits(value);
  return digits.length === 11 || digits.length === 14;
};

export const getNestedValue = (source: any, path: string): any => {
  if (!source || !path) return undefined;

  return String(path)
    .split(".")
    .reduce((acc, key) => {
      if (acc === null || typeof acc === "undefined") return undefined;
      return acc[key];
    }, source);
};

export const toArray = (value: unknown): any[] => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
};
