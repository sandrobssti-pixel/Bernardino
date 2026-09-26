import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.IG_ACCESS_TOKEN = "IGAA_TEST";
process.env.VERIFY_TOKEN = "segredo123";
process.env.ANTHROPIC_API_KEY = "sk-test";
process.env.AGENT_PROMPT = "Somos a Confianza.";
process.env.BURST_WAIT_MS = "0";
process.env.DASHBOARD_PASSWORD = "senha-forte";
process.env.KV_REST_API_URL = "https://redis.test";
process.env.KV_REST_API_TOKEN = "t";

const { GET, POST } = await import("../api/webhook.js");
const admin = await import("../api/admin.js");
const { handleMessagingEvent, handleCommentChange, pickCommentReplies } = await import("../lib/agent.js");
const { splitMessage } = await import("../lib/instagram.js");
const { DEFAULT_CONFIG } = await import("../lib/store.js");

// ---------- Redis falso (subconjunto usado pelo agente) ----------
let db;
const redis = cmd => {
  const [op, key, ...a] = cmd;
  const get = () => db.get(key);
  switch (op) {
    case "GET": return get() ?? null;
    case "SET":
      if (a.includes("NX") && db.has(key)) return null;
      db.set(key, String(a[0])); return "OK";
    case "PING": return "PONG";
    case "EXISTS": return db.has(key) ? 1 : 0;
    case "EXPIRE": return 1;
    case "MGET": return [key, ...a].map(k => db.get(k) ?? null);
    case "ZADD": { const z = get() || new Map(); z.set(String(a[1]), Number(a[0])); db.set(key, z); return 1; }
    case "ZCARD": return (get() || new Map()).size;
    case "ZREVRANGE": return [...(get() || new Map()).entries()].sort((x, y) => y[1] - x[1]).map(e => e[0]).slice(Number(a[0]), Number(a[1]) + 1);
    case "LPUSH": { const l = get() || []; l.unshift(String(a[0])); db.set(key, l); return l.length; }
    case "LTRIM": { const l = get() || []; db.set(key, l.slice(Number(a[0]), Number(a[1]) + 1)); return "OK"; }
    case "LRANGE": { const l = get() || []; const end = Number(a[1]) < 0 ? l.length + Number(a[1]) : Number(a[1]); return l.slice(Number(a[0]), end + 1); }
    case "RPUSH": { const l = get() || []; l.push(...a.map(String)); db.set(key, l); return l.length; }
    case "DEL": { const had = db.has(key); db.delete(key); return had ? 1 : 0; }
    case "ZREM": { const z = get(); if (z) z.delete(String(a[0])); return 1; }
    case "HINCRBY": { const h = get() || {}; h[a[0]] = (h[a[0]] || 0) + Number(a[1]); db.set(key, h); return h[a[0]]; }
    case "HGETALL": return Object.entries(get() || {}).flat().map(String);
    default: throw new Error(`comando não suportado no teste: ${op}`);
  }
};

