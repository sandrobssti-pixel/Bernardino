---
name: api-oficial-deploy
description: Use sempre que for implantar o api_oficial (API Oficial do WhatsApp da Meta — NestJS + Prisma) num servidor de cliente novo. Diferente de tudo baseado em Coolify/Docker Compose completo deste repositório — aqui o padrão real é VPS própria com PM2 + Nginx + Certbot (não Coolify). Roteiro genérico condensado a partir dos scripts reais do projeto (`api_oficial/install/*.sh`, `api_oficial/README.md`) e da skill `api-oficial-dev` (seção 4) — inclui uma inconsistência real encontrada nos scripts (Docker e PM2 tentando rodar a mesma app na mesma porta) que precisa ser resolvida antes de usar em produção.
---

# Implantar o api_oficial num servidor de cliente

**Padrão de deploy diferente de todo o resto deste repositório**: aqui
NÃO é Coolify — é VPS própria com **PM2 + Nginx + Certbot**, igual era
o AtendeFlow antes da migração pro Coolify (ver histórico das seções
32+ do `docs/MANUAL_TECNICO.md`). Os scripts já existem em
`api_oficial/install/`, usados como estão — esta skill organiza o uso
deles pra reaproveitar em cliente novo, com os checkpoints e a
inconsistência real já encontrada.

## 0. Pedido ambíguo → perguntar antes de agir

Mesma regra do `CLAUDE.md` da raiz. Em especial, confirmar ANTES de
começar:
- **Docker ou PM2 pra rodar a aplicação** — os scripts existentes fazem
  os dois ao mesmo tempo (ver "Inconsistência real" abaixo), o que
  tende a colidir na porta. Decidir qual dos dois é o caminho de
  verdade pra esse cliente antes de rodar `install/start.sh` sem
  revisar.
- Onde vão morar Postgres/Redis/RabbitMQ — **nenhum dos três é
  provisionado pelos scripts** (`init.sh` só instala Node/PM2/Docker/
  Nginx/Certbot). Precisam existir antes (serviços já rodando no
  próprio servidor, ou externos).
- Domínio e e-mail do Certbot pra esse cliente.

## 1. Pré-requisitos (nada disso é instalado pelos scripts)

- **PostgreSQL** acessível (local ou externo) — vira `DATABASE_LINK`.
- **Redis** acessível — vira `REDIS_URI`.
- **RabbitMQ** acessível — vira `RABBITMQ_URL` (ou
  `RABBITMQ_ENABLED_GLOBAL=false` pra desligar essa integração se o
  cliente não for usar).
- Domínio já apontando (DNS) pro IP do servidor novo — necessário pro
  Certbot emitir certificado.
- Chave SSH do servidor cadastrada no GitHub (pra clonar o repositório
  privado) — `README.md` do `api_oficial/` tem o passo a passo de
  `ssh-keygen` se ainda não tiver.

## 2. Provisionar o servidor (`install/init.sh`)

```bash
cd api_oficial
chmod +x install/*.sh
./install/init.sh
```

Instala Node 20, PM2, Docker, Docker Compose. **Depois de rodar, pode
ser necessário logout/login (ou `newgrp docker`)** pro usuário atual
usar Docker sem `sudo` — o grupo só vale pra sessões novas.

**Checkpoint**: `node -v` (20.x), `pm2 -v`, `docker --version` todos
respondem sem erro.

## 3. Configurar o `.env`

```bash
cp .env.exemplo .env
nano .env
```

| Variável | Preencher com |
|---|---|
| `DATABASE_LINK` | `postgresql://<usuario>:<senha>@<host>:<porta>/<banco>?schema=public` |
| `JWT_SECRET` | segredo aleatório novo (`openssl rand -base64 32`) — nunca reaproveitar de outro cliente |
| `NAME_ADMIN` / `EMAIL_ADMIN` / `PASSWORD_ADMIN` | conta admin inicial da API |
| `TOKEN_ADMIN` | token de aplicação, gerado novo |
| `RABBITMQ_URL` | `amqp://<usuario>:<senha>@<host>/<vhost>` (ou deixar e usar `RABBITMQ_ENABLED_GLOBAL=false`) |
| `URL_BACKEND_MULT100` | URL do backend Mult100 desse cliente, se aplicável |
| `REDIS_URI` | `redis://:<senha>@<host>:6379` |
| `PORT` | padrão `6000` — só mudar se já tiver algo nessa porta |

