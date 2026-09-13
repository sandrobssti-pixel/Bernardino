# Manual Técnico — AtendeFlow

**Versão do documento:** 1.1.0
**Etapa:** 1.1 — Redesign da interface
**Última atualização:** 2026-09-13

> Este manual é atualizado a cada etapa do projeto. O histórico de mudanças de cada versão está em
> [`CHANGELOG.md`](../CHANGELOG.md), na raiz do repositório.

---

## 1. Visão geral

O **AtendeFlow** é um CRM de **multi atendimento**: várias pessoas (atendentes) conseguem atender,
simultaneamente, conversas de clientes vindas do WhatsApp, organizadas em uma caixa de entrada
compartilhada, com atribuição de conversa por atendente e por fila (departamento).

Nesta primeira versão (v1.0.0), a conexão com o WhatsApp é feita através da biblioteca
[Baileys](https://github.com/WhiskeySockets/Baileys) (`@whiskeysockets/baileys`), que se conecta
usando o protocolo do WhatsApp Web — o pareamento é feito escaneando um QR Code, sem depender de uma
API paga.

---

## 2. Arquitetura

```
Bernardino/
├── backend/     -> API REST + WebSocket + integração com WhatsApp (Baileys)
├── frontend/    -> Interface web (inbox, conexão WhatsApp, configurações)
├── docs/        -> Este manual técnico
├── CHANGELOG.md -> Histórico de versões/etapas
└── docker-compose.yml -> PostgreSQL para desenvolvimento
```

### 2.1 Backend

| Camada | Tecnologia |
| --- | --- |
| Linguagem | TypeScript (Node.js) |
| Framework HTTP | Express |
| Banco de dados | PostgreSQL |
| ORM | Prisma |
| Autenticação | JWT (`jsonwebtoken`) + hash de senha (`bcryptjs`) |
| Tempo real | Socket.io |
| WhatsApp | Baileys (`@whiskeysockets/baileys`) |
| Validação de entrada | Zod |

Estrutura de pastas (`backend/src`):

```
config/env.ts              -> variáveis de ambiente centralizadas
lib/prisma.ts               -> instância única do Prisma Client
lib/socket.ts                -> instância do Socket.io e helpers de emissão de eventos
middleware/auth.ts          -> requireAuth / requireRole (proteção de rotas)
middleware/errorHandler.ts  -> tratamento centralizado de erros
utils/jwt.ts                 -> assinar/verificar token JWT
utils/asyncHandler.ts        -> wrapper para rotas assíncronas do Express
modules/auth.routes.ts       -> cadastro, login, sessão do usuário
modules/users.routes.ts      -> listagem e papel (role) de atendentes
modules/queues.routes.ts     -> filas de atendimento (departamentos)
modules/contacts.routes.ts   -> contatos (clientes)
modules/conversations.routes.ts -> conversas, atribuição e status
modules/messages.routes.ts   -> envio de mensagens (dispara o envio via WhatsApp)
modules/whatsapp/whatsapp.service.ts -> integração com Baileys (conectar, QR, enviar, receber)
modules/whatsapp/whatsapp.routes.ts  -> endpoints para gerenciar sessões do WhatsApp
app.ts                        -> montagem do Express e das rotas
server.ts                     -> ponto de entrada (HTTP + Socket.io + restauração de sessões)
```

### 2.2 Frontend

| Camada | Tecnologia |
| --- | --- |
| Linguagem | TypeScript (React) |
| Build tool | Vite |
| Estilo | Tailwind CSS |
| Estado global | Zustand |
| Requisições HTTP | Axios |
| Tempo real | socket.io-client |
| Rotas | React Router |

Estrutura de pastas (`frontend/src`):

```
pages/           -> LoginPage, RegisterPage, InboxPage, WhatsAppPage, SettingsPage
components/      -> Sidebar, Topbar, ConversationList, ChatWindow, ProtectedRoute,
                    Logo, StatusPill, StatCard, EmptyState, icons.tsx
store/           -> authStore (sessão do usuário), inboxStore (conversas/mensagens)
services/        -> api.ts (Axios + JWT), socket.ts (conexão Socket.io)
types/           -> tipos TypeScript compartilhados (User, Contact, Conversation, Message)
```

### 2.2.1 Design system (desde a v1.1.0)

A interface segue uma identidade visual "tech", escura, definida em `tailwind.config.js` e
`src/index.css`:

| Token | Uso |
| --- | --- |
| `ink-900` / `ink-950` | Fundo da aplicação (azul-marinho bem escuro) |
| `brand-500` (violeta) → `accent-400` (ciano) | Gradiente de marca (`bg-brand-gradient`), usado em botões primários, logo e mensagens enviadas |
| `.glass` | Painéis translúcidos com desfoque (glassmorphism) |
| `StatusPill` | Selo colorido com legenda para status (conversa, sessão do WhatsApp, atendente online/offline) |
| `EmptyState` | Estado vazio com ícone, título e explicação — usado sempre que uma lista está sem dados |
| Fontes | `Space Grotesk` (títulos), `Inter` (texto), `JetBrains Mono` (dados técnicos como nome de sessão) |

Esses tokens devem ser reaproveitados em novas telas para manter a identidade visual consistente.

### 2.3 Fluxo de uma mensagem recebida

```
WhatsApp do cliente
   │  (mensagem)
   ▼
Baileys (whatsapp.service.ts → messages.upsert)
   │  cria/atualiza Contact e Conversation, grava Message (status DELIVERED)
   ▼
Socket.io → evento "message:new"
   ▼
Frontend (InboxPage) atualiza a lista de conversas e o chat em tempo real
```

### 2.4 Fluxo de uma mensagem enviada por um atendente

```
Atendente digita no ChatWindow → POST /messages
   ▼
messages.routes.ts grava Message (status PENDING)
   ▼
whatsapp.service.ts → socket.sendMessage(jid, texto) via Baileys
   ▼
Message atualizada para SENT (ou FAILED em caso de erro)
```

---

## 3. Modelo de dados (Prisma)

| Modelo | Descrição |
| --- | --- |
| `User` | Atendente/administrador do sistema (`role`: `ADMIN` ou `AGENT`; `status`: `ONLINE`/`OFFLINE`) |
| `Queue` | Fila/departamento de atendimento (ex: Suporte, Vendas) |
| `Contact` | Cliente identificado pelo número/JID do WhatsApp |
| `Conversation` | Uma conversa entre um `Contact` e a empresa; pode estar `OPEN`, `PENDING` ou `CLOSED`; pode estar atribuída a um `User` e/ou `Queue` |
| `Message` | Mensagem trocada em uma `Conversation`, com direção (`INBOUND`/`OUTBOUND`), remetente (`CONTACT`/`AGENT`/`SYSTEM`) e status de entrega |
| `WhatsAppSession` | Sessão de conexão com o WhatsApp (nome, status, QR Code atual) |

O arquivo-fonte da modelagem está em [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).

---

## 4. Como rodar o projeto localmente

### 4.1 Pré-requisitos

- Node.js 18 ou superior
- Docker (para subir o PostgreSQL) — ou um PostgreSQL já instalado
- Um número de WhatsApp para escanear o QR Code (pode ser um número de testes)

### 4.2 Passo a passo

```bash
# 1. Instalar as dependências do monorepo (backend + frontend)
npm install

# 2. Subir o banco de dados PostgreSQL
docker compose up -d

# 3. Configurar variáveis de ambiente
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 4. Rodar as migrações do banco (cria as tabelas)
npm run prisma:migrate

# 5. Subir backend e frontend juntos
npm run dev
```

- Backend: http://localhost:3333 (rota de saúde: `GET /health`)
- Frontend: http://localhost:5173

### 4.3 Primeiro acesso

1. Acesse `http://localhost:5173/register` e crie a primeira conta — ela vira automaticamente
   `ADMIN`.
2. Vá até **Conexão WhatsApp**, informe um nome para a sessão e clique em **Nova conexão**.
3. Escaneie o QR Code exibido na tela com o WhatsApp do celular
   (**Configurações > Aparelhos conectados > Conectar um aparelho**).
4. Assim que conectar, mensagens recebidas nesse número já aparecem na **Caixa de entrada**.

---

## 5. Referência da API (v1.0.0)

Todas as rotas abaixo (exceto `/health`, `/auth/register` e `/auth/login`) exigem o cabeçalho
`Authorization: Bearer <token>`.

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/health` | Verifica se a API está no ar |
| POST | `/auth/register` | Cria um usuário (o primeiro vira ADMIN) |
| POST | `/auth/login` | Autentica e retorna o token JWT |
| GET | `/auth/me` | Retorna o usuário autenticado |
| POST | `/auth/logout` | Marca o usuário como offline |
| GET | `/users` | Lista os atendentes |
| PATCH | `/users/:id/role` | Altera o papel de um atendente (somente ADMIN) |
| GET | `/queues` | Lista as filas |
| POST | `/queues` | Cria uma fila (somente ADMIN) |
| DELETE | `/queues/:id` | Remove uma fila (somente ADMIN) |
| GET | `/contacts` | Lista/busca contatos |
| GET | `/contacts/:id` | Detalhe de um contato |
| GET | `/conversations` | Lista conversas (filtro opcional `?status=`) |
| GET | `/conversations/:id/messages` | Histórico de mensagens de uma conversa |
| PATCH | `/conversations/:id/assign` | Atribui/remove um atendente da conversa |
| PATCH | `/conversations/:id/status` | Altera o status da conversa |
| POST | `/messages` | Envia uma mensagem (atendente → WhatsApp do contato) |
| GET | `/whatsapp/sessions` | Lista as sessões do WhatsApp |
| POST | `/whatsapp/sessions` | Cria/inicia uma sessão (gera QR Code) — somente ADMIN |
| POST | `/whatsapp/sessions/:name/disconnect` | Desconecta uma sessão — somente ADMIN |

### Eventos de tempo real (Socket.io)

| Evento | Quando ocorre |
| --- | --- |
| `message:new` | Nova mensagem recebida do WhatsApp |
| `conversation:updated` | Conversa atribuída ou com status alterado |
| `whatsapp:qr` | Novo QR Code gerado para pareamento |
| `whatsapp:status` | Sessão do WhatsApp conectou/desconectou |

---

## 6. Decisões técnicas e limitações da v1.0.0

- **Baileys em vez de API oficial**: escolhido conforme decisão do projeto, por não depender de
  aprovação/custo de API paga. Ponto de atenção: é uma biblioteca não-oficial que se conecta como
  WhatsApp Web, então o número precisa ficar com o app do WhatsApp ativo no celular.
- **Sessão do WhatsApp em arquivo local** (`backend/sessions/<nome-da-sessão>/`): simples e suficiente
  para uma única instância do backend. **Não** deve ser usada assim se o sistema rodar em múltiplos
  servidores/containers — nesse caso, migrar para um armazenamento compartilhado (banco de dados ou
  Redis) nas próximas etapas.
- **Uma única sessão conectada envia mensagens**: hoje o sistema usa a primeira sessão conectada para
  enviar qualquer mensagem. Multiplicar isso por fila/número é trabalho da Etapa 2.
- **Sem suporte a mídia** (imagem, áudio, vídeo, documento) nesta versão — apenas texto.
- **Sem testes automatizados** nesta etapa.

---

## 7. Histórico de versões

Ver [`CHANGELOG.md`](../CHANGELOG.md) na raiz do repositório para o detalhamento de cada etapa
entregue e as próximas etapas planejadas.

## 8. Avaliação do projeto legado (zappro-legado)

Um sistema antigo e mais maduro de multi atendimento, recuperado de um backup, foi avaliado
como possível nova base para o AtendeFlow. Ver o relatório completo em
[`docs/AVALIACAO_ZAPPRO_LEGADO.md`](AVALIACAO_ZAPPRO_LEGADO.md).

---

## 9. Runbook: migrar código-fonte de um backup local para o GitHub

**Ambiente testado:** Ubuntu 24.04 (também vale para outras distros baseadas em Debian/Ubuntu).

Roteiro usado para resgatar o `zappro-legado` de um backup de servidor (zip de 5,1GB) e
publicá-lo num repositório GitHub, já limpo de dependências, mídia de cliente e backups
redundantes. Serve de referência para qualquer migração parecida no futuro.

### 9.1 Instalar o Git (se necessário)

```bash
sudo apt update
sudo apt install git -y
git --version
```

### 9.2 Configurar identidade do Git (uma vez por máquina)

```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu-email@exemplo.com"
git config --global init.defaultBranch main
```

### 9.3 Extrair o backup (se ainda estiver zipado)

```bash
mkdir -p ~/projeto-antigo
unzip "/caminho/para/o/arquivo.zip" -d ~/projeto-antigo
cd ~/projeto-antigo
```

### 9.4 Descobrir o que está ocupando espaço

Backups de servidor costumam vir com `node_modules`, builds, mídia de cliente e cópias
redundantes — o código-fonte de verdade normalmente é uma fração pequena do total.

```bash
# Tamanho total da pasta
du -sh .

# Lista as maiores subpastas (até 3 níveis), da maior pra menor
du -h --max-depth=3 . 2>/dev/null | sort -rh | head -30
```

### 9.5 Remover o que não é código-fonte

```bash
# Dependências, builds e caches (seguros de apagar — são gerados de novo com npm install/build)
find . -type d \( -name node_modules -o -name .git -o -name dist -o -name build \
  -o -name .next -o -name vendor -o -name uploads -o -name storage \
  -o -name logs -o -name tmp -o -name cache \) -prune -exec rm -rf {} +

# Backups redundantes (ex.: pastas tipo nome_backup_AAAAMMDD_HHMMSS)
rm -rf caminho/para/*_backup_*

# Mídia de clientes/usuários (fotos, áudios, vídeos recebidos em produção — não é código)
find caminho/para/public -maxdepth 1 -type d -name "empresaN*" -exec rm -rf {} +

# Confirma o tamanho final (esperado: poucas dezenas de MB para código-fonte puro)
du -sh .
```

### 9.6 ⚠️ Procurar credenciais sensíveis antes de subir

**Nunca** suba certificados, chaves privadas ou arquivos `.env` reais para o Git — mesmo em
repositório privado.

```bash
# Procura por extensões/nome comuns de credenciais
find . -type f \( -iname "*.p12" -o -iname "*.pem" -o -iname "*.key" \
  -o -iname ".env" -o -iname "*.pfx" \)
```

Se encontrar algo, remova do controle de versão (mantendo o arquivo no disco, se precisar
dele localmente) e adicione ao `.gitignore` **antes** do primeiro push:

```bash
git rm --cached caminho/para/arquivo-sensivel.p12
echo "caminho/para/arquivo-sensivel.p12" >> .gitignore
```

Se a credencial já foi commitada (mesmo que depois removida), considere-a exposta e
**revogue/troque-a** — remover do commit atual não apaga do histórico do Git.

### 9.7 Inicializar o repositório e commitar

```bash
cd ~/projeto-antigo
git init
git add .
git commit -m "Código-fonte do projeto antigo"
git branch -M main
```

### 9.8 Criar o repositório vazio no GitHub

No navegador, acesse **https://github.com/new**:
- Dê um nome ao repositório
- Marque **Private** se não for público
- **Não** marque nenhuma opção de README/.gitignore/license (o repositório precisa ficar
  vazio para receber o `git push` inicial)
- Clique em **Create repository** e copie a URL mostrada (formato
  `https://github.com/usuario/nome-do-repo.git`)

### 9.9 Gerar um token de acesso (Personal Access Token)

Desde 2021 o GitHub não aceita mais a senha normal da conta para operações Git por HTTPS —
é obrigatório usar um token.

1. Acesse **https://github.com/settings/tokens/new** (token **clássico** — não confundir
   com "fine-grained", que exige configuração extra de permissão por repositório)
2. Em **Note**, dê um nome (ex.: `push-projeto-antigo`)
3. Em **Expiration**, escolha um prazo (ex.: 30 dias)
4. Marque a caixa **`repo`** (dá acesso completo de leitura/escrita aos repositórios)
5. Clique em **Generate token** e copie o valor gerado (começa com `ghp_`)

> ⚠️ **O token é como uma senha — nunca cole ele num chat, e-mail ou qualquer lugar que não
> seja o prompt do próprio terminal.** Se ele vazar, revogue imediatamente em
> https://github.com/settings/tokens e gere outro.

### 9.10 Subir o código

```bash
git remote add origin https://github.com/usuario/nome-do-repo.git
git push -u origin main
```

Quando pedir:
- **Username** → seu usuário do GitHub
- **Password** → cole o token gerado no passo anterior (não aparece nada na tela ao colar
  — é o comportamento normal do terminal, não quer dizer que falhou)

### 9.11 Erros comuns e como resolver

| Mensagem de erro | Causa | Solução |
| --- | --- | --- |
| `Password authentication is not supported for Git operations` | Foi digitada a senha normal da conta em vez do token | Gerar um token (passo 9.9) e usá-lo no campo de senha |
| `remote: Repository not found` | A URL do remote (`git remote add origin ...`) está errada ou o repositório não existe | Confirmar com `git remote -v` e corrigir com `git remote set-url origin <url-correta>` |
| `remote: Write access to repository not granted` (403) | O token usado é do tipo **fine-grained** sem permissão de escrita configurada, ou não tem o escopo certo | Gerar um token **classic** com o escopo `repo` marcado (passo 9.9) |
| `fatal: repositorio ... no encontrado` (com a URL literal `SEU-USUARIO/NOME-DO-REPO`) | Um comando de exemplo foi copiado sem substituir pelos dados reais | Rodar `git remote set-url origin <url-real-copiada-do-github>` |

### 9.12 Depois de subir

- Se o repositório contiver algo que você já sabe que não devia estar lá (credencial,
  mídia grande demais), é mais seguro **apagar o repositório e recomeçar** do que tentar
  limpar o histórico do Git — reescrever histórico já publicado é arriscado.
- Conecte o novo repositório a uma sessão do Claude Code (ou clone normalmente) para dar
  sequência ao trabalho de avaliação/integração do código.