let calls;
let aiText;
let aiFailModel;
let subscribed;
beforeEach(() => {
  db = new Map();
  calls = [];
  aiText = "Olá! Como posso ajudar?";
  aiFailModel = null;
  subscribed = ["messages"];
  delete process.env.IG_APP_SECRET;
  let seq = 0;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const body = init.body ? JSON.parse(init.body) : undefined;
    if (u.startsWith("https://redis.test/pipeline")) return Response.json(body.map(cmd => ({ result: redis(cmd) })));
    calls.push({ url: u, method: init.method || "GET", body, headers: init.headers });
    if (u.startsWith("https://evo.test/")) { calls.push({ url: u, method: init.method || "GET", body, headers: init.headers }); return u.includes("connectionState") ? Response.json({ instance: { state: "open" } }) : Response.json({ key: { id: "wa1" } }); }
    if (u.includes("/me/subscribed_apps")) {
      if ((init.method || "GET") === "POST") { subscribed = new URL(u).searchParams.get("subscribed_fields").split(","); return Response.json({ success: true }); }
      return Response.json({ data: [{ subscribed_fields: subscribed }] });
    }
    if (/v21\.0\/me\?fields=user_id/.test(u)) return Response.json({ user_id: "17841", username: "confianza", account_type: "BUSINESS" });
    if (u.includes("me/media?")) return Response.json({ data: [{ id: "post1", caption: "Lançamento", permalink: "https://instagram.com/p/1" }] });
    if (u.includes("post1/comments")) return Response.json({ data: [{ id: "k1", text: "quero o link", username: "ana" }, { id: "k2", text: "lindo", username: "bia" }] });
    if (u.includes("refresh_access_token")) return Response.json({ access_token: "IGAA_RENOVADO", expires_in: 5184000 });
    if (u.includes("api.anthropic.com")) {
      if (aiFailModel && body.model === aiFailModel) return Response.json({ error: { message: "overloaded" } }, { status: 529 });
      return Response.json({ content: [{ type: "text", text: aiText }] });
    }
    if (u.includes("/replies")) return Response.json({ id: "reply1" });
    if (u.includes("me/messages")) {
      // "digitando" não gera mensagem (como na API real)
      return Response.json(body?.message ? { recipient_id: "1", message_id: `out-${++seq}` } : { recipient_id: "1" });
    }
    if (/graph\.instagram\.com\/v21\.0\/cliente\?/.test(u)) return Response.json({ id: "cliente", username: "maria.silva", name: "Maria Silva" });
    return new Response("{}", { status: 404 });
  };
});

const sentTexts = () => calls.filter(c => c.url.includes("me/messages") && c.body?.message).map(c => c.body.message.text);
const aiCalls = () => calls.filter(c => c.url.includes("anthropic"));
const saveConfig = cfg => db.set("config", JSON.stringify(cfg));

test("verificação da Meta: token certo devolve o challenge", async () => {
  const ok = await GET(new Request("https://x/api/webhook?hub.mode=subscribe&hub.verify_token=segredo123&hub.challenge=abc"));
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), "abc");
  const bad = await GET(new Request("https://x/api/webhook?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=abc"));
  assert.equal(bad.status, 403);
});

test("status sem parâmetros não expõe segredos", async () => {
  const text = await (await GET(new Request("https://x/api/webhook"))).text();
  assert.ok(!text.includes("IGAA_TEST") && !text.includes("sk-test") && !text.includes("senha-forte"));
  const status = JSON.parse(text);
  assert.equal(status.aiProvider, "anthropic");
  assert.equal(status.hasDatabase, true);
});

test("primeira DM: cria lead com perfil, manda boas-vindas e resposta da IA, registra tudo", async () => {
  saveConfig({ ...DEFAULT_CONFIG, welcome: { enabled: true, text: "Oi, {nome}! Bem-vindo." } });
  await handleMessagingEvent({ sender: { id: "cliente" }, recipient: { id: "loja" }, ownId: "loja", message: { mid: "m1", text: "quanto custa? meu zap 45 99999-8888" } });

  assert.deepEqual(sentTexts(), ["Oi, Maria! Bem-vindo.", "Olá! Como posso ajudar?"]);
  const lead = JSON.parse(db.get("lead:cliente"));
  assert.equal(lead.username, "maria.silva");
  assert.equal(lead.source, "dm");
  assert.match(lead.phone, /99999-8888/);
  assert.equal(lead.messagesIn, 1);
  assert.equal(lead.messagesOut, 2);
  const msgs = db.get("msgs:cliente").map(JSON.parse).reverse();
  assert.deepEqual(msgs.map(m => m.by), ["cliente", "boas-vindas", "ia"]);
  const stats = [...db.entries()].find(([k]) => k.startsWith("stats:"))[1];
  assert.deepEqual({ in: stats.in, out: stats.out, leads: stats.leads, ai: stats.ai }, { in: 1, out: 2, leads: 1, ai: 1 });
  assert.match(aiCalls()[0].body.system, /Somos a Confianza/);
});

