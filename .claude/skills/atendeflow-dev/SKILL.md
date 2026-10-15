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

**Regra permanente**: toda atualização relevante do AtendeFlow atualiza os
TRÊS juntos — versão do sistema (seção 1), `CHANGELOG.md` +
`docs/MANUAL_TECNICO.md` (acima), e a skill `atendeflow-deploy` (ou outra
skill de implantação afetada — `coolify-deploy`, `cloudflare-tunnel-deploy`,
etc.) sempre que a mudança alterar algo que essas skills descrevem (passo de
deploy, variável de ambiente nova, pré-requisito, pegadinha nova encontrada).
Não fazer isso de cabeça a cada pedido — conferir esta lista antes de
considerar a entrega concluída.

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

## 6. Deploy — SSH + `docker compose` direto, NÃO o botão Redeploy do Coolify

O AtendeFlow roda num VPS com Coolify instalado, mas (pelo menos na
implantação real da Confiança Technologies) o recurso usado lá é do tipo
"Service" (YAML colado direto, sem repositório Git conectado) — esse tipo
**nunca clona o código-fonte**, só guarda o texto do compose. `backend` e
`frontend` usam `build: context: ./backend`/`./frontend`, que exigem o
código de verdade no disco — clicar em "Deploy" nessa tela SEMPRE falha com
`unable to prepare context: path ".../backend" not found` (já aconteceu
duas vezes, mesmo erro, ver `docs/MANUAL_TECNICO.md` seções 35 e — se
existir — a mais recente). **Não perder tempo tentando usar essa tela de
novo** — ela ficou órfã, os containers reais não são mais geridos por ela.

O fluxo real, direto por SSH na VPS, dentro de `~/atendeflow`:

```bash
cd ~/atendeflow
git pull origin claude/tender-carson-h1zc86   # ver seção 9 antes — pode não ser tão simples
sudo docker compose -f docker-compose.coolify.yml --env-file .env build --no-cache backend frontend
sudo docker compose -f docker-compose.coolify.yml --env-file .env up -d --force-recreate backend frontend
```

Rebuildar só o que mudou (`backend` OU `frontend`) economiza ~2-3min. O
Postgres continua gerido pelo Coolify normalmente — só `backend`,
`frontend`, `redis`, `cloudflared` saíram do controle da interface.
Variáveis de ambiente ficam no `.env` dessa pasta no servidor (não na aba
do Coolify, que não se aplica mais aqui). Detalhes completos em
`docs/MANUAL_TECNICO.md`, seção 32 ("Deploy do AtendeFlow via Coolify",
histórico) e seções 35-36 (a migração real pra esse fluxo SSH).

## 7. Antes de assumir que um fix "não pegou": confira se o servidor bate com o GitHub

Já aconteceu (outubro/2026) do `~/atendeflow` do servidor ter **divergido**
da branch do GitHub — commits só locais, nunca commitados nem enviados,
misturados com customizações reais de produção (logo, favicon, PWA,
integrações). Sintoma: `git pull` recusa ("branches diverged, X and Y
commits"), e rebuildar não traz o fix mesmo depois de confirmado que o
commit existe no GitHub.

**Antes de instruir qualquer deploy**, rodar no servidor:

```bash
cd ~/atendeflow && git status && git log -1 --oneline
```

- Working tree limpo e commit batendo com o esperado → segue o fluxo normal
  da seção 6.
- Divergência ou mudanças locais não commitadas → **não fazer `git pull`
  nem `git reset --hard` sem avisar o cliente** (risco real de apagar
  customização de produção que só existe ali). Duas saídas seguras,
  dependendo do arquivo:
  - **Arquivo sem modificação local** (não aparece no `git status`):
    seguro substituir o conteúdo inteiro, arquivo por arquivo —
    `git fetch origin <branch>` seguido de
    `git show origin/<branch>:<caminho> > <caminho>` (local no repo
    clonado desta sessão, não no SSH) e rebuildar.
  - **Arquivo com modificação local** (aparece como staged ou não-staged):
    NÃO sobrescrever. Pedir `grep -n -A 2 "<âncora>"` do trecho relevante
    no servidor, montar um `sed -i '<linha>a\<texto novo>'` cirúrgico que
    só insere o necessário, e confirmar com `node --check`
    (JS)/`npx tsc --noEmit` (TS) antes do rebuild.
  Reconciliar de vez (commitar o que está solto no servidor + merge com o
  GitHub) é trabalho maior, com conflito arquivo por arquivo — só fazer se
  o cliente pedir explicitamente e confirmar que quer isso (ver pergunta
  obrigatória da seção 0).

## 8. Nome de arquivo / link de mídia — encoding é fácil de esquecer

`Message.ts`, getter `mediaUrl`, é o ÚNICO lugar que monta a URL pública de
qualquer mídia (usado por frontend principal, webchat, `forwardMessage`,
transcrição/visão de IA, etc.) — sempre aplica `encodeURIComponent` no nome
do arquivo antes de montar o link (`docs/MANUAL_TECNICO.md`, seção 79).
Antes disso, nome com caractere fora do ASCII básico "funcionava sozinho"
só porque o navegador escapa automaticamente caractere não-ASCII ao montar
a requisição a partir de um `href` — mas um "%" **literal** no nome (ex.:
nome de arquivo que já veio com sequência tipo `%C2%BA` como texto, não
como escape de verdade — aconteceu com nota fiscal baixada/assinada no
gov.br) não é reescapado pelo navegador, e dá "Cannot GET".

Qualquer código novo que extraia o nome do arquivo direto de
`mensagem.mediaUrl` (em vez de usar o link como está) precisa de
`decodeURIComponent` depois do `.split("/").pop()` — já esquecido uma vez
em `OpenAiService.ts` (dois pontos, transcrição de áudio e visão de
imagem), que usavam o nome extraído como caminho de disco direto.

**Diagnóstico de "Cannot GET" num link de mídia**: antes de supor que o
arquivo sumiu ou está corrompido, confirmar se ele existe de verdade
dentro do container (o volume do Docker não aparece necessariamente no
mesmo caminho no host):

```bash
sudo docker exec atendeflow-backend-1 find /app/public/company{ID} -iname "*trecho-do-nome*"
```

Se achar o arquivo intacto, o problema é de encoding no link, não de
arquivo perdido — ver a causa acima antes de qualquer ação destrutiva
(renomear/apagar).

## 9. Validação antes de commitar

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

## 10. Commit

Mensagem com o quê + por quê (nunca só "fix bug"), rodapé de atribuição
conforme as instruções da sessão. Rodar a validação da seção 7 antes.
