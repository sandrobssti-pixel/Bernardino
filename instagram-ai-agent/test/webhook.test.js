import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.IG_ACCESS_TOKEN = "IGAA_TEST";
process.env.VERIFY_TOKEN = "segredo123";
process.env.ANTHROPIC_API_KEY = "sk-test";
process.env.AGENT_PROMPT = "Somos a Confianza.";
process.env.BURST_WAIT_MS = "0";

const { GET, POST, handleEvent } = await import("../api/webhook.js");
const { splitMessage } = await import("../lib/instagram.js");

let calls;
let history;
beforeEach(() => {
  calls = [];
  history = [];
  delete process.env.IG_APP_SECRET;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: u, method: init.method || "GET", body, headers: init.headers });
    if (u.includes("api.anthropic.com")) {
      return Response.json({ content: [{ type: "text", text: "Olá! Como posso ajudar?" }] });
    }
    if (u.includes("me/conversations")) {
      return Response.json({ data: [{ messages: { data: [...history].reverse() } }] });
    }
    if (u.includes("me/messages")) return Response.json({ recipient_id: "1", message_id: "m" });
    return new Response("not found", { status: 404 });
  };
});

test("verificação da Meta: token certo devolve o challenge", async () => {
  const ok = await GET(new Request("https://x/api/webhook?hub.mode=subscribe&hub.verify_token=segredo123&hub.challenge=abc"));
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), "abc");
  const bad = await GET(new Request("https://x/api/webhook?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=abc"));
  assert.equal(bad.status, 403);
});

test("status sem parâmetros não expõe segredos", async () => {
  const res = await GET(new Request("https://x/api/webhook"));
  const text = await res.text();
  assert.ok(!text.includes("IGAA_TEST") && !text.includes("sk-test"));
  assert.equal(JSON.parse(text).aiProvider, "anthropic");
});

test("mensagem do cliente: chama a IA com histórico e responde no Direct", async () => {
  history = [
    { id: "a1", message: "oi", from: { id: "cliente" } },
    { id: "a2", message: "Olá!", from: { id: "loja" } },
    { id: "mid-atual", message: "quanto custa?", from: { id: "cliente" } }
  ];
  await handleEvent({ sender: { id: "cliente" }, ownId: "loja", message: { mid: "mid-atual", text: "quanto custa?" } });

  const ai = calls.find(c => c.url.includes("anthropic"));
  assert.equal(ai.body.model, "claude-sonnet-5");
  assert.match(ai.body.system, /Somos a Confianza/);
  assert.deepEqual(ai.body.messages.map(m => [m.role, m.content]), [
    ["user", "oi"], ["assistant", "Olá!"], ["user", "quanto custa?"]
  ]);
  const sent = calls.filter(c => c.url.includes("me/messages") && c.body.message);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].body, { recipient: { id: "cliente" }, message: { text: "Olá! Como posso ajudar?" } });
  assert.equal(sent[0].headers.Authorization, "Bearer IGAA_TEST");
});

test("rajada: mensagem mais antiga não responde se já chegou outra do cliente", async () => {
  history = [
    { id: "m1", message: "oi", from: { id: "cliente" } },
    { id: "m2", message: "tudo bem?", from: { id: "cliente" } }
  ];
  await handleEvent({ sender: { id: "cliente" }, ownId: "loja", message: { mid: "m1", text: "oi" } });
  assert.equal(calls.filter(c => c.url.includes("anthropic")).length, 0);
});

test("ignora eco das próprias mensagens", async () => {
  await handleEvent({ sender: { id: "loja" }, ownId: "loja", message: { mid: "x", text: "oi", is_echo: true } });
  assert.equal(calls.length, 0);
});

test("imagem vai para a IA como bloco de imagem", async () => {
  await handleEvent({
    sender: { id: "cliente" }, ownId: "loja",
    message: { mid: "img", attachments: [{ type: "image", payload: { url: "https://cdn/x.jpg" } }] }
  });
  const ai = calls.find(c => c.url.includes("anthropic"));
  const last = ai.body.messages.at(-1);
  assert.equal(last.content[0].type, "image");
  assert.equal(last.content[0].source.url, "https://cdn/x.jpg");
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

test("texto longo é quebrado em partes de até 1000 caracteres", () => {
  const parts = splitMessage("Frase de teste. ".repeat(200));
  assert.ok(parts.length > 1);
  assert.ok(parts.every(p => p.length <= 1000));
});
