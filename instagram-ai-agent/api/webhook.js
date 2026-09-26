// Webhook do Instagram: a Meta chama GET para verificar e POST a cada evento
// (DM ou comentário). A resposta 200 sai na hora; o processamento roda em
// segundo plano (waitUntil), para a Meta não reenviar por demora.

import { waitUntil } from "@vercel/functions";
import { handleCommentChange, handleMessagingEvent } from "../lib/agent.js";
import { resolveProvider } from "../lib/ai.js";
import { passwordConfigured } from "../lib/auth.js";
import { isValidSignature } from "../lib/instagram.js";
import { hasStore } from "../lib/store.js";

export async function GET(request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const verifyToken = String(process.env.VERIFY_TOKEN || "").trim();

  if (mode) {
    if (mode === "subscribe" && verifyToken && url.searchParams.get("hub.verify_token") === verifyToken) {
      return new Response(url.searchParams.get("hub.challenge") || "", { status: 200 });
    }
    console.warn("[WEBHOOK] verificação recusada: VERIFY_TOKEN diferente ou não configurado");
    return new Response("Forbidden", { status: 403 });
  }

  // Sem parâmetros da Meta: mostra o que está configurado (sem expor segredos).
  return Response.json({
    ok: true,
    agentEnabled: String(process.env.AGENT_ENABLED || "true").toLowerCase() !== "false",
    hasAccessToken: Boolean(String(process.env.IG_ACCESS_TOKEN || "").trim()),
    hasVerifyToken: Boolean(verifyToken),
    checksSignature: Boolean(String(process.env.IG_APP_SECRET || "").trim()),
    aiProvider: resolveProvider(process.env) || null,
    hasPrompt: Boolean(String(process.env.AGENT_PROMPT || "").trim()),
    hasDatabase: hasStore(),
    hasDashboardPassword: passwordConfigured()
  });
}

export async function POST(request) {
  const rawBody = await request.text();
  const appSecret = String(process.env.IG_APP_SECRET || "").trim();

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

  const jobs = [];
  if (payload?.object === "instagram") {
    for (const entry of Array.isArray(payload.entry) ? payload.entry : []) {
      const ownId = String(entry?.id || "");
      for (const event of Array.isArray(entry?.messaging) ? entry.messaging : []) {
        // Id da própria conta: entry.id; no eco ela é o remetente, senão o destinatário.
        const accountId = ownId || String((event?.message?.is_echo ? event?.sender?.id : event?.recipient?.id) || "");
        jobs.push(handleMessagingEvent({ ...event, ownId: accountId }));
      }
      for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
        if (change?.field === "comments" || change?.field === "live_comments") {
          jobs.push(handleCommentChange(change.value, ownId));
        }
      }
    }
  }

  if (jobs.length) {
    waitUntil(
      Promise.allSettled(jobs).then(results =>
        results
          .filter(result => result.status === "rejected")
          .forEach(result => console.error("[AGENT] erro:", result.reason?.message || result.reason))
      )
    );
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
}
