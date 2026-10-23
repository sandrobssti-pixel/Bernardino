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

⚠️ **Nunca encurtar esse comando pra `docker compose build frontend
backend` (sem `-f docker-compose.coolify.yml --env-file .env`) num
deploy rápido passado por chat** — já aconteceu (outubro/2026) de dar
exatamente isso de memória, sem reler essa seção antes: o `docker
compose` sem `-f` cai no `docker-compose.yml` da raiz do repo (que só
tem `postgres`/`redis`, serve pra dev local), e falha com `no such
service: frontend`/`no such service: backend` — build nunca roda,
cliente reporta "ficou igual" depois de um push que devia ter mudado
alguma coisa. Sempre copiar o comando completo (com `-f` e
`--env-file`) direto dessa seção, não resumir de cabeça.

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
    **`git fetch origin <branch>` tem que rodar TODA VEZ, em TODA rodada
    de deploy — nunca só uma vez no início da sessão.** `git show
    origin/<branch>:<caminho>` lê da referência LOCAL cacheada
    (`origin/<branch>`), que só atualiza com um fetch/pull explícito. Batido
    na prática (outubro/2026, v2.3.97-101): a primeira tentativa de `git
    pull` fez o fetch com sucesso antes de falhar no merge — deixando a
    referência local travada naquele commit. As cinco rodadas de deploy
    seguintes (~5 versões, horas de trabalho) só copiaram `git show` sem
    fetch antes, e cada uma delas **copiou silenciosamente o mesmo
    conteúdo antigo de novo** — sem erro nenhum, o build sempre completava
    normal (só recompilava a mesma versão desatualizada). O sintoma
    (`docs/MANUAL_TECNICO.md`, seção 86) foi um bug que já tinha sido
    corrigido no código continuar "não resolvendo" em produção repetidas
    vezes. **Checagem rápida pra confirmar que pegou**: depois do `git
    show`, `wc -l <arquivo>` deveria bater com o número de linhas do
    arquivo local (desta sessão) — se vier bem menor, é sinal de que
    trouxe uma versão antiga.
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

**Ambiente novo sem `node_modules` instalado** (ex.: sessão/container
recém-criado): `npx tsc` sem o `node_modules` do próprio projeto cai num
TypeScript global (versão mais nova, incompatível com o `moduleResolution`
do `tsconfig.json` do backend) e dá um erro de configuração que parece erro
de código, mas não é (`TS5107`, `moduleResolution=node10` deprecated). Rodar
`npm ci --prefer-offline --no-audit --no-fund` em `backend/` (e/ou
`frontend/`, se for lint lá) antes de confiar no resultado do typecheck —
nesse projeto a instalação é rápida (~1400 pacotes em menos de 1 minuto).

`backend`'s `npm test` roda migrations reais (`pretest`) e depois as desfaz
(`posttest`) contra o banco configurado em `NODE_ENV=test` — nunca rodar
isso contra um banco de produção/desenvolvimento com dado real.

**`npx eslint` e o dev server do CRA NÃO pegam tudo — rodar o build de
produção de verdade antes de entregar qualquer PR de frontend.** Batido em
produção (v2.3.117): `import XLSX from "xlsx"` (default export) passou no
ESLint e funcionava no dev server, mas quebrava o `docker compose build`
do cliente com "Attempted import error: 'xlsx' does not contain a default
export" — só o build de produção real (webpack com tree-shaking/strict
module resolution) pega esse tipo de erro. Comando:
```bash
cd frontend && GENERATE_SOURCEMAP=false CI=false npx craco build
```
Rodar isso (não só lint) antes de toda entrega que toque em import de
pacote de terceiro no frontend — mais caro que o lint, mas muito mais
barato que o cliente descobrir no deploy.

**O cache do webpack/craco pode mascarar exatamente esse tipo de erro.**
Batido na prática (v2.3.202): um `import { SmartToy } from
"@material-ui/icons"` (ícone que só existe no Material-UI v5; este
projeto usa v4, `@material-ui/icons` 4.11.3) passou num `npx craco
build` local — "Compiled successfully" — e só quebrou de verdade no
deploy do cliente. Rodando `rm -rf build node_modules/.cache` antes de
buildar de novo, o erro reproduziu na hora. Pra qualquer ícone/nome
importado de pacote de terceiro novo, ou sempre que for investigar um
build que falhou no cliente mas "passou" localmente, limpar `build/` e
`node_modules/.cache` antes de confiar no resultado — não basta rodar
o `craco build` uma vez e seguir em frente.

## 10. Commit

Mensagem com o quê + por quê (nunca só "fix bug"), rodapé de atribuição
conforme as instruções da sessão. Rodar a validação da seção 7 antes.

## 11. Módulo Financeiro — convenções próprias (diferentes do resto do app)

`frontend/src/pages/Financeiro/` + `backend/src/.../FinanceService/` têm
duas convenções que **não** seguem as regras gerais das seções 3 e 2 deste
documento — confirmado investigando o código existente antes de presumir
que eram esquecimento:

- **Não usa o catálogo de i18n (seção 3)**: todo rótulo de campo/coluna em
  `financeConfig.js` é string fixa em PT-BR, e nenhum código de erro
  `ERR_FINANCE_*` tem entrada em `backendErrors` em nenhum dos 5 idiomas
  (nem os que já existiam antes de qualquer trabalho recente, ex.
  `ERR_FINANCE_PRODUCT_INVALID_NAME`) — sem tradução, cai no fallback de
  `toastError.js` que mostra o código bruto. Faz sentido: o módulo inteiro é
  voltado à regulamentação brasileira (CPF/CNPJ, NF-e, SIGMA/SINARM, Decreto
  11.615/2023 etc.), que não existe nos outros países atendidos pelo
  catálogo. **Ao adicionar campo/erro novo neste módulo, seguir essa mesma
  convenção (string fixa em PT-BR, sem entrada em `backendErrors`)** — não
  é inconsistência a corrigir de passagem; se um dia decidirem
  internacionalizar o Financeiro, é um projeto próprio pra TODOS os
  `ERR_FINANCE_*`/rótulos de uma vez, não field-by-field.
- **Yup nesse projeto é 0.32.x** (backend `^0.32.11`, frontend `^0.32.8`) —
  sintaxe de objeto antiga pra condicional, não a função `(schema) =>
  schema` do Yup 1.x:
  ```js
  campo: Yup.string().when("outroCampo", {
    is: (v) => v === "valor",
    then: Yup.string().required("ERR_CODE"),
    otherwise: Yup.string().nullable()
  })
  ```