test("boas-vindas só na primeira mensagem; histórico vai para a IA", async () => {
  saveConfig({ ...DEFAULT_CONFIG, welcome: { enabled: true, text: "Bem-vindo!" } });
  await handleMessagingEvent({ sender: { id: "cliente" }, ownId: "loja", message: { mid: "m1", text: "oi" } });
  calls = [];
  await handleMessagingEvent({ sender: { id: "cliente" }, ownId: "loja", message: { mid: "m2", text: "e o horário?" } });
  assert.deepEqual(sentTexts(), ["Olá! Como posso ajudar?"]);
  assert.deepEqual(aiCalls()[0].body.messages.map(m => [m.role, m.content]), [
    ["user", "oi"],
    ["assistant", "Bem-vindo!\nOlá! Como posso ajudar?"],
    ["user", "e o horário?"]
  ]);
});

test("reenvio da Meta (mesmo mid) é ignorado", async () => {
  const event = { sender: { id: "cliente" }, ownId: "loja", message: { mid: "dup", text: "oi" } };
  await handleMessagingEvent(event);
  await handleMessagingEvent(event);
  assert.equal(aiCalls().length, 1);
});

test("eco do próprio agente é ignorado; resposta da equipe pelo app pausa a IA", async () => {
  await handleMessagingEvent({ sender: { id: "cliente" }, ownId: "loja", message: { mid: "m1", text: "oi" } });
  // eco da resposta da IA (out-1 foi marcado como enviado pelo agente)
  await handleMessagingEvent({ sender: { id: "loja" }, recipient: { id: "cliente" }, ownId: "loja", message: { mid: "out-1", text: "Olá!", is_echo: true } });
  assert.equal(JSON.parse(db.get("lead:cliente")).aiPaused, false);
  // equipe responde pelo app
  await handleMessagingEvent({ sender: { id: "loja" }, recipient: { id: "cliente" }, ownId: "loja", message: { mid: "humano1", text: "Oi, sou o Sandro", is_echo: true } });
  assert.equal(JSON.parse(db.get("lead:cliente")).aiPaused, true);
  calls = [];
  await handleMessagingEvent({ sender: { id: "cliente" }, ownId: "loja", message: { mid: "m2", text: "beleza" } });
  assert.equal(aiCalls().length, 0);
});

test("rajada: mensagem antiga não responde se já chegou outra", async () => {
  process.env.BURST_WAIT_MS = "30";
  const first = handleMessagingEvent({ sender: { id: "cliente" }, ownId: "loja", message: { mid: "r1", text: "oi" } });
  await new Promise(r => setTimeout(r, 5));
  const second = handleMessagingEvent({ sender: { id: "cliente" }, ownId: "loja", message: { mid: "r2", text: "tudo bem?" } });
  await Promise.all([first, second]);
  process.env.BURST_WAIT_MS = "0";
  assert.equal(aiCalls().length, 1);
});

test("comentário: resposta pública + Direct, regra por palavra-chave, vira lead", async () => {
  saveConfig({
    ...DEFAULT_CONFIG,
    comments: { ...DEFAULT_CONFIG.comments, enabled: true, rules: [{ keywords: "preço, valor", publicReply: "Te mandei no Direct, {nome}!", privateReply: "Os valores são..." }] }
  });
  await handleCommentChange({ id: "c1", text: "Qual o PREÇO?", from: { id: "fulano", username: "fulano" }, media: { id: "post1" } }, "loja");

  const pub = calls.find(c => c.url.includes("c1/replies"));
  assert.equal(new URL(pub.url).searchParams.get("message"), "Te mandei no Direct, @fulano!");
  const dm = calls.find(c => c.body?.recipient?.comment_id === "c1");
  assert.equal(dm.body.message.text, "Os valores são...");
  const lead = JSON.parse(db.get("lead:fulano"));
  assert.equal(lead.source, "comentario");
  assert.equal(lead.comments, 1);
  const comment = JSON.parse(db.get("comments")[0]);
  assert.equal(comment.rule, "preço, valor");
});

