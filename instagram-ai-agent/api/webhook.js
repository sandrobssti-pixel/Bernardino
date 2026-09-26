// Webhook do Instagram Direct: a Meta chama GET para verificar e POST a cada
// mensagem recebida. A resposta 200 sai na hora; a IA roda em segundo plano
// (waitUntil), para a Meta não reenviar o evento por demora.

import { waitUntil } from "@vercel/functions";
import { generateReply, resolveProvider } from "../lib/ai.js";
import {
  getConversationHistory,
  isValidSignature,
  sendText,
  sendTyping
} from "../lib/instagram.js";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const env = () => process.env;

const config = () => ({
  token: String(env().IG_ACCESS_TOKEN || "").trim(),
  verifyToken: String(env().VERIFY_TOKEN || "").trim(),
  appSecret: String(env().IG_APP_SECRET || "").trim(),
  historyLimit: Number(env().HISTORY_LIMIT) || 12,
  burstWaitMs: env().BURST_WAIT_MS !== undefined ? Number(env().BURST_WAIT_MS) : 4000,
  enabled: String(env().AGENT_ENABLED || "true").toLowerCase() !== "false"
});

export async function GET(request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const { verifyToken, token, appSecret, enabled } = config();

  if (mode) {
    const received = url.searchParams.get("hub.verify_token");
    if (mode === "subscribe" && verifyToken && received === verifyToken) {
      return new Response(url.searchParams.get("hub.challenge") || "", { status: 200 });
    }
    console.warn("[WEBHOOK] verificação recusada: VERIFY_TOKEN diferente ou não configurado");
    return new Response("Forbidden", { status: 403 });
  }

  // Sem parâmetros da Meta: mostra o que está configurado (sem expor segredos).
  return Response.json({
    ok: true,
    agentEnabled: enabled,
    hasAccessToken: Boolean(token),
    hasVerifyToken: Boolean(verifyToken),
    checksSignature: Boolean(appSecret),
    aiProvider: resolveProvider(env()) || null,
    hasPrompt: Boolean(String(env().AGENT_PROMPT || "").trim())
  });
}

export async function POST(request) {
  const rawBody = await request.text();
  const { appSecret } = config();

  if (appSecret && !isValidSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    console.warn("[WEBHOOK] assinatura inválida — confira IG_APP_SECRET");
    return new Response("Invalid signature", { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const events = [];
  for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) {
    for (const event of Array.isArray(entry?.messaging) ? entry.messaging : []) {
      events.push({ ...event, ownId: String(event?.recipient?.id || entry?.id || "") });
    }
  }

  if (payload?.object === "instagram" && events.length) {
    waitUntil(
      Promise.all(
        events.map(event =>
          handleEvent(event).catch(error => {
            console.error("[AGENT] erro ao responder:", error.message);
          })
        )
      )
    );
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
}

export const handleEvent = async event => {
  const { token, historyLimit, burstWaitMs, enabled } = config();
  const message = event?.message;
  const senderId = String(event?.sender?.id || "");
  const ownId = String(event?.ownId || "");

  // Só mensagem nova do cliente (ignora eco das nossas respostas, leitura,
  // reação, mensagem apagada etc.).
  if (!enabled || !token || !message || message.is_echo || message.is_deleted) return;
  if (!senderId || senderId === ownId) return;

  const text = String(message.text || "").trim();
  const attachment = message.attachments?.[0];
  const imageUrl = attachment?.type === "image" ? attachment.payload?.url : undefined;
  const otherAttachment = attachment && !imageUrl ? attachment.type : undefined;

  if (!text && !imageUrl && !otherAttachment) return;

  // Espera um pouco para juntar mensagens seguidas ("oi" + "tudo bem?" +
  // "quanto custa?"): só a última mensagem da rajada gera resposta.
  if (burstWaitMs > 0) await sleep(burstWaitMs);

  let history = [];
  try {
    history = await getConversationHistory(token, senderId, historyLimit);
  } catch (error) {
    console.warn("[AGENT] sem histórico, respondendo só a mensagem atual:", error.message);
  }

  const currentIndex = history.findIndex(item => item.id === message.mid);
  if (currentIndex >= 0) {
    const newerFromCustomer = history
      .slice(currentIndex + 1)
      .some(item => item.fromId === senderId);
    if (newerFromCustomer) return; // a mensagem mais nova responde por todas
    history.splice(currentIndex, 1);
  }

  const turns = history.map(item => ({
    role: item.fromId === senderId ? "user" : "assistant",
    text: item.text
  }));

  const currentText =
    text ||
    (otherAttachment ? `[o cliente enviou um anexo do tipo "${otherAttachment}", que você não consegue abrir]` : "");
  const last = turns[turns.length - 1];
  if (last && last.role === "user" && last.text === currentText && !imageUrl) turns.pop();
  turns.push({ role: "user", text: currentText, imageUrl });

  await sendTyping(token, senderId, true);
  const reply = await generateReply(turns, env());
  if (!reply) {
    await sendTyping(token, senderId, false);
    return;
  }

  await sendText(token, senderId, reply);
  console.log(`[AGENT] respondeu ${senderId} (${reply.length} caracteres)`);
};