- **`FinanceRecordModal` (`frontend/src/components/FinanceRecordModal/`)
  suporta campo condicional** desde a v2.3.95 — antes disso todo campo do
  array `fields` sempre renderizava, sem exceção. Ao declarar um campo em
  `financeConfig.js` que só deve aparecer conforme outro valor do form (ex.:
  campos de arma só quando `type = "weapon"`):
  - `visibleWhen: (values) => boolean` — some da tela quando falso. Ao
    submeter, o modal já limpa (`stripHiddenFieldValues`) o valor de
    qualquer campo que ficou invisível, pro `defaultValue`/vazio — não
    precisa fazer isso manualmente.
  - `requiredWhen: (values) => boolean` — obrigatório só quando verdadeiro
    (usa `Yup.string().test(...)`, lendo `context.parent` pros outros
    valores do form). Só funciona bem em campo de texto simples; não foi
    testado com `select`/`switch`/`asyncSelect`.
  - Esse padrão é genérico e reaproveitável por qualquer cadastro futuro do
    módulo (não é algo específico de arma/munição).
- **Modelo de arma/munição (`FinanceProduct` type `"weapon"`/`"ammunition"`)
  — desde a v2.3.204, Produto é o MODELO/SKU, não mais 1 arma física por
  linha.** Até a v2.3.203, cada arma física era um `FinanceProduct` inteiro
  (mesmo SKU repetido entre as armas do mesmo modelo, `serialNumber`/
  `sigmaRegistrationNumber`/`weaponStatus` gravados direto no produto) —
  pedido do cliente pra poder cadastrar as N armas de um SKU sem duplicar
  produto, vender/consultar por nome, SKU OU número de série, e tirar
  relatório por arma individual. Esses 3 campos migraram pra
  `FinanceWeaponUnit` (`backend/src/models/FinanceWeaponUnit.ts`,
  `FinanceWeaponUnitService.ts`), sub-cadastro com 1 linha por número de
  série, ligado ao Produto por `productId`. As colunas antigas continuam em
  `FinanceProducts` (não removidas, só não usadas mais pelo app — segurança/
  auditoria sem precisar restaurar backup). Editar/cadastrar arma na tela:
  nome/SKU/calibre/etc. no Produto; cada unidade física entra em
  `WeaponUnitsSection.js` (dentro do `FinanceRecordModal`, pseudo-campo
  `type: "weaponUnits"`, mesmo mecanismo do `type: "photo"`) — só o número
  de série é obrigatório ali. Venda (`SaleModal.js`): produto tipo arma
  mostra um autocomplete de número de série (unidades "em estoque" daquele
  SKU, `finance.products.weaponUnits.search`); escolher uma liga
  `SaleItem.weaponUnitId` e autopreenche SIGMA/SINARM. `SaleService.
  adjustWeaponUnits` (espelha `adjustStock`) marca a unidade "sold" ao
  confirmar a venda e devolve pra "in_stock" ao cancelar/editar — ver
  docs/MANUAL_TECNICO.md, seção 183.
- **Índice único parcial pra campo opcional-mas-único** (técnica geral,
  exemplo histórico era `FinanceProduct.serialNumber` antes da v2.3.204 —
  hoje o mesmo padrão se aplica a `FinanceWeaponUnit.serialNumber`, que
  virou único por empresa direto na coluna porque ali o campo é sempre
  obrigatório, sem caso de NULL a proteger): quando o campo PODE ficar
  vazio/NULL em outras linhas (ex.: um campo só obrigatório pra um
  `type` específico), não dá pra usar `unique: true` direto na coluna
  (bloquearia duas linhas com o campo vazio/NULL). Migration usa SQL puro
  (`queryInterface.sequelize.query`) em vez do `addIndex` do Sequelize, pra
  controlar a cláusula `WHERE` do índice parcial:
  ```sql
  CREATE UNIQUE INDEX idx_x ON "Tabela" ("companyId", "coluna")
  WHERE "coluna" IS NOT NULL AND "coluna" <> '';
  ```
  O service faz um `findOne` prévio pra devolver erro amigável, e também
  captura `SequelizeUniqueConstraintError` no `create`/`update` como rede de
  segurança contra corrida entre duas requisições simultâneas.
- **Migration com mais de um `addColumn`/`addIndex` em sequência: usar SQL
  com `IF NOT EXISTS`, não o `queryInterface.addColumn` padrão.** Batido em
  produção (v2.3.95/97): uma migration com várias colunas em `addColumn`
  sequencial, sem transação, que falha no meio (qualquer motivo — corrida
  com um container ainda de pé, erro transitório) deixa as colunas já
  criadas no banco, mas o Sequelize NÃO marca a migration como concluída
  (`SequelizeMeta`). Rodar `db:migrate` de novo tenta do zero e bate em
  "column already exists" na primeira coluna que sobrou da vez anterior —
  trava pra sempre, sem progredir, até alguém corrigir a migration (não dá
  pra simplesmente rodar de novo). Prevenção: escrever a migration com
  `ALTER TABLE "Tabela" ADD COLUMN IF NOT EXISTS "coluna" <tipo>;` e `CREATE
  [UNIQUE] INDEX IF NOT EXISTS ...` via `queryInterface.sequelize.query(...)`
  em vez de `addColumn`/`addIndex` — Postgres aceita `IF NOT EXISTS` nos dois
  desde a 9.5/9.6, e assim qualquer nova tentativa sempre completa (pula o
  que já existe, cria só o que falta). Ver migration
  `20261015120000-add-weapon-fields-to-finance-products.ts` como exemplo.
- **Importação por Excel com detecção automática de coluna**: já existia um
  padrão pra isso em `ContactListService/ImportContacts.ts` (normaliza
  cabeçalho — remove acento, minúsculo, só `[a-z0-9]` — e casa contra uma
  lista de aliases por campo). `FinanceImportService.ts` reaproveitou a
  mesma TÉCNICA, mas com helpers locais (não um util compartilhado) — os
  campos/entidades do Financeiro não têm nada a ver com contato/campanha, e
  o `ContactListService` original não foi tocado. Ao adicionar importação
  em um cadastro novo, cada linha deve chamar o `create`/`update` do
  próprio `Service` da entidade (não gravar direto no model) — reaproveita
  a validação (Yup, checagem de duplicidade) já implementada ali, em vez de
  duplicar a regra no importador.
  - **Cuidado com `uploadConfig`** (`backend/src/config/upload.ts`): salva
    o arquivo em `public/company{id}/`, servido estaticamente — qualquer
    endpoint de import que use esse multer precisa remover o arquivo depois
    de processar (`fs.unlink` no `finally` do controller), senão a planilha
    enviada (que pode ter preço de custo, documento de cliente/fornecedor
    etc.) fica acessível por URL indefinidamente. O `ContactListController`
    existente **não** faz essa limpeza (débito pré-existente, não corrigido
    de passagem) — não copiar esse detalhe ao reaproveitar o padrão.
