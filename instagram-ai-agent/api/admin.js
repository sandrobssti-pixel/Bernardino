// API do painel. Uma função só (limite de funções do plano gratuito):
// a rota vem em ?r=...  Tudo exige login, menos r=login/r=session.

import { fillTemplate, sendAndLog } from "../lib/agent.js";
import { checkPassword, clearCookie, isAuthenticated, passwordConfigured, sessionCookie } from "../lib/auth.js";
import { resolveProvider } from "../lib/ai.js";
import { refreshAccessToken } from "../lib/instagram.js";
import {
  accessToken,
  countLeads,
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
  info ? { refreshedAt: info.refreshedAt, expiresAt: info.expiresAt } : null;

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
        return json({ stats, feed, totalLeads, setup: setup() });
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
