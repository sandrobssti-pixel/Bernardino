import { parsePhoneNumberFromString } from "libphonenumber-js";

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

// Usa a biblioteca libphonenumber-js (dados oficiais de numeração de todos
// os países) em vez de regras feitas à mão — ela sabe, por exemplo,
// exatamente quais DDDs do Brasil exigem o 9º dígito do celular (e a mesma
// classe de regra pra qualquer outro país), o que uma lista fixa de
// tamanhos de dígitos nunca acompanharia direito. Bug real corrigido: um
// número brasileiro salvo sem o 9º dígito (12 dígitos: DDI+DDD+8) passava
// como "válido" e às vezes a mensagem não chegava de verdade no aparelho.
export const normalizeCampaignContactNumber = (value: unknown): string => {
  const raw = toRawString(value);
  if (!raw) return "";

  if (!isPhoneLikeValue(raw)) return "";

  const trimmed = raw.trim();

  try {
    // Com "+" ou "00" na frente, o próprio número já diz o país — não
    // assume nada. Sem isso, mantém o comportamento histórico do sistema
    // de tratar como Brasil (a imensa maioria dos contatos).
    const hasExplicitCountry = trimmed.startsWith("+") || trimmed.startsWith("00");
    const forParsing = hasExplicitCountry
      ? trimmed.replace(/^00/, "+")
      : trimmed;

    const parsed = parsePhoneNumberFromString(
      forParsing,
      hasExplicitCountry ? undefined : "BR"
    );

    if (parsed && parsed.isValid()) {
      return parsed.number.replace(/^\+/, "");
    }
  } catch {
    // segue pro fallback abaixo (formato que a lib não reconheceu)
  }

  // Fallback: mantém o comportamento antigo pra números que a lib não
  // conseguiu validar (ex.: DDI de um país sem essa info completa, ou
  // formato fora do padrão) — melhor devolver algo do que nada.
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.replace(/^00+/, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits;
};

export const isCampaignContactNumberFormatValid = (value: string): boolean => {
  if (!value) return false;

  try {
    const parsed = parsePhoneNumberFromString(`+${value}`);
    if (parsed) return parsed.isValid();
  } catch {
    // segue pro fallback abaixo
  }

  // Fallback pro mesmo caso do normalize: DDI (2-3) + DDD (2) + número
  // local (8-9), pra número que a lib não reconheceu mas ainda parece
  // plausível.
  return /^\d{12,14}$/.test(value);
};