test("comentário da própria conta e comentários com resposta desligada", async () => {
  await handleCommentChange({ id: "c2", text: "obrigado!", from: { id: "loja" } }, "loja");
  assert.equal(db.get("comments"), undefined);
  await handleCommentChange({ id: "c3", text: "lindo", from: { id: "x", username: "x" } }, "loja");
  assert.equal(calls.filter(c => c.method === "POST").length, 0); // desligado por padrão
  assert.equal(db.get("comments").length, 1);
});

test("regra ignora acento e maiúscula", () => {
  const cfg = { comments: { ...DEFAULT_CONFIG.comments, rules: [{ keywords: "preco", publicReply: "R" }] } };
  assert.equal(pickCommentReplies(cfg, "Qual o PREÇO?").publicReply, "R");
  assert.equal(pickCommentReplies(cfg, "lindo").rule, null);
});

test("POST com assinatura inválida é recusado; válida é aceita", async () => {
  process.env.IG_APP_SECRET = "app-secret";
  const body = JSON.stringify({ object: "instagram", entry: [] });
  const bad = await POST(new Request("https://x/api/webhook", { method: "POST", body, headers: { "x-hub-signature-256": "sha256=00" } }));
  assert.equal(bad.status, 401);
  const sig = "sha256=" + crypto.createHmac("sha256", "app-secret").update(body).digest("hex");
  const ok = await POST(new Request("https://x/api/webhook", { method: "POST", body, headers: { "x-hub-signature-256": sig } }));
  assert.equal(ok.status, 200);
});

test("painel: exige login, senha errada recusa, cookie dá acesso", async () => {
  const noAuth = await admin.GET(new Request("https://x/api/admin?r=overview"));
  assert.equal(noAuth.status, 401);
  const wrong = await admin.POST(new Request("https://x/api/admin?r=login", { method: "POST", body: JSON.stringify({ password: "x" }) }));
  assert.equal(wrong.status, 401);
  const login = await admin.POST(new Request("https://x/api/admin?r=login", { method: "POST", body: JSON.stringify({ password: "senha-forte" }) }));
  const cookie = login.headers.get("set-cookie").split(";")[0];
  assert.match(login.headers.get("set-cookie"), /HttpOnly; Secure; SameSite=Strict/);

  await handleMessagingEvent({ sender: { id: "cliente" }, ownId: "loja", message: { mid: "m1", text: "oi" } });
  const overview = await admin.GET(new Request("https://x/api/admin?r=overview", { headers: { cookie } }));
  assert.equal(overview.status, 200);
  const data = await overview.json();
  assert.equal(data.totalLeads, 1);
  assert.equal(data.stats.length, 14);
  assert.ok(data.feed.length >= 2);

  const forged = await admin.GET(new Request("https://x/api/admin?r=leads", { headers: { cookie: `ia_session=${Date.now() + 99999}.forjado` } }));
  assert.equal(forged.status, 401);

  const cfg = await admin.POST(new Request("https://x/api/admin?r=config", { method: "POST", headers: { cookie }, body: JSON.stringify({ config: { welcome: { enabled: true, text: "Oi!" } } }) }));
  const saved = (await cfg.json()).config;
  assert.equal(saved.welcome.text, "Oi!");
  assert.equal(saved.agent.enabled, true); // mantém os padrões

  calls = [];
  const send = await admin.POST(new Request("https://x/api/admin?r=send", { method: "POST", headers: { cookie }, body: JSON.stringify({ id: "cliente", text: "Oi, aqui é a equipe" }) }));
  assert.equal(send.status, 200);
  assert.deepEqual(sentTexts(), ["Oi, aqui é a equipe"]);
  assert.equal(JSON.parse(db.get("lead:cliente")).aiPaused, true);

  const csv = await admin.GET(new Request("https://x/api/admin?r=export", { headers: { cookie } }));
  assert.match(await csv.text(), /@maria\.silva/);
});

test("texto longo é quebrado em partes de até 1000 caracteres", () => {
  const parts = splitMessage("Frase de teste. ".repeat(200));
  assert.ok(parts.length > 1 && parts.every(p => p.length <= 1000));
});

