// Regras do agente: DMs (leads, boas-vindas, IA, pausa quando a equipe
// responde) e comentários (resposta pública + resposta privada no Direct).

import { ESCALATION_MARKER, generateReply } from "./ai.js";
import { evolutionConfigured, sendWhatsApp } from "./whatsapp.js";
import {
  getConversationHistory,
  getProfile,
  replyToComment,
  sendPrivateReply,
  sendText,
  sendTyping
} from "./instagram.js";
import {
  accessToken,
  bumpLeadCounter,
  extractContacts,
  getConfig,
  getLead,
  getMessages,
  hasStore,
  incrStat,
  logComment,
  logFeed,
  logMessage,
  markSeen,
  markSent,
  updateLead,
  upsertLead,
  wasSentByAgent
} from "./store.js";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export const settings = () => ({
  historyLimit: Number(process.env.HISTORY_LIMIT) || 12,
  burstWaitMs: process.env.BURST_WAIT_MS !== undefined ? Number(process.env.BURST_WAIT_MS) : 4000,
  envEnabled: String(process.env.AGENT_ENABLED || "true").toLowerCase() !== "false"
});

const firstName = lead => {
  const name = String(lead?.name || "").trim();
  if (name) return name.split(/\s+/)[0];
  return lead?.username ? `@${lead.username}` : "";
};

export const fillTemplate = (text, lead, vars = {}) =>
  String(text || "")
    .replace(/\{link\}/gi, vars.link || "")
    .replace(/\{nome\}/gi, firstName(lead))
    .replace(/\{usuario\}/gi, lead?.username ? `@${lead.username}` : "")
    .replace(/\s+([,!?.])/g, "$1")
    .replace(/,\s*!/g, "!")
    .trim();

