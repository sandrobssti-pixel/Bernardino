# Build de produção do frontend do AtendeFlow, pensado pra rodar via
# Coolify. Ver docs/MANUAL_TECNICO.md, seção "Deploy com Coolify".
#
# IMPORTANTE: as variáveis REACT_APP_* do Create React App são gravadas
# dentro dos arquivos estáticos NO MOMENTO DO BUILD — não dá pra trocar
# depois só reiniciando o container. No Coolify, configure-as como
# "Build Variables" (ou equivalente), não só como variáveis de runtime.

FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package*.json ./
# --legacy-peer-deps e o ajv fixo: mesmo ajuste já usado no instalador.sh
# do servidor atual, por causa de um conflito de peer-dependency entre
# material-ui-color/material-ui-popup-state e as demais libs do projeto.
RUN npm install --legacy-peer-deps \
  && npm install -D ajv@^8.17.1 ajv-keywords@^5.1.0 --legacy-peer-deps

COPY . .

ARG REACT_APP_BACKEND_URL
ARG REACT_APP_NUMBER_SUPPORT
ARG REACT_APP_WA_CONNECT_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV REACT_APP_NUMBER_SUPPORT=$REACT_APP_NUMBER_SUPPORT
ENV REACT_APP_WA_CONNECT_URL=$REACT_APP_WA_CONNECT_URL
ENV GENERATE_SOURCEMAP=false
ENV NODE_OPTIONS=--max-old-space-size=4096

RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
RUN npm install -g serve

COPY --from=builder /app/build ./build

EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]