test("renovação do token: cron com CRON_SECRET, token novo passa a valer, variável trocada vence", async () => {
  const { accessToken } = await import("../lib/store.js");
  const denied = await admin.GET(new Request("https://x/api/admin?r=refresh-token"));
  assert.equal(denied.status, 401);
  process.env.CRON_SECRET = "cron123";
  const ok = await admin.GET(new Request("https://x/api/admin?r=refresh-token", { headers: { authorization: "Bearer cron123" } }));
  assert.equal(ok.status, 200);
  assert.equal(await accessToken(), "IGAA_RENOVADO");
  process.env.IG_ACCESS_TOKEN = "IGAA_NOVO_NA_VERCEL";
  assert.equal(await accessToken(), "IGAA_NOVO_NA_VERCEL");
  process.env.IG_ACCESS_TOKEN = "IGAA_TEST";
  delete process.env.CRON_SECRET;
});

const login = async () => {
  const res = await admin.POST(new Request("https://x/api/admin?r=login", { method: "POST", body: JSON.stringify({ password: "senha-forte" }) }));
  return res.headers.get("set-cookie").split(";")[0];
};
const escalationConfig = extra => ({
  ...DEFAULT_CONFIG,
  escalation: { enabled: true, keywords: "humano, atendente", message: "Certo, {nome}! Vou chamar a equipe.", whatsappNumber: "+55 45 99999-0000", evolutionUrl: "https://evo.test", evolutionInstance: "confianza" },
  ...extra
});

test("escalação por palavra-chave: transição, IA pausada, aviso no WhatsApp com resumo", async () => {
  process.env.EVOLUTION_API_KEY = "evo-key";
  saveConfig(escalationConfig());
  await handleMessagingEvent({ sender: { id: "cliente" }, ownId: "loja", message: { mid: "e1", text: "quero falar com um HUMANO" } });
  assert.equal(aiCalls().length, 0);
  assert.deepEqual(sentTexts(), ["Certo, Maria! Vou chamar a equipe."]);
  const lead = JSON.parse(db.get("lead:cliente"));
  assert.equal(lead.aiPaused, true);
  assert.ok(lead.escalatedAt);
  const wa = calls.find(c => c.url.includes("evo.test/message/sendText/confianza"));
  assert.equal(wa.headers.apikey, "evo-key");
  assert.equal(wa.body.number, "5545999990000");
  assert.match(wa.body.text, /@maria\.silva/);
  assert.match(wa.body.text, /HUMANO/);
  const feed = db.get("feed").map(JSON.parse);
  assert.ok(feed.some(item => item.kind === "escalation" && /WhatsApp/.test(item.text)));
  const stats = [...db.entries()].find(([k]) => k.startsWith("stats:"))[1];
  assert.equal(stats.escalations, 1);
  delete process.env.EVOLUTION_API_KEY;
});

test("escalação pedida pela IA: marcador removido da resposta e escalação disparada", async () => {
  saveConfig(escalationConfig({ escalation: { ...escalationConfig().escalation, keywords: "" } }));
  aiText = "Claro! Já vou chamar alguém da equipe. [[HUMANO]]";
  await handleMessagingEvent({ sender: { id: "cliente" }, ownId: "loja", message: { mid: "e2", text: "prefiro conversar com uma pessoa" } });
  assert.deepEqual(sentTexts(), ["Claro! Já vou chamar alguém da equipe."]);
  assert.equal(JSON.parse(db.get("lead:cliente")).aiPaused, true);
  assert.match(aiCalls()[0].body.system, /\[\[HUMANO\]\]/);
});

test("base de produtos vai para a IA; sem produtos a IA é proibida de citar", async () => {
  saveConfig({ ...DEFAULT_CONFIG, products: [{ name: "Kit Câmeras 4K", url: "https://loja/kit", price: "R$ 1.990", description: "4 câmeras", bonus: "instalação grátis" }] });
  await handleMessagingEvent({ sender: { id: "cliente" }, ownId: "loja", message: { mid: "p1", text: "tem kit de câmeras?" } });
  const system = aiCalls()[0].body.system;
  assert.match(system, /Kit Câmeras 4K/);
  assert.match(system, /https:\/\/loja\/kit/);
  assert.match(system, /instalação grátis/);
  calls = [];
  saveConfig({ ...DEFAULT_CONFIG });
  await handleMessagingEvent({ sender: { id: "cliente" }, ownId: "loja", message: { mid: "p2", text: "e preço?" } });
  assert.match(aiCalls()[0].body.system, /Não há produtos cadastrados/);
});

