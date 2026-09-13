# Changelog — AtendeFlow

Todas as etapas de desenvolvimento do projeto são registradas aqui, na ordem em que foram entregues.
Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [Não versionado] — Avaliação do projeto legado — 2026-09-13

Recuperado o código-fonte de um sistema antigo de multi atendimento (`zappro-legado`),
resgatado de um backup de servidor. Avaliação completa registrada em
[`docs/AVALIACAO_ZAPPRO_LEGADO.md`](docs/AVALIACAO_ZAPPRO_LEGADO.md): é um sistema maduro
(1.638 arquivos, ~290 mil linhas) com multi-empresa, multi-sessão de WhatsApp, builder de
fluxo/chatbot, campanhas, cobrança e API oficial da Meta. Recomendação registrada no
documento: usá-lo como nova base do AtendeFlow em vez de reconstruir tudo do zero.

## [1.1.0] — Etapa 1.1: Redesign da interface — 2026-09-13

### Adicionado
- Novo visual "tech" para todo o frontend: tema escuro com gradiente violeta → ciano, fontes
  Space Grotesk (títulos) + Inter (texto) + JetBrains Mono (dados técnicos), painéis em vidro
  fosco (glassmorphism) e grade sutil de fundo.
- Ícones em SVG próprios (sem dependência externa) para navegação, status e ações.
- Barra de estatísticas no topo da Caixa de entrada (total de conversas, aguardando atendimento,
  sessões WhatsApp conectadas, atendentes online) — visão rápida do estado do atendimento.
- Estados vazios explicativos em toda a aplicação (ex: "Nenhuma conversa ainda", "Nenhuma sessão
  criada") com instruções de próximo passo, em vez de telas em branco.
- Tela de conexão do WhatsApp reformulada em formato de passo a passo (1. nomear sessão,
  2. escanear QR Code, 3. pronto para atender), com instruções diretas na tela.
- Indicadores visuais de status (pílulas coloridas com legenda) para conversas, atendentes e
  sessões do WhatsApp — sem precisar interpretar cores sozinho.
- Cabeçalho (`Topbar`) em cada tela com título e explicação curta do que ela faz.

### Sem mudanças de backend/API nesta versão — apenas camada visual do frontend.

## [1.0.0] — Etapa 1: Estrutura Base — 2026-09-13

### Adicionado
- **Backend** (Node.js + TypeScript + Express + Prisma + PostgreSQL):
  - Autenticação com e-mail/senha e JWT (`/auth/register`, `/auth/login`, `/auth/me`, `/auth/logout`).
    O primeiro usuário cadastrado no sistema vira automaticamente `ADMIN`.
  - Modelo de dados inicial: `User` (atendentes), `Contact`, `Queue` (filas), `Conversation` e `Message`.
  - CRUD básico de usuários, filas e contatos.
  - Módulo de conversas com atribuição de atendente (`/conversations/:id/assign`) e mudança de status
    (`OPEN`, `PENDING`, `CLOSED`).
  - Envio de mensagens de um atendente para o contato (`POST /messages`).
  - **Integração real com WhatsApp via Baileys** (`@whiskeysockets/baileys`):
    - Criação de sessão com pareamento por QR Code.
    - Recebimento de mensagens de texto, criando/atualizando contato e conversa automaticamente.
    - Envio de mensagens de texto para o WhatsApp do contato.
    - Reconexão automática de sessão em caso de queda (exceto logout manual).
  - Comunicação em tempo real com o frontend via Socket.io (`conversation:updated`, `message:new`,
    `whatsapp:qr`, `whatsapp:status`).
- **Frontend** (React + Vite + TypeScript + Tailwind CSS):
  - Telas de login e cadastro.
  - Caixa de entrada (inbox) com lista de conversas e janela de chat em tempo real.
  - Tela de conexão do WhatsApp com exibição do QR Code.
  - Tela de configurações (lista de atendentes e cadastro de filas).
- **Infraestrutura**:
  - `docker-compose.yml` com PostgreSQL para desenvolvimento local.
  - Monorepo com npm workspaces (`backend` + `frontend`) e script único (`npm run dev`) para subir os dois.
  - Manual técnico do sistema (`docs/MANUAL_TECNICO.md`).

### Limitações conhecidas desta versão (a evoluir nas próximas etapas)
- Suporta apenas uma sessão de WhatsApp conectada por vez para envio de mensagens.
- Mensagens de grupo do WhatsApp são ignoradas.
- Mídias (imagem, áudio, vídeo, documento) ainda não são recebidas/enviadas — apenas texto.
- Credenciais da sessão do WhatsApp ficam em arquivos locais (pasta `backend/sessions/`), o que não é
  adequado para múltiplas instâncias/servidores em produção.
- Sem testes automatizados, sem paginação nas listagens e sem relatórios/dashboards.

---

## Próximas etapas sugeridas (ainda não iniciadas)
- Etapa 2: suporte a múltiplas sessões/números de WhatsApp simultâneos, com roteamento por fila.
- Etapa 3: envio/recebimento de mídia (imagem, áudio, documento).
- Etapa 4: relatórios e dashboards de atendimento (tempo de resposta, volume por atendente/fila).
- Etapa 5: outros canais (chat web, Instagram, Telegram).
