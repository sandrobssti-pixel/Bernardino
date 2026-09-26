// API do painel. Uma função só (limite de funções do plano gratuito):
// a rota vem em ?r=...  Tudo exige login, menos r=login/r=session.

import { aiOverrides, fillTemplate, planCommentReplies, sendAndLog } from "../lib/agent.js";
import { runAudit, tokenDaysLeft } from "../lib/audit.js";
import { extractProductFromUrl } from "../lib/extract.js";
import { sendWhatsApp } from "../lib/whatsapp.js";
import { checkPassword, clearCookie, isAuthenticated, passwordConfigured, sessionCookie } from "../lib/auth.js";
import { ESCALATION_MARKER, generateReply, resolveProvider } from "../lib/ai.js";
import {
  getAccountProfile,
  getMe,
  getMediaComments,
  getProfile,
  getRecentMedia,
  getSubscribedFields,
  refreshAccessToken,
  subscribeFields
} from "../lib/instagram.js";
import {
  accessToken,
  countLeads,
  deleteLeadData,
  getComments,
  getConfig,
  getFeed,
  getLead,
  getMessages,
  getStats,
  getTokenInfo,
  hasStore,
  listLeads,
  saveConfig,
  saveRefreshedToken,
  updateLead
} from "../lib/store.js";

const json = (data, status = 200, headers = {}) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });

const setup = () => ({
  hasDatabase: hasStore(),
  hasAccessToken: Boolean(String(process.env.IG_ACCESS_TOKEN || "").trim()),
  hasVerifyToken: Boolean(String(process.env.VERIFY_TOKEN || "").trim()),
  aiProvider: resolveProvider(process.env) || null,
  hasDashboardPassword: passwordConfigured(),
  agentEnvEnabled: String(process.env.AGENT_ENABLED || "true").toLowerCase() !== "false"
});

const refreshToken = async () => {
  const data = await refreshAccessToken(await accessToken());
  return saveRefreshedToken(data.access_token, data.expires_in);
};

const tokenStatus = info =>
  info ? { refreshedAt: info.refreshedAt, expiresAt: info.expiresAt, daysLeft: tokenDaysLeft(info), source: info.source || "renovacao" } : null;

const WEBHOOK_FIELDS = ["messages", "comments"];

const csvCell = value => `"${String(value ?? "").replace(/"/g, '""')}"`;