test("modelo reserva entra quando o principal falha", async () => {
  saveConfig({ ...DEFAULT_CONFIG, agent: { ...DEFAULT_CONFIG.agent, model: "modelo-principal", fallbackModel: "modelo-reserva" } });
  aiFailModel = "modelo-principal";
  await handleMessagingEvent({ sender: { id: "cliente" }, ownId: "loja", message: { mid: "f1", text: "oi" } });
  assert.deepEqual(aiCalls().map(c => c.body.model), ["modelo-principal", "modelo-reserva"]);
  assert.deepEqual(sentTexts(), ["Olá! Como posso ajudar?"]);
});

test("comentário: só palavra-chave (padrão) e {link} da regra", async () => {
  saveConfig({
    ...DEFAULT_CONFIG,
    comments: { ...DEFAULT_CONFIG.comments, enabled: true, rules: [{ keywords: "quero, link", link: "https://loja/oferta", publicReply: "Enviei no Direct!", privateReply: "Aqui está: {link}" }] }
  });
  await handleCommentChange({ id: "c10", text: "que lindo", from: { id: "x1", username: "x1" } }, "loja");
  assert.equal(calls.filter(c => c.method === "POST").length, 0);
  assert.equal(JSON.parse(db.get("comments")[0]).skipped, "nenhuma palavra-chave encontrada");
  await handleCommentChange({ id: "c11", text: "QUERO", from: { id: "x2", username: "x2" } }, "loja");
  assert.equal(calls.find(c => c.body?.recipient?.comment_id === "c11").body.message.text, "Aqui está: https://loja/oferta");
});

test("painel: simular comentário, dry-run nos posts, simulador do Direct — nada é enviado", async () => {
  const cookie = await login();
  saveConfig({
    ...escalationConfig(),
    comments: { ...DEFAULT_CONFIG.comments, enabled: true, rules: [{ keywords: "link", link: "https://l", publicReply: "Te chamei, {nome}!", privateReply: "Link: {link}" }] }
  });
  const post = (r, body) => admin.POST(new Request(`https://x/api/admin?r=${r}`, { method: "POST", headers: { cookie }, body: JSON.stringify(body) }));

  const sim = await (await post("simulate-comment", { text: "manda o link", username: "joana" })).json();
  assert.deepEqual([sim.rule, sim.publicText, sim.privateText], ["link", "Te chamei, @joana!", "Link: https://l"]);

  const dry = await (await admin.GET(new Request("https://x/api/admin?r=dry-run", { headers: { cookie } }))).json();
  assert.equal(dry.posts[0].comments.length, 2);
  assert.equal(dry.posts[0].comments.find(c => c.id === "k1").privateText, "Link: https://l");
  assert.equal(dry.posts[0].comments.find(c => c.id === "k2").skipped, "nenhuma palavra-chave encontrada");

  aiText = "Vou chamar a equipe! [[HUMANO]]";
  const dm = await (await post("simulate-dm", { messages: [{ role: "user", text: "quero um humano" }] })).json();
  assert.deepEqual(dm, { reply: "Vou chamar a equipe!", escalation: true });

  assert.equal(calls.filter(c => c.url.includes("me/messages") || c.url.includes("/replies")).length, 0);
});

