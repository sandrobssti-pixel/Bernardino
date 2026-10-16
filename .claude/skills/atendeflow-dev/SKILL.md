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
- **Índice único parcial pra campo opcional-mas-único** (ex.:
  `FinanceProduct.serialNumber`, só obrigatório pra `type = "weapon"`, mas
  único por empresa quando preenchido): não dá pra usar `unique: true`
  direto na coluna (bloquearia duas linhas com `serialNumber` vazio/NULL em
  produtos comuns). Migration usa SQL puro
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
