---
name: atendeflow-dev
description: Use sempre que for mexer em backend/ ou frontend/ (o CRM AtendeFlow — multi atendimento com WhatsApp) — nova feature, correção de bug, integração com WhatsApp (Baileys), telas de Conexões, campanhas, multiempresa, i18n, ou deploy. Reúne os procedimentos já estabelecidos neste projeto (versionamento em 3 lugares, documentação dupla changelog+manual técnico, i18n em 5 idiomas, ciclo de vida de sessão do WhatsApp, deploy via Coolify) pra manter tudo consistente em vez de redescobrir ou espalhar a informação a cada pedido novo.
---

# Procedimentos do AtendeFlow (backend/ + frontend/)

CRM de multiatendimento multiempresa (multi-tenant) com integração WhatsApp,
usado por clientes pagantes de verdade em produção. Atenção especial a
qualquer coisa que toque sessão do WhatsApp, campanhas em massa, ou dados de
outra empresa — já houve incidente real de mensagem indo pro contato errado
(ver CHANGELOG.md v2.3.82/2.3.83).

## 0. Pedido ambíguo → perguntar antes de codar

Mesma regra do `CLAUDE.md` da raiz: se o pedido permitir mais de um caminho
razoável (ex.: "ícone no desktop" podia ser PWA ou Electron — foram coisas
bem diferentes em risco/esforço), pare e pergunte antes de implementar. Só
pule a pergunta com bug reproduzido com clareza ou pedido com um único jeito
óbvio de resolver.

## 1. Versionamento — TRÊS lugares, sempre juntos (fácil esquecer um)

A versão mostrada no chip da barra lateral do sistema **não vem do
`CHANGELOG.md`** — vem de `backend/src/utils/version.ts`
(`export const version = '2.3.84'`), que precisa ser atualizado manualmente
a cada mudança relevante, junto com:
- `backend/src/utils/version.ts`
- `backend/package.json` (`"version"`)
- `frontend/package.json` (`"version"`)

Isso já ficou **travado em "15.0.10" por várias etapas** antes de alguém
notar (corrigido na v2.3.7, ver `docs/MANUAL_TECNICO.md`) — os três
precisam bater com o número usado no `CHANGELOG.md` dessa entrega.

## 2. Documentação dupla — CHANGELOG.md + docs/MANUAL_TECNICO.md

Toda mudança relevante ganha as duas coisas, sempre:
- Uma entrada nova no topo do `CHANGELOG.md` (formato Keep a Changelog):
  `## [versão] — título curto — data`, seções `### Corrigido`/`### Adicionado`
  com o quê + por quê, terminando com
  `Detalhes em \`docs/MANUAL_TECNICO.md\`, seção N.`
- Uma seção numerada nova em `docs/MANUAL_TECNICO.md` (seções são
  sequenciais, nunca reaproveitar número) com o relato técnico completo:
  causa raiz, o que foi tentado, o que funcionou. Atualizar também o cabeçalho
  do manual (**Versão do documento**, **Etapa**, **Última atualização** — a
  numeração de "Etapa" é PARALELA à de versão, não é a mesma sequência).

Isso não é burocracia: é o único jeito de não re-investigar do zero um bug
já resolvido há 40 versões (ex.: a história do número de telefone BR com
12 vs. 13 dígitos, revisitada mais de uma vez).

## 3. i18n — CINCO idiomas, sempre os cinco juntos

`frontend/src/translate/languages/`: `pt.js`, `en.js`, `es.js`, `esES.js`,
`tr.js`. Toda chave nova de texto fixo precisa existir nos CINCO, na mesma
posição relativa dentro do objeto `translations`. Esquecer um idioma quebra
a UI silenciosamente só nesse idioma (texto cru da chave ou `undefined`) —
fácil de não notar testando só em pt-BR. Note que `es.js`/`esES.js` às vezes
não têm vírgula depois da última chave de um bloco — conferir a sintaxe com
`node --check arquivo.js` depois de editar.

## 4. Multiempresa (multi-tenant) — nunca vazar dado entre empresas

Toda entidade (WhatsApp, contato, ticket, campanha...) pertence a uma
`companyId`. Serviços que buscam um recurso por id (ex.:
`ShowWhatsAppService`) sempre reconferem `recurso.companyId !== companyId`
do usuário autenticado e rejeitam se não bater — nunca confiar só no id da
URL/payload. Ao adicionar um serviço novo que busca por id, seguir esse
mesmo padrão de reconferência.

## 5. WhatsApp (Baileys) — ciclo de vida de sessão, cheio de pegadinha