test("auditoria: testa as peças e corrige token e campos do webhook", async () => {
  process.env.EVOLUTION_API_KEY = "evo-key";
  process.env.IG_USER_ID = "17841";
  saveConfig(escalationConfig({ products: [{ name: "Kit" }] }));
  const cookie = await login();
  const res = await (await admin.GET(new Request("https://x/api/admin?r=audit", { headers: { cookie } }))).json();
  const byName = Object.fromEntries(res.checks.map(c => [c.name, c]));
  assert.equal(byName["Banco de dados"].status, "ok");
  assert.equal(byName["Token do Instagram"].status, "ok");
  assert.equal(byName["ID da conta (IG_USER_ID)"].status, "ok");
  assert.equal(byName["Validade do token"].fixed, "Token renovado agora");
  assert.equal(byName["Webhook: campos assinados"].status, "ok");
  assert.equal(byName["Webhook: campos assinados"].fixed, "Campos assinados agora");
  assert.equal(byName["IA respondendo"].status, "ok");
  assert.equal(byName["Base de produtos"].status, "ok");
  assert.equal(byName["Escalação (WhatsApp)"].status, "ok");
  assert.ok(!JSON.stringify(res).includes("evo-key") && !JSON.stringify(res).includes("IGAA_TEST"));
  delete process.env.EVOLUTION_API_KEY;
  delete process.env.IG_USER_ID;
});

test("botão Testar da Meta (formato changes): aparece na movimentação, sem lead e sem resposta", async () => {
  const body = JSON.stringify({ object: "instagram", entry: [{ id: "0", time: 1, changes: [{ field: "messages", value: { sender: { id: "12334" }, recipient: { id: "23245" }, timestamp: "1527459824", message: { mid: "random_mid", text: "random_text" } } }] }] });
  const res = await POST(new Request("https://x/api/webhook", { method: "POST", body }));
  assert.equal(res.status, 200);
  await new Promise(r => setTimeout(r, 50));
  const feed = (db.get("feed") || []).map(JSON.parse);
  assert.equal(feed[0].kind, "test");
  assert.equal(db.get("lead:12334"), undefined);
  assert.equal(calls.length, 0);
});

test("DM real no formato changes também é processada", async () => {
  const body = JSON.stringify({ object: "instagram", entry: [{ id: "loja", time: 1, changes: [{ field: "messages", value: { sender: { id: "cliente" }, recipient: { id: "loja" }, timestamp: "1", message: { mid: "ch1", text: "oi" } } }] }] });
  await POST(new Request("https://x/api/webhook", { method: "POST", body }));
  await new Promise(r => setTimeout(r, 50));
  assert.equal(aiCalls().length, 1);
  assert.ok(db.get("lead:cliente"));
});

test("exclusão de dados: apaga lead, conversa, eventos e comentários só daquele cliente", async () => {
  saveConfig({ ...DEFAULT_CONFIG, comments: { ...DEFAULT_CONFIG.comments, enabled: true, onlyKeywords: false } });
  await handleMessagingEvent({ sender: { id: "cliente" }, ownId: "loja", message: { mid: "d1", text: "oi" } });
  await handleCommentChange({ id: "cc1", text: "top", from: { id: "cliente", username: "maria.silva" } }, "loja");
  await handleCommentChange({ id: "cc2", text: "legal", from: { id: "outro", username: "outro" } }, "loja");
  const cookie = await login();
  const res = await admin.POST(new Request("https://x/api/admin?r=delete-lead", { method: "POST", headers: { cookie }, body: JSON.stringify({ id: "cliente" }) }));
  const out = await res.json();
  assert.equal(out.deleted, true);
  assert.equal(db.get("lead:cliente"), undefined);
  assert.equal(db.get("msgs:cliente"), undefined);
  assert.ok(!db.get("leads").has("cliente"));
  assert.ok((db.get("feed") || []).map(JSON.parse).every(item => item.leadId !== "cliente"));
  const comments = db.get("comments").map(JSON.parse);
  assert.deepEqual(comments.map(c => c.id), ["cc2"]);
  assert.ok(db.get("lead:outro"));
});

