# AtendeFlow — Multi Atendimento CRM

CRM de multi atendimento multi-empresa, com WhatsApp (Baileys), API Oficial da Meta,
builder de fluxo/chatbot, campanhas e cobrança de clientes (SaaS).

**Versão atual: 2.3.43 (Etapa 6.8 — Painel Vigia ganha card e gráfico ao vivo por Regra de SLA, e a contagem de SLA não zera mais quando o atendimento sai de "aguardando" para "atendendo" — ver `docs/MANUAL_TECNICO.md`, seções 26 e 27)**

## Documentação

- 📘 [Manual técnico completo](docs/MANUAL_TECNICO.md) — arquitetura, modelo de dados e como rodar o projeto.
- 📋 [Avaliação do projeto legado](docs/AVALIACAO_ZAPPRO_LEGADO.md) — relatório que embasou a migração de base.
- 🗒️ [Changelog](CHANGELOG.md) — histórico de versões/etapas entregues e próximas etapas planejadas.

## Início rápido

```bash
docker compose up -d
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm run install:backend
npm run install:frontend
npm run db:migrate
npm run db:seed
npm run dev:backend    # num terminal
npm run dev:frontend   # em outro terminal
```

Veja o [manual técnico](docs/MANUAL_TECNICO.md#4-como-rodar-o-projeto-localmente) para o passo a passo completo.

## Stack

- **Backend:** Node.js, TypeScript, Express, Sequelize, PostgreSQL, Redis, Bull, Socket.io, Baileys
- **Frontend:** React, Material UI, Create React App/CRACO
- **API Oficial (Meta):** NestJS, Prisma (microsserviço separado)
