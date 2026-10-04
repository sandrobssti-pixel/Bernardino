---
name: api-oficial-dev
description: Use sempre que for mexer em api_oficial/ — a integração com a API Oficial do WhatsApp da Meta (NestJS + Prisma), separada do AtendeFlow (backend/frontend, que usa Baileys/WhatsApp não-oficial). Nova feature, correção de bug, webhook da Meta, envio/recebimento de mensagem oficial, ou deploy. Reúne os procedimentos já estabelecidos pra manter consistência em vez de redescobrir a cada pedido.
---

# Procedimentos do api_oficial (API Oficial do WhatsApp — Meta)

Projeto separado do AtendeFlow (`backend/`+`frontend/`) — stack diferente
(NestJS + Prisma em vez de Express + Sequelize), integra com a API Graph
oficial da Meta em vez do Baileys (lib não-oficial usada no AtendeFlow).
Não confundir os dois: `backend/` fala com o WhatsApp "por fora" (sessão
Baileys, QR Code); `api_oficial/` fala com a API de verdade da Meta
(Business API, token/webhook oficiais).

## 0. Pedido ambíguo → perguntar antes de codar

Mesma regra do `CLAUDE.md` da raiz — parar e perguntar quando o pedido
permitir mais de um caminho razoável, em vez de supor.

## 1. Multiempresa + por conexão

Dado isolado por `company` (tabela `company` no Prisma) e, dentro dela, por
`whatsappOficial` (uma conexão/número Business específico — campo
`conexaoId`/`whatsappId` nas rotas). As rotas de webhook são
`/:companyId/:conexaoId` — toda query feita a partir de um webhook recebido
precisa confirmar que a conexão pertence de fato à company do path, nunca
confiar cegamente no par da URL.

## 2. Webhook da Meta — handshake de verificação, SEM validação de assinatura

`src/resources/v1/webhook/webhook.controller.ts`:
- `GET /v1/webhook/:companyId/:conexaoId` implementa o handshake de
  verificação da Meta (`hub.mode` + `hub.verify_token` nos query params) —
  é assim que a Meta confirma o endpoint na hora de configurar o webhook no
  painel do Business Manager.
- `POST /v1/webhook/:companyId/:conexaoId` recebe os eventos de verdade
  (mensagem recebida, status de entrega, etc.), marcado `@Public()`
  (sem autenticação — precisa ser público pra Meta conseguir chamar).

**Risco conhecido, não corrigido**: o `POST` não valida o header
`X-Hub-Signature-256` (assinatura HMAC que a Meta envia em cada webhook,
calculada com o App Secret) — qualquer um que descubra/adivinhe um
`companyId`/`conexaoId` válido pode mandar um payload falso pro endpoint.
Mitigação atual é só a obscuridade do path. Se for endurecer isso, validar
a assinatura é o próximo passo natural — mas é mudança de segurança que
merece ser tratada (e testada) separada de qualquer outra, não de
passagem dentro de uma feature não relacionada.

## 3. Banco — Prisma, não Sequelize

Modelos principais: `company`, `whatsappOficial`, `sendMessageWhatsApp`
(`prisma/schema.prisma`). Depois de mudar o schema:
```bash
cd api_oficial
npx prisma generate   # regenera o client tipado
npx prisma migrate dev --name descricao_da_mudanca   # gera + aplica migration em dev
```
O script `install/start.sh` (primeira instalação) usa `prisma migrate dev`
mesmo em produção — não é `migrate deploy`. Ao tocar nisso, ter em mente
que é esse o comando já estabelecido no fluxo real, mesmo não sendo o mais
"certo" pra produção — mudar esse comportamento é uma decisão separada, não
um ajuste de passagem.

## 4. Deploy — VPS própria com PM2 + Nginx + Certbot, NÃO Coolify

Diferente do AtendeFlow (Coolify/Docker Compose) e do disk-monitor (SSH
script simples). Aqui:
- `install/init.sh` — provisiona a VPS do zero (Node 20, PM2, Docker,
  Nginx, Certbot).
- `install/start.sh` — primeira instalação: `npm install` + `npm run build`
  (`nest build`) + sobe containers Docker auxiliares + migrations Prisma +
  `pm2 start dist/main.js --name=api_oficial` + configura Nginx/Certbot
  pro domínio informado.
- `install/restart.sh` — atualização de uma instalação já existente:
  `git pull` + `npm install` + `npm run build` + `pm2 restart all`. Esse é
  o equivalente ao `update.sh` do disk-monitor pra este projeto.

## 5. Validação antes de commitar

```bash
cd api_oficial
npx tsc --noEmit -p tsconfig.json   # typecheck
npm run lint                         # eslint --fix (confirmar que roda sem erro neste projeto antes de usar)
npm test                             # jest — confirmar que não precisa de infra externa (Redis/RabbitMQ) rodando antes de assumir que vai passar local
```

Note as dependências `amqplib`/`ioredis` no `package.json` — se algum teste
depender de RabbitMQ/Redis de verdade, rodar local sem essa infra vai falhar
por motivo de ambiente, não por bug no código. Confirmar o que está
disponível antes de tirar conclusão de um teste falhando.

## 6. Commit

Mensagem com o quê + por quê (nunca só "fix bug"), rodapé de atribuição
conforme as instruções da sessão. Rodar a validação da seção 5 antes. Este
projeto não tem o hábito de CHANGELOG/manual técnico separado que o
AtendeFlow tem — se isso mudar (time passar a querer esse histórico aqui
também), seguir o mesmo modelo do `atendeflow-dev` em vez de inventar um
formato novo.
