# Agente de IA do Instagram Direct (Vercel)

Agente **independente do AtendeFlow**: a Meta manda cada DM do Instagram para
`/api/webhook` na Vercel, a IA responde sozinha e a resposta volta pelo
próprio Instagram. As conversas **não** aparecem no multi atendimento.

- Sem banco de dados: o histórico da conversa é lido da própria API do
  Instagram (`me/conversations`).
- Junta mensagens seguidas do cliente (rajada) numa resposta só.
- Entende imagem (visão do modelo). Áudio/vídeo/outros anexos: a IA avisa que
  não consegue abrir.
- Confere a assinatura da Meta (`X-Hub-Signature-256`) quando `IG_APP_SECRET`
  está configurado.
- Usa a "API do Instagram com login do Instagram" (token `IGAA...`,
  `graph.instagram.com`).

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável | Obrigatória | O que é |
|---|---|---|
| `IG_ACCESS_TOKEN` | sim | Token `IGAA...` da conta profissional do Instagram |
| `VERIFY_TOKEN` | sim | Texto qualquer inventado por você; o mesmo vai no campo "Verificar token" da Meta |
| `ANTHROPIC_API_KEY` **ou** `OPENAI_API_KEY` | sim | Chave da IA (Claude ou OpenAI) |
| `AGENT_PROMPT` | recomendada | Instruções do negócio: o que vende, preços, horários, tom de voz |
| `AGENT_NAME` | não | Nome do atendente virtual (padrão "Assistente") |
| `IG_APP_SECRET` | recomendada | "Chave secreta do app do Instagram" — valida que o evento veio da Meta |
| `AI_PROVIDER` | não | `anthropic` ou `openai` (padrão: o da chave configurada) |
| `AI_MODEL` | não | Padrão `claude-sonnet-5` (Anthropic) / `gpt-4o-mini` (OpenAI) |
| `OPENAI_BASE_URL` | não | Para provedor compatível com OpenAI (Gemini, DeepSeek, Groq...) |
| `AGENT_ENABLED` | não | `false` desliga as respostas sem desfazer nada |
| `HISTORY_LIMIT` | não | Quantas mensagens anteriores a IA lê (padrão 12) |
| `BURST_WAIT_MS` | não | Espera para juntar mensagens seguidas (padrão 4000) |

## Publicar

```bash
cd instagram-ai-agent
vercel project add instagram-ai-agent
vercel link --yes --project instagram-ai-agent
vercel env add IG_ACCESS_TOKEN production
vercel env add VERIFY_TOKEN production
vercel env add ANTHROPIC_API_KEY production
vercel env add AGENT_PROMPT production
vercel --prod
```

Depois, no painel da Meta (app → Instagram → Webhooks):

- URL de retorno de chamada: `https://instagram-ai-agent.vercel.app/api/webhook`
- Verificar token: o mesmo valor de `VERIFY_TOKEN`
- Assinar o campo `messages`

## Conferir

- `https://instagram-ai-agent.vercel.app/api/webhook` (sem parâmetros) mostra
  o que está configurado, sem expor segredos.
- `vercel logs <url-do-deploy>` mostra `[AGENT] respondeu ...` a cada resposta.

## Limitações

- Se alguém da equipe responder pelo app do Instagram, a IA continua
  respondendo as próximas mensagens (não há "pausa" sem banco de dados). Use
  `AGENT_ENABLED=false` para desligar.
- A Meta só deixa responder até 24h depois da última mensagem do cliente.

## Testes

```bash
npm test
```
