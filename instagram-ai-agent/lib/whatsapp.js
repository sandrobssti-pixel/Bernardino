// Aviso de escalação no WhatsApp via Evolution API.
// URL, instância e número vêm do painel; a chave fica na variável
// EVOLUTION_API_KEY (segredo, nunca no banco nem no navegador).

const evolutionConfig = escalation => ({
  url: String(escalation?.evolutionUrl || "").trim().replace(/\/+$/, ""),
  instance: String(escalation?.evolutionInstance || "").trim(),
  number: String(escalation?.whatsappNumber || "").replace(/\D/g, ""),
  apiKey: String(process.env.EVOLUTION_API_KEY || "").trim()
});

export const evolutionConfigured = escalation => {
  const config = evolutionConfig(escalation);
  return Boolean(config.url && config.instance && config.number && config.apiKey);
};

export const sendWhatsApp = async (escalation, text) => {
  const { url, instance, number, apiKey } = evolutionConfig(escalation);
  if (!url || !instance || !number || !apiKey) {
    throw new Error("Evolution API incompleta (URL, instância, número ou EVOLUTION_API_KEY)");
  }

  const response = await fetch(`${url}/message/sendText/${encodeURIComponent(instance)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    // "text" (Evolution v2) e "textMessage" (v1): cada versão ignora o outro.
    body: JSON.stringify({ number, text, textMessage: { text } }),
    signal: AbortSignal.timeout(10000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Evolution ${response.status}: ${JSON.stringify(data?.response?.message || data?.message || data).slice(0, 200)}`);
  }
  return data;
};

// Estado da instância (auditoria): "open" = WhatsApp conectado.
export const evolutionStatus = async escalation => {
  const { url, instance, apiKey } = evolutionConfig(escalation);
  const response = await fetch(`${url}/instance/connectionState/${encodeURIComponent(instance)}`, {
    headers: { apikey: apiKey },
    signal: AbortSignal.timeout(8000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Evolution ${response.status}`);
  return data?.instance?.state || data?.state || "desconhecido";
};