export async function GET(request) {
  const url = new URL(request.url);
  const route = url.searchParams.get("r");

  // Cron semanal da Vercel (vercel.json → crons): renova o token do Instagram.
  if (route === "refresh-token") {
    const cronSecret = String(process.env.CRON_SECRET || "");
    const fromCron = cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`;
    if (!fromCron && !isAuthenticated(request)) return json({ error: "Não autorizado" }, 401);
    if (!hasStore()) return json({ error: "Banco de dados não conectado" }, 503);
    try {
      return json({ ok: true, token: tokenStatus(await refreshToken()) });
    } catch (error) {
      console.error("[TOKEN]", error.message);
      return json({ error: error.message }, 502);
    }
  }

  if (route === "session") {
    return json({ authenticated: isAuthenticated(request), passwordConfigured: passwordConfigured() });
  }
  if (!isAuthenticated(request)) return json({ error: "Não autenticado" }, 401);
  if (!hasStore()) return json({ error: "Banco de dados não conectado", setup: setup() }, 503);

  try {
    switch (route) {
      case "overview": {
        const [stats, feed, totalLeads] = await Promise.all([getStats(14), getFeed(40), countLeads()]);
        // Nome do cliente em cada evento da movimentação.
        const ids = [...new Set(feed.map(item => item.leadId).filter(Boolean))];
        const leads = Object.fromEntries((await Promise.all(ids.map(getLead))).filter(Boolean).map(lead => [lead.id, lead]));
        for (const item of feed) {
          const lead = leads[item.leadId];
          item.leadLabel = lead?.username ? `@${lead.username}` : lead?.name || item.username || "";
        }
        return json({ stats, feed, totalLeads, setup: setup(), token: tokenStatus(await getTokenInfo()) });
      }
      case "leads":
        return json({ leads: await listLeads(500) });
      case "conversation": {
        const id = url.searchParams.get("id");
        const [lead, messages] = await Promise.all([getLead(id), getMessages(id, 200)]);
        if (!lead) return json({ error: "Lead não encontrado" }, 404);
        return json({ lead, messages });
      }
      case "comments":
        return json({ comments: await getComments(200) });
      case "config":
        return json({ config: await getConfig(), setup: { ...setup(), token: tokenStatus(await getTokenInfo()) } });
      case "instagram": {
        // Sincroniza o bloco "Conexão com o Instagram".
        const token = await accessToken();
        const info = await getTokenInfo();
        const envToken = String(process.env.IG_ACCESS_TOKEN || "").trim();
        const usingStored = Boolean(info?.token && info.baseToken === envToken && token === info.token);
        const result = {
          token: tokenStatus(usingStored ? info : null),
          tokenSource: usingStored ? (info.source === "painel" ? "painel" : "renovado automaticamente") : "variável IG_ACCESS_TOKEN (Vercel)",
          expectedUserId: String(process.env.IG_USER_ID || "") || null
        };
        try {
          result.account = await getAccountProfile(token);
        } catch (error) {
          result.accountError = error.message;
        }
        try {
          result.webhookFields = await getSubscribedFields(token);
        } catch (error) {
          result.webhookError = error.message;
        }
        return json(result);
      }
      case "audit":
        return json(await runAudit({ autoFix: url.searchParams.get("fix") !== "0" }));
      case "dry-run": {
        // Aplica as regras aos comentários dos últimos 5 posts, sem enviar nada.
        const config = await getConfig();
        const token = await accessToken();
        const posts = await getRecentMedia(token, 5);
        const result = [];
        for (const post of posts) {
          const comments = await getMediaComments(token, post.id, 30);
          const items = [];
          for (const comment of comments) {
            const lead = { username: comment.username || comment.from?.username || "" };
            items.push({ id: comment.id, username: lead.username, text: comment.text, ...(await planCommentReplies({ ...config, comments: { ...config.comments, useAI: false } }, comment.text, lead)) });
          }
          result.push({ id: post.id, caption: String(post.caption || "").slice(0, 120), permalink: post.permalink, timestamp: post.timestamp, comments: items });
        }
        return json({ posts: result });
      }
      case "export": {
        const leads = await listLeads(5000);
        const header = ["usuario", "nome", "origem", "status", "telefone", "email", "primeiro_contato", "ultimo_contato", "mensagens_recebidas", "comentarios", "observacoes"];
        const rows = leads.map(lead =>
          [
            lead.username ? `@${lead.username}` : lead.id,
            lead.name,
            lead.source,
            lead.status,
            lead.phone,
            lead.email,
            new Date(lead.firstAt).toISOString(),
            new Date(lead.lastAt).toISOString(),
            lead.messagesIn,
            lead.comments,
            lead.notes
          ]
            .map(csvCell)
            .join(",")
        );
        return new Response(`﻿${[header.join(","), ...rows].join("\n")}`, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="leads-instagram.csv"`,
            "Cache-Control": "no-store"
          }
        });
      }
      default:
        return json({ error: "Rota inválida" }, 404);
    }
  } catch (error) {
    console.error("[ADMIN]", error.message);
    return json({ error: error.message }, 500);
  }
}