- **Planilha "de verdade" que o cliente usa no dia a dia raramente é uma
  planilha simples (cabeçalho na linha 1, um registro por linha)** — é um
  relatório exportado de outro sistema (ERP do cliente), com título/dados da
  empresa nas primeiras linhas, células mescladas, cabeçalho repetido a cada
  página, linha de rodapé entre blocos. O importador genérico por alias de
  cabeçalho (`PRODUCT_MAPPINGS` etc.) não reconhece esse formato — e tentar
  forçar um alias a bater com a célula errada (por causa do deslocamento de
  coluna que o merge causa) é pior que simplesmente não reconhecer. Padrão
  usado em `parseGunStoreReport` (`FinanceImportService.ts`, v2.3.98):
  detectar o formato específico procurando um texto de cabeçalho conhecido
  em posição fixa (`"Cód. Produto"`), e se achar, usar mapeamento de coluna
  **por posição absoluta** (índice numérico, lido com
  `XLSX.utils.sheet_to_json(ws, {header:1})` — array de arrays, não objeto
  por nome de coluna) em vez de alias — channel próprio, só ativado quando a
  assinatura do relatório bate; se não bater, cai pro importador genérico
  sem quebrar o caso padrão. Útil reaproveitar esse padrão (detecção por
  assinatura + parser de posição fixa) pra qualquer relatório fixo de ERP
  de cliente no futuro, em vez de tentar generalizar o importador por alias
  pra cobrir cada formato de relatório.
  - **Números pt-BR vs. decimal com ponto podem coexistir nas MESMAS
    linhas de um relatório assim** (colunas diferentes, formatos
    diferentes) — `parseBrazilianDecimal` em `FinanceImportService.ts`
    decide pelo separador decimal encontrado (vírgula = pt-BR, remove ponto
    de milhar antes; só ponto = já é decimal, não mexe) em vez de presumir
    um formato fixo pra toda a planilha.
  - **Extração de marca/calibre a partir de descrição em texto livre: só
    best-effort, nunca adivinhar por inferência indireta** (ex.: não
    reconhecer marca pelo código do modelo) — a decisão de "o que conta
    como reconhecido" é do cliente, não do código; campo que não tem
    certeza fica em branco pra preenchimento manual, documentado como tal.
- **Rota Express com segmento fixo (`/finance/customers/by-contact/:id`)
  precisa vir ANTES da rota genérica (`/finance/customers/:id`) no mesmo
  arquivo de rotas** — senão o Express casa `"by-contact"` como se fosse o
  valor do parâmetro `:id` da rota genérica (que vem primeiro na ordem de
  registro) e a rota específica nunca é alcançada. Vale pra qualquer rota
  nova desse padrão (`/recurso/acao-fixa/:algo` convivendo com
  `/recurso/:id`), não só a do vínculo Contato/Cliente.
- **Gate de permissão num componente FORA do módulo Financeiro (ex.:
  `ContactModal`, que é do Atendimento) que precisa saber se o usuário
  logado tem acesso ao Financeiro**: chamar `finance.getAccess()` (o hook
  `useFinance`, mesmo endpoint `GET /finance/access` que a própria tela do
  Financeiro usa) em vez de replicar a regra Admin/Master/`Plan.useFinancial`/
  `User.financialAccess` no frontend — essa regra já é a fonte da verdade
  no backend (`EnsureFinancialAccess.ts`); duplicá-la no componente arrisca
  os dois lados divergirem com o tempo.
- **`logger.info`/`logger.warn` (Pino + transporte `pino-pretty`,
  `backend/src/utils/logger.ts`) não é confiável pra log de diagnóstico
  temporário neste ambiente de produção** — batido em produção (v2.3.100):
  um `logger.info` novo, adicionado só pra investigar um bug, nunca
  apareceu nos logs do container mesmo depois de várias tentativas
  confirmadas pelo cliente, enquanto `console.log`/`console.warn` (usados
  em todo o resto do sistema, ex. `[WBOT] upsert event...`) aparecem
  normalmente. Causa provável: o transporte `pino-pretty` roda numa worker
  thread separada que pode falhar silenciosamente nesse ambiente — sem
  erro visível, sem nada no `stdout`. **Pra qualquer log de diagnóstico
  temporário que precise aparecer com certeza, usar `console.log` direto,
  não `logger.*`** — não vale a pena gastar um ciclo de deploy só pra
  descobrir que o log não apareceu. (Isso não significa trocar todo uso
  já existente de `logger.*` no sistema — só não confiar nele pra
  diagnóstico novo sem testar primeiro.)
- **Qualquer campo que lista registros de outro cadastro do Financeiro
  (Produto numa venda, Fornecedor numa despesa, Cliente numa venda/conta a
  receber) precisa de busca no servidor (`FinanceAsyncAutocomplete`,
  `frontend/src/components/FinanceAsyncAutocomplete/`), nunca um `<select>`
  com a lista inteira carregada de uma vez** — `list()` de Produtos/
  Clientes/Fornecedores é paginado, 20 por página (`FinanceProductService`/
  `FinanceCustomerService`/`FinanceSupplierService`). Carregar tudo de uma
  vez (`searchParam: ""` uma única vez ao abrir o modal/tela) "funciona"
  em ambiente de teste com poucos registros, mas quebra silenciosamente
  assim que o cliente tem mais de 20 produtos/clientes/fornecedores — os
  registros além da primeira página ficam literalmente impossíveis de
  selecionar, sem erro nenhum aparecendo. Batido na prática (outubro/2026,
  v2.3.103) depois do cliente importar 65 produtos reais. Ao adicionar um
  campo novo desse tipo, usar `FinanceAsyncAutocomplete` direto (recebe
  `fetchOptions(searchParam)` que chama `resource.list({searchParam})` —
  a busca por nome/SKU/CPF-CNPJ/e-mail já existe nesses `list()`, só
  precisa repassar o termo digitado) em vez de montar outro `<select>`
  com lista fixa.
- **Módulo Fiscal — gateway é plugável desde a v2.3.105, nunca mais
  importar `FocusNFeService` direto fora de `FiscalGatewayService.ts`.**
  `FiscalConfig.gatewayProvider` escolhe o adapter via
  `FiscalGatewayService.getGateway(provider)` — `FiscalDocumentService`
  (único consumidor) já segue esse padrão. Pra adicionar um gateway de
  verdade (o cliente ainda não confirmou qual seria o segundo — só
  descartou ficar travado só na Focus NFe): criar um arquivo novo com as
  mesmas três funções (`emit`/`getStatus`/`cancel`, mesma assinatura de
  `FocusNFeService.ts`) e registrar em `GATEWAYS`/`SUPPORTED_GATEWAYS` —
  nenhum outro arquivo do backend precisa mudar, e a lista no frontend
  (`GET /fiscal/gateways`) já reflete automaticamente. Decidir também,
  nesse momento, como fica o upload de certificado digital (pedido
  anterior do cliente, ainda não implementado) — cada gateway pode ter
  uma API própria pra isso, ou nenhuma.