test("pedido de exclusão pelo Direct (PT e ES): confirma, pausa a IA e registra", async () => {
  await handleMessagingEvent({ sender: { id: "cliente" }, ownId: "loja", message: { mid: "x1", text: "Oi, quero excluir meus dados" } });
  assert.equal(aiCalls().length, 0);
  assert.match(sentTexts()[0], /Recebemos seu pedido de exclusão/);
  const lead = JSON.parse(db.get("lead:cliente"));
  assert.equal(lead.aiPaused, true);
  assert.match(lead.notes, /exclusão de dados/);
  assert.equal(db.get("feed").map(JSON.parse)[0].kind, "deletion");
  calls = [];
  await handleMessagingEvent({ sender: { id: "otro" }, ownId: "loja", message: { mid: "x2", text: "Hola, quiero eliminar mis datos" } });
  assert.match(sentTexts()[0], /Recibimos su solicitud/);
});

test("eco com mid diferente e chegando antes da confirmação NÃO pausa a IA (conversa continua)", async () => {
  // Instagram devolve message_id "out-N", mas o eco chega com outro mid.
  await handleMessagingEvent({ sender: { id: "cliente" }, ownId: "loja", message: { mid: "q1", text: "oi" } });
  await handleMessagingEvent({ sender: { id: "loja" }, recipient: { id: "cliente" }, ownId: "loja", message: { mid: "eco-diferente-1", text: "Olá! Como posso ajudar?", is_echo: true } });
  assert.equal(JSON.parse(db.get("lead:cliente")).aiPaused, false);
  await handleMessagingEvent({ sender: { id: "cliente" }, ownId: "loja", message: { mid: "q2", text: "quanto custa?" } });
  await handleMessagingEvent({ sender: { id: "cliente" }, ownId: "loja", message: { mid: "q3", text: "e o prazo?" } });
  assert.equal(aiCalls().length, 3);
  assert.equal(sentTexts().length, 3);
  // e a equipe de verdade (texto que o agente não mandou) continua pausando
  await handleMessagingEvent({ sender: { id: "loja" }, recipient: { id: "cliente" }, ownId: "loja", message: { mid: "h9", text: "Oi, aqui é o Sandro", is_echo: true } });
  assert.equal(JSON.parse(db.get("lead:cliente")).aiPaused, true);
});

test("conexão com o Instagram: sincroniza conta, troca token pelo painel com validação, assina webhook, atualiza leads", async () => {
  const cookie = await login();
  const get = r => admin.GET(new Request(`https://x/api/admin?r=${r}`, { headers: { cookie } }));
  const post = (r, body = {}) => admin.POST(new Request(`https://x/api/admin?r=${r}`, { method: "POST", headers: { cookie }, body: JSON.stringify(body) }));

  const ig = await (await get("instagram")).json();
  assert.equal(ig.account.username, "confianza");
  assert.deepEqual(ig.webhookFields, ["messages"]);
  assert.match(ig.tokenSource, /Vercel/);

  assert.equal((await post("instagram-token", { token: "abc" })).status, 400);
  process.env.IG_USER_ID = "999";
  const wrong = await post("instagram-token", { token: "IGAA" + "x".repeat(60) });
  assert.equal(wrong.status, 400);
  assert.match((await wrong.json()).error, /outra conta|travado/);
  process.env.IG_USER_ID = "17841";
  const ok = await (await post("instagram-token", { token: "IGAA" + "x".repeat(60) })).json();
  assert.equal(ok.username, "confianza");
  const { accessToken } = await import("../lib/store.js");
  assert.equal(await accessToken(), "IGAA_RENOVADO");
  assert.match((await (await get("instagram")).json()).tokenSource, /painel/);
  delete process.env.IG_USER_ID;

  const sub = await (await post("subscribe-webhook")).json();
  assert.deepEqual(sub.webhookFields.sort(), ["comments", "messages"]);

  await handleMessagingEvent({ sender: { id: "cliente" }, ownId: "loja", message: { mid: "s1", text: "oi" } });
  const before = JSON.parse(db.get("lead:cliente")).lastAt;
  const synced = await (await post("sync-leads")).json();
  assert.equal(synced.updated, 0); // id "cliente" não é numérico (IGSID real é numérico)
  assert.equal(JSON.parse(db.get("lead:cliente")).lastAt, before);
});
