// Armazenamento do agente. Aceita dois tipos de Redis, conforme o que foi
// conectado ao projeto em Vercel → Storage:
//   - Upstash (REST): KV_REST_API_URL/KV_REST_API_TOKEN ou
//     UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN
//   - Redis Cloud / qualquer Redis (TCP): REDIS_URL (redis:// ou rediss://)
//
// Chaves:
//   config                 JSON com as configurações do painel
//   lead:<id>              JSON do lead (perfil, status, contatos, pausa da IA)
//   leads                  ZSET id -> última atividade (ms)
//   msgs:<id>              LIST de mensagens da conversa (mais nova primeiro)
//   feed                   LIST de eventos gerais (movimentação)
//   comments               LIST de comentários recebidos
//   stats:<AAAA-MM-DD>     HASH contadores do dia
//   seen:<id>              dedupe de reenvio da Meta
//   sent:<mid>             mensagens enviadas pelo agente (para reconhecer o eco)

const MAX_MSGS_PER_LEAD = 300;
const MAX_FEED = 1000;
const MAX_COMMENTS = 1000;
const STATS_TTL_SECONDS = 400 * 24 * 3600;

const restCredentials = (env = process.env) => {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || "";
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || "";
  return { url: url.replace(/\/+$/, ""), token };
};

const redisUrl = (env = process.env) => String(env.REDIS_URL || env.KV_URL || "").trim();

export const hasStore = (env = process.env) => {
  const { url, token } = restCredentials(env);
  return Boolean((url && token) || /^rediss?:\/\//.test(redisUrl(env)));
};

const restPipeline = async commands => {
  const { url, token } = restCredentials();
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(8000)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(data)) {
    throw new Error(`Redis ${response.status}: ${JSON.stringify(data)?.slice(0, 200)}`);
  }
  return data.map(item => {
    if (item?.error) throw new Error(`Redis: ${item.error}`);
    return item?.result;
  });
};

// Conexão TCP reaproveitada entre chamadas da mesma função (instância quente).
let tcpClientPromise = null;
const tcpClient = () => {
  if (!tcpClientPromise) {
    tcpClientPromise = (async () => {
      const { createClient } = await import("redis");
      const client = createClient({ url: redisUrl(), socket: { connectTimeout: 5000, reconnectStrategy: false } });
      client.on("error", error => console.error("[REDIS]", error.message));
      client.on("end", () => (tcpClientPromise = null));
      await client.connect();
      return client;
    })().catch(error => {
      tcpClientPromise = null;
      throw new Error(`Redis (REDIS_URL): ${error.message}`);
    });
  }
  return tcpClientPromise;
};

const tcpPipeline = async commands => {
  const client = await tcpClient();
  // Enviados juntos na mesma conexão (o cliente agrupa automaticamente).
  return Promise.all(commands.map(command => client.sendCommand(command.map(String))));
};

export const pipeline = async commands => {
  const { url, token } = restCredentials();
  if (url && token) return restPipeline(commands);
  if (redisUrl()) return tcpPipeline(commands);
  throw new Error("Banco de dados não configurado (Vercel → Storage → Redis)");
};

const one = async command => (await pipeline([command]))[0];

const parse = value => {
  if (value === null || value === undefined) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

// ---------- datas no fuso do negócio ----------

export const timeZone = () => process.env.TIMEZONE || "America/Asuncion";

export const dayKey = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);

// ---------- configuração ----------

// Nada de texto pronto: tudo é preenchido no painel.
export const DEFAULT_CONFIG = {
  agent: {
    enabled: true,
    name: "",
    prompt: "",
    model: "",
    fallbackModel: "",
    pauseWhenTeamReplies: true
  },
  welcome: {
    enabled: false,
    text: ""
  },
  comments: {
    enabled: false,
    // true: só responde comentários que tenham uma palavra-chave das regras
    onlyKeywords: true,
    publicReplyEnabled: true,
    publicReply: "",
    privateReplyEnabled: true,
    privateReply: "",
    useAI: false,
    // [{ keywords, link, publicReply, privateReply }]
    rules: []
  },
  // Base de conhecimento: a IA só fala dos produtos cadastrados aqui.
  // [{ name, url, description, price, bonus }]
  products: [],
  escalation: {
    enabled: false,
    keywords: "",
    message: "",
    whatsappNumber: "",
    evolutionUrl: "",
    evolutionInstance: ""
  }
};

const mergeConfig = (base, saved) => {
  const result = { ...base };
  for (const key of Object.keys(base)) {
    const value = saved?.[key];
    if (value === undefined) continue;
    result[key] =
      base[key] && typeof base[key] === "object" && !Array.isArray(base[key])
        ? mergeConfig(base[key], value)
        : value;
  }
  return result;
};

