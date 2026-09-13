const parseCurrencyValue = (input: unknown): number | null => {
  if (input === null || input === undefined) {
    return null;
  }

  if (typeof input === "number") {
    return Number.isFinite(input) ? input : null;
  }

  let value = String(input).trim();
  if (!value) {
    return null;
  }

  value = value.replace(/\s/g, "").replace(/[^\d,.-]/g, "");

  const hasComma = value.includes(",");
  const hasDot = value.includes(".");

  if (hasComma && hasDot) {
    const lastComma = value.lastIndexOf(",");
    const lastDot = value.lastIndexOf(".");
    if (lastComma > lastDot) {
      value = value.replace(/\./g, "").replace(",", ".");
    } else {
      value = value.replace(/,/g, "");
    }
  } else if (hasComma) {
    value = value.replace(/\./g, "").replace(",", ".");
  } else {
    value = value.replace(/,/g, "");
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export default parseCurrencyValue;
