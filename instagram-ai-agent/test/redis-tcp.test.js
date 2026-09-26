// Roda contra um Redis de verdade via REDIS_URL (formato do Redis Cloud).
// Só roda se TEST_REDIS_URL estiver definido, ex.:
//   TEST_REDIS_URL=redis://127.0.0.1:6390 npm test
import { test, after } from "node:test";
import assert from "node:assert/strict";

const url = process.env.TEST_REDIS_URL;

test("Redis via REDIS_URL: agente e painel funcionam de ponta a ponta", { skip: !url && "defina TEST_REDIS_URL" }, async () => {
  for (const key of ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) delete process.env[key];
  Object.assign(process.env, {
    REDIS_URL: url,
    IG_ACCESS_TOKEN: "IGAA_TEST",
    ANTHROPIC_API_KEY: "k",
    BURST_WAIT_MS: "0",
    DASHBOARD_PASSWORD: "senha-forte"
  });
  const store = await import("../lib/store.js");
  const { handleMessagingEvent, handleCommentChange } = await import("../lib/agent.js");
  const admin = await import("../api/admin.js");

  await store.pipeline([["FLUSHDB"]]);
  assert.equal(store.hasStore(), true);

  const sent = [];
  globalThis.fetch = async (u, init = {}) => {
    u = String(u);
    const body = init.body ? JSON.parse(init.body) : undefined;
    if (u.includes("anthropic")) return Response.json({ content: [{ type: "text", text: "Oi! Como posso ajudar?" }] });
    if (u.includes("me/messages")) { if (body?.message) sent.push(body.message.text); return Response.json(body?.message ? { message_id: `o${sent.length}` } : {}); }
    if (u.includes("/replies")) return Response.json({ id: "r" });
    if (u.includes("v21.0/cli?")) return Response.json({ id: "cli", username: "cliente.real", name: "Cliente Real" });
    return new Response("{}", { status: 404 });
  };

  await store.saveConfig({
    welcome: { enabled: true, text: "Bem-vindo, {nome}!" },
    comments: { enabled: true, rules: [{ keywords: "quero", link: "https://l", publicReply: "Te chamei!", privateReply: "Link: {link}" }] }
  });
  await handleMessagingEvent({ sender: { id: "cli" }, ownId: "loja", message: { mid: "m1", text: "oi, meu email é a@b.com" } });
  await handleMessagingEvent({ sender: { id: "cli" }, ownId: "loja", message: { mid: "m1", text: "oi" } }); // reenvio
  await handleCommentChange({ id: "c1", text: "QUERO", from: { id: "fan", username: "fan" } }, "loja");

  assert.deepEqual(sent, ["Bem-vindo, Cliente!", "Oi! Como posso ajudar?", "Link: https://l"]);
  const lead = await store.getLead("cli");
  assert.equal(lead.email, "a@b.com");
  assert.equal(lead.messagesOut, 2);
  assert.deepEqual((await store.getMessages("cli")).map(m => m.by), ["cliente", "boas-vindas", "ia"]);
  assert.equal((await store.listLeads()).length, 2);
  const today = (await store.getStats(1))[0];
  assert.deepEqual([today.in, today.out, today.leads, today.comments, today.commentsReplied], [1, 3, 2, 1, 1]);

  const login = await admin.POST(new Request("https://x/api/admin?r=login", { method: "POST", body: JSON.stringify({ password: "senha-forte" }) }));
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const overview = await (await admin.GET(new Request("https://x/api/admin?r=overview", { headers: { cookie } }))).json();
  assert.equal(overview.totalLeads, 2);
  assert.ok(overview.feed.length >= 4);
});

after(async () => {
  if (!url) return;
  const store = await import("../lib/store.js");
  await store.pipeline([["FLUSHDB"]]).catch(() => {});
  process.exit(0); // fecha a conexão TCP aberta
});
