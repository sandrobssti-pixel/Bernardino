// Lê título, descrição, preço e imagem de uma página de produto (tags
// og:/product:/<title>), para pré-preencher o cadastro no painel.

const BLOCKED_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$)/i;

const decode = value =>
  String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

const meta = (html, names) => {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name|itemprop)=["']${name}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${name}["']`,
      "i"
    );
    const match = html.match(re);
    if (match) return decode(match[1] ?? match[2]);
  }
  return "";
};

export const extractProductFromUrl = async rawUrl => {
  let url;
  try {
    url = new URL(String(rawUrl || "").trim());
  } catch {
    throw new Error("Link inválido");
  }
  if (!/^https?:$/.test(url.protocol) || BLOCKED_HOST.test(url.hostname)) throw new Error("Link não permitido");

  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ConfianzaBot/1.0)", Accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`A página respondeu ${response.status}`);
  const html = (await response.text()).slice(0, 600000);

  const currency = meta(html, ["product:price:currency", "og:price:currency", "priceCurrency"]);
  const amount = meta(html, ["product:price:amount", "og:price:amount", "price"]);
  return {
    name: meta(html, ["og:title", "twitter:title"]) || decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]),
    description: meta(html, ["og:description", "description", "twitter:description"]),
    price: amount ? `${currency ? `${currency} ` : ""}${amount}` : "",
    image: meta(html, ["og:image", "twitter:image"]),
    url: url.toString()
  };
};