- **Emissão automática de documento fiscal ao confirmar a venda
  (`FiscalConfig.defaultDocumentType`, v2.3.105) fica orquestrada no
  `SaleController.confirm`, nunca dentro de `SaleService.confirm`.**
  `FiscalDocumentService.ts` já importa `SaleService` (pra revalidar a
  venda antes de emitir) — `SaleService` importar `FiscalDocumentService`
  de volta seria import circular. Sempre em `try/catch` que nunca deixa
  falha de emissão (gateway fora do ar, token errado) impedir a
  confirmação da venda/criação da conta a receber — essas duas não podem
  falhar por causa do módulo fiscal. Esse padrão (orquestração entre dois
  services que se importariam em círculo fica no controller que chama os
  dois) é reaproveitável pra qualquer acoplamento parecido no futuro.
- **Toda nota fiscal emitida usava o id interno do banco como "código do
  produto" (`codigo_produto` no payload da Focus NFe) até a v2.3.105** —
  bug real, não só falta de exibição; corrigido junto com o pedido do
  cliente de mostrar o SKU na tela de Vendas. `SaleItem` ganhou campo
  `sku` (snapshot no momento da venda, mesma lógica já usada pra
  `description`/`ncm`/`cfop` — cadastro do produto pode mudar depois, a
  venda/nota já emitida não pode mudar retroativamente). Ao adicionar
  qualquer campo novo de produto que precise ir pra nota fiscal, snapshotar
  em `SaleItem` no momento da venda, nunca ler do `FinanceProduct` vivo na
  hora de montar o payload do gateway.
- **`WebFetch` não consegue abrir `nfe.io`, `focusnfe.com.br`,
  `doc.focusnfe.com.br` (nem provavelmente outros domínios de gateway
  fiscal) neste ambiente de sessão — sempre `getaddrinfo ENOTFOUND`,
  confirmado batendo até no domínio raiz.** Só o `WebSearch` funciona (usa
  um serviço à parte, não é o mesmo bloqueio), mas devolve resumo indireto,
  não a página real. Na prática (v2.3.106): implementar endpoint novo de
  gateway fiscal sem conseguir ler a doc oficial é arriscado demais (é nota
  fiscal de verdade) — melhor pedir pro cliente copiar/colar o conteúdo
  (ele abre no navegador dele normalmente) do que tentar reconstruir só
  por `WebSearch` ou conhecimento geral. Quando o cliente manda curl de
  exemplo da documentação oficial (como fez pra Focus NFe), isso vira fonte
  de alta confiança pro método/URL do endpoint — mas se o corpo do
  exemplo for só `{}`/`{"items":[]}` genérico, os nomes de campo dentro
  dele ainda são reconstrução por conhecimento geral, não confirmados; deixar
  isso explícito no código e no manual técnico, não misturar os dois níveis
  de confiança.
- **`FiscalGatewayAdapter` (`FiscalGatewayService.ts`) agora tem métodos
  opcionais** (`emitCorrectionLetter?`, `sendByEmail?`, `previewDanfe?`,
  `invalidateNumbering?`, `listInvalidations?`) além dos três obrigatórios
  (`emit`/`getStatus`/`cancel`) — porque nem todo gateway tem equivalente
  de cada recurso (ex.: carta de correção só existe no modelo de NF-e).
  Usar `FiscalGatewayService.requireFeature(gateway, "nomeDoMetodo")` em
  vez de checar `gateway.x &&` na mão em cada service novo — já lança
  `ERR_FISCAL_FEATURE_NOT_SUPPORTED_BY_GATEWAY` padronizado.
- **Antes de mexer num importador por alias de cabeçalho (Produtos/
  Clientes/Fornecedores), testar contra o arquivo REAL do cliente num
  script Node avulso primeiro** (reaproveitando a lib `xlsx` já instalada
  no backend), não só olhar a lista de aliases e supor que bate. Batido de
  novo na prática (v2.3.107, Relatório de Clientes real): 3 colunas comuns
  em relatório de ERP não batiam por causa da mesma pegadinha já conhecida
  (igualdade exata do texto normalizado, não substring — "Nome / Razão
  Social" → `nomerazaosocial` ≠ apelido `razaosocial` sozinho; "Telefone 1"
  → `telefone1` ≠ `telefone`; "Compl." → `compl` ≠ `complemento`). Rodar o
  parser contra o arquivo de verdade ANTES de mexer no código mostra
  exatamente quantas linhas ficam inválidas e por quê, em vez de descobrir
  só depois do deploy.
- **Coluna de planilha sem campo correspondente no model → guardar em
  `notes` em vez de descartar**, mas com dedup: se o relatório do ERP
  antigo repete o mesmo valor em duas colunas (comum — "Nome Fantasia"
  igual ao nome, "Telefone 2/3" iguais ao "Telefone 1"), comparar via
  `normalizeHeader` (o mesmo helper já usado pro casamento de cabeçalho —
  ignora acento/case/pontuação) contra o campo já capturado e pular a
  linha da nota se for igual. Padrão em `FinanceImportService.ts`
  (`buildLegacyNotes`/`LEGACY_NOTE_FIELDS`, v2.3.107) — reaproveitável pra
  qualquer importador futuro que precise preservar coluna "extra".
- **`readRows()` de `FinanceImportService.ts` lê com `raw: true` de
  propósito** (Produtos depende disso pro parser de preço/estoque em
  formato brasileiro) — uma célula de DATA do Excel chega como número
  serial (dias desde 30/12/1899), não como texto "10/04/1988". Não mudar
  esse default globalmente; converter pontual só onde precisar (ver
  `excelSerialToDateString` em `FinanceImportService.ts`).
- **`FinanceRecordList` (lista genérica de Produtos/Clientes/Fornecedores/
  Contas) não tinha paginação na TELA até a v2.3.108**, mesmo os services
  do backend já aceitando `pageNumber` e devolvendo `{records, count,
  hasMore}` desde a Fase 1/2 — o componente só nunca mandava `pageNumber`
  nem mostrava nenhum controle de página, sempre buscando só a página 1
  (20 registros). Passou batido até o cliente importar 205 clientes de
  verdade (seção 90) e notar que o resto sumia. Lição: um `list()` com
  paginação pronta no backend não significa que a tela que o consome usa
  de verdade — ao criar uma lista nova em cima de um recurso já paginado,
  conferir se o componente manda `pageNumber` e mostra algum controle de
  página, não só assumir que "menos de 20 registros no teste" cobre o
  caso real do cliente.