const normalize = text =>
  String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Envia texto no Direct, marca como enviado pelo agente (para o eco não
// virar "resposta da equipe") e registra no histórico.
export const sendAndLog = async ({ leadId, text, by }) => {
  const token = await accessToken();
  const results = await sendText(token, leadId, text);
  if (hasStore()) {
    for (const result of results) await markSent(result?.message_id);
    await logMessage({ leadId, direction: "out", text, by, mid: results[0]?.message_id });
  }
  return results;
};

// ---------------- DMs ----------------

export const isMetaSampleEvent = event =>
  event?.message?.mid === "random_mid" ||
  (String(event?.sender?.id) === "12334" && String(event?.recipient?.id) === "23245");

export const handleMessagingEvent = async event => {
  const { envEnabled } = settings();
  const token = await accessToken();
  const message = event?.message;
  const senderId = String(event?.sender?.id || "");
  const recipientId = String(event?.recipient?.id || "");
  const ownId = String(event?.ownId || "");

  if (!token || !message || message.is_deleted) return;

  // Evento de exemplo do botão "Testar" da Meta: só confirma que o webhook
  // chega, sem criar lead nem tentar responder a um id que não existe.
  if (isMetaSampleEvent(event)) {
    console.log("[WEBHOOK] evento de teste da Meta recebido");
    if (hasStore()) {
      await logFeed({
        kind: "test",
        direction: "in",
        by: "meta",
        text: `Teste da Meta recebido — o webhook está funcionando (${String(message.text || "").slice(0, 60)})`
      });
    }
    return;
  }

  if (!hasStore()) {
    // Sem banco: modo simples (só IA, histórico pela API do Instagram).
    if (message.is_echo || !senderId || senderId === ownId) return;
    if (!envEnabled) return;
    return replyWithAI({ leadId: senderId, message, useStoreHistory: false });
  }

  if (!(await markSeen(`m:${message.mid}`))) return; // reenvio da Meta

  // Eco: mensagem que saiu da conta. Se não foi o agente, foi alguém da
  // equipe respondendo pelo app do Instagram.
  if (message.is_echo) {
    if (await wasSentByAgent(message.mid)) return;
    const leadId = recipientId;
    if (!leadId || leadId === ownId) return;
    await upsertLead(leadId, {});
    await logMessage({
      leadId,
      direction: "out",
      by: "equipe",
      mid: message.mid,
      text: message.text || `[${message.attachments?.[0]?.type || "anexo"}]`
    });
    const config = await getConfig();
    if (config.agent.pauseWhenTeamReplies) await updateLead(leadId, { aiPaused: true });
    return;
  }

  if (!senderId || senderId === ownId) return;

  const text = String(message.text || "").trim();
  const attachment = message.attachments?.[0];

  let lead = await getLead(senderId);
  const profile = !lead || !lead.username ? await getProfile(token, senderId) : {};
  const contacts = extractContacts(text);
  const upserted = await upsertLead(senderId, {
    username: profile.username,
    name: profile.name,
    profilePic: profile.profile_pic,
    source: "dm",
    phone: contacts.phone,
    email: contacts.email
  });
  lead = upserted.lead;

  await logMessage({
    leadId: senderId,
    direction: "in",
    by: "cliente",
    mid: message.mid,
    text: text || `[${attachment?.type || "anexo"}]`,
    extra: attachment?.payload?.url ? { mediaUrl: attachment.payload.url, mediaType: attachment.type } : undefined
  });

  const config = await getConfig();

  if (upserted.isNew && config.welcome.enabled && config.welcome.text.trim()) {
    await sendAndLog({ leadId: senderId, text: fillTemplate(config.welcome.text, lead), by: "boas-vindas" });
  }

  if (!envEnabled || !config.agent.enabled || lead.aiPaused) return;

  return replyWithAI({ leadId: senderId, message, useStoreHistory: true, config });
};

const replyWithAI = async ({ leadId, message, useStoreHistory, config }) => {
  const { historyLimit, burstWaitMs } = settings();
  const token = await accessToken();
  const text = String(message.text || "").trim();
  const attachment = message.attachments?.[0];
  const imageUrl = attachment?.type === "image" ? attachment.payload?.url : undefined;
  const otherAttachment = attachment && !imageUrl ? attachment.type : undefined;
  if (!text && !imageUrl && !otherAttachment) return;

  // Espera para juntar mensagens seguidas: só a última da rajada responde.
  if (burstWaitMs > 0) await sleep(burstWaitMs);

  let turns = [];
  if (useStoreHistory) {
    const history = await getMessages(leadId, historyLimit + 5);
    const lastIn = [...history].reverse().find(item => item.direction === "in");
    if (lastIn && lastIn.id !== message.mid) return; // chegou mensagem mais nova

    const lead = await getLead(leadId);
    if (lead?.aiPaused) return; // equipe assumiu durante a espera

    turns = history
      .filter(item => item.id !== message.mid)
      .slice(-historyLimit)
      .map(item => ({ role: item.direction === "in" ? "user" : "assistant", text: item.text }));
  } else {
    let history = [];
    try {
      history = await getConversationHistory(token, leadId, historyLimit);
    } catch (error) {
      console.warn("[AGENT] sem histórico:", error.message);
    }
    const currentIndex = history.findIndex(item => item.id === message.mid);
    if (currentIndex >= 0) {
      if (history.slice(currentIndex + 1).some(item => item.fromId === leadId)) return;
      history.splice(currentIndex, 1);
    }
    turns = history.map(item => ({ role: item.fromId === leadId ? "user" : "assistant", text: item.text }));
  }

  const currentText =
    text ||
    (otherAttachment ? `[o cliente enviou um anexo do tipo "${otherAttachment}", que você não consegue abrir]` : "");
  const last = turns[turns.length - 1];
  if (last && last.role === "user" && last.text === currentText && !imageUrl) turns.pop();
  turns.push({ role: "user", text: currentText, imageUrl });

  const escalationOn = Boolean(config?.escalation?.enabled);

  // Pedido explícito de humano (palavra-chave): nem chama a IA.
  if (escalationOn && matchesKeywords(config.escalation.keywords, text) && config.escalation.message.trim()) {
    const lead = await getLead(leadId);
    await sendAndLog({ leadId, text: fillTemplate(config.escalation.message, lead), by: "escalacao" });
    await escalate({ leadId, config, reason: `palavra-chave: "${text.slice(0, 80)}"` });
    return;
  }

  await sendTyping(token, leadId, true);
  const raw = await generateReply(turns, process.env, aiOverrides(config));
  const wantsHuman = escalationOn && raw.includes(ESCALATION_MARKER);
  const reply = raw.split(ESCALATION_MARKER).join("").trim();
  if (!reply) {
    await sendTyping(token, leadId, false);
    if (wantsHuman) await escalate({ leadId, config, reason: "pedido identificado pela IA" });
    return;
  }

  await sendAndLog({ leadId, text: reply, by: wantsHuman ? "escalacao" : "ia" });
  if (wantsHuman) await escalate({ leadId, config, reason: "pedido identificado pela IA" });
  console.log(`[AGENT] respondeu ${leadId} (${reply.length} caracteres)${wantsHuman ? " + escalação" : ""}`);
};

export const aiOverrides = config => ({
  name: config?.agent?.name,
  prompt: config?.agent?.prompt,
  model: config?.agent?.model,
  fallbackModel: config?.agent?.fallbackModel,
  products: config?.products,
  escalation: Boolean(config?.escalation?.enabled)
});

export const matchesKeywords = (keywords, text) => {
  const normalized = normalize(text);
  return String(keywords || "")
    .split(",")
    .map(keyword => normalize(keyword).trim())
    .filter(Boolean)
    .some(keyword => normalized.includes(keyword));
};

// ---------------- Escalação para humano ----------------

const panelUrl = () => {
  const host = process.env.PANEL_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "";
  return host ? (host.startsWith("http") ? host : `https://${host}`) : "";
};

export const escalate = async ({ leadId, config, reason }) => {
  const lead = (await updateLead(leadId, { aiPaused: true, escalatedAt: Date.now() })) || { id: leadId };
  await incrStat("escalations");

  let notified = false;
  let error = "";
  if (evolutionConfigured(config.escalation)) {
    const recent = (await getMessages(leadId, 8))
      .map(item => `${item.direction === "in" ? "👤" : "🤖"} ${String(item.text).slice(0, 200)}`)
      .join("\n");
    const who = lead.username ? `@${lead.username}` : lead.name || leadId;
    const text = [
      "🔔 *Instagram: cliente pediu atendimento humano*",
      `Cliente: ${who}${lead.name && lead.username ? ` (${lead.name})` : ""}`,
      lead.phone ? `Telefone: ${lead.phone}` : "",
      lead.username ? `Responder: https://ig.me/m/${lead.username}` : "",
      panelUrl() ? `Painel: ${panelUrl()}` : "",
      "",
      "Últimas mensagens:",
      recent
    ]
      .filter(line => line !== null && line !== undefined)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n");
    try {
      await sendWhatsApp(config.escalation, text);
      notified = true;
    } catch (err) {
      error = err.message;
      console.error("[ESCALAÇÃO] WhatsApp falhou:", err.message);
    }
  } else {
    error = "Evolution API não configurada (aviso no WhatsApp não enviado)";
  }

  await logFeed({
    kind: "escalation",
    leadId,
    direction: "out",
    by: "escalacao",
    text: `Pediu atendimento humano (${reason}). ${notified ? "Aviso enviado no WhatsApp." : error}`
  });
  return { notified, error };
};

// ---------------- Comentários ----------------

export const pickCommentReplies = (config, commentText) => {
  const rule = (config.comments.rules || []).find(item => matchesKeywords(item?.keywords, commentText));
  return {
    rule: rule || null,
    publicReply: rule?.publicReply || config.comments.publicReply,
    privateReply: rule?.privateReply || config.comments.privateReply
  };
};

// Decide o que responder a um comentário, sem enviar nada.
export const planCommentReplies = async (config, text, lead) => {
  const { rule, publicReply, privateReply } = pickCommentReplies(config, text);
  const plan = { rule: rule?.keywords || "", publicText: "", privateText: "", skipped: "", errors: [] };

  if (!config.comments.enabled) {
    plan.skipped = "respostas a comentários desligadas";
    return plan;
  }
  if (config.comments.onlyKeywords && !rule) {
    plan.skipped = "nenhuma palavra-chave encontrada";
    return plan;
  }

  const vars = { link: rule?.link || "" };
  if (config.comments.publicReplyEnabled) {
    plan.publicText = fillTemplate(publicReply, lead, vars);
    if (config.comments.useAI && !rule) {
      try {
        plan.publicText =
          (await generateReply([{ role: "user", text: `Comentário público no nosso post: "${text}"` }], process.env, {
            ...aiOverrides(config),
            escalation: false,
            extra:
              "Você está respondendo um COMENTÁRIO PÚBLICO em um post. Responda em 1 frase curta e simpática, sem passar preços nem dados pessoais; convide a pessoa para continuar no Direct."
          })) || plan.publicText;
      } catch (error) {
        plan.errors.push(`IA: ${error.message}`);
      }
    }
  }
  if (config.comments.privateReplyEnabled) plan.privateText = fillTemplate(privateReply, lead, vars);
  return plan;
};

export const handleCommentChange = async (value, ownId) => {
  const { envEnabled } = settings();
  const token = await accessToken();
  const commentId = String(value?.id || "");
  const fromId = String(value?.from?.id || "");
  if (!token || !commentId || !fromId || fromId === ownId) return; // ignora a própria conta
  if (!hasStore()) return;
  if (!(await markSeen(`c:${commentId}`))) return;

  const text = String(value?.text || "").trim();
  const { lead, isNew } = await upsertLead(fromId, {
    username: value?.from?.username,
    source: "comentario"
  });
  await bumpLeadCounter(fromId, "comments");

  const record = {
    id: commentId,
    leadId: fromId,
    username: value?.from?.username || lead.username || "",
    text,
    mediaId: value?.media?.id || "",
    parentId: value?.parent_id || "",
    at: Date.now(),
    newLead: isNew,
    publicReply: null,
    privateReply: null,
    errors: []
  };

  const config = await getConfig();
  if (envEnabled) {
    const plan = await planCommentReplies(config, text, lead);
    record.rule = plan.rule;
    record.skipped = plan.skipped;
    record.errors.push(...plan.errors);

    if (plan.publicText) {
      try {
        await replyToComment(token, commentId, plan.publicText);
        record.publicReply = plan.publicText;
      } catch (error) {
        record.errors.push(`Resposta pública: ${error.message}`);
      }
    }

    if (plan.privateText) {
      try {
        const result = await sendPrivateReply(token, commentId, plan.privateText);
        await markSent(result?.message_id);
        await logMessage({ leadId: fromId, direction: "out", by: "comentario", text: plan.privateText, mid: result?.message_id });
        record.privateReply = plan.privateText;
      } catch (error) {
        record.errors.push(`Direct: ${error.message}`);
      }
    }
  }

  await logComment(record);
};
