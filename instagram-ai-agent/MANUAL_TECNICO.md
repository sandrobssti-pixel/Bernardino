# Manual técnico — Agente de IA do Instagram (Confianza Technologies)

Passo a passo completo para instalar, configurar, operar e manter o agente de
IA do Instagram Direct com painel de controle. Todos os comandos rodam no
servidor `sandro@ConfianzaThechnologies`, **um bloco por vez**.

> Este agente é **independente do AtendeFlow** (multi atendimento). Ele não usa
> nem altera `atendeflow.confiancatechnologies.com`, e as conversas do
> Instagram **não** aparecem no multi atendimento.

---

## Sumário

0. [Como funciona](#0-como-funciona)
1. [Pré-requisitos](#1-pré-requisitos)
2. [Parte A — App na Meta e token do Instagram](#2-parte-a--app-na-meta-e-token-do-instagram)
3. [Parte B — Chave da IA (Anthropic)](#3-parte-b--chave-da-ia-anthropic)
4. [Parte C — Projeto na Vercel](#4-parte-c--projeto-na-vercel)
5. [Parte D — Conferir a instalação](#5-parte-d--conferir-a-instalação)
6. [Parte E — Ligar o webhook na Meta](#6-parte-e--ligar-o-webhook-na-meta)
7. [Parte F — Painel: primeiro acesso e configurações](#7-parte-f--painel-primeiro-acesso-e-configurações)
8. [Parte G — Teste de ponta a ponta](#8-parte-g--teste-de-ponta-a-ponta)
9. [Parte H — Liberar para todos os clientes (app publicado)](#9-parte-h--liberar-para-todos-os-clientes-app-publicado)
10. [Uso do dia a dia](#10-uso-do-dia-a-dia)
11. [Manutenção](#11-manutenção)
12. [Solução de problemas](#12-solução-de-problemas)
13. [Referência técnica](#13-referência-técnica)

---

## 0. Como funciona

```
 Cliente no Instagram                         Painel (navegador)
   │  DM / comentário                          https://instagram-ai-agent-omega.vercel.app
   ▼                                                   │  login com senha
 Meta (webhook)                                        ▼
   │  POST /api/webhook                         /api/admin  (dados, config, envio)
   ▼                                                   │
 Vercel — projeto instagram-ai-agent  ◄────────────────┘
   ├─ grava lead, mensagem e contadores ──► Upstash Redis (banco)
   ├─ boas-vindas (1ª mensagem do lead)
   ├─ IA (Claude) gera a resposta ──► api.anthropic.com
   ├─ responde comentário (público + Direct)
   └─ envia pelo Instagram ──► graph.instagram.com (token IGAA)
```

- A Meta avisa cada DM e cada comentário no endereço `/api/webhook`.
- O agente responde **200 na hora** e processa em segundo plano (a Meta não
  reenvia por demora).
- Tudo fica registrado no banco (Upstash Redis): leads, conversas, comentários
  e contadores por dia — é o que o painel mostra.
- As configurações do painel (instruções da IA, boas-vindas, respostas de
  comentários) ficam no banco e valem na hora, **sem novo deploy**.

---

## 1. Pré-requisitos

| Item | Onde | Observação |
|---|---|---|
| Conta **profissional** do Instagram (Empresa ou Criador) | App do Instagram → Configurações → Tipo de conta | Conta pessoal não funciona |
| Conta de desenvolvedor Meta | developers.facebook.com | Mesmo login do Facebook |
| Conta Vercel | vercel.com | Plano gratuito (Hobby) atende |
| Conta Anthropic com crédito | console.anthropic.com | Billing com saldo |
| Servidor com Node.js 20+ e Vercel CLI | já instalado (`node -v`, `vercel --version`) | Para instalar a CLI: `sudo npm install -g vercel` e `vercel login` |
| Código | repositório `sandrobssti-pixel/Bernardino`, pasta `instagram-ai-agent/` | No servidor: `~/atendeflow/instagram-ai-agent` |

**Regras de ouro no terminal**

- Rode **um comando por vez** e confira a saída antes do próximo.
- Textos entre `<...>` são para trocar pelo valor real (não digite os `< >`).
- Para **colar** no terminal Linux use **Ctrl+Shift+V** (ou botão direito →
  Colar). O Ctrl+V comum não cola.
- Em campos de segredo o valor não aparece enquanto você cola; confira se
  surgiu a linha de `*****` antes de apertar Enter. Se aparecer
  `! Value is empty`, aperte **Ctrl+C** e repita.

---

## 2. Parte A — App na Meta e token do Instagram

### A.1 Criar o app

1. developers.facebook.com → **Meus apps → Criar app**.
2. Caso de uso: **Gerenciar mensagens e conteúdo no Instagram** (ou "Outro" →
   tipo **Empresa**).
3. Nome do app (ex.: `Confianza Instagram IA`) e e-mail de contato → Criar.

### A.2 Adicionar a API do Instagram com login do Instagram

1. No painel do app → **Instagram → Configuração da API com login do
   Instagram** (em alguns painéis: *Adicionar produto → Instagram → Configurar*).
2. Anote a **Chave secreta do app do Instagram** (botão *Mostrar*). Ela vira a
   variável `IG_APP_SECRET`.
3. Permissões usadas pelo agente:
   - `instagram_business_basic`
   - `instagram_business_manage_messages` (DMs e resposta privada a comentário)
   - `instagram_business_manage_comments` (responder comentários)

### A.3 Gerar o token (IGAA...)

1. Na mesma tela, em **Gerar tokens de acesso → Adicionar conta**, entre com a
   conta do Instagram da Confianza e autorize.
2. Clique em **Gerar token** e copie. Ele começa com `IGAA` e tem ~180–200
   caracteres. É a variável `IG_ACCESS_TOKEN`.
3. Guarde num lugar seguro. **Nunca** cole o token em chat, e-mail ou arquivo
   do repositório. Se vazar, gere outro (o antigo deixa de ser usado quando
   você trocar a variável).

> O token vale **60 dias**. O agente renova sozinho toda segunda-feira (ver
> [Manutenção](#11-manutenção)).

### A.4 Testadores (enquanto o app não estiver publicado)

Em modo de desenvolvimento a Meta **só entrega mensagens de contas com papel
no app**. Para testar:

1. **Funções do app → Funções → Adicionar pessoas → Testador do Instagram** →
   informe o @ do perfil de teste.
2. No perfil de teste, aceite: Instagram → **Configurações → Apps e sites →
   Convites de testador → Aceitar**.

---

## 3. Parte B — Chave da IA (Anthropic)

1. console.anthropic.com → **API Keys → Create Key** → nome
   `instagram-ai-agent`.
2. Copie na hora (a chave completa só aparece **uma vez**). Começa com
   `sk-ant-` e tem ~108 caracteres.
3. Confira em **Billing** se há crédito.

> Alternativa: chave da OpenAI → use a variável `OPENAI_API_KEY` no lugar de
> `ANTHROPIC_API_KEY`.

---

## 4. Parte C — Projeto na Vercel

### C.1 Baixar/atualizar o código no servidor

```bash
cd ~/atendeflow && git fetch origin claude/instagram-ai-agent-ivcyk4 && git merge --ff-only FETCH_HEAD
```

### C.2 Criar o projeto e ligar a pasta (só na primeira vez)

```bash
cd ~/atendeflow/instagram-ai-agent && vercel project add instagram-ai-agent && vercel link --yes --project instagram-ai-agent
```

A saída **tem** que mostrar `Linked ... /instagram-ai-agent`.

> ⚠️ Nunca ligue esta pasta ao projeto `confiancafacilities` (é outro site).
> Se aparecer `confiancafacilities`, apague a ligação com
> `rm -rf .vercel .env.local` e repita o C.2.

### C.3 Criar o banco de dados (Upstash Redis)

1. vercel.com → projeto **instagram-ai-agent** → aba **Storage** →
   **Create Database** (ou *Browse Marketplace*) → **Upstash → Redis**.
2. Região: a mais próxima disponível (ex.: `São Paulo` ou `Washington, D.C.`);
   plano **Free**.
3. **Connect Project** → `instagram-ai-agent` → ambientes **Production**
   (pode marcar os outros também).
4. A Vercel cria sozinha as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN`
   (ou `UPSTASH_REDIS_REST_URL`/`..._TOKEN`). O agente aceita os dois nomes.

### C.4 Cadastrar as variáveis de ambiente

| Variável | Tipo | Obrigatória | Valor |
|---|---|---|---|
| `IG_ACCESS_TOKEN` | Secret | sim | Token `IGAA...` (A.3) |
| `VERIFY_TOKEN` | **Config** | sim | Texto inventado, sem espaços. Ex.: `ConfianzaAgenteIA` |
| `ANTHROPIC_API_KEY` | Secret | sim | Chave `sk-ant-...` (B) |
| `DASHBOARD_PASSWORD` | Secret | sim | Senha do painel (mínimo 6 caracteres; use uma forte) |
| `IG_APP_SECRET` | Secret | recomendada | Chave secreta do app do Instagram (A.2) — valida que o evento veio da Meta |
| `CRON_SECRET` | Secret | recomendada | Texto aleatório longo — protege a renovação automática do token |
| `TIMEZONE` | Config | não | Fuso dos gráficos. Padrão `America/Asuncion`; no Brasil use `America/Sao_Paulo` |
| `AGENT_ENABLED` | Config | não | `false` desliga tudo sem desinstalar |

**Pelo terminal** (repita para cada variável):

```bash
vercel env add IG_ACCESS_TOKEN production
```

- *Environment Variable type?* → **Secret** (Enter) ou **Config** (seta para
  baixo + Enter) conforme a tabela.
- *Value?* → cole com **Ctrl+Shift+V** (ou digite) → Enter.

**Pelo site** (mais fácil para colar): projeto → **Settings → Environment
Variables → Add** → Type, Key, Value, Environments = **Production** → Save.

Conferir:

```bash
vercel env ls
```

Tem que listar todas as variáveis acima (e as do banco) em **Production**.

### C.5 Publicar

```bash
vercel --prod
```

A saída mostra o endereço público no `Aliased`, por exemplo
`https://instagram-ai-agent-omega.vercel.app` (o sufixo `-omega` existe porque
o nome curto já era de outra pessoa na Vercel). **Use sempre esse endereço.**

> ⚠️ **Toda vez que criar ou alterar uma variável, rode `vercel --prod` de
> novo.** O deploy que está no ar só enxerga as variáveis que existiam quando
> ele foi criado. (No site: Deployments → ⋯ → **Redeploy**.)

---

## 5. Parte D — Conferir a instalação

**D.1 Status** — abra no navegador (ou `curl -s`):

```
https://instagram-ai-agent-omega.vercel.app/api/webhook
```

Resultado esperado:

```json
{"ok":true,"agentEnabled":true,"hasAccessToken":true,"hasVerifyToken":true,
 "checksSignature":true,"aiProvider":"anthropic","hasPrompt":false,
 "hasDatabase":true,"hasDashboardPassword":true}
```

Qualquer `false`/`null` indica a variável correspondente vazia ou ausente → ver
[Solução de problemas](#12-solução-de-problemas). (`hasPrompt:false` é normal:
as instruções ficam no painel.)

**D.2 Verificação do webhook** (troque pelo seu `VERIFY_TOKEN`):

```bash
curl -s "https://instagram-ai-agent-omega.vercel.app/api/webhook?hub.mode=subscribe&hub.verify_token=ConfianzaAgenteIA&hub.challenge=teste123"; echo
```

Tem que responder `teste123`. Se responder `Forbidden`, o `VERIFY_TOKEN` está
diferente, vazio, ou faltou o `vercel --prod`.

---

## 6. Parte E — Ligar o webhook na Meta

developers.facebook.com → seu app → **Instagram → Configuração da API com
login do Instagram → Configurar webhooks**:

| Campo | Valor |
|---|---|
| URL de retorno de chamada | `https://instagram-ai-agent-omega.vercel.app/api/webhook` |
| Verificar token | exatamente o mesmo `VERIFY_TOKEN` (ex.: `ConfianzaAgenteIA`) |

1. **Verificar e salvar** (só funciona depois que o D.2 responder `teste123`).
2. Em **Campos do webhook**, assine:
   - `messages` — DMs
   - `comments` — comentários nos posts
   - (opcional) `live_comments` — comentários em lives
3. Em **Gerar tokens de acesso**, na linha da conta do Instagram, confirme que
   a **assinatura de webhooks está ativada** para a conta.

> O aviso *"Para receber webhooks, seu aplicativo precisa estar publicado"* é
> esperado em modo de desenvolvimento: só testadores recebem até a
> [Parte H](#9-parte-h--liberar-para-todos-os-clientes-app-publicado).

---

## 7. Parte F — Painel: primeiro acesso e configurações

1. Abra `https://instagram-ai-agent-omega.vercel.app` e entre com a
   `DASHBOARD_PASSWORD`.
2. Vá em **Configurações** e preencha:

**Agente de IA no Direct**

- *IA responde as mensagens do Direct*: ligado.
- *Nome do atendente virtual*: ex. `Sofia, da Confianza`.
- *Instruções do negócio*: o que a empresa faz, serviços, cidades atendidas
  (Ciudad del Este, Foz do Iguaçu, Puerto Iguazú), faixa de preço ou "preço sob
  orçamento", horários, WhatsApp/telefone, como encaminhar para orçamento, e o
  que a IA **não** deve responder. Quanto mais concreto, melhor a resposta.
- *Pausar a IA quando a equipe responder*: recomendado ligado — se alguém da
  equipe responder pelo app do Instagram ou pelo painel, a IA para naquela
  conversa (dá para reativar no botão **IA ativa** da conversa).

**Boas-vindas a novos leads**

- Enviada uma única vez, na primeira DM de cada pessoa, antes da resposta da
  IA. `{nome}` vira o primeiro nome (ou o @).

**Comentários nas postagens**

- *Responder comentários automaticamente*: liga o recurso.
- *Responder em público*: resposta embaixo do comentário (padrão ou da regra).
- *Usar a IA para a resposta pública*: quando nenhuma regra bater, a IA escreve
  uma frase curta convidando para o Direct.
- *Chamar no Direct*: "resposta privada" — abre a conversa no Direct com quem
  comentou (a Meta permite **1 por comentário, até 7 dias** depois dele).
- *Regras por palavra-chave*: ex. palavras `preço, valor, quanto` → respostas
  próprias. Não diferencia maiúsculas nem acentos.

3. Clique em **Salvar**. Vale na hora, sem deploy.
4. O quadro **Status da instalação** (fim da página) mostra o que falta.

---

## 8. Parte G — Teste de ponta a ponta

Com um perfil **testador** (A.4):

1. Mande uma DM para a conta da Confianza, ex.: *"Oi, vocês instalam câmeras?
   Meu WhatsApp é 45 99999-0000"*.
   - Esperado: chega a boas-vindas (se ligada) e, em ~5–10 s, a resposta da IA.
   - No painel: **Visão geral** mostra o evento; **Leads** mostra o lead com o
     telefone capturado; **Conversas** mostra a conversa.
2. Mande duas mensagens seguidas rápido → a IA responde **uma vez** para as duas.
3. Responda você mesmo pelo app do Instagram → no painel a conversa mostra
   *Equipe* e a chave **IA ativa** desliga.
4. Comente num post da conta com *"qual o preço?"* → resposta pública + DM.
   Aparece em **Comentários**.

Logs em tempo real no servidor:

```bash
cd ~/atendeflow/instagram-ai-agent && vercel logs https://instagram-ai-agent-omega.vercel.app
```

Esperado: `POST /api/webhook 200` e `[AGENT] respondeu ...`.

---

## 9. Parte H — Liberar para todos os clientes (app publicado)

Enquanto o app estiver em desenvolvimento, **só testadores** são atendidos.
Para atender qualquer pessoa:

1. **Configurações do app → Básico**: URL da política de privacidade, ícone
   1024×1024, categoria, e-mail. (A política pode ser uma página no site
   `site.confiancatechnologies.com`.)
2. **Análise do app (App Review)**: solicite *Acesso avançado* para
   `instagram_business_manage_messages` e `instagram_business_manage_comments`,
   com vídeo curto mostrando o agente respondendo uma DM e um comentário, e
   o texto explicando o uso (atendimento automático da própria empresa).
3. Após a aprovação, mude o app para **Ao vivo / Publicado** (chave no topo).

O prazo da análise é da Meta (normalmente alguns dias).

---

## 10. Uso do dia a dia

| Aba | Para que serve |
|---|---|
| **Visão geral** | Leads hoje/7 dias/total, mensagens recebidas, respostas da IA, comentários; gráfico dos últimos 14 dias (botão *Ver tabela*); movimentação em tempo real (atualiza a cada 30 s) |
| **Conversas** | Histórico de cada cliente; responder como equipe (a IA pausa); ligar/desligar a IA por conversa; atalho *Abrir no Instagram* |
| **Leads** | Lista com origem (Direct/Comentário), status (Novo → Em contato → Qualificado → Convertido/Perdido), telefone/e-mail capturados; filtros; **Exportar CSV** (abre no Excel) |
| **Comentários** | Cada comentário, a regra usada e as respostas enviadas (ou o erro) |
| **Configurações** | Agente, boas-vindas, comentários, regras, status da instalação e token |

Tema claro/escuro: botão da lua no canto da barra lateral.

**Desligar a IA rapidamente**: Configurações → desmarque *IA responde...* →
Salvar. (Desligar tudo, inclusive comentários: variável `AGENT_ENABLED=false`
+ `vercel --prod`.)

---

## 11. Manutenção

### Token do Instagram (60 dias)

- Renovado **automaticamente toda segunda-feira** (cron da Vercel em
  `vercel.json`). O token novo fica guardado no banco.
- Painel → Configurações → *Token do Instagram*: mostra a última renovação e o
  vencimento; botão **Renovar token agora**.
- Se você gerar um token novo na Meta e trocar a variável `IG_ACCESS_TOKEN`,
  o novo passa a valer automaticamente (após `vercel --prod`).
- Se o token **vencer** (agente parado por mais de 60 dias, por exemplo), a
  renovação não funciona mais: gere outro na Meta (A.3), troque a variável e
  rode `vercel --prod`.

### Atualizar o código

```bash
cd ~/atendeflow && git fetch origin claude/instagram-ai-agent-ivcyk4 && git merge --ff-only FETCH_HEAD
```

```bash
cd ~/atendeflow/instagram-ai-agent && vercel --prod
```

### Trocar uma variável

```bash
cd ~/atendeflow/instagram-ai-agent
vercel env rm NOME_DA_VARIAVEL production --yes
vercel env add NOME_DA_VARIAVEL production
vercel --prod
```

### Backup

Os dados ficam no Upstash (painel da Upstash tem backup/export). Os leads podem
ser exportados a qualquer momento em **Leads → Exportar CSV**.

---

## 12. Solução de problemas

| Sintoma | Causa | Solução |
|---|---|---|
| `npm ERR! enoent ... package.json` | Comando rodado na pasta errada | Entre na pasta certa (`cd ~/atendeflow/instagram-ai-agent`) |
| `vercel --prod` tentou publicar em `confiancafacilities` / `Too many requests ... api-upload-free` | Pasta ligada ao projeto errado | `rm -rf .vercel .env.local` e refazer C.2 |
| `No Next.js version detected` | Pasta ligada ao `confiancafacilities` | Idem acima |
| `! Value is empty` ao cadastrar variável | Colagem não funcionou | Ctrl+C e repetir colando com Ctrl+Shift+V, ou cadastrar pelo site |
| Status com `hasAccessToken/hasVerifyToken:false` ou `aiProvider:null` | Variável vazia, ausente, ou sem novo deploy | `vercel env ls`; recadastrar; `vercel --prod` |
| `curl` de verificação responde `Forbidden` | `VERIFY_TOKEN` diferente/vazio ou sem deploy | Recadastrar como **Config**, `vercel --prod`, testar de novo |
| Meta: *"Não foi possível validar a URL..."* | Mesmo caso acima, ou URL errada | Fazer o D.2 dar `teste123` antes; conferir URL com `-omega` e `/api/webhook` |
| Meta: *"aplicativo precisa estar publicado"* | App em desenvolvimento | Testar com perfil testador (A.4); para todos, Parte H |
| DM de teste não aparece no painel/logs | Perfil não é testador, campo `messages` não assinado, ou assinatura da conta desligada | Conferir A.4 e E.2/E.3 |
| Aparece no painel, mas a IA não responde | Chave da IA errada/sem crédito, IA desligada, ou conversa pausada | Logs (`IA 401` = chave errada); Billing da Anthropic; Configurações; botão **IA ativa** |
| `IA 401: invalid x-api-key` | Chave da Anthropic errada (ex.: colou o token do Instagram no lugar) | Recadastrar `ANTHROPIC_API_KEY` (≈108 caracteres, `sk-ant-`) e `vercel --prod` |
| Comentários não chegam | Campo `comments` não assinado ou falta permissão de comentários | E.2 e A.2 |
| Erro `Direct:` num comentário | Resposta privada já usada para esse comentário, ou comentário com mais de 7 dias | Limite da Meta; responder pela aba Conversas quando a pessoa mandar DM |
| Painel mostra "Falta configurar: banco de dados" | Upstash não conectado ao projeto | C.3 e `vercel --prod` |
| Login do painel: "Cadastre DASHBOARD_PASSWORD" | Variável ausente | C.4 e `vercel --prod` |
| `Instagram API ... 190` / token inválido nos logs | Token vencido ou revogado | Gerar novo token (A.3), trocar variável, `vercel --prod` |

---

## 13. Referência técnica

### Estrutura

```
instagram-ai-agent/
├── api/webhook.js     Webhook da Meta (GET verificação/status, POST eventos)
├── api/admin.js       API do painel (?r=session|login|logout|overview|leads|
│                      conversation|comments|config|lead|send|export|refresh-token)
├── lib/agent.js       Regras: leads, boas-vindas, IA, pausa, comentários
├── lib/ai.js          Chamada à IA (Anthropic ou OpenAI), prompt do sistema
├── lib/instagram.js   Graph API do Instagram (enviar, perfil, comentários, token)
├── lib/store.js       Banco Upstash Redis (leads, mensagens, estatísticas, config)
├── lib/auth.js        Login do painel (cookie assinado, 7 dias)
├── public/            Painel (index.html, app.css, app.js)
├── test/              Testes (npm test)
└── vercel.json        Funções, pasta pública, cabeçalhos de segurança, cron
```

### Dados no banco (Upstash Redis)

| Chave | Conteúdo |
|---|---|
| `config` | Configurações do painel |
| `lead:<id>` / `leads` | Lead (perfil, status, contatos, pausa) / índice por última atividade |
| `msgs:<id>` | Conversa do lead (últimas 300 mensagens) |
| `feed` | Movimentação geral (últimos 1000 eventos) |
| `comments` | Comentários (últimos 1000) |
| `stats:<AAAA-MM-DD>` | Contadores do dia (in, out, ai, leads, comments), guardados ~13 meses |
| `ig_token` | Token renovado automaticamente |
| `seen:*` / `sent:*` | Controle de reenvio da Meta e de eco (24 h) |

### Limites da Meta

- Resposta no Direct só até **24 h** após a última mensagem do cliente.
- Resposta privada a comentário: **1 por comentário**, até **7 dias**.
- Texto no Direct: até **1000 caracteres** por mensagem (o agente divide
  respostas maiores).
- Resposta pública a comentário: até 2200 caracteres.

### Segurança

- Segredos só nas variáveis da Vercel (tipo *Secret*), nunca no código.
- Assinatura `X-Hub-Signature-256` conferida quando `IG_APP_SECRET` existe.
- Painel com senha, cookie `HttpOnly; Secure; SameSite=Strict`; só a pasta
  `public/` é servida.
- Todo texto vindo de clientes é escapado no painel (proteção contra XSS).

### Testes

```bash
cd ~/atendeflow/instagram-ai-agent && npm install && npm test
```