export const getConfig = async () => {
  if (!hasStore()) return mergeConfig(DEFAULT_CONFIG, {});
  return mergeConfig(DEFAULT_CONFIG, parse(await one(["GET", "config"])) || {});
};

export const saveConfig = async config => {
  const merged = mergeConfig(DEFAULT_CONFIG, config);
  await one(["SET", "config", JSON.stringify(merged)]);
  return merged;
};

// ---------- token do Instagram ----------
// O token IGAA vale 60 dias. A renovação automática (cron semanal) guarda o
// token novo aqui; ele tem prioridade sobre a variável IG_ACCESS_TOKEN.

export const accessToken = async () => {
  const envToken = String(process.env.IG_ACCESS_TOKEN || "").trim();
  if (!hasStore()) return envToken;
  try {
    const stored = parse(await one(["GET", "ig_token"]));
    // Se trocaram a variável na Vercel depois, a variável nova vence.
    if (stored?.token && stored.baseToken === envToken) return stored.token;
  } catch (error) {
    console.warn("[STORE] sem token salvo:", error.message);
  }
  return envToken;
};

export const getTokenInfo = async () => (hasStore() ? parse(await one(["GET", "ig_token"])) : null);

export const saveRefreshedToken = async (token, expiresIn) => {
  const info = {
    token,
    baseToken: String(process.env.IG_ACCESS_TOKEN || "").trim(),
    refreshedAt: Date.now(),
    expiresAt: Date.now() + Number(expiresIn || 0) * 1000
  };
  await one(["SET", "ig_token", JSON.stringify(info)]);
  return info;
};

// ---------- dedupe ----------

// true na primeira vez que o id aparece (nas próximas 24h).
export const markSeen = async id => {
  if (!id || !hasStore()) return true;
  return (await one(["SET", `seen:${id}`, "1", "NX", "EX", 86400])) === "OK";
};

export const markSent = async mid => {
  if (!mid || !hasStore()) return;
  await one(["SET", `sent:${mid}`, "1", "EX", 86400]);
};

export const wasSentByAgent = async mid => {
  if (!mid || !hasStore()) return false;
  return (await one(["EXISTS", `sent:${mid}`])) === 1;
};

// ---------- leads ----------

export const getLead = async id => parse(await one(["GET", `lead:${id}`]));

const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,3}\)?[\s.-]?\d{3,5}[\s.-]?\d{3,4}/;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;

export const extractContacts = text => {
  const phone = String(text || "").match(PHONE_RE)?.[0];
  const email = String(text || "").match(EMAIL_RE)?.[0];
  return {
    phone: phone && phone.replace(/\D/g, "").length >= 8 ? phone.trim() : undefined,
    email: email || undefined
  };
};

// Cria ou atualiza o lead. Retorna { lead, isNew }.
export const upsertLead = async (id, patch = {}) => {
  const now = Date.now();
  const current = await getLead(id);
  const isNew = !current;

  const lead = {
    id,
    username: "",
    name: "",
    profilePic: "",
    source: patch.source || "dm",
    status: "novo",
    phone: "",
    email: "",
    notes: "",
    aiPaused: false,
    firstAt: now,
    messagesIn: 0,
    messagesOut: 0,
    comments: 0,
    ...current,
    ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined && v !== "")),
    lastAt: now
  };
  if (current?.source) lead.source = current.source;

  const commands = [
    ["SET", `lead:${id}`, JSON.stringify(lead)],
    ["ZADD", "leads", now, id]
  ];
  if (isNew) {
    commands.push(["HINCRBY", `stats:${dayKey()}`, "leads", 1]);
    commands.push(["EXPIRE", `stats:${dayKey()}`, STATS_TTL_SECONDS]);
  }
  await pipeline(commands);
  return { lead, isNew };
};

export const updateLead = async (id, patch) => {
  const current = await getLead(id);
  if (!current) return null;
  const allowed = ["status", "notes", "phone", "email", "aiPaused", "name", "escalatedAt"];
  const lead = { ...current };
  for (const key of allowed) if (patch[key] !== undefined) lead[key] = patch[key];
  await one(["SET", `lead:${id}`, JSON.stringify(lead)]);
  return lead;
};

export const bumpLeadCounter = async (id, field) => {
  const lead = await getLead(id);
  if (!lead) return;
  lead[field] = (Number(lead[field]) || 0) + 1;
  await one(["SET", `lead:${id}`, JSON.stringify(lead)]);
};

