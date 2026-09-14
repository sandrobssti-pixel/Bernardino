# AtendeFlow — Multi Atendimento CRM

CRM de multi atendimento multi-empresa, com WhatsApp (Baileys), API Oficial da Meta,
builder de fluxo/chatbot, campanhas e cobrança de clientes (SaaS).

**Versão atual: 2.3.16 (Etapa 4 — Alerta de vencimento da assinatura no Dashboard, Master com acesso completo a todas as funcionalidades (isolado por empresa), módulo Financeiro completo (Fase 1: cadastros), assinatura movida para Configurações)**

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
