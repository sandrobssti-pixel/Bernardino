// Cliente mínimo da "API do Instagram com login do Instagram"
// (token IGAA..., host graph.instagram.com).

import crypto from "node:crypto";

const GRAPH_URL = "https://graph.instagram.com/v21.0";

// Limite de caracteres de uma mensagem de texto no Instagram Direct.
export const MAX_TEXT_LENGTH = 1000;

const graphRequest = async (token, path, { method = "GET", body, params } = {}) => {
  const url = new URL(`${GRAPH_URL}/${path}`);
  for (const [key, value] of Object.entries(params || {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.message || response.statusText;
    throw new Error(`Instagram API ${method} ${path} -> ${response.status}: ${detail}`);
  }
  return data;
};

// Confere o cabeçalho X-Hub-Signature-256 (HMAC-SHA256 do corpo com a chave
// secreta do app do Instagram).
export const isValidSignature = (rawBody, signatureHeader, appSecret) => {
  const signature = String(signatureHeader || "");
  if (!signature.startsWith("sha256=")) return false;

  const expected = `sha256=${crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex")}`;

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Quebra um texto longo em partes de até MAX_TEXT_LENGTH, preferindo quebrar
// em parágrafo, depois em frase, depois em espaço.
export const splitMessage = (text, limit = MAX_TEXT_LENGTH) => {
  const parts = [];
  let rest = String(text || "").trim();

  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    let cut = window.lastIndexOf("\n\n");
    if (cut < limit * 0.5) cut = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! ")) + 1;
    if (cut < limit * 0.5) cut = window.lastIndexOf(" ");
    if (cut <= 0) cut = limit;

    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }

  if (rest) parts.push(rest);
  return parts;
};

export const sendText = async (token, recipientId, text) => {
  const results = [];
  for (const part of splitMessage(text)) {
    results.push(
      await graphRequest(token, "me/messages", {
        method: "POST",
        body: { recipient: { id: recipientId }, message: { text: part } }
      })
    );
  }
  return results;
};

export const sendTyping = async (token, recipientId, on = true) => {
  try {
    await graphRequest(token, "me/messages", {
      method: "POST",
      body: { recipient: { id: recipientId }, sender_action: on ? "typing_on" : "typing_off" }
    });
  } catch (error) {
    // Indicador de digitação é só cosmético.
    console.warn("[IG] typing falhou:", error.message);
  }
};

// Últimas mensagens da conversa com o cliente, da mais antiga para a mais
// nova: [{ id, text, fromId, createdAt }]. A própria API do Instagram guarda o
// histórico, então o agente não precisa de banco de dados.
export const getConversationHistory = async (token, userId, limit) => {
  const data = await graphRequest(token, "me/conversations", {
    params: {
      platform: "instagram",
      user_id: userId,
      fields: `messages.limit(${limit}){id,message,from,created_time}`
    }
  });

  const messages = data?.data?.[0]?.messages?.data || [];
  return messages
    .map(message => ({
      id: message.id,
      text: String(message.message || "").trim(),
      fromId: String(message.from?.id || ""),
      createdAt: message.created_time
    }))
    .reverse();
};
