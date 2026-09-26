// Auditoria técnica do painel: confere cada peça da instalação com testes
// reais e corrige sozinho o que dá (token perto de vencer, campos do webhook).

import { generateReply, resolveProvider } from "./ai.js";
import { getMe, getSubscribedFields, refreshAccessToken, subscribeFields } from "./instagram.js";
import { accessToken, getConfig, getTokenInfo, hasStore, pipeline, saveRefreshedToken } from "./store.js";
import { evolutionConfigured, evolutionStatus } from "./whatsapp.js";

const REQUIRED_FIELDS = ["messages", "comments"];
const DAY = 86400000;

export const tokenDaysLeft = info => (info?.expiresAt ? Math.floor((info.expiresAt - Date.now()) / DAY) : null);

export const runAudit = async ({ autoFix = true } = {}) => {
  const checks = [];
  const add = (name, status, detail, fixed) => checks.push({ name, status, detail, ...(fixed ? { fixed } : {}) });
  const env = process.env;

  // 1. Variáveis
  const missing = [
    ["IG_ACCESS_TOKEN", env.IG_ACCESS_TOKEN],
    ["VERIFY_TOKEN", env.VERIFY_TOKEN],
    ["ANTHROPIC_API_KEY ou OPENAI_API_KEY", resolveProvider(env)],
    ["DASHBOARD_PASSWORD", env.DASHBOARD_PASSWORD]
  ].filter(([, value]) => !String(value || "").trim()).map(([name]) => name);
  add("Variáveis obrigatórias", missing.length ? "fail" : "ok", missing.length ? `Faltam: ${missing.join(", ")}` : "Todas cadastradas");

  // 2. Banco
  let config = null;
  try {
    if (!hasStore()) throw new Error("Upstash Redis não conectado ao projeto");
    await pipeline([["PING"]]);
    config = await getConfig();
    add("Banco de dados", "ok", "Upstash Redis respondendo");
  } catch (error) {
    add("Banco de dados", "fail", error.message);
  }

  // 3–4. Token e conta
  let token = await accessToken();
  let me = null;
  try {
    me = await getMe(token);
    add("Token do Instagram", "ok", `Válido para @${me.username} (${me.account_type || "conta profissional"})`);
    const expected = String(env.IG_USER_ID || "").trim();
    if (expected) {
      add("ID da conta (IG_USER_ID)", String(me.user_id) === expected ? "ok" : "fail", String(me.user_id) === expected ? `Confere: ${expected}` : `Token é da conta ${me.user_id}, esperado ${expected}`);
    } else {
      add("ID da conta", "ok", `ID ${me.user_id} (defina IG_USER_ID para travar a conta)`);
    }
  } catch (error) {
    add("Token do Instagram", "fail", `${error.message} — gere outro token na Meta e troque IG_ACCESS_TOKEN`);
  }

  // 5. Validade do token (renova sozinho se faltar pouco)
  if (hasStore()) {
    let info = await getTokenInfo();
    let days = tokenDaysLeft(info);
    let fixed = "";
    if (autoFix && me && (days === null || days < 15)) {
      try {
        const data = await refreshAccessToken(token);
        info = await saveRefreshedToken(data.access_token, data.expires_in);
        token = data.access_token;
        days = tokenDaysLeft(info);
        fixed = "Token renovado agora";
      } catch (error) {
        fixed = `Tentou renovar: ${error.message}`;
      }
    }
    add(
      "Validade do token",
      days === null ? "warn" : days < 5 ? "fail" : days < 15 ? "warn" : "ok",
      days === null ? "Sem data de vencimento conhecida" : `${days} dias restantes (renovação automática toda segunda)`,
      fixed
    );
  }

  // 6. Campos do webhook (assina sozinho os que faltarem)
  if (me) {
    try {
      let fields = await getSubscribedFields(token);
      let missingFields = REQUIRED_FIELDS.filter(field => !fields.includes(field));
      let fixed = "";
      if (autoFix && missingFields.length) {
        try {
          await subscribeFields(token, [...new Set([...fields, ...REQUIRED_FIELDS])]);
          fields = await getSubscribedFields(token);
          missingFields = REQUIRED_FIELDS.filter(field => !fields.includes(field));
          fixed = missingFields.length ? "" : "Campos assinados agora";
        } catch (error) {
          fixed = `Tentou assinar: ${error.message}`;
        }
      }
      add("Webhook: campos assinados", missingFields.length ? "fail" : "ok", missingFields.length ? `Faltam: ${missingFields.join(", ")} (assine na Meta → Webhooks)` : fields.join(", "), fixed);
    } catch (error) {
      add("Webhook: campos assinados", "warn", `Não foi possível conferir: ${error.message}`);
    }
  }

  // 7. IA
  try {
    const answer = await generateReply([{ role: "user", text: "Teste técnico: responda apenas OK." }], env, {
      model: config?.agent?.model,
      fallbackModel: config?.agent?.fallbackModel,
      extra: "Isto é um teste técnico. Responda apenas: OK"
    });
    add("IA respondendo", answer ? "ok" : "fail", answer ? `${resolveProvider(env)} · ${config?.agent?.model || env.AI_MODEL || "modelo padrão"}` : "Resposta vazia");
  } catch (error) {
    add("IA respondendo", "fail", error.message);
  }
  add("Modelo reserva", config?.agent?.fallbackModel || env.AI_MODEL_FALLBACK ? "ok" : "warn", config?.agent?.fallbackModel || env.AI_MODEL_FALLBACK || "Não configurado (opcional)");

  // 8. Base de produtos
  const products = (config?.products || []).filter(product => String(product?.name || "").trim());
  add("Base de produtos", products.length ? "ok" : "warn", products.length ? `${products.length} produto(s) cadastrado(s)` : "Nenhum produto: a IA não vai citar produtos nem links");

  // 9. Escalação
  if (config?.escalation?.enabled) {
    if (!evolutionConfigured(config.escalation)) {
      add("Escalação (WhatsApp)", "fail", "Preencha URL, instância e número no painel e cadastre EVOLUTION_API_KEY");
    } else {
      try {
        const state = await evolutionStatus(config.escalation);
        add("Escalação (WhatsApp)", state === "open" ? "ok" : "warn", `Instância ${config.escalation.evolutionInstance}: ${state}`);
      } catch (error) {
        add("Escalação (WhatsApp)", "fail", error.message);
      }
    }
  } else {
    add("Escalação (WhatsApp)", "warn", "Desligada");
  }

  // 10. Segurança
  add("Assinatura da Meta (IG_APP_SECRET)", env.IG_APP_SECRET ? "ok" : "warn", env.IG_APP_SECRET ? "Eventos conferidos" : "Recomendado cadastrar");
  add("Proteção do cron (CRON_SECRET)", env.CRON_SECRET ? "ok" : "warn", env.CRON_SECRET ? "Configurado" : "Sem ele a renovação semanal não roda — use o botão ou cadastre");

  return {
    at: Date.now(),
    checks,
    summary: {
      ok: checks.filter(check => check.status === "ok").length,
      warn: checks.filter(check => check.status === "warn").length,
      fail: checks.filter(check => check.status === "fail").length
    }
  };
};
