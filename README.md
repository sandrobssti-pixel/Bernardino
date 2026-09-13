# AtendeFlow — Multi Atendimento CRM

CRM de multi atendimento com integração ao WhatsApp via [Baileys](https://github.com/WhiskeySockets/Baileys).

**Versão atual: 1.1.0 (Etapa 1.1 — Redesign da interface)**

## Documentação

- 📘 [Manual técnico completo](docs/MANUAL_TECNICO.md) — arquitetura, modelo de dados, API e como rodar o projeto.
- 🗒️ [Changelog](CHANGELOG.md) — histórico de versões/etapas entregues e próximas etapas planejadas.

## Início rápido

```bash
npm install
docker compose up -d
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm run prisma:migrate
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3333

Veja o [manual técnico](docs/MANUAL_TECNICO.md#4-como-rodar-o-projeto-localmente) para o passo a passo completo, incluindo a conexão do WhatsApp via QR Code.

## Stack

- **Backend:** Node.js, TypeScript, Express, Prisma, PostgreSQL, Socket.io, Baileys
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Zustand