export const listLeads = async (limit = 200) => {
  const ids = await one(["ZREVRANGE", "leads", 0, limit - 1]);
  if (!ids?.length) return [];
  const values = await one(["MGET", ...ids.map(id => `lead:${id}`)]);
  return values.map(parse).filter(Boolean);
};

// ---------- mensagens e movimentação ----------

// direction: "in" (cliente) | "out" (agente/equipe). by: "cliente" | "ia" |
// "boas-vindas" | "equipe" | "comentario"
export const logMessage = async ({ leadId, direction, text, by, mid, kind = "dm", extra }) => {
  const item = {
    id: mid || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    leadId,
    direction,
    by,
    kind,
    text: String(text || "").slice(0, 4000),
    at: Date.now(),
    ...(extra || {})
  };
  const day = `stats:${dayKey()}`;
  const counter = direction === "in" ? "in" : "out";
  const leadCounter = direction === "in" ? "messagesIn" : "messagesOut";

  const commands = [
    ["LPUSH", `msgs:${leadId}`, JSON.stringify(item)],
    ["LTRIM", `msgs:${leadId}`, 0, MAX_MSGS_PER_LEAD - 1],
    ["LPUSH", "feed", JSON.stringify(item)],
    ["LTRIM", "feed", 0, MAX_FEED - 1],
    ["HINCRBY", day, counter, 1],
    ["EXPIRE", day, STATS_TTL_SECONDS]
  ];
  if (by === "ia") commands.push(["HINCRBY", day, "ai", 1]);
  await pipeline(commands);

  const lead = await getLead(leadId);
  if (lead) {
    lead[leadCounter] = (lead[leadCounter] || 0) + 1;
    lead.lastText = item.text.slice(0, 160);
    lead.lastDirection = direction;
    lead.lastAt = item.at;
    await pipeline([
      ["SET", `lead:${leadId}`, JSON.stringify(lead)],
      ["ZADD", "leads", item.at, leadId]
    ]);
  }
  return item;
};

// Conversa em ordem cronológica (mais antiga primeiro).
export const getMessages = async (leadId, limit = 100) =>
  ((await one(["LRANGE", `msgs:${leadId}`, 0, limit - 1])) || []).map(parse).filter(Boolean).reverse();

export const getFeed = async (limit = 100) =>
  ((await one(["LRANGE", "feed", 0, limit - 1])) || []).map(parse).filter(Boolean);

export const logComment = async comment => {
  const day = `stats:${dayKey()}`;
  await pipeline([
    ["LPUSH", "comments", JSON.stringify(comment)],
    ["LTRIM", "comments", 0, MAX_COMMENTS - 1],
    ["LPUSH", "feed", JSON.stringify({ ...comment, kind: "comment", direction: "in", by: "cliente" })],
    ["LTRIM", "feed", 0, MAX_FEED - 1],
    ["HINCRBY", day, "comments", 1],
    ["HINCRBY", day, "commentsReplied", comment.publicReply || comment.privateReply ? 1 : 0],
    ["HINCRBY", day, "commentErrors", comment.errors?.length ? 1 : 0],
    ["EXPIRE", day, STATS_TTL_SECONDS]
  ]);
};

export const incrStat = async (field, amount = 1) => {
  const day = `stats:${dayKey()}`;
  await pipeline([
    ["HINCRBY", day, field, amount],
    ["EXPIRE", day, STATS_TTL_SECONDS]
  ]);
};

// Registra um evento só na movimentação (sem conversa), ex.: escalação.
export const logFeed = async item => {
  await pipeline([
    ["LPUSH", "feed", JSON.stringify({ at: Date.now(), ...item })],
    ["LTRIM", "feed", 0, MAX_FEED - 1]
  ]);
};

export const getComments = async (limit = 100) =>
  ((await one(["LRANGE", "comments", 0, limit - 1])) || []).map(parse).filter(Boolean);

// Contadores dos últimos N dias (mais antigo primeiro).
export const getStats = async (days = 14) => {
  const keys = [];
  for (let i = days - 1; i >= 0; i--) keys.push(dayKey(new Date(Date.now() - i * 86400000)));
  const results = await pipeline(keys.map(key => ["HGETALL", `stats:${key}`]));
  return keys.map((day, index) => {
    const flat = results[index] || [];
    const row = { day, in: 0, out: 0, leads: 0, comments: 0, ai: 0, commentsReplied: 0, commentErrors: 0, escalations: 0 };
    for (let i = 0; i < flat.length; i += 2) row[flat[i]] = Number(flat[i + 1]) || 0;
    return row;
  });
};

export const countLeads = async () => Number(await one(["ZCARD", "leads"])) || 0;
