# Build de produção do backend do AtendeFlow, pensado pra rodar via
# Coolify (ou qualquer orquestrador que fale Docker/Docker Compose).
# Ver docs/MANUAL_TECNICO.md, seção "Deploy com Coolify".

FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package*.json ./
# puppeteer está no package.json mas não é usado em nenhum lugar do
# código-fonte (confirmado por busca) — pular o download do Chromium dele
# economiza tempo de build e espaço, sem tirar nenhuma funcionalidade.
RUN PUPPETEER_SKIP_DOWNLOAD=true npm install

COPY . .
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.sequelizerc ./.sequelizerc
COPY --from=builder /app/package*.json ./

# Uploads (mídia do WhatsApp, currículos do RH, fotos de perfil etc.) —
# precisa ser um volume persistente, senão some a cada novo deploy.
RUN mkdir -p public
VOLUME ["/app/public"]

EXPOSE 8080

# Roda as migrations pendentes (idempotente — sequelize-cli só aplica as
# que ainda não rodaram) antes de subir o servidor. A sessão do WhatsApp
# (Baileys) já é salva direto no Postgres (ver authState.ts), não no
# disco — não precisa de volume extra pra isso.
CMD ["sh", "-c", "npx sequelize-cli db:migrate && node dist/server.js"]
