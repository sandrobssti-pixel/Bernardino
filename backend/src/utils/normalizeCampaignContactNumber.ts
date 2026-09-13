const toRawString = (value: unknown): string => {
  if (value === null || value === undefined) return "";

  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value).toString();
  }

  const text = String(value).trim();
  if (!text) return "";

  if (/^\d+(\.0+)?$/.test(text)) {
    return text.replace(/\..*$/, "");
  }

  if (/^\d+(\.\d+)?e[+-]?\d+$/i.test(text)) {
    const numeric = Number(text);
    if (Number.isFinite(numeric)) {
      return numeric.toFixed(0);
    }
  }

  return text;
};

// Só aplica a extração de dígitos quando o valor já "parece" telefone (dígitos
// e separadores comuns). Isso evita que um username/LID alfanumérico (ex.:
// Meta permitindo usernames no lugar do número) tenha seus dígitos internos
// extraídos e interpretados como um número de destino errado.
const isPhoneLikeValue = (text: string): boolean =>
  /\d/.test(text) && /^[\d\s\-().+]+$/.test(text);

export const normalizeCampaignContactNumber = (value: unknown): string => {
  const raw = toRawString(value);
  if (!raw) return "";

  if (!isPhoneLikeValue(raw)) return "";

  let digits = raw.replace(/\D/g, "");

  if (!digits) return "";

  if (digits.startsWith("00")) {
    digits = digits.replace(/^00+/, "");
  }

  // Aceita número sem DDI e normaliza para Brasil por padrão.
  // Ex.: DDD + 8/9 dígitos (10/11) -> 55 + DDD + número.
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }

  return digits;
};

export const isCampaignContactNumberFormatValid = (value: string): boolean => {
  // Modelo: código do país (2-3) + DDD (2) + número local (8-9)
  return /^\d{12,14}$/.test(value);
};