- **`WebFetch`/`curl` CONSEGUEM acessar `raw.githubusercontent.com`
  normalmente, mesmo com `nfe.io`/`focusnfe.com.br`/`doc.focusnfe.com.br`
  dando `ENOTFOUND` neste ambiente de sessão** (lição anterior, seção
  acima) — o bloqueio parece ser por domínio específico, não uma falha
  geral de rede. Útil pra achar dado de referência público (tabela fixa
  tipo CFOP/município/NCM) mesmo quando a doc oficial do serviço em questão
  está bloqueada: procurar se existe um repositório GitHub público com o
  mesmo dado (`raw.githubusercontent.com/<owner>/<repo>/<branch>/<arquivo>`)
  antes de desistir ou reconstruir de memória. **Sempre conferir a
  qualidade do dado baixado antes de usar** — ex.: grep por um código
  conhecido (CFOP 5102 = "Venda de mercadoria...") ou comparar contagem
  por estado contra número público conhecido (MG tem 853 municípios) —
  feito na prática na v2.3.109 antes de gerar `frontend/src/data/`.
- **Tabela de referência fixa (CFOP, município/IBGE) vira arquivo estático
  gerado uma vez por script, não busca em tempo de execução** — não muda
  com frequência (CFOP é definido por Ajuste SINIEF, município por lei),
  e depender de rede em produção pra isso seria custo/risco sem benefício.
  Padrão: baixar o CSV fonte, rodar um script Node avulso de conversão
  (documentado no header do arquivo gerado, com a fonte/data), revisar a
  saída, só então commitar o `.js` gerado em `frontend/src/data/`.
- **Lista de referência fixa e pequena o bastante pra caber no bundle
  (CFOP ~600, município ~5.570) usa `@material-ui/lab/Autocomplete` puro
  com filtro client-side**, não o `FinanceAsyncAutocomplete` (que é
  especificamente pra busca no SERVIDOR de um recurso paginado por
  empresa, ex. Produto/Cliente/Fornecedor) — usar o componente errado
  pra esse caso seria buscar no servidor uma coisa que já está toda no
  bundle, sem necessidade.
- **Configuração Fiscal: Homologação e Produção são credenciais
  SEPARADAS desde a v2.3.109** (token próprio + liga/desliga cada uma),
  não um token único alternado por um seletor de ambiente — decisão
  tomada olhando o padrão real do painel da Focus NFe (print que o
  cliente mandou). `FiscalConfigService.getActiveGatewayToken(config)` é
  o único lugar que decide qual token vale AGORA — qualquer código novo
  que precise do token do gateway usa esse helper, nunca lê
  `gatewayTokenSandbox`/`gatewayTokenProduction` direto (evita duplicar a
  lógica de "qual ambiente tá ativo" espalhada).
- **Formulário com `Grid` (MUI) misturando item grande (cartão/`Paper`) e
  pequeno (campo de texto) na mesma sequência: somar a largura (`sm`) de
  cada "grupo" antes de empilhar, não confiar no wrap automático** —
  batido na prática na v2.3.110 (Configuração Fiscal "desorganizada"): um
  campo `sm=6` sozinho antes de dois cartões `sm=6` deixava só metade da
  linha livre, o primeiro cartão preenchia ali, o segundo abria linha
  nova sozinho, e o próximo campo pequeno (`sm=4`) grudava do lado errado
  em vez de ficar com os campos do mesmo grupo. Fix: campo que antecede
  um grupo "fechado" (dois itens que somam 12) vira `sm=12` próprio, ou o
  grupo inteiro fica isolado numa linha garantida.
- **"Ambiente ativo" (seletor separado homologação/produção) durou só uma
  versão (v2.3.109 → v2.3.112)** — cliente pediu pra tirar assim que viu
  a tela, queria só os dois cartões com liga/desliga, sem um terceiro
  campo redundante escolhendo qual vale. Lição: ao modelar
  "duas credenciais + qual está ativa", perguntar/confirmar se precisa
  mesmo de um campo explícito de seleção ou se dá pra DERIVAR isso dos
  próprios toggles (aqui: Produção habilitada ganha prioridade) antes de
  implementar os dois — evita retrabalho que só aparece depois que o
  cliente vê a tela de verdade. `FiscalConfigService.isProductionActive`
  é o padrão a reaproveitar pra esse tipo de decisão derivada.
- **Controle de estoque na venda (v2.3.114) só mexe em item com produto
  vinculado E `FinanceProduct.controlStock` ligado** — item avulso (sem
  produto cadastrado) ou produto tipo serviço nunca entram na validação/
  desconto. Desconto é SÓ na confirmação da venda (não no rascunho), e
  devolvido automaticamente no cancelamento — só se a venda REALMENTE
  estava confirmada (`sale.status === "confirmed"` antes de cancelar,
  senão nunca descontou nada pra devolver). Mesma função
  (`adjustStock(sale, direction)`, `SaleService.ts`) nos dois sentidos
  (`1`/`-1`) em vez de duplicar a lógica de "quem conta" duas vezes.
  Padrão reaproveitável pra qualquer outro efeito colateral de
  confirmar/cancelar venda que precise ser simétrico.
- **`FinanceProduct.minStockQuantity = 0` significa "sem aviso
  configurado"**, não "o mínimo é zero" — um produto com estoque zerado
  mas sem mínimo definido entra em `outOfStock` (sempre destacado), mas
  NÃO em `lowStock` até o cliente definir um mínimo > 0 de propósito pra
  ele. Mesmo padrão de "0 = desligado" já usado em outros campos do
  projeto (ex. `defaultDocumentType` vazio = emissão manual).
- **Toda função nova de `FocusNFeService.ts` (ou qualquer chamada HTTP pro
  gateway fiscal) PRECISA de `try/catch` em volta da chamada — sem
  exceção.** Batido em produção (v2.3.115): `listInvalidations` foi a
  única das sete funções adicionadas na v2.3.106 sem isso, e uma falha
  nela (algo que a Focus NFe devolve quando não tem inutilização nenhuma
  registrada) virou exceção não tratada → 500 → derrubou a Configuração
  Fiscal inteira, mesmo ela já tendo os dados principais carregados e
  exibidos (o erro era de outra chamada da mesma tela, não da que carrega
  a config). Ao adicionar uma função nova nesse arquivo, copiar o padrão
  já usado nas outras (`try { ... } catch (err) { devolve valor "vazio"
  de erro, nunca deixa a exceção subir }`) mesmo que pareça óbvio demais
  pra esquecer.