export async function POST(request) {
  const url = new URL(request.url);
  const route = url.searchParams.get("r");
  const body = await request.json().catch(() => ({}));

  if (route === "login") {
    if (!passwordConfigured()) {
      return json({ error: "Cadastre a variável DASHBOARD_PASSWORD (mínimo 6 caracteres) na Vercel." }, 503);
    }
    if (!checkPassword(body.password)) {
      await new Promise(resolve => setTimeout(resolve, 800)); // freia tentativa e erro
      return json({ error: "Senha incorreta" }, 401);
    }
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie() });
  }
  if (route === "logout") return json({ ok: true }, 200, { "Set-Cookie": clearCookie() });

  if (!isAuthenticated(request)) return json({ error: "Não autenticado" }, 401);
  if (!hasStore()) return json({ error: "Banco de dados não conectado" }, 503);

  try {
    switch (route) {
      case "config":
        return json({ config: await saveConfig(body.config || {}) });
      case "refresh-token":
        return json({ ok: true, token: tokenStatus(await refreshToken()) });
      case "instagram-token": {
        // Troca o token pelo painel (sem mexer na Vercel). Valida antes de salvar.
        const token = String(body.token || "").trim();
        if (!/^IG[A-Za-z0-9_-]{40,}$/.test(token)) return json({ error: "Token inválido: precisa começar com IG (ex.: IGAA...)" }, 400);
        let me;
        try {
          me = await getMe(token);
        } catch (error) {
          return json({ error: `A Meta recusou o token: ${error.message}` }, 400);
        }
        const expected = String(process.env.IG_USER_ID || "").trim();
        if (expected && String(me.user_id) !== expected) {
          return json({ error: `Este token é da conta @${me.username} (${me.user_id}), mas o agente está travado na conta ${expected} (IG_USER_ID).` }, 400);
        }
        let expiresIn = 60 * 86400;
        let saved = token;
        try {
          const refreshed = await refreshAccessToken(token); // já garante 60 dias, quando possível
          saved = refreshed.access_token;
          expiresIn = refreshed.expires_in || expiresIn;
        } catch {
          // token com menos de 24h não pode ser renovado ainda: salva como veio
        }
        const info = await saveRefreshedToken(saved, expiresIn, "painel");
        return json({ ok: true, username: me.username, token: tokenStatus(info) });
      }
      case "subscribe-webhook": {
        const token = await accessToken();
        const current = await getSubscribedFields(token).catch(() => []);
        await subscribeFields(token, [...new Set([...current, ...WEBHOOK_FIELDS])]);
        return json({ ok: true, webhookFields: await getSubscribedFields(token) });
      }
      case "sync-leads": {
        // Atualiza nome/@/foto dos leads mais recentes (fotos do Instagram vencem).
        const token = await accessToken();
        const leads = (await listLeads(40)).filter(lead => /^\d+$/.test(String(lead.id)));
        let updated = 0;
        for (const lead of leads) {
          const profile = await getProfile(token, lead.id);
          if (profile?.username || profile?.name) {
            await updateLead(lead.id, {
              username: profile.username || lead.username,
              name: profile.name || lead.name,
              profilePic: profile.profile_pic || lead.profilePic
            });
            updated += 1;
          }
        }
        return json({ ok: true, checked: leads.length, updated });
      }
      case "delete-lead":
        return json({ ok: true, ...(await deleteLeadData(String(body.id || ""))) });
      case "simulate-comment": {
        // Mostra o que o agente responderia a um comentário, sem enviar.
        const config = await getConfig();
        const lead = { username: String(body.username || "cliente.teste"), name: String(body.name || "") };
        return json(await planCommentReplies(config, String(body.text || ""), lead));
      }
      case "simulate-dm": {
        // Conversa de teste com a IA (usa produtos e instruções), sem enviar.
        const config = await getConfig();
        const turns = (Array.isArray(body.messages) ? body.messages : [])
          .slice(-20)
          .map(item => ({ role: item.role === "assistant" ? "assistant" : "user", text: String(item.text || "").slice(0, 2000) }));
        const raw = await generateReply(turns, process.env, aiOverrides(config));
        const escalation = Boolean(config.escalation.enabled) && raw.includes(ESCALATION_MARKER);
        return json({ reply: raw.split(ESCALATION_MARKER).join("").trim(), escalation });
      }
      case "extract-url":
        return json({ product: await extractProductFromUrl(body.url) });
      case "test-whatsapp": {
        const config = await getConfig();
        await sendWhatsApp(config.escalation, "✅ Teste do painel Confianza: o aviso de escalação do Instagram está funcionando.");
        return json({ ok: true });
      }
      case "lead": {
        const lead = await updateLead(String(body.id || ""), body.patch || {});
        return lead ? json({ lead }) : json({ error: "Lead não encontrado" }, 404);
      }
      case "send": {
        const id = String(body.id || "");
        const lead = await getLead(id);
        const text = fillTemplate(String(body.text || ""), lead);
        if (!lead || !text) return json({ error: "Lead ou texto inválido" }, 400);
        await sendAndLog({ leadId: id, text, by: "equipe" });
        const config = await getConfig();
        const updated = config.agent.pauseWhenTeamReplies ? await updateLead(id, { aiPaused: true }) : lead;
        return json({ ok: true, lead: updated });
      }
      default:
        return json({ error: "Rota inválida" }, 404);
    }
  } catch (error) {
    console.error("[ADMIN]", error.message);
    return json({ error: error.message }, 500);
  }
}