Máquina de estados em `Whatsapp.status`: `DISCONNECTED` → `OPENING`
("Conectando" na tela) → `qrcode` (mostra QR) → `CONNECTED`. Lógica
principal em `backend/src/libs/wbot.ts` (`initWASocket`) e
`backend/src/services/WbotServices/StartWhatsAppSession.ts`.

Pegadinhas já batidas em produção, pra não redescobrir:

- **`tryGetWbot(id)` só retorna algo depois que a sessão chega em `qrcode`
  ou `CONNECTED`** (`sessions` array só é populado nesses dois pontos,
  `wbot.ts`) — NÃO no momento em que o status vira `OPENING`. Qualquer
  checagem de "sessão já iniciando" baseada em `tryGetWbot` fica cega
  durante essa janela inicial.
- **Timeout de segurança (90s) tem que ser armado ANTES de qualquer
  `await`**, não depois. Já foi corrigido uma vez (`initWASocket` armava o
  timeout só depois de três awaits — se um deles travasse, ex. lock de
  linha no Postgres, não existia timer nenhum ainda rodando pra resgatar a
  sessão, e ela ficava presa em "Conectando" pra sempre). Qualquer timer de
  resgate novo tem que ser criado o mais cedo possível na função, usando só
  dados já em memória (parâmetros), nunca depois de um `await`.
- **`reconnectTimers` (backoff de reconexão) e `qrExpiryTimers` (expiração
  de 120s do QR) são mapas SEPARADOS de propósito** — já foram o mesmo mapa
  uma vez, e um cancelava o outro sem querer (reconectar cancelava
  silenciosamente um QR pendente, e vice-versa). Nunca reunir os dois de
  volta num mapa só.
- **`sessionStartLocks` em `StartWhatsAppSession.ts` tem TTL de 120s** —
  depois disso, um lock é tratado como "antigo" e liberado, permitindo uma
  nova tentativa concorrente com a antiga (que pode ainda estar presa). Se
  for mexer nessa trava, lembrar que uma segunda tentativa pode colidir com
  a primeira em vez de simplesmente substituí-la.
- **Não existe `statement_timeout` configurado no Postgres**
  (`backend/src/config/database.ts`) — uma query travada numa linha
  (lock) pode bloquear indefinidamente sem erro nenhum do lado do Node.
  Isso é um risco conhecido, documentado, mas NÃO corrigido (mudar isso é
  uma config global que afeta toda query do sistema — avaliar com cuidado
  e separado de qualquer outra mudança, nunca de passagem).
- A tela de Conexões (`frontend/src/pages/Connections/index.js`, e as
  variantes `AllConnections`/`CompanyWhatsapps`) usa o MESMO componente
  `QrcodeModal` — ele só reage a `qrcode` chegando ou status `CONNECTED`;
  qualquer novo status/transição que o backend passe a emitir precisa de
  tratamento explícito ali também, senão o modal fica girando sem avisar
  nada (já aconteceu com `DISCONNECTED` depois de uma falha).

## 6. Deploy — Coolify, não é SSH script

Diferente do `server-toolkit/disk-monitor` (que tem `update.sh` rodado via
SSH), o AtendeFlow roda num VPS com **Coolify**, como um recurso Docker
Compose (`docker-compose.coolify.yml`, não o `docker-compose.yml` da raiz —
esse é só banco+redis de desenvolvimento local). Deploy de código novo
precisa de um **Redeploy manual no painel do Coolify** (ou webhook
configurado lá, se houver) — `git push` sozinho não implanta nada. Variáveis
de ambiente ficam na aba de variáveis do recurso no Coolify, nunca direto no
arquivo compose (ver `.env.coolify.example` como roteiro). Detalhes completos
em `docs/MANUAL_TECNICO.md`, seção 32 ("Deploy do AtendeFlow via Coolify") e
seção 33 (Cloudflare Tunnel).

## 7. Validação antes de commitar

```bash
# Backend: typecheck é o check confiável (lint tem bug de config
# pré-existente em eslint-config-prettier — "prettier/@typescript-eslint
# merged into prettier" — não é algo pra corrigir de passagem)
cd backend && npx tsc --noEmit -p tsconfig.json

# Frontend: eslint funciona direto nos arquivos tocados
cd frontend && npx eslint src/caminho/do/arquivo.js
```

`backend`'s `npm test` roda migrations reais (`pretest`) e depois as desfaz
(`posttest`) contra o banco configurado em `NODE_ENV=test` — nunca rodar
isso contra um banco de produção/desenvolvimento com dado real.

## 8. Commit

Mensagem com o quê + por quê (nunca só "fix bug"), rodapé de atribuição
conforme as instruções da sessão. Rodar a validação da seção 7 antes.