- **Importação de histórico de migração (v2.3.116, `SaleImportService.ts`)
  nunca deve reaproveitar `SaleService.confirm()`/`.cancel()`** — grava
  `Sale`/`SaleItem`/`FiscalDocument`/`FinanceReceivable` direto, porque
  aquele fluxo é feito pra venda NOVA (chama o gateway, desconta estoque).
  Venda histórica já tem nota de verdade emitida no sistema anterior e não
  deve tocar estoque nem emitir nada de novo — confirmar explicitamente com
  o cliente antes de assumir isso em qualquer importador fiscal futuro
  (aqui foi confirmado: "não mexe no estoque, pois só a partir de hoje as
  vendas lançadas que vai mexer no estoque").
- **Relatório de bloco de tamanho variável (nº de linhas de item muda por
  registro) não dá pra parsear por offset fixo** (técnica usada no
  "Relatório de Produtos") — precisa de reconhecimento de padrão linha a
  linha: cada linha é classificada pelo *conteúdo das colunas* (ex.: "é
  cabeçalho se coluna X é só dígitos E coluna Y tem '/' E coluna Z é uma
  das situações conhecidas"), não pela posição dentro do bloco. Ver
  `parseNotesReport` em `SaleImportService.ts`.
- **Nem todo relatório do mesmo cliente usa o mesmo formato de número.** O
  "Relatório de Notas" usa separador de milhar "," e decimal "." (formato
  americano, ex. `"5,100.00"`) — o INVERSO do formato brasileiro que
  `parseBrazilianDecimal` (usado nos outros importadores) espera. Sempre
  inspecionar uma amostra de valores reais do arquivo antes de escolher/
  reaproveitar um parser numérico; se não bater, criar um helper dedicado
  (`parseUsNumber`) em vez de forçar o existente.
- **Antes de liberar qualquer importador novo pro cliente, validar com um
  script local (fora do Express/banco) contra o arquivo real que ele
  mandou** — ler o arquivo, contar quantos registros o parser extraiu,
  comparar soma de totais do cabeçalho vs. soma calculada a partir dos
  itens, e olhar as primeiras linhas extraídas. Pego no v2.3.116: validar
  486 notas de 5.535 linhas, com <0,1% de diferença entre total do
  cabeçalho e soma dos itens, deu confiança pra liberar sem precisar de
  acesso ao banco de produção.
- **Pedido espalhado em várias mensagens seguidas, cada uma acrescentando
  um detalhe novo (v2.3.117, dashboard de lucro) — não implementar no
  meio, esperar o pedido "assentar" e depois perguntar de uma vez.** O
  cliente mandou ~5 mensagens em sequência (custo/imposto no produto,
  visão simplificada pro analista financeiro, dashboard unificado
  estoque+vendas com hover no gráfico, "só aplicar quando for pra
  produção") antes de parar de adicionar contexto. Resposta certa: juntar
  tudo mentalmente primeiro, identificar os pontos realmente ambíguos
  (onde gravar custo/imposto, quantos tributos detalhar, o que "só
  produção" quer dizer, onde entra o painel) e perguntar os 4 de uma vez
  só (`AskUserQuestion` com 4 perguntas), não uma pergunta por mensagem
  chegada nem implementar a primeira interpretação que apareceu.
- **Custo/alíquota de imposto do produto são sempre snapshot no item da
  venda, nunca lidos "ao vivo" do cadastro** (`SaleService.buildItemRows`,
  v2.3.117) — mesmo motivo do sku/ncm/cfop: se o cliente editar o custo ou
  a alíquota de um produto depois, vendas já feitas (e qualquer relatório
  de lucro sobre elas) não podem mudar retroativamente. Ao adicionar
  qualquer campo novo no cadastro de Produto que alimente cálculo
  financeiro de uma venda, por padrão snapshot no `SaleItem` no momento da
  venda — só não fazer isso se o cliente pedir explicitamente o contrário.
- **Relatório/painel que só deve valer "pra produção de verdade" (não
  teste) deriva isso de `FiscalConfigService.isProductionActive(config)`,
  igual já é feito pra escolher qual token usar** — não inventar um flag
  novo. E ao ler `FiscalConfig` de dentro de um código do módulo
  Financeiro (não Fiscal) só pra checar esse booleano, usar
  `FiscalConfig.findOne` direto, nunca `FiscalConfigService.show()` (que
  faz `findOrCreate` — criaria uma linha de configuração fiscal pra toda
  empresa que só abrisse o Painel Financeiro, mesmo sem usar o módulo
  fiscal nenhuma vez).
- **Export de Excel no frontend não precisa de endpoint novo no backend**
  quando os dados já estão na tela (ex.: uma tabela de relatório já
  carregada) — só montar o workbook no cliente com
  `XLSX.utils.json_to_sheet` + `XLSX.writeFile` (mesmo padrão já usado em
  `pages/Reports/index.js`). PDF do Painel Financeiro já é
  `window.print()` + CSS `@media print` (ver seção 2 do manual técnico,
  etapa 6.2) — qualquer seção nova dentro do mesmo painel ganha isso de
  graça, só precisa adicionar o id certo (`finance-painel-print-hide*`) em
  botão que não deve ir pro papel.
- **Pedido pra pré-configurar algo que entra em vigor numa data futura
  (v2.3.118, Reforma Tributária 2027) — padrão "existe mas não faz nada
  até o gatilho".** Nunca espalhar o `if (flagLigada)` em vários lugares:
  centralizar o cálculo numa função pura própria (`Iva2027Service.ts`,
  sem I/O), e no ÚNICO ponto de entrada real (aqui, `SaleService.
  buildItemRows`) nem sequer CONSULTAR a config/dados relacionados quando
  a flag estiver desligada — não só pular o cálculo. Isso garante que
  "sem efeito no faturamento atual" seja verdade de verdade (zero query
  extra, zero I/O), não só "o resultado fica igual por coincidência".
  Campo desabilitado na tela (não escondido) enquanto a flag estiver off
  é outra parte do mesmo padrão — ver `disabledWhen` abaixo.
- **`FinanceRecordModal` ganhou `disabledWhen(values, context)` (v2.3.118),
  diferente de `visibleWhen`/`requiredWhen` (só recebem `values`)** —
  porque o motivo de desabilitar um campo às vezes é um estado de FORA do
  formulário (ex.: uma flag global lida da Configuração Fiscal), não algo
  digitado neste form. `context` é um prop novo, opcional, repassado por
  quem monta a tela (`Financeiro/index.js` busca a flag uma vez e passa
  pra baixo via `FinanceRecordList` → `FinanceRecordModal`). Também ganhou
  um pseudo-campo `type: "sectionTitle"` (só visual, sem `name`, sem valor
  de formulário) pra agrupar um bloco de campos novo sob um título —
  reaproveitável pra qualquer feature futura que precise anexar um grupo
  de campos opcionais/condicionais a um cadastro já existente sem mexer no
  layout do resto.
- **Especificação externa com nomes de tabela/campo genéricos
  (snake_case, nomes de ERP/exemplo) nunca deve ser copiada ao pé da
  letra** — mapear pro schema REAL do projeto (camelCase, nomes dos models
  Sequelize já existentes) antes de escrever a migration. Documentar essa
  tabela de mapeamento no manual técnico (seção 99) ajuda a auditar depois
  se a interpretação ficou fiel à intenção original do cliente.
- **Antes de criar uma tabela nova pra "preparar" uma integração futura,
  perguntar se um campo a mais numa tabela já existente não resolve** —
  aqui a especificação pedia uma "tabela de transações financeiras" nova
  pro Asaas (split payment), mas este projeto já tem exatamente um
  `FinanceReceivable` por venda confirmada; 3 colunas novas nele cobrem o
  mesmo pedido sem criar uma tabela solta, sem FK de volta pra venda e sem
  nenhum código que a use ainda (exatamente o tipo de abstração prematura
  que este projeto pede pra evitar). Reservar tabela nova pra quando o
  domínio de verdade não existir ainda no schema.
- **Toda nota/venda feita em Homologação precisa ficar identificável
  depois** — `FiscalDocument.environment` ("sandbox"/"production"),
  gravado em `FiscalDocumentService.emit` a partir de
  `isProductionActive(config)` no momento da emissão, é o que decide se
  algo pode ser EXCLUÍDO de verdade (teste) ou só CANCELADO (nota real).
  Sem esse campo, não tem como diferenciar programaticamente lixo de
  teste de dado de produção depois do fato — vale pra qualquer _gateway_
  fiscal futuro, não só Focus NFe.
- **Tela de configuração com DOIS OU MAIS gateways/provedores no mesmo
  nível (ex. Configuração de Pagamento, Mercado Pago + Asaas, v2.3.154):
  layout padrão é colunas lado a lado, uma por gateway, nunca um
  empilhado embaixo do outro** — pedido explícito do cliente (v2.3.155)
  depois de ver o layout empilhado na tela de verdade: "deixa os dois
  painéis um do lado do outro e centraliza as palavras nos campos para
  não ficar descentralizadas". Virou padrão do projeto, não precisa
  perguntar de novo da próxima vez que entrar um terceiro gateway (ou
  outra tela nesse formato): `Grid item xs={12} md={6}` por coluna
  (`md`, não `sm` — em telas médias cada coluna ainda precisa de espaço
  pros cartões Homologação/Produção internos, que ficam empilhados
  DENTRO da coluna, não lado a lado entre si nesse caso), painel-pai com
  `maxWidth` maior que o padrão de formulário simples (1200px em vez de
  900px, senão as colunas ficam espremidas), e todo campo de
  credencial/URL somente-leitura com texto do VALOR centralizado
  (`inputProps: { style: { textAlign: "center" } }` — só o valor digitado,
  o `label` continua no lugar padrão do Material-UI, flutuando na borda).
  Ver `frontend/src/components/FinancePaymentConfigPanel/index.js`
  (`centeredFieldProps`, `gatewayColumn`) como referência.
  - Cada painel precisa também do próprio texto de contexto (ex. "Credenciais
    do Mercado Pago — gera Pix/boleto por esse gateway", dentro da coluna,
    logo abaixo do título) — NÃO um parágrafo só no topo da tela citando os
    dois/três/quatro provedores juntos. Cliente pediu essa separação
    explicitamente (v2.3.155, segunda rodada) depois do primeiro ajuste já
    ter separado só as colunas visuais, mas deixado a frase de introdução
    ainda junta: o texto descritivo acompanha cada gateway, não fica
    compartilhado.
  - **Cliente já avisou a intenção de escala**: "quando for adicionando mais
    painéis de configuração de pagamento vai ficando menor o painel, porém
    dá pra ficar 4 painéis em uma tela" — ou seja, o layout de 2 colunas
    (`md={6}`) é o certo pra 2 gateways HOJE, mas quando entrar um
    terceiro/quarto gateway, ajustar a largura da coluna nesse momento (não
    adiantar agora com breakpoint fixo pra 4, que deixaria metade da tela
    vazia com só 2 provedores) — o teto é 4 painéis numa tela só antes de
    rolar/quebrar linha. Não precisa perguntar de novo quando isso
    acontecer, só redimensionar (`md={4}` pra 3, `md={3}` pra 4).
  - **Painel lado a lado NÃO significa "layout separado, estado
    compartilhado"** — leva um tempo pro cliente perceber e corrigir isso
    se não ficar claro de cara (v2.3.158, seção 137 do manual técnico):
    liga/desliga, modo Produção, e qualquer campo que só faz sentido pra
    UM gateway (ex. "Expiração do Pix", só Mercado Pago) têm que morar e
    funcionar dentro do próprio painel, cada um com o próprio campo no
    banco (`mercadoPagoEnabled`/`asaasEnabled`,
    `mercadoPagoProductionEnabled`/`asaasProductionEnabled` — nunca um
    campo `provider`/`productionEnabled` só decidindo pros dois ao mesmo
    tempo). Os dois gateways PODEM ficar ativos ao mesmo tempo — não é
    seletor de rádio. Só o título/texto geral da página (o que não é
    específico de gateway nenhum) pode ficar compartilhado no topo. Se
    outro módulo deste projeto ganhar mais de um provedor/gateway no
    futuro, aplicar esse mesmo princípio sem perguntar de novo: cada
    painel 100% autocontido, nada que mude um afeta o outro.

## 12. Segredo criptografado em repouso + log de acesso — padrão reaproveitável

Primeiro caso no projeto: senha do gov.br do cliente, no módulo
Despachante Bélico (v2.3.159, seção 138 do manual técnico) — antes vivia
em texto puro numa planilha/Notion. Qualquer campo novo, em qualquer
módulo, que precise guardar uma credencial de verdade (senha de outro
sistema, token de API de terceiro informado pelo cliente final, etc. —
diferente de token de GATEWAY que a própria empresa configura, como
Mercado Pago/Asaas/Focus NFe, esses não precisam desse padrão) segue a
mesma receita, sem precisar perguntar de novo:

- **Criptografia simétrica (AES-256-GCM)**, chave só em variável de
  ambiente (nunca no código/git), nunca um "ofuscamento" (base64 sozinho,
  XOR, etc.) — ver `backend/src/utils/weaponDispatchCrypto.ts`
  (`encryptSecret`/`decryptSecret`) como referência direta a copiar.
  Formato armazenado: `"<iv>:<authTag>:<ciphertext>"`, tudo em base64,
  numa coluna `TEXT` só (não 3 colunas separadas).
- **Escrever é livre, LER o valor decifrado é sempre auditado** — a
  função que descriptografa (ex. `getGovPassword`) grava uma linha numa
  tabela de log (quem, quando, por quê) ANTES de devolver o valor, nunca
  depois (registra a tentativa mesmo se o decrypt falhar por chave
  errada/corrompida) — nunca chamar `decryptSecret` fora dessa função
  única, nem no controller nem em outro service.
- **O campo cifrado nunca aparece numa listagem/show genérico** —
  `attributes: { exclude: ["campoEncriptado"] }` em todo `findAll`/
  `findOne` do cadastro, mesmo padrão já usado em
  `WeaponDispatchClientService.ts`. Só a função de leitura auditada tem
  permissão de buscar esse campo.
- Antes de decidir ENTRE "guardar criptografado" e "não guardar a senha
  nenhuma" (a alternativa mais segura de todas, zero risco de vazamento),
  perguntar ao cliente — não é uma decisão técnica, é uma decisão de
  produto/risco que só ele pode tomar (ver `AskUserQuestion` na seção 138
  do manual técnico, onde o cliente escolheu continuar guardando, mas
  com esse padrão).

## 13. Lista/catálogo novo: sempre Adicionar + Editar + Excluir, nunca só Adicionar/Excluir

Pedido explícito do cliente (v2.3.198/199, catálogo "Arquivos da IA"): depois
de eu entregar uma tela de catálogo só com cadastrar/excluir (sem editar),
resposta foi "coloque sempre adicionar editar e excluir" — virou padrão
permanente do projeto, não precisa perguntar de novo da próxima vez que uma
tela de lista/catálogo nova for criada. Ao desenhar qualquer CRUD simples
novo (lista com itens que o usuário cadastra), as três ações (criar, editar,
excluir) nascem juntas desde a primeira versão — nunca entregar só
criar/excluir "pra simplificar" e deixar editar pra depois.

## 14. Padrão "espelhar/sincronizar de outro cadastro" — reaproveitável

Primeiro caso no projeto: "Arquivos da IA" (`PromptFiles`) espelhando
Mensagens Rápidas (`QuickMessage`) marcadas como `geral` (v2.3.198/199,
`docs/MANUAL_TECNICO.md` seção 177) — pedido do cliente foi "puxar tudo de
Mensagens Rápidas pra essa tela, mantendo as duas sincronizadas, sem mexer
no cadastro original". Qualquer feature futura no formato "cadastro B
reflete automaticamente o conteúdo do cadastro A, mas A continua existindo e
editável por conta própria" (ex.: um catálogo de produto espelhando alguma
lista existente, uma tela de IA reaproveitando conteúdo de outro módulo)
segue a mesma receita, sem redescobrir do zero:

- **FK `sourceXId` nullable na tabela espelho**, não um campo booleano
  "éEspelho" — é o que torna a sincronização idempotente (sempre encontra e
  atualiza a MESMA linha em vez de duplicar a cada edição do original) e
  também marca a proveniência (espelho automático x item cadastrado manual
  direto na tela B, que nunca tem esse FK preenchido).
- **Campos que o usuário edita na tela B depois de criado (nome, descrição/
  "quando usar", qualquer metadado visível) NUNCA são sobrescritos numa
  sincronização seguinte** — só o conteúdo de fato (arquivo, texto, preço,
  o que for o "dado" em si) fica em sincronia contínua. Sem essa regra,
  editar a tela B e depois editar o cadastro A original apaga silenciosamente
  a edição feita em B, sem aviso nenhum — já foi pensado nesse sentido desde
  a primeira versão aqui, não precisou corrigir depois.
- **Editar o CONTEÚDO (não só metadado) de um item espelhado, direto na tela
  B, desvincula esse item da sincronização** (zera o `sourceXId`) — vira um
  item manual a partir daí. Sem isso, a próxima edição do cadastro A
  sobrescreveria silenciosamente a troca manual feita em B. Depois de
  desvinculado, o cadastro A seguinte volta a criar uma linha NOVA em B
  (comportamento esperado, não um bug) — se precisar os dois ligados nesse
  cenário, teria que reatribuir o `sourceXId` manualmente, não implementado
  por padrão.
- **Disparo da sincronização em TODO ponto que muda o cadastro A** — não só
  create/update "principal": inclui endpoints separados de anexo/mídia
  (upload e remoção), se existirem como rotas próprias (foi o caso aqui:
  `QuickMessageController.mediaUpload`/`deleteMedia` são endpoints distintos
  de `store`/`update`). Sempre em `try/catch` que nunca derruba a operação
  principal do cadastro A se a sincronização falhar — só loga.
- **Remover/apagar o item A, ou ele deixar de atender o critério de
  inclusão** (aqui: `geral` virar `false`) **remove o espelho em B** (registro
  + qualquer arquivo físico copiado) — reaproveitar a MESMA função de sync
  pra isso (setar o critério como "não atende" em memória, sem persistir, e
  chamar a função normal de sincronização) em vez de duplicar a lógica de
  limpeza num lugar separado.
- **Arquivo físico: sempre CÓPIA de verdade (`fs.copyFileSync`), nunca
  referência pro caminho original** — apagar o cadastro A não pode apagar
  o arquivo que B ainda está usando. Nome do arquivo copiado prefixado com
  a origem (ex. `qm{id}_{nomeOriginal}`) pra nunca colidir com upload manual
  direto em B.
- **Migração de dados pro backfill (trazer o que já existia antes da
  feature) usa só funções PURAS via `require()` (sem banco/model) +
  `queryInterface.sequelize.query` direto** — mesmo padrão já estabelecido
  pras migrations de criptografia (seção 2/CLAUDE.md raiz); idempotente
  checando o `sourceXId` já usado antes de inserir de novo, pra poder rodar
  de novo sem duplicar se precisar.
- **Getter de model mascarando o valor real** (ex. `QuickMessage.mediaPath`
  é um *getter* que devolve a URL pública completa, não o nome do arquivo no
  disco) — ao ler esse campo de dentro de uma função que mexe direto no
  arquivo físico, usar `instance.getDataValue("campo")`, nunca
  `instance.campo`, senão a cópia/exclusão do arquivo quebra silenciosamente
  (não dá erro, só não acha o arquivo no caminho errado). Checar sempre se o
  campo que vai ser usado em `fs.*` é um getter antes de usar o valor direto.

## 15. "1 Cliente → N Processos/registros ao longo do tempo" — não presumir "1 ativo por vez"

Lição do mesmo módulo (Despachante Bélico): antes de desenhar uma tabela
pra algo que parece "um registro ativo por cliente" (um processo, uma
assinatura, uma matrícula...), checar como o cliente usa isso NA VIDA
REAL hoje (planilha, Notion, sistema antigo) antes de presumir. Aqui, a
base real do Notion mostrava claramente que o mesmo cliente volta pra
vários processos ao longo do tempo (CR novo → Autorização de Compra → GT
→ anos depois, Renovação) — um modelo "1 processo ativo por cliente"
perderia esse histórico ou forçaria recriar o cliente a cada novo
processo. Padrão: entidade "quem" (Cliente) separada da entidade "o
quê/quando" (Processo, N por cliente, cada um com a própria esteira/
status/protocolo), nunca campos de processo direto no cadastro do
cliente — mesmo princípio já usado em outros módulos deste projeto
(`FinanceCustomer` 1 → N `FinanceReceivable`/`Sale`).
