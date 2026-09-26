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
   ├─ grava lead, mensagem e contadores ──► Redis (Redis Cloud ou Upstash)
   ├─ boas-vindas (1ª mensagem do lead)
   ├─ IA (Claude) gera a resposta com a base de produtos ──► api.anthropic.com
   ├─ cliente pede humano: pausa a IA e avisa ──► WhatsApp (Evolution API)
   ├─ responde comentário (público + Direct)
   └─ envia pelo Instagram ──► graph.instagram.com (token IGAA)
```

- A Meta avisa cada DM e cada comentário no endereço `/api/webhook`.
- O agente responde **200 na hora** e processa em segundo plano (a Meta não
  reenvia por demora).
- Tudo fica registrado no banco (Redis): leads, conversas, comentários
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

### C.3 Criar o banco de dados (Redis)

O agente aceita dois tipos de Redis — use o que estiver disponível na Vercel:

- **Redis** (Redis Cloud, do fornecedor "Redis"): cria a variável `REDIS_URL`.
- **Upstash for Redis**: cria `KV_REST_API_URL`/`KV_REST_API_TOKEN` (ou
  `UPSTASH_REDIS_REST_URL`/`..._TOKEN`).

1. vercel.com → projeto **instagram-ai-agent** → aba **Storage** →
   **Create Database**.
2. Escolha **Redis** (ou **Upstash → Upstash for Redis**), plano **Free**,
   região mais próxima disponível.
3. Na tela **Connect Project**: `instagram-ai-agent`, ambiente **Production**
   → **Connect**. A Vercel grava a variável do banco sozinha — não copie nem
   cole o endereço em lugar nenhum (ele contém a senha do banco).
4. Confira com `vercel env ls` (aparece `REDIS_URL` ou `KV_REST_API_URL`) e
   rode `vercel --prod`.

> Se a senha do banco vazar (ex.: colada numa conversa), troque-a no painel do
> Redis Cloud (**Security → Reset password**) e reconecte o banco ao projeto.

### C.4 Cadastrar as variáveis de ambiente

| Variável | Tipo | Obrigatória | Valor |
|---|---|---|---|
| `IG_ACCESS_TOKEN` | Secret | sim | Token `IGAA...` (A.3) |
| `VERIFY_TOKEN` | **Config** | sim | Texto inventado, sem espaços. Ex.: `ConfianzaAgenteIA` |
| `ANTHROPIC_API_KEY` | Secret | sim | Chave `sk-ant-...` (B) |
| `DASHBOARD_PASSWORD` | Secret | sim | Senha do painel (mínimo 6 caracteres; use uma forte) |
| `IG_APP_SECRET` | Secret | recomendada | Chave secreta do app do Instagram (A.2) — valida que o evento veio da Meta |
| `CRON_SECRET` | Secret | recomendada | Texto aleatório longo — protege a renovação automática do token |
| `EVOLUTION_API_KEY` | Secret | se usar escalação | Chave (apikey) da sua Evolution API — o aviso de "cliente pediu humano" chega no seu WhatsApp |
| `IG_USER_ID` | Config | não | ID da conta do Instagram (a auditoria mostra). Trava o agente nessa conta: se o token for de outra, a auditoria acusa |
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

- *Responder só comentários com palavra-chave* (padrão ligado): comentários
  sem palavra-chave ficam registrados, mas não recebem resposta.
- Cada regra tem **Palavras-chave**, **Link de destino**, **Resposta pública**
  e **Mensagem no Direct**. Use `{link}` nas mensagens para inserir o link da
  regra. Não há texto pronto: tudo é preenchido por você.

**Base de conhecimento · Produtos**

- Cadastre quantos produtos quiser: nome, link de compra, descrição/diferenciais
  (várias linhas), preço e bônus.
- **Extrair do link**: cole o link e o painel lê o título, a descrição e o
  preço da página (quando a página informa). Revise e salve.
- A IA **só** fala dos produtos cadastrados e passa o link exatamente como
  está. Sem produtos, ela não cita produtos, preços nem links.

**Escalação para humano · WhatsApp**

- *Palavras que pedem humano*: ex. `humano, atendente, falar com alguém`.
  Além delas, a IA também reconhece o pedido quando é dito de outro jeito.
- *Mensagem de transição*: o que o cliente recebe (ex.: *"Certo, {nome}! Vou
  chamar alguém da equipe."*).
- Ao escalar: a IA **pausa** naquela conversa, o lead fica marcado e você
  recebe no WhatsApp o @ do cliente, o telefone (se capturado), o link para
  responder e as últimas mensagens.
- Preencha seu número com DDI (ex.: `5545999990000`), a URL da sua Evolution
  API e o nome da instância; cadastre `EVOLUTION_API_KEY` na Vercel (C.4) e
  rode `vercel --prod`. Use **Enviar teste no WhatsApp** para conferir.
- Para voltar a IA nessa conversa depois do atendimento: aba **Conversas →**
  chave **IA ativa**.

**Modelos**

- *Modelo principal* (vazio = padrão `claude-sonnet-5`) e *Modelo reserva*
  (ex.: `claude-haiku-4-5-20251001`), usado automaticamente se o principal
  falhar ou estiver fora do ar.

3. Clique em **Salvar**. Vale na hora, sem deploy.
4. Teste sem enviar nada (seção 8.1) e rode a **Auditoria técnica** (seção 8.2).

---

## 8. Parte G — Teste de ponta a ponta

### 8.1 Testes no painel (não enviam nada)

Em **Configurações**:

- **Testar comentário**: digite um comentário de exemplo (ex.: `quero o link`)
  e veja qual regra bate e o que seria respondido em público e no Direct.
- **Simular nos últimos 5 posts** (dry-run): lê os comentários reais dos seus
  últimos 5 posts e mostra, para cada um, o que o agente responderia — sem
  enviar nada.
- **Simulador do Direct**: converse com a IA como se fosse um cliente, com as
  instruções e os produtos salvos. Mostra também quando a conversa seria
  escalada para humano.

### 8.2 Auditoria técnica

**Configurações → Auditoria técnica → Rodar auditoria.** Testa de verdade:

| # | Verificação | Correção automática |
|---|---|---|
| 1 | Variáveis obrigatórias cadastradas | — |
| 2 | Banco de dados respondendo | — |
| 3 | Token do Instagram válido (consulta a conta) | — |
| 4 | ID da conta confere com `IG_USER_ID` | — |
| 5 | Validade do token | Renova se faltar menos de 15 dias |
| 6 | Campos do webhook assinados (`messages`, `comments`) | Assina os que faltarem |
| 7 | IA respondendo (chamada curta de teste) | — |
| 8 | Modelo reserva configurado | — |
| 9 | Base de produtos | — |
| 10 | Escalação: instância da Evolution conectada | — |
| 11 | Segurança: `IG_APP_SECRET` e `CRON_SECRET` | — |

Resultado: **ok**, **atenção** (funciona, mas falta algo recomendado) ou
**falha** (resolver antes de usar).

### 8.3 Ciclo real

Com um perfil **testador** (A.4):

1. Mande uma DM para a conta da Confianza, ex.: *"Oi, vocês instalam câmeras?
   Meu WhatsApp é 45 99999-0000"*.
   - Esperado: chega a boas-vindas (se ligada) e, em ~5–10 s, a resposta da IA.
   - No painel: **Visão geral** mostra o evento; **Leads** mostra o lead com o
     telefone capturado; **Conversas** mostra a conversa.
2. Mande duas mensagens seguidas rápido → a IA responde **uma vez** para as duas.
3. Responda você mesmo pelo app do Instagram → no painel a conversa mostra
   *Equipe* e a chave **IA ativa** desliga.
4. Comente num post da conta usando uma palavra-chave de regra (ex.: *"quero"*)
   → resposta pública + DM com o link. Aparece em **Comentários**.
5. Pergunte no Direct por um produto cadastrado → a IA responde com preço e link
   da base.
6. Escreva *"quero falar com humano"* → chega a mensagem de transição, a IA
   pausa e você recebe o aviso no WhatsApp.

Logs em tempo real no servidor:

```bash
cd ~/atendeflow/instagram-ai-agent && vercel logs https://instagram-ai-agent-omega.vercel.app
```

Esperado: `POST /api/webhook 200` e `[AGENT] respondeu ...`.

---

## 9. Parte H — Liberar para todos os clientes (app publicado)

Enquanto o app estiver em desenvolvimento, **só testadores** são atendidos.
Para atender qualquer pessoa:

1. **Configurações do app → Básico**:
   - **URL da Política de Privacidade**:
     `https://instagram-ai-agent-omega.vercel.app/privacidade`
   - **URL de instruções de exclusão de dados** (em "Exclusão de dados do
     usuário", escolha *URL de instruções*):
     `https://instagram-ai-agent-omega.vercel.app/exclusao-de-dados`
   - Ícone 1024×1024, categoria (*Negócios e páginas*), e-mail de contato
     `confianzatechnologies.pry@gmail.com`.

   As duas páginas estão em português e espanhol (idioma automático pelo
   navegador; `?lang=es` força espanhol) e descrevem exatamente o que o agente
   faz com os dados. Revise o texto antes de enviar — não é assessoria jurídica.
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
| **Visão geral** | Leads hoje/7 dias/total, DMs recebidas, respostas da IA, **escalações para humano**, comentários (respondidos e falhas), **dias até o token vencer** (fica vermelho com menos de 5); gráfico dos últimos 14 dias (botão *Ver tabela*); movimentação em tempo real (atualiza a cada 30 s) |
| **Conversas** | Histórico de cada cliente; responder como equipe (a IA pausa); ligar/desligar a IA por conversa; atalho *Abrir no Instagram* |
| **Leads** | Lista com origem (Direct/Comentário), status (Novo → Em contato → Qualificado → Convertido/Perdido), telefone/e-mail capturados; filtros; **Exportar CSV** (abre no Excel) |
| **Comentários** | Cada comentário, a regra usada e as respostas enviadas (ou o erro) |
| **Configurações** | Agente e modelos, produtos, escalação, boas-vindas, comentários e regras, testes sem envio, simulador, auditoria, status e token |

Tema claro/escuro: botão da lua no canto da barra lateral.

**Pedido de exclusão de dados** (LGPD / política de privacidade): se o cliente
escrever no Direct algo como *"quero excluir meus dados"* / *"quiero eliminar
mis datos"*, o agente confirma o recebimento, pausa a IA, anota no lead e
registra **Exclusão de dados** na Movimentação (e avisa no WhatsApp, se a
escalação estiver configurada). Para cumprir: **Conversas →** cliente →
**Excluir dados** — apaga o lead, a conversa e os comentários dele. Prazo
prometido na página pública: **até 15 dias**.

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

Os dados ficam no Redis (o painel do Redis Cloud/Upstash tem backup/export). Os leads podem
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
| Painel mostra "Falta configurar: banco de dados" / `hasDatabase:false` | Redis não conectado ao projeto, ou faltou `vercel --prod` | C.3 e `vercel --prod` |
| Auditoria: `Redis (REDIS_URL): ...` | Endereço/senha do Redis Cloud inválidos ou banco pausado | Reconectar o banco em Storage; conferir no painel do Redis Cloud |
| Login do painel: "Cadastre DASHBOARD_PASSWORD" | Variável ausente | C.4 e `vercel --prod` |
| Cliente pediu humano mas o WhatsApp não chegou | Evolution incompleta, chave errada ou instância desconectada | Auditoria (item 10); **Enviar teste no WhatsApp**; conferir `EVOLUTION_API_KEY` + `vercel --prod`. O motivo aparece na Movimentação |
| IA não cita um produto | Produto não cadastrado ou não salvo | Configurações → Produtos → Salvar; testar no Simulador do Direct |
| "Extrair do link" não preencheu | A página não informa título/descrição/preço nas tags | Preencher à mão |
| Comentário registrado, mas sem resposta | *Responder só com palavra-chave* ligado e nenhuma palavra bateu | Ver o motivo na aba Comentários; ajustar regras; testar com **Testar comentário** |
| `Instagram API ... 190` / token inválido nos logs | Token vencido ou revogado | Gerar novo token (A.3), trocar variável, `vercel --prod` |

---

## 13. Referência técnica

### Estrutura

```
instagram-ai-agent/
├── api/webhook.js     Webhook da Meta (GET verificação/status, POST eventos)
├── api/admin.js       API do painel (?r=session|login|logout|overview|leads|
│                      conversation|comments|config|lead|send|export|refresh-token|
│                      audit|dry-run|simulate-comment|simulate-dm|extract-url|
│                      test-whatsapp|delete-lead)
├── lib/agent.js       Regras: leads, boas-vindas, IA, pausa, comentários
├── lib/ai.js          Chamada à IA (Anthropic ou OpenAI), prompt do sistema
├── lib/instagram.js   Graph API do Instagram (enviar, perfil, comentários, token)
├── lib/store.js       Banco Redis — REDIS_URL (TCP) ou Upstash (REST)
├── lib/auth.js        Login do painel (cookie assinado, 7 dias)
├── lib/audit.js       Auditoria técnica com correção automática
├── lib/whatsapp.js    Aviso de escalação via Evolution API
├── lib/extract.js     Leitura de título/descrição/preço de um link de produto
├── public/            Painel (index.html, app.css, app.js) e páginas públicas
│                      privacidade.html / exclusao-de-dados.html (PT/ES)
├── test/              Testes (npm test)
└── vercel.json        Funções, pasta pública, cabeçalhos de segurança, cron
```

### Dados no banco (Redis)

| Chave | Conteúdo |
|---|---|
| `config` | Configurações do painel (agente, modelos, produtos, escalação, boas-vindas, comentários e regras) |
| `lead:<id>` / `leads` | Lead (perfil, status, contatos, pausa) / índice por última atividade |
| `msgs:<id>` | Conversa do lead (últimas 300 mensagens) |
| `feed` | Movimentação geral (últimos 1000 eventos) |
| `comments` | Comentários (últimos 1000) |
| `stats:<AAAA-MM-DD>` | Contadores do dia (in, out, ai, leads, comments, commentsReplied, commentErrors, escalations), guardados ~13 meses |
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

Com um Redis local, testa também a conexão por `REDIS_URL`:
`TEST_REDIS_URL=redis://127.0.0.1:6379 npm test`.
