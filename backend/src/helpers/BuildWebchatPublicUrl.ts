// Monta uma URL pública ABSOLUTA (com host e porta) para arquivos servidos em
// /public — usado especificamente pelo webchat, onde o consumidor da URL
// (widget.js embutido no site do visitante, ou o painel via
// WebchatPublicController) está sempre em uma origem diferente do backend.
// Diferente do getter Message.mediaUrl (que, em ambiente local, cai para um
// caminho relativo por assumir mesma origem), aqui isso nunca é seguro: uma
// URL relativa resolveria contra o domínio do site do cliente, não do
// backend. Por isso sempre devolvemos absoluto, reaproveitando a mesma
// convenção BACKEND_URL + PROXY_PORT já usada em Announcement.ts.
export const buildWebchatPublicUrl = (relativePath: string): string => {
  const rawBackendUrl = String(process.env.BACKEND_URL || "").trim();
  const proxyPort = String(process.env.PROXY_PORT || "").trim();

  let base = rawBackendUrl.replace(/\/+$/, "");

  try {
    const parsedUrl = new URL(rawBackendUrl);
    if (proxyPort && !parsedUrl.port) {
      parsedUrl.port = proxyPort;
    }
    base = parsedUrl.toString().replace(/\/+$/, "");
  } catch {
    // BACKEND_URL inválida/ausente: segue com o valor bruto, sem porta.
  }

  return `${base}/public/${relativePath.replace(/^\/+/, "")}`;
};
