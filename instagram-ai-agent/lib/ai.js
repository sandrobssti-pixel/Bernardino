// Chamada ao modelo de IA, sem SDK (fetch puro). Provedores:
// - "anthropic" (Claude): ANTHROPIC_API_KEY
// - "openai" (ou compatível, ex.: Gemini/DeepSeek/Groq via OPENAI_BASE_URL):
//   OPENAI_API_KEY

const DEFAULT_MODELS = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-4o-mini"
};

export const resolveProvider = (env = process.env) => {
  const explicit = String(env.AI_PROVIDER || "").trim().toLowerCase();
  if (explicit) return explicit;
  if (env.ANTHROPIC_API_KEY) return "anthropic";
  if (env.OPENAI_API_KEY) return "openai";
  return "";
};

// Marcador que a IA acrescenta quando o cliente pede um humano. O agente
// remove o marcador antes de enviar e dispara a escalação.
export const ESCALATION_MARKER = "[[HUMANO]]";

const formatProducts = products =>
  (products || [])
    .filter(product => String(product?.name || "").trim())
    .map((product, index) =>
      [
        `${index + 1}. ${product.name.trim()}`,
        product.price ? `   Preço: ${String(product.price).trim()}` : "",
        product.url ? `   Link: ${String(product.url).trim()}` : "",
        product.description ? `   Descrição: ${String(product.description).trim().replace(/\n+/g, "\n   ")}` : "",
        product.bonus ? `   Bônus: ${String(product.bonus).trim()}` : ""
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n");

// overrides (do painel, têm prioridade sobre AGENT_NAME/AGENT_PROMPT):
// { name, prompt, extra, products, escalation: boolean }
export const buildSystemPrompt = (env = process.env, overrides = {}) => {
  const agentName = String(overrides.name || env.AGENT_NAME || "Assistente").trim();
  const instructions = String(overrides.prompt || env.AGENT_PROMPT || "").trim();
  const catalog = formatProducts(overrides.products);

  return [
    `Você é ${agentName}, o atendente virtual desta conta no Instagram Direct.`,
    "Responda sempre em português do Brasil, de forma curta, simpática e direta, como numa conversa de DM.",
    "Use texto simples: sem markdown, sem listas longas, sem títulos. No máximo 2 ou 3 frases curtas por resposta, a não ser que o cliente peça detalhes.",
    "Nunca invente produtos, preços, prazos, links, endereços ou informações que não estejam nas instruções ou na base de produtos abaixo. Se não souber, diga que vai verificar com a equipe.",
    catalog
      ? "Quando o cliente se interessar por um produto, passe o link dele exatamente como está na base."
      : "Não há produtos cadastrados: não cite produtos, preços nem links.",
    overrides.escalation
      ? `Se o cliente pedir para falar com uma pessoa/atendente/humano, responda com uma frase curta avisando que vai chamar alguém da equipe e termine a resposta com ${ESCALATION_MARKER} (exatamente assim).`
      : "Se o cliente pedir para falar com uma pessoa, diga que a equipe vai responder por aqui assim que possível.",
    instructions ? `\nInstruções do negócio:\n${instructions}` : "",
    catalog ? `\nBase de produtos (a única fonte de produtos, preços e links):\n${catalog}` : "",
    overrides.extra ? `\n${overrides.extra}` : ""
  ]
    .filter(Boolean)
    .join("\n");
};

// Junta mensagens seguidas do mesmo papel e garante que a conversa começa
// pelo cliente (exigência das APIs de chat).
export const normalizeTurns = turns => {
  const merged = [];
  for (const turn of turns) {
    if (!turn || (!turn.text && !turn.imageUrl)) continue;
    const last = merged[merged.length - 1];
    if (last && last.role === turn.role && !turn.imageUrl && !last.imageUrl) {
      last.text = `${last.text}\n${turn.text}`.trim();
    } else {
      merged.push({ ...turn });
    }
  }
  while (merged.length && merged[0].role !== "user") merged.shift();
  return merged;
};

const toAnthropicMessages = (turns, withImages) =>
  turns.map(turn => ({
    role: turn.role,
    content:
      withImages && turn.imageUrl
        ? [
            { type: "image", source: { type: "url", url: turn.imageUrl } },
            { type: "text", text: turn.text || "O cliente enviou esta imagem." }
          ]
        : turn.text || "[o cliente enviou uma imagem]"
  }));

const toOpenAIMessages = (system, turns, withImages) => [
  { role: "system", content: system },
  ...turns.map(turn => ({
    role: turn.role,
    content:
      withImages && turn.imageUrl
        ? [
            { type: "image_url", image_url: { url: turn.imageUrl } },
            { type: "text", text: turn.text || "O cliente enviou esta imagem." }
          ]
        : turn.text || "[o cliente enviou uma imagem]"
  }))
];

const postJson = async (url, headers, body) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.message || response.statusText;
    throw new Error(`IA ${response.status}: ${detail}`);
  }
  return data;
};

const callModel = async ({ provider, env, system, turns, withImages, model: requested }) => {
  const model = String(requested || env.AI_MODEL || DEFAULT_MODELS[provider] || "").trim();
  const maxTokens = Number(env.AI_MAX_TOKENS) || 500;

  if (provider === "anthropic") {
    const data = await postJson(
      "https://api.anthropic.com/v1/messages",
      {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      {
        model,
        max_tokens: maxTokens,
        system,
        messages: toAnthropicMessages(turns, withImages)
      }
    );
    return (data.content || [])
      .filter(block => block.type === "text")
      .map(block => block.text)
      .join("\n")
      .trim();
  }

  if (provider === "openai") {
    const baseUrl = String(env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
    const data = await postJson(
      `${baseUrl}/chat/completions`,
      { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      {
        model,
        max_tokens: maxTokens,
        messages: toOpenAIMessages(system, turns, withImages)
      }
    );
    return String(data.choices?.[0]?.message?.content || "").trim();
  }

  throw new Error(`AI_PROVIDER inválido: "${provider}" (use anthropic ou openai)`);
};

// Tenta o modelo principal; se falhar (fora do ar, limite, modelo inválido),
// tenta o modelo reserva (overrides.fallbackModel ou AI_MODEL_FALLBACK).
export const generateReply = async (turns, env = process.env, overrides = {}) => {
  const provider = resolveProvider(env);
  const system = buildSystemPrompt(env, overrides);
  const normalized = normalizeTurns(turns);
  if (!normalized.length) return "";

  const primary = String(overrides.model || "").trim() || undefined;
  const fallback = String(overrides.fallbackModel || env.AI_MODEL_FALLBACK || "").trim();

  const attempt = async model => {
    const hasImages = normalized.some(turn => turn.imageUrl);
    try {
      return await callModel({ provider, env, system, turns: normalized, withImages: hasImages, model });
    } catch (error) {
      if (!hasImages) throw error;
      // Link da imagem expirado/inacessível ou modelo sem visão: tenta só com texto.
      console.warn("[AI] falhou com imagem, tentando só texto:", error.message);
      return callModel({ provider, env, system, turns: normalized, withImages: false, model });
    }
  };

  try {
    return await attempt(primary);
  } catch (error) {
    if (!fallback || fallback === primary) throw error;
    console.warn(`[AI] modelo principal falhou (${error.message}); usando reserva ${fallback}`);
    return attempt(fallback);
  }
};
