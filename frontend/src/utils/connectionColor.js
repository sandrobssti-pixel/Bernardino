const DEFAULT_CONNECTION_COLOR = "#25D366";
const isValidColor = (value) => /^#[0-9a-f]{3,6}$/i.test(String(value || "").trim());

const hashString = (value = "") => {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }

  return Math.abs(hash);
};

export const getConnectionColor = (connection) => {
  if (!connection) return DEFAULT_CONNECTION_COLOR;

  if (isValidColor(connection.color)) {
    return connection.color.trim();
  }

  const seed = `${connection.id || ""}-${connection.name || ""}`.trim();
  if (!seed) return DEFAULT_CONNECTION_COLOR;

  const hash = hashString(seed);
  const hue = hash % 360;
  const saturation = 68;
  const lightness = 44;

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

export default getConnectionColor;
