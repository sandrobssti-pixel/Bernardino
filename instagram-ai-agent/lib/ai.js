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

export const buildSystemPrompt = (env = process.env) => {
  const agentName = String(env.AGENT_NAME || "Assistente").trim();
  const instructions = String(env.AGENT_PROMPT || "").trim();

  return [
    `Você é ${agentName}, o atendente virtual desta conta no Instagram Direct.`,
    "Responda sempre em português do Brasil, de forma curta, simpática e direta, como numa conversa de DM.",
    "Use texto simples: sem markdown, sem listas longas, sem títulos. No máximo 2 ou 3 frases curtas por resposta, a não ser que o cliente peça detalhes.",
    "Nunca invente preços, prazos, endereços ou informações que não estejam nas instruções abaixo. Se não souber, diga que vai verificar com a equipe.",
    "Se o cliente pedir para falar com uma pessoa, diga que a equipe vai responder por aqui assim que possível.",
    instructions ? `\nInstruções do negócio:\n${instructions}` : ""
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

const callModel = async ({ provider, env, system, turns, withImages }) => {
  const model = String(env.AI_MODEL || DEFAULT_MODELS[provider] || "").trim();
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

export const generateReply = async (turns, env = process.env) => {
  const provider = resolveProvider(env);
  const system = buildSystemPrompt(env);
  const normalized = normalizeTurns(turns);
  if (!normalized.length) return "";

  const hasImages = normalized.some(turn => turn.imageUrl);
  try {
    return await callModel({ provider, env, system, turns: normalized, withImages: hasImages });
  } catch (error) {
    if (!hasImages) throw error;
    // Link da imagem expirado/inacessível ou modelo sem visão: tenta só com texto.
    console.warn("[AI] falhou com imagem, tentando só texto:", error.message);
    return callModel({ provider, env, system, turns: normalized, withImages: false });
  }
};