Segredos sempre gerados novos por cliente, nunca copiados de outro
`.env`.

## 4. Inconsistência real encontrada nos scripts: Docker E PM2 rodando a mesma app

`install/start.sh` faz, nesta ordem: `npm install` + `npm run build` →
**`docker-compose up --build -d`** (sobe o container `api_oficial`,
que roda `node dist/main.js` na porta 6000 via `network_mode: host`,
construído do mesmo `Dockerfile`) → migrations Prisma → **`pm2 start
dist/main.js --name=api_oficial`** (roda a MESMA aplicação, de novo,
na MESMA porta 6000, fora do Docker).

Rodar o script como está tende a dar conflito de porta entre as duas
instâncias (ou uma delas falhar silenciosamente ao tentar bindar uma
porta já ocupada pela outra). **Antes de rodar `install/start.sh` num
cliente novo, decidir qual caminho usar e comentar/pular a parte do
outro**:
- **Só PM2** (mais simples, é o caminho real já documentado na skill
  `api-oficial-dev` seção 4): comentar o passo `docker-compose up
  --build -d` do `start.sh`, ou rodá-lo manualmente sem essa linha.
- **Só Docker**: comentar o passo `pm2 start dist/main.js` do
  `start.sh`, e usar `docker-compose logs -f`/`docker ps` em vez de
  `pm2 status`/`pm2 logs` pra acompanhar.

Se esse comportamento já foi aceito/testado de propósito pelo time
(ex.: um dos dois é só um teste de fumaça que sai do ar logo depois),
confirmar isso com quem já implantou antes de simplesmente corrigir —
é uma mudança de comportamento, não um ajuste de passagem.

## 5. Primeira instalação (`install/start.sh`, depois de resolver a etapa 4)

```bash
./install/start.sh
```

Pede domínio e e-mail (Certbot) interativamente. Faz: `npm
install`/`npm run build` → sobe a aplicação (Docker e/ou PM2, conforme
decidido na etapa 4) → `npx prisma migrate dev` (nota: usa `migrate
dev`, não `migrate deploy`, mesmo em produção — comportamento já
estabelecido, não mudar de passagem) → `npx prisma generate` → instala
e configura Nginx (proxy reverso pra `127.0.0.1:6000`) → instala
Certbot e emite certificado SSL pro domínio informado.

**Checkpoint**: `https://<dominio>/swagger` abre a documentação da API.
`pm2 status` (se usando PM2) mostra `api_oficial` com status `online`.

## 6. Atualizar uma instalação já existente

```bash
cd api_oficial
./install/restart.sh
```

`git pull` + `npm install` + `npm run build` + `pm2 restart all`. Não
mexe em Nginx/Certbot/`.env` — só código e processo.

(Alternativa pontual, só reinicia sem buildar de novo: `install/start-api.sh`
— mesmo fluxo, mas termina com `pm2 start` em vez de `pm2 restart`, útil
se o processo não existir ainda no PM2 daquele servidor.)

**Checkpoint**: `pm2 logs api_oficial --lines 30` sem erro de boot, e
`https://<dominio>/swagger` continua respondendo.

## 7. Checklist final

- [ ] Resolvida a duplicação Docker/PM2 da etapa 4 (só um dos dois
      rodando de verdade na porta 6000).
- [ ] Postgres/Redis/RabbitMQ acessíveis a partir do servidor
      (confirmados antes do `start.sh`, não descobertos durante).
- [ ] `.env` com segredos novos, nunca reaproveitados de outro cliente.
- [ ] `https://<dominio>/swagger` abrindo com certificado válido.
- [ ] `pm2 status` (ou `docker ps`) mostra o processo estável, sem
      reinício em loop.
- [ ] Migrations do Prisma aplicadas sem erro
      (`npx prisma migrate status` pra conferir).

## 8. Commit

Normalmente essa skill não gera commit (é instalação no servidor do
cliente). Pra mudanças no código do `api_oficial/` em si — inclusive se
decidir corrigir de vez a duplicação Docker/PM2 nos scripts — usar a
skill `api-oficial-dev` e as instruções de commit do `CLAUDE.md` da
raiz.
