# Manual Técnico — AtendeFlow

**Versão do documento:** 2.3.51
**Etapa:** 6.16 — Deploy via SSH/docker compose direto (não pelo recurso "Docker Compose" colado do Coolify) + remove portas publicadas
**Última atualização:** 2026-09-19

> ⚠️ **Manutenção do número de versão exibido no sistema**: o chip de versão na barra
> lateral vem de `backend/src/utils/version.ts` (`export const version = '...'`) — um
> arquivo separado do `CHANGELOG.md`, que **precisa ser atualizado manualmente a cada
> nova versão** (junto com `version`/`versionSystem` nos `package.json` do backend e
> frontend, por consistência). Ficou travado em "15.0.10" por várias etapas até ser
> corrigido na v2.3.7.

> Este manual é atualizado a cada etapa do projeto. O histórico de mudanças de cada versão está em
> [`CHANGELOG.md`](../CHANGELOG.md), na raiz do repositório.

> ⚠️ **Mudança de base na v2.0.0**: a partir desta versão, o AtendeFlow deixou de usar a
> estrutura enxuta criada nas Etapas 1/1.1 (Express + Prisma + React simples) e passou a
> usar como base o sistema `zappro-legado` — um projeto de multi atendimento bem mais
> maduro, recuperado de um backup e avaliado em
> [`docs/AVALIACAO_ZAPPRO_LEGADO.md`](AVALIACAO_ZAPPRO_LEGADO.md). As seções 1 a 7 abaixo
> descrevem essa nova base. O histórico da versão anterior continua disponível nos commits
> `c925da4` e `630ab4d` deste repositório, caso seja preciso consultar.

---

## 1. Visão geral

O **AtendeFlow** é um CRM de **multi atendimento**: várias empresas (multi-tenant) e,
dentro de cada uma, vários atendentes conseguem atender simultaneamente conversas de
clientes vindas de múltiplos canais — WhatsApp (via Baileys), API Oficial do WhatsApp
(Meta), Facebook, Instagram e webchat — tudo numa caixa de entrada compartilhada, com
filas, tags, automações e relatórios.

---

## 2. Arquitetura

O sistema é dividido em **três aplicações independentes**, cada uma com seu próprio
`package.json` e ciclo de vida:

```
Bernardino/
├── backend/       -> API principal (Express + Sequelize) + WhatsApp (Baileys) + filas (Bull/Redis)
├── frontend/      -> Interface web (React + Material UI)
├── api_oficial/   -> Microsserviço isolado para a API Oficial do WhatsApp (Meta) — NestJS + Prisma
├── docs/          -> Documentação técnica (este manual, avaliações, runbooks)
├── instalador.sh  -> Script de atualização/rebuild para uma instância já provisionada
└── docker-compose.yml -> PostgreSQL + Redis para desenvolvimento local
```

### 2.1 Backend (`backend/`)

| Camada | Tecnologia |
| --- | --- |
| Linguagem | TypeScript (Node.js) |
| Framework HTTP | Express |
| Banco de dados | PostgreSQL (ou MySQL) via **Sequelize** (não Prisma) |
| Filas assíncronas | **Bull** + Redis (processamento de mensagens, evita travar a API em picos) |
| WhatsApp | **Baileys** (multi-sessão, multi-empresa, reconexão automática) |
| Tempo real | Socket.io |
| IA | OpenAI, Google Gemini, Dialogflow, transcrição de áudio (Azure Cognitive Services) |
| Cobrança | Mercado Pago, Efí/Gerencianet, Asaas, PushinPay |
| Multi-instância | Suporta modo **cluster** (`server-cluster.ts`, um worker por núcleo de CPU) |

Pontos importantes:
- **Multi-tenant real**: praticamente toda tabela tem `companyId` — várias empresas
  isoladas na mesma instância, com planos/assinaturas/faturas.
- **Sessão do WhatsApp persistida no banco de dados** (não em arquivo local como na versão
  anterior) — funciona corretamente mesmo com múltiplas instâncias/cluster. Ver
  `backend/src/helpers/authState.ts`.
- Migrações do banco ficam em `backend/src/database/migrations/` (Sequelize CLI).

### 2.2 Frontend (`frontend/`)

| Camada | Tecnologia |
| --- | --- |
| Linguagem | JavaScript (React 17) |
| Estilo | Material UI (v4 **e** v5 coexistindo — ver seção 6) |
| Build | Create React App + CRACO |
| i18n | 4 idiomas (pt, en, es, tr) |

~45 telas — ver inventário completo em
[`docs/AVALIACAO_ZAPPRO_LEGADO.md`](AVALIACAO_ZAPPRO_LEGADO.md#3-inventário-de-funcionalidades-o-que-já-existe-pronto).

### 2.3 API Oficial (`api_oficial/`)

Microsserviço **separado** (processo/deploy independente do backend principal),
responsável só pela integração com a API Oficial do WhatsApp da Meta.

| Camada | Tecnologia |
| --- | --- |
| Framework | NestJS |
| Banco de dados | PostgreSQL via **Prisma** (diferente do backend principal, que usa Sequelize) |
| Filas | RabbitMQ + Redis |

O backend principal se comunica com este microsserviço via HTTP (`URL_API_OFICIAL`) quando
`USE_WHATSAPP_OFICIAL=true`.

---

## 3. Modelo de dados

O modelo de dados é extenso (dezenas de tabelas) — a fonte da verdade são as migrações em
`backend/src/database/migrations/`. Principais entidades:

| Modelo | Descrição |
| --- | --- |
| `Company` | Empresa (tenant) — planos, assinatura, configurações, faturas |
| `User` | Atendente/administrador, vinculado a uma `Company` |
| `Whatsapp` | Conexão/sessão de canal (WhatsApp, oficial, facebook, instagram, webchat) |
| `Contact` | Cliente final |
| `Ticket` | Conversa (equivalente à `Conversation` da versão anterior) |
| `Message` | Mensagem trocada num `Ticket` |
| `Queue` | Fila de atendimento |
| `Tag` | Etiqueta, com suporte a quadro Kanban |
| `Campaign` / `CampaignShipping` | Campanha de disparo em massa e seus envios |
| `FlowBuilder` | Fluxo de chatbot criado no builder visual |
| `Schedule` / `ScheduledMessages` | Agendamentos de mensagem |
| `Plan` / `Subscriptions` / `Invoices` | Cobrança da própria plataforma (SaaS) |

---

## 4. Como rodar o projeto localmente

### 4.1 Pré-requisitos

- Node.js 18 ou 20 (testado também em 22 — ver nota no fim desta seção)
- Docker (para PostgreSQL e Redis) — ou instalações locais equivalentes (`postgresql`,
  `redis-server` via `apt`, por exemplo)
- Um número de WhatsApp para escanear o QR Code

### 4.2 Passo a passo

```bash
# 1. Subir PostgreSQL e Redis
docker compose up -d
# (sem Docker: sudo apt install -y postgresql redis-server && sudo service postgresql start && sudo service redis-server start)

# 2. Configurar variáveis de ambiente
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp api_oficial/.env.exemplo api_oficial/.env   # opcional, só se for usar a API Oficial

# 3. Instalar dependências (cada app é independente)
npm run install:backend
npm run install:frontend
# npm run install:api-oficial   # opcional

# 4. Compilar o backend e rodar as migrações do banco
# (o Sequelize CLI lê os arquivos compilados em backend/dist/ — sem este build,
# "npm run db:migrate" falha com "Cannot find .../dist/config/database.js")
npm run build:backend
npm run db:migrate
npm run db:seed   # cria empresa/usuário padrão

# 5. Subir backend e frontend (em terminais separados)
npm run dev:backend
npm run dev:frontend
```

> Consulte `backend/.env.example` e `frontend/.env.example` para a lista completa de
> variáveis — muitas são opcionais (só necessárias se for usar aquela integração
> específica, como cobrança ou IA).

> **Primeira subida do backend é lenta:** `npm run dev:backend` usa `ts-node-dev`, que
> compila o TypeScript na hora — pode levar 10 a 20 segundos até aparecer
> `✅ Server started on HOST:PORT`. Espere essa linha antes de testar o login/frontend.
> Uma linha `ERROR ... Erro no startup do servidor` logo depois é um aviso conhecido e
> inofensivo (tentativa de reconectar sessões do WhatsApp/filas no boot) — não impede
> o uso do sistema.

### 4.3 Primeiro acesso

O seed (`npm run db:seed`) cria a empresa padrão e o usuário Master
`master@atendeflow.com` / `123456` (ver `backend/src/database/seeds/`). Troque a senha
no primeiro login.

---

## 5. Funcionalidades

Inventário completo em
[`docs/AVALIACAO_ZAPPRO_LEGADO.md`](AVALIACAO_ZAPPRO_LEGADO.md#3-inventário-de-funcionalidades-o-que-já-existe-pronto) —
inclui builder de fluxo/chatbot, campanhas, Kanban, relatórios, cobrança de clientes (SaaS),
agendamentos, listas de contato, respostas rápidas, entre outros.

---

## 6. Identidade visual "tech" (Etapa 2.1)

A identidade visual criada na Etapa 1.1 foi aplicada por cima da nova base através do
**tema central do Material UI** (`frontend/src/App.js`), em vez de editar tela por tela:

| Token | Valor | Onde é usado |
| --- | --- | --- |
| Gradiente de marca | `linear-gradient(135deg, #6d5efc 0%, #22d3ee 100%)` | `palette.brandGradient`, botões `containedPrimary`, barra superior no modo escuro |
| Cor de marca padrão (clara/escura) | `#6d5efc` / `#8b7bff` | Fallback de `primaryColorLight`/`primaryColorDark` quando a empresa não personalizou |
| Título (display) | Space Grotesk | `typography.h1`–`h6` |
| Texto/corpo | Inter | `typography.fontFamily` (já era usada no projeto original) |
| Dados técnicos | JetBrains Mono | Carregada em `public/index.html`, disponível para uso pontual |

Como é o tema central, o efeito se propaga **automaticamente** para as ~45 telas do
sistema, sem precisar editar tela por tela. A tela de **Login** foi ajustada à parte, por
ter estilo próprio fora do tema: os estilos reais estão em `frontend/src/pages/Login/index.js`
(`makeStyles`) e num bloco de CSS com `!important` em `frontend/public/index.html` (que
mantém a página de login com um visual fixo, independente do tema claro/escuro
selecionado). Fundo escuro com halo gradiente, cartão em vidro fosco, campos escuros e
botão com gradiente de marca.

**Pendente**: telas com cores/gradientes escritos diretamente no componente (fora do tema
central) continuam com a aparência original até serem revisadas individualmente — o tema
central não alcança esses casos.

Lembrete: o frontend já tem suporte a **whitelabel** embutido (nome da empresa, logo,
cores) em `frontend/src/components/Settings/Whitelabel.js` — uma empresa cliente pode
personalizar por cima da identidade padrão sem mexer em código.

---

## 6.1 Papel Master, manual na lateral e sino de notificações (Etapa 3)

- **Papel "Master"**: não é um novo valor de `profile` — é `profile: "admin"` combinado
  com `super: true` (campo que já existia no modelo `User` desde a base migrada, com
  middleware `isSuper` pronta). Só quem já é Master pode conceder/editar o papel Master
  de outro usuário (checado tanto no front, no `Select` de perfil do `UserModal`, quanto
  no backend, em `CreateUserService`/`UpdateUserService`/`UserController`). Login padrão
  do seed: `master@atendeflow.com` / `123456`.
- **Status Ativo/Desativado**: rótulo do indicador de presença na listagem de usuários
  (`UserStatusIcon`) — a lógica online/offline já existia, só o texto mudou.
- **Manual + versão na lateral**: último item do menu (`frontend/src/layout/MainListItems.js`).
  O manual é servido como arquivo estático em
  `frontend/public/manual/MANUAL_TECNICO.md` (cópia deste arquivo — atualizar as duas
  cópias ao editar o manual) para não depender de acesso à internet/GitHub em produção.
  A versão vem do endpoint `/version` já existente, via hook `useVersion`.
- **Sino de notificações**: além de mensagens não lidas, também lista tickets com
  `status: "pending"` (aguardando atendimento, sem atendente). Um botão de "apagar
  notificações" (visível só para Admin/Master) limpa a lista exibida no popover.
- **White Label completo em Configurações** (v2.3.5): o componente `Whitelabel`
  completo (identidade/nome, cores clara/escura, logotipos claro/escuro/favicon/ícones
  PWA, e logo/capa/WhatsApp da tela de login) vive na aba "Opções" de Configurações
  (`frontend/src/components/Settings/Options.js`), reaproveitando os mesmos endpoints
  já existentes (`/settings-whitelabel/logo`, `/global-config/upload`,
  `/global-config/upload/remove`) e o `ColorModeContext` — sem duplicar lógica. A aba
  "White Label" foi **removida do Painel SaaS**: ele fica reservado para gestão de
  empresas/licenças e (próxima etapa) cobrança bancária/mensagens de vencimento de
  fatura. A logomarca da tela de login usa a logomarca geral da empresa como
  alternativa quando não há uma logo específica de login configurada
  (`GlobalConfigController.publicBranding`, desde a v2.3.4). Removidas da tela de login
  as opções "Criar conta gratuita" e "Esqueceu a senha?" (v2.3.4).
- **Permissões da identidade (v2.3.6)**: dentro do `Whitelabel`, "Identidade"/
  "Logotipos" (nome, cores, logomarcas, favicon, ícones) ficam visíveis para **qualquer
  Admin** — cada empresa cuida da própria marca. "Login / capa" (compartilhada por
  todas as empresas na mesma tela de login) continua **exclusiva do Master**.
  ~~Limitação conhecida: a exibição da logo no menu lateral hoje ainda lê de um
  endpoint fixo na empresa 1, não por empresa autenticada~~ — **corrigido na v2.3.18**,
  ver seção 7.

---

## 6.2 Roadmap — módulo Financeiro completo (Etapa 4, planejado, ainda não iniciado)

O módulo "Financeiro" (hoje `frontend/src/pages/Financeiro/index.js`, rota `/financeiro`)
vai deixar de ser só a tela de fatura/assinatura da empresa com o Master e virar um
módulo financeiro/ERP completo, por dentro do próprio AtendeFlow. Isso é um projeto
grande, então fica registrado aqui em fases, na ordem em que faz sentido construir —
cada fase deve virar sua própria etapa/versão, não uma coisa só.

**Já feito (v2.3.12):** o Painel SaaS (cobrança das empresas-clientes pelo Master) foi
absorvido pela mesma rota `/financeiro` — pra quem é Master, `/financeiro` mostra o
Painel SaaS (isso continua valendo).

**Ajustado (v2.3.14):** a fatura/plano da própria empresa com o AtendeFlow ("Minha
assinatura") saiu de `/financeiro` — não fazia sentido misturar a cobrança da empresa
com o AtendeFlow com os cadastros operacionais da própria empresa. Agora é uma aba em
Configurações ("Assinatura"), com a marca Confianza Technologies (quem emite a
cobrança). `/financeiro`, pra quem não é Master, passou a ser só sobre os cadastros
da Fase 1 abaixo.

**Já feito (v2.3.13) — Fase 1 completa:** cadastro de clientes, fornecedores e
produtos/serviços, com listagem (busca + paginação), criação, edição e exclusão —
novas abas "Clientes"/"Fornecedores"/"Produtos" dentro do item "Financeiro", visíveis
só quando o módulo está liberado (ver regra de permissionamento abaixo, já
implementada: `Plan.useFinancial` + `User.financialAccess`). Modelos:
`backend/src/models/FinanceCustomer.ts`, `FinanceSupplier.ts`, `FinanceProduct.ts`;
endpoints em `backend/src/routes/financeRoutes.ts`
(`/finance/customers|suppliers|products`, `/finance/access` pro status);
componentes reutilizáveis no frontend: `FinanceRecordModal` (formulário genérico
orientado a um schema declarativo de campos) e `FinanceRecordList` (tabela + CRUD
genérico) — evita triplicar o mesmo código pras três entidades; configuração de
colunas/campos de cada uma em `frontend/src/pages/Financeiro/financeConfig.js`.
Campos como `ncm` (Nomenclatura Comum do Mercosul) em `FinanceProduct` já ficam
previstos pra Fase 3 (fiscal/NF-e), mas sem uso ainda.

**Regra de permissionamento (implementada na v2.3.13), que vale pra todo o módulo
Financeiro novo**: o módulo financeiro completo é um **add-on pago**, à parte do
plano-base do AtendeFlow. O Master decide **por plano** (Configurações → Planos,
toggle "Financeiro (add-on)" → `Plan.useFinancial`) se as empresas daquele plano têm
ou não direito ao módulo — reaproveita o mesmo mecanismo já usado por `useKanban`/
`useCampaigns`/etc., em vez de criar um controle novo por empresa. Se o plano da
empresa tiver o módulo, o **Admin daquela empresa** decide quais usuários/funcionários
dela têm acesso às telas (aba Permissões do cadastro de usuário → `User.financialAccess`
— igual já funciona hoje pra outras permissões). Admin sempre tem acesso quando o
módulo está ativo, independente desse campo; Master nunca tem acesso (não opera
empresa nenhuma — `backend/src/services/FinanceService/EnsureFinancialAccess.ts`
nega explicitamente pra `super`). Ou seja: `Master → libera o módulo no plano` →
`Admin da empresa → libera telas específicas pra cada funcionário`.

### Fase 1 — Cadastros ✅ concluída (v2.3.13)
- Cadastro de clientes: entidade própria (`FinanceCustomer`), não reaproveita
  `Contact` diretamente — precisa de campos fiscais que o Contact não tem (CPF/CNPJ,
  endereço estruturado) — mas tem um `contactId` opcional pra vincular a um Contact
  já existente quando fizer sentido.
- Cadastro de fornecedores (`FinanceSupplier`).
- Cadastro de produtos/serviços (`FinanceProduct` — nome, tipo produto/serviço, SKU,
  unidade, preço de venda/custo, controle de estoque opcional, campo `ncm` já
  previsto pra Fase 3 mas sem uso ainda).

### Fase 2 — Financeiro operacional ✅ concluída (backend v2.3.19, frontend v2.3.20)
- **Contas a pagar** (`FinanceExpense`): descrição, categoria (livre), tipo de custo
  (`fixed`/`variable`), valor, vencimento, data de pagamento, status
  (`pending`/`paid`), fornecedor (opcional, vínculo com `FinanceSupplier`),
  observações. CRUD completo em `/finance/expenses`.
- **Contas a receber** (`FinanceReceivable`): descrição, valor, vencimento, data de
  recebimento, status (`pending`/`received`), cliente (opcional, vínculo com
  `FinanceCustomer`), observações. CRUD completo em `/finance/receivables`.
- **Relatórios** (`FinanceReportService`, rotas `/finance/reports/*`):
  - `summary`: cartões de resumo (pendências, vencidos, pago/recebido no mês,
    saldo previsto);
  - `cashflow`: série de N meses (padrão 6) com entradas x saídas, baseada na
    data real de pagamento/recebimento (não no vencimento);
  - `expenses-by-category`: total de despesas agrupado por categoria.
  - ⚠️ **Armadilha de tipagem/SQL encontrada e corrigida**: `value` é salvo como
    `string` (varchar) nos modelos, de propósito, pra evitar imprecisão de ponto
    flutuante — mas isso quebra `SUM()` no Postgres (`42883: function sum(character
    varying) does not exist`). Toda soma precisa de `CAST("value" AS NUMERIC)`
    explícito — ver o helper `sumValue()`/`sumWhere()` em `FinanceReportService.ts`.
    Se `Model.sum("value", ...)` for usado em código novo sobre esse mesmo tipo de
    coluna, vai quebrar da mesma forma — usar sempre o helper.
- **Painel Financeiro** (`frontend/src/components/FinancePainel`, aba lateral
  "Painel Financeiro" dentro de Financeiro): cartões de resumo (7, direto do
  `summary`), gráfico de barras de fluxo de caixa (Receitas x Despesas, últimos
  6 meses) e gráfico de barras horizontais de despesas por categoria — construído
  com `recharts` (já usado no `Dashboard`), seguindo a skill de `dataviz` do
  projeto: paleta categórica já validada `['#6366f1', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6']` (Receitas = índigo, Despesas = vermelho, cor fixa por
  identidade — nunca cíclica), rótulo direto em toda barra (nunca só cor), sem
  eixo duplo. **Despesas por categoria usa barras horizontais de um hue só (magnitude),
  não um gráfico de pizza multicor** — decisão deliberada: a categoria é
  cadastrada livremente pelo cliente, então o número de categorias não tem teto
  previsível, e a skill de dataviz exige atribuir cor categórica em ordem fixa,
  nunca gerada/ciclada — um gráfico de barras de magnitude evita esse problema
  por completo e ainda lê melhor pra comparar valores. O cliente enviou uma
  referência visual (coleção de elementos de dashboard estilo escuro, gradientes
  neon roxo/rosa/azul, anéis de progresso) usada só como inspiração de paleta/
  estilo geral — não reproduzida (é um stock de terceiros com licença própria).
  - ⚠️ **Armadilha de layout encontrada e corrigida**: o rótulo direto (`LabelList`)
    da MAIOR barra do gráfico de categorias ficava cortado na borda direita do
    SVG, porque o domínio do eixo X ia exatamente até o maior valor — corrigido
    com `domain={[0, dataMax => dataMax * 1.2]}` (20% de folga) + mais margem
    direita. Vale lembrar disso em qualquer gráfico novo com rótulo direto
    posicionado "depois" da marca (`position="right"`/`"top"`): sempre reservar
    espaço extra no domínio do eixo, não só na margem do `<svg>`.
- **Exportação/impressão dos relatórios**: botão "Imprimir / Exportar PDF" no
  Painel Financeiro, via `window.print()` + CSS `@media print` dedicado (não
  `jsPDF`/Puppeteer — mais simples, sem depender de captura de canvas, e o
  usuário já pode "Salvar como PDF" na própria caixa de diálogo de impressão do
  navegador). A técnica: um `id` fixo (`#finance-painel-print-area`) marca o que
  deve ir pro papel; todo o resto da página (`body *`) vira `visibility: hidden`
  só durante a impressão, e a área do painel é reposicionada em `position:
  absolute` pra ocupar a folha inteira. O próprio botão de imprimir também some
  no papel (`#finance-painel-print-hide`). Detalhe: qualquer tooltip de gráfico
  que esteja "grudado" na tela no momento do print precisa ser escondido também
  (`.recharts-tooltip-wrapper { display: none }`), senão ele aparece flutuando
  no PDF/impresso.
- Migrações: `20260914150000-create-finance-expenses.ts`,
  `20260914150100-create-finance-receivables.ts` (rodar `npm run db:migrate`
  no deploy desta versão, se ainda não tiver rodado).
- ⚠️ **Bug de troca de aba encontrado e corrigido**: ao adicionar as novas abas
  (Contas a Pagar/Receber), descobri que trocar de aba dentro do Financeiro
  (`FinanceRecordList`) **não recarregava os dados** — ficava mostrando os
  registros da aba anterior, porque o React reaproveita a mesma instância do
  componente quando o tipo/posição não muda, e o `useCallback` do fetch só tinha
  `searchParam`/`filterValues` nas deps, nunca `resource` — trocar só a prop
  `resource` não disparava um novo fetch. Isso já existia desde a Fase 1
  (Clientes/Fornecedores/Produtos), só não tinha sido percebido. Corrigido em
  duas camadas: `resource` entrou nas deps do `useCallback` (causa raiz) e
  `key={financeTab}` em cada `<FinanceRecordList>` de `Financeiro/index.js`
  (reforço — força remontagem completa a cada troca de aba, garantindo que
  busca/filtro também comecem limpos). **Lição**: uma lista com CRUD reaproveitada
  entre "abas" que trocam o recurso de dados precisa ou de `resource` nas deps
  do fetch, ou de um `key` que mude junto com o recurso — nunca as duas coisas
  de menos.

### Fase 3 — Módulo fiscal (Nota Fiscal Eletrônica) — iniciada v2.3.22

Decisões tomadas com o cliente antes de começar (evitando o risco regulatório
de emitir nota fiscal incorreta):
- **Emissão via gateway** (não integração direta com a SEFAZ) — escolhido
  **Focus NFe** como provedor padrão: cobre NF-e/NFC-e/NFS-e num único
  contrato de API, documentação em português, bom encaixe pra um adapter só
  cobrir os 3 tipos de documento.
- **Todos os 3 documentos** (NF-e, NFC-e, NFS-e) fazem parte do escopo, com
  NF-e sendo o mais padronizado e testado primeiro.
- **Regime tributário**: suporte a MEI/ME/EPP (Simples Nacional) e
  LTDA/S.A. (Lucro Presumido/Real) — campo `taxRegime` na Configuração
  Fiscal cobre os 4 regimes.
- **Origem da nota — decisão estrutural**: NF-e/NFC-e exigem itens
  discriminados (produto, quantidade, NCM, CFOP); uma Conta a Receber
  (Fase 2) é só um valor total, sem itens — não dá pra virar nota fiscal
  sozinha. Criada uma nova tela **Vendas** com itens (reaproveitando o
  catálogo de produtos da Fase 1, `FinanceProduct`, que já tinha o campo
  `ncm` previsto) — confirmar uma venda gera automaticamente a conta a
  receber correspondente, e a partir da venda confirmada é possível emitir
  a nota fiscal.

#### O que foi implementado

- **`FiscalConfig`** (`/fiscal/config`, GET/PUT): um registro por empresa —
  regime tributário, inscrição estadual (+ isenção), inscrição municipal,
  CNAE, código IBGE do município, e as credenciais do gateway (token,
  ambiente homologação/produção, séries de NF-e/NFC-e/NFS-e). Configurado
  pelo **Admin da empresa-cliente**, não pelo Master — o token é da própria
  empresa junto à Focus NFe (emite em nome do CNPJ dela), diferente das
  credenciais de gateway de pagamento da assinatura do AtendeFlow (essas
  sim geridas pelo Master, em `Company`).
- **`Sale`/`SaleItem`** (`/sales`, CRUD + `/sales/:id/confirm` +
  `/sales/:id/cancel`): venda com itens. Fluxo: `draft` (editável, itens
  podem mudar) → `confirm` (trava os itens, gera uma `FinanceReceivable`
  com o valor total, some `receivableId` na venda) → a partir daí pode
  emitir nota fiscal. Uma venda confirmada não pode mais ser editada
  (`ERR_SALE_NOT_EDITABLE`) — nota fiscal e conta a receber já emitidas não
  podem refletir uma mudança retroativa nos itens.
- **`FiscalDocument`** (`/sales/:saleId/fiscal-documents`, POST pra emitir;
  `/fiscal-documents/:id/refresh-status`, `/fiscal-documents/:id/cancel`):
  um registro por TENTATIVA de emissão (histórico completo — uma reemissão
  depois de erro gera outro registro, nunca sobrescreve o anterior).
  `externalRef` é a chave que este sistema gera e manda pro gateway
  (idempotente do lado da Focus NFe); `accessKey` é a chave de acesso de 44
  dígitos, só existe depois de autorizada pela SEFAZ.
- **`FocusNFeService`** (`backend/src/services/FiscalService/FocusNFeService.ts`):
  adapter HTTP pro gateway — `emit`, `getStatus`, `cancel`. Erros de
  comunicação/gateway nunca derrubam a aplicação: ficam armazenados no
  campo `errorMessage` do `FiscalDocument` com `status: "error"`, pra dar
  pra investigar e reemitir depois.
- ✅ **Corrigido na v2.3.23**: inicialmente o fiscal reaproveitava o mesmo
  gate do Financeiro (`Plan.useFinancial`), sem controle próprio — o Master
  não tinha como vender/liberar o fiscal separado do Financeiro. Corrigido
  com um flag de plano dedicado: `Plan.useFiscal` (`EnsureFiscalAccess`,
  `GetFiscalAccessStatus`), com um toggle próprio no editor de planos do
  Master ("Fiscal — NF-e/NFC-e/NFS-e (add-on)", ao lado de "Financeiro
  (add-on)" em `PlansManager.js`). **Sempre exige `useFinancial` também
  ativo** (Vendas usa os cadastros de cliente/produto do Financeiro) — não
  faz sentido vender fiscal sem financeiro, mas o inverso é normal (um
  plano pode ter Financeiro sem Fiscal). Endpoint `GET /fiscal/access`
  (mesmo padrão do `GET /finance/access`) — o frontend usa isso pra
  esconder as abas Vendas/Configuração Fiscal quando o plano do cliente não
  inclui, em vez de deixá-las visíveis e travadas no backend (mesma lição
  do bug da v2.3.19 sobre permissão "Módulo Financeiro").
- Frontend: dentro do Financeiro (navegação lateral), duas abas novas —
  **Vendas** (`SaleList`/`SaleModal`/`SaleDetailModal` — modal de
  criação/edição com itens dinâmicos via `Formik` `FieldArray`, seleção de
  produto autopreenche descrição/NCM/unidade/preço; modal de detalhe mostra
  itens travados + histórico de notas fiscais + botões "Emitir NF-e/NFC-e/
  NFS-e") e **Configuração Fiscal** (`FiscalConfigPanel` — formulário único
  por empresa).

#### ⚠️ Limitação de teste importante — leia antes de usar em produção

**O adapter `FocusNFeService` nunca foi validado contra uma chave de
sandbox real** — esta sessão de desenvolvimento não tinha acesso a
credenciais da Focus NFe. Foi implementado a partir da documentação
pública da Focus NFe (nomes de campos, formato de payload, parsing de
resposta), e o teste end-to-end confirmou que:
- o fluxo completo funciona (venda → confirmação → conta a receber →
  tentativa de emissão → registro do resultado);
- a chamada HTTP realmente alcança o servidor de homologação da Focus NFe
  (testado com um token inválido de propósito — a resposta 403 de
  autenticação confirma que a URL, o método de autenticação HTTP Basic e o
  formato geral da requisição estão corretos);
- erros do gateway são capturados e mostrados de forma clara pro usuário,
  sem quebrar a aplicação.

**O que ainda não foi confirmado**: se os NOMES EXATOS dos campos do
payload (`buildNfePayload`/`buildNfcePayload`/`buildNfsePayload` em
`FocusNFeService.ts`) batem 100% com o que a Focus NFe espera pra emitir
uma nota de verdade, e se o parsing da resposta (`parseDocumentResponse`)
extrai os campos certos (`numero`, `chave_nfe`, `caminho_danfe` etc.) do
formato real de retorno. **Antes de emitir a primeira nota de produção**:
configurar um token de homologação de verdade em Configuração Fiscal,
emitir uma NF-e de teste, e comparar a resposta real da API com o parsing
no código — ajustar os nomes de campo se necessário (são poucos pontos,
isolados nas funções citadas acima).

**NFS-e em particular** é a mais dependente de município (cada prefeitura
tem seu próprio layout) — o payload implementado é um denominador comum
simplificado; é bem provável que precise de ajuste por município conforme
forem testados de verdade.

#### Ainda pendente da Fase 3

- Validar o adapter contra um token de homologação real (ver acima).
- Reforma Tributária (transição CBS/IBS iniciada em 2026, substituindo
  PIS/COFINS/ICMS/ISS ao longo dos próximos anos) — a Focus NFe absorve
  atualizações de layout do lado dela, mas os campos que o AtendeFlow
  manda podem precisar de ajuste conforme a transição avança.
- Contingência (emissão offline quando a SEFAZ está fora do ar) — não
  implementado; a Focus NFe tem suporte a isso do lado dela, mas o
  AtendeFlow ainda não expõe esse fluxo.
- PDF (DANFE/DANFCE) e XML: os links (`xmlUrl`/`pdfUrl`) retornados pelo
  gateway já ficam salvos no `FiscalDocument`, mas o frontend ainda não tem
  um botão de download/visualização direto — só mostra o link seria
  suficiente, é uma extensão pequena quando for necessário.

### Fase 4 — Módulo contábil (adiada — decisão do cliente, v2.3.25)
Cálculo e geração de guias de pagamento de impostos conforme o regime tributário
escolhido na Fase 3 (DAS do Simples Nacional para MEI/ME/EPP, ou apuração normal para
LTDA/S/A maiores), já considerando a transição da Reforma Tributária. Nível de
complexidade regulatória alto — normalmente é feito integrando com um ERP/contador
terceirizado (ex. via SPED) em vez de implementar o cálculo tributário do zero.
**O cliente pediu explicitamente pra definir o escopo dessa fase depois, numa fase
final separada** — nenhuma decisão de abordagem foi tomada ainda (nem DAS x SPED, nem
priorização de regime); não retomar sem o cliente trazer o assunto de volta. Nesse
meio tempo o roadmap seguiu direto pra Fase 5.

### Fase 5 — Módulo de RH / recrutamento ✅ concluída (v2.3.25)

Cadastro de vagas, recebimento/triagem de candidaturas (com anexo de currículo via uma
página pública sem login), e seleção de funcionários que podem, ao final, ser
efetivados como usuários do sistema daquela empresa (reaproveitando o cadastro de
`User` já existente pra etapa de efetivação). Decisões tomadas com o cliente antes de
começar: (1) a listagem de vagas é uma **página pública, sem login** — candidato não
precisa de conta pra ver vagas nem se candidatar; (2) a candidatura **exige anexo de
currículo** (PDF ou Word), não é só um formulário de texto.

**Regra de permissionamento**: mesmo padrão já usado pelo Financeiro/Fiscal — add-on
independente (`Plan.useHR`, toggle "RH — Recrutamento (add-on)" em Configurações →
Planos), liberado pelo Master por plano; dentro de uma empresa que tem o módulo, o
Admin decide quais funcionários têm acesso à tela (`User.hrAccess`, aba Permissões do
usuário). Diferente do Fiscal, o RH **não depende de nenhum outro módulo** (não exige
`useFinancial`) — é um add-on totalmente independente. `EnsureHRAccess`/
`GetHRAccessStatus` em `backend/src/services/HRService/EnsureHRAccess.ts`, endpoint
`GET /hr/access` (mesmo padrão do `GET /finance/access`/`GET /fiscal/access`). No
frontend, o item de menu "RH" (`/rh`) fica **sempre visível** pro Admin (igual
"Financeiro") — quem decide se mostra a tela ou uma mensagem de bloqueio é a própria
página, não o menu.

#### O que foi implementado

- **`JobPosting`** (`/job-postings`, CRUD autenticado): vaga com título, departamento,
  descrição, requisitos, tipo de contrato (CLT/PJ/estágio/temporário/freelancer),
  modalidade (presencial/híbrido/remoto), faixa salarial, localização e status
  (aberta/pausada/encerrada). A listagem do admin já traz `applicationCount` (contagem
  de candidaturas por vaga) via subquery `Sequelize.literal()`, evitando N+1.
- **`JobApplication`** (`/job-applications`, CRUD autenticado + `/job-applications/:id/hire`):
  candidatura com nome/e-mail/telefone do candidato, carta de apresentação opcional,
  `resumeUrl` (caminho do currículo salvo), status (recebida/em triagem/entrevista/
  aprovada/reprovada), observações internas e avaliação (1 a 5). **Efetivação**
  (`hire`): gera um usuário de verdade (`CreateUserService`, mesma validação de limite
  de usuários do plano) com uma senha provisória aleatória (`crypto.randomBytes`),
  marca a candidatura como aprovada e vincula `hiredUserId` — não é possível efetivar
  a mesma candidatura duas vezes (`ERR_JOB_APPLICATION_ALREADY_HIRED`) nem um e-mail
  que já é usuário de algum lugar (`ERR_JOB_APPLICATION_EMAIL_ALREADY_USER`). A senha
  provisória só é mostrada uma vez, na hora — o admin precisa repassar ao novo
  funcionário; não há envio de e-mail automático ainda.
- **Upload de currículo — rota pública, storage dedicado**: a candidatura é enviada
  sem login, então não existe `req.user.companyId` pra montar o caminho do arquivo
  (diferente do upload autenticado genérico em `config/upload.ts`). Criado
  `backend/src/config/resumeUpload.ts`, uma config de `multer` própria que usa
  `req.params.companyId` (vem da própria URL pública) pra montar
  `public/company{id}/resumes/`, aceita só PDF/Word (`fileFilter`) e limita a 8MB.
  Servido estaticamente pela mesma rota `/public` já existente (`app.ts`) — o mesmo
  padrão de URL usado em outros uploads do sistema (`${backendUrl}/public/<caminho>`).
- **Página pública de vagas** (`frontend/src/pages/PublicJobBoard`, rotas
  `/vagas/:companyId` e `/vagas/:companyId/:jobId`): sem login, lista as vagas com
  status "aberta" de uma empresa e permite se candidatar com formulário +
  `<input type="file">` (envio `multipart/form-data`). Usa `openApi` (instância do
  `axios` sem `withCredentials`/interceptor de sessão — a mesma já usada em
  Login/Signup) em vez da instância autenticada `api`, pra não arriscar efeito
  colateral de sessão numa página aberta a qualquer visitante. Registrada em
  `frontend/src/routes/index.js` **fora** do `<LoggedInLayout>` (mesmo grupo de
  `/login`/`/signup`) — mas usando o `Route` puro do `react-router-dom`, não o
  wrapper `Route` customizado do projeto: esse wrapper redireciona qualquer usuário
  autenticado pra fora de rotas não-privadas (pensado pra `/login`), o que faria um
  Admin logado ser expulso da própria página pública da empresa ao tentar visualizá-la.
  - ⚠️ **Bug de corrida encontrado e corrigido antes de commitar**: como a
    listagem e o detalhe da vaga são a mesma rota/componente (`/vagas/:companyId` e
    `/vagas/:companyId/:jobId` no mesmo `PublicJobBoard`), navegar da listagem pro
    detalhe via link do React Router **reaproveita a mesma instância do componente**
    — no primeiro render após a navegação, `jobId` já mudou (vem da URL) mas o
    estado (`jobPosting`/`loading`) ainda é o da listagem anterior, causando
    `Cannot read properties of null (reading 'title')`. Corrigido tratando o
    "carregando" como `loading || (jobId && !jobPosting && !notFound)`, não só a
    flag `loading` isolada. **Lição**: sempre que duas "visões" (lista/detalhe)
    dividem o mesmo componente por causa de um parâmetro de rota opcional, o guard
    de loading precisa considerar se os dados batem com o parâmetro atual, não só
    se uma requisição está em voo.
- **Painel administrativo** (`frontend/src/pages/RH`, rota `/rh`): duas abas —
  "Vagas" (`JobPostingList`/`JobPostingModal` — CRUD + botão "Copiar link" que monta
  a URL pública da vaga pra divulgação) e "Candidaturas" (`JobApplicationsPanel`,
  com filtro por vaga/status; `JobApplicationDetailModal` faz a triagem — status,
  observações, avaliação por estrelas (`@material-ui/lab/Rating`), link pro currículo,
  e o botão "Efetivar candidato").

#### Testado end-to-end (Playwright)

Fluxo completo validado no ambiente de desenvolvimento: Master cria uma vaga → vaga
aparece na página pública `/vagas/:companyId` → candidato anônimo abre o detalhe,
preenche o formulário e anexa um currículo (PDF) → candidatura aparece no painel
"Candidaturas" do admin, com contagem refletida na aba "Vagas" → admin abre a
triagem, muda o status e salva observações → admin efetiva o candidato → usuário
novo é criado de verdade na empresa (`profile: "user"`), a senha provisória aparece
na tela, e a candidatura fica marcada como aprovada com `hiredUserId` preenchido.
Testado também nas duas direções do controle por plano (`GetHRAccessStatus`): Admin
sem `Plan.useHR` → sem acesso; com o plano habilitado → Admin sempre tem acesso,
funcionário comum só com `User.hrAccess` marcado; Master sempre tem acesso, isolado
por `companyId`. Todos os dados de teste (vaga, candidatura, usuário efetivado,
arquivo de currículo) foram removidos do banco depois dos testes.

#### Etapa 5.1 — Painel RH e página pública com cara de dashboard (v2.3.26)

Pedido do cliente depois de testar a Fase 5: deixar o painel administrativo e a
página pública com uma cara mais "dashboard", no mesmo espírito visual do Painel
Financeiro (cards de resumo + gráficos, `dataviz` do projeto).

- **Nova aba "Painel RH"** (`frontend/src/components/HRPainel`, primeira aba de
  `/rh`, mesma posição que "Painel Financeiro" ocupa dentro do Financeiro): 4 cards
  de resumo (vagas abertas, total de candidaturas, total de vagas, candidatos
  efetivados) + dois gráficos de barra (`recharts`):
  - **Candidaturas por status**: cor por IDENTIDADE (conjunto fixo e pequeno de 5
    status conhecidos — recebida/triagem/entrevista/aprovada/reprovada), reaproveitando
    as mesmas cores já usadas nos `Chip`s de `JobApplicationsPanel`/
    `JobApplicationDetailModal` (`Cell` do `recharts` por barra, nunca cor cíclica).
  - **Candidaturas por vaga**: barras horizontais de um hue só (magnitude, não
    identidade) — mesmo raciocínio já usado em "Despesas por categoria" no
    `FinancePainel`, porque o título da vaga é texto livre cadastrado pelo Admin
    (não dá pra atribuir uma cor fixa por vaga com um número não previsível delas).
  - Endpoint novo: `GET /hr/reports/summary` (`HRReportService.summary`,
    `HRReportController`) — agrega contagens com `COUNT`/`GROUP BY` no banco em vez
    de trazer todas as candidaturas pro frontend só pra contar.
- **Página pública de vagas com cabeçalho "hero"**: gradiente roxo/índigo, ícone,
  nome da empresa (novo — os endpoints públicos `listPublicOpen`/`showPublic` agora
  incluem `company.name` via `include`) e um badge com a contagem de vagas abertas.
  Cards de vaga com efeito de elevação/leve translação no hover.

### Decisões em aberto antes de iniciar a Fase 3+
Fases 1 e 2 são construção "normal" de CRUD + relatórios, dá pra tocar direto. A partir
da Fase 3 (fiscal) e Fase 4 (contábil), a arquitetura muda bastante dependendo das
respostas acima (gateway de NF-e vs. integração direta; quais documentos fiscais;
integração com contador/SPED vs. cálculo próprio) — não deve ser iniciada sem alinhar
isso, dado o risco de gerar uma integração fiscal incorreta (o que teria consequência
real/legal pra empresas-clientes que dependessem dela).

---

## 7. Decisões técnicas e riscos conhecidos

- **Sem arquivo de licença (`LICENSE`)** no projeto original — o `zappro-legado` aparenta
  derivar do projeto open-source Whaticket. Antes de usar/revender comercialmente, vale
  confirmar os termos de licenciamento.
- **Duas versões de Material UI convivendo** (`@material-ui/*` v4 e `@mui/*` v5) —
  indica uma migração incompleta no projeto original; ao mexer em telas antigas, prestar
  atenção em qual versão cada componente usa.
- **`api_oficial` usa Prisma enquanto o `backend` usa Sequelize** — dois ORMs diferentes no
  mesmo sistema; são bancos de dados/processos separados, então não há conflito direto, mas
  é bom ter isso em mente ao dar manutenção.
- **`instalador.sh`** é, na prática, um script de **atualização** de uma instância já
  provisionada (reinstala dependências, builda e reinicia via PM2) — não faz o setup
  inicial completo (não roda migração de banco, não cria `.env`, não configura PM2 do
  zero). Ver o script para o passo a passo exato.
- Já removidos antes desta migração: um certificado `.p12` que estava versionado no
  backup original, arquivos de rascunho/quebrados (`*_old`, `*_backup`, `*dontwork*`) e 86
  arquivos de lixo do Windows (`*_Zone.Identifier`).
- ✅ **`npm install` e build validados** nas três aplicações (v2.1.1) — sem erros de
  compilação.
- ✅ **Vulnerabilidades críticas corrigidas** (v2.2.0) — de 13 para 2 no total (todas no
  backend). As 2 restantes são do **Sequelize** (ORM principal): a correção exige subir de
  v5 para v6, uma mudança de versão maior que afeta todos os modelos/migrações do
  sistema. **Não foi aplicada** — precisa de uma migração dedicada, seguindo o
  [guia oficial de upgrade](https://sequelize.org/docs/v6/other-topics/upgrade-to-v6/),
  com testes extensivos antes de ir para produção. Rode `npm audit` periodicamente em
  cada app pra acompanhar novas vulnerabilidades.
- ✅ **Bug crítico corrigido (v2.3.3)**: o modelo `Whatsapp` tinha o campo
  `maxUseBotQueues` sem nenhuma migration correspondente — quebrava qualquer listagem de
  conexões (`ListWhatsAppsService`, tela de Conexões) com `column ... does not exist`.
  Adicionada a migration que faltava. **Após atualizar o código, rodar
  `npm run build:backend && npm run db:migrate` para aplicar.**
- **`frontend/src/pages/Settings/index.js` é um arquivo órfão** — a rota `/settings` usa
  `frontend/src/pages/SettingsCustom/index.js`. Sempre confirmar em
  `frontend/src/routes/index.js` qual componente uma rota realmente usa antes de editar.
- ✅ **Marca "dona do sistema" fixada no código, não em configuração (v2.3.9)**: a logo
  Confianza Technologies exibida na tela de login não é lida de `Setting`/upload — é um
  asset importado diretamente em `frontend/src/pages/Login/index.js`
  (`frontend/src/assets/confianza-logo-dark.png`). Motivo: essa marca representa a
  empresa dona/fornecedora do software (não uma empresa-cliente configurável pelo Master
  ou por um Admin), então depender de banco/upload só criava pontos de falha (SQL não
  rodado, arquivo não enviado, cache de build). Qualquer marca que precise **sempre**
  aparecer, em qualquer instalação, deve seguir esse padrão — asset fixo no build, não
  Setting dinâmica.
- ⚠️ **Papel do Master x Admin (v2.3.10, revisado na v2.3.15) — regra de
  arquitetura a respeitar em qualquer tela nova**: o **Master** é o
  dono/operador do sistema. Ele cadastra empresas, cria o Admin de cada uma e
  libera o plano/licença (Configurações → Empresas, Painel SaaS) — isso
  continua exclusivo dele. Mas o Master **também tem acesso a todas as
  funcionalidades do sistema** (v2.3.15) — inclusive as que operacionalmente
  pertencem a uma empresa (White Label, módulo Financeiro, filas, conexões,
  campanhas etc.) — só que sempre dentro do **próprio ambiente dele**
  (companyId 1, o "esqueleto"). Nunca dá acesso aos dados de uma
  empresa-cliente real, porque tudo continua escopado por `companyId`. Ou
  seja: pra funcionalidades operacionais normais, a checagem certa é só
  `profile === "admin"` (cobre Admin de empresa E Master, cada um só vendo o
  próprio `companyId`) — **não** `profile === "admin" && !super` como a
  v2.3.10 tinha estabelecido (isso escondia a funcionalidade do Master por
  completo, contrariando "Master tem acesso a tudo"). A checagem
  `!super` continua certa **só** para o que é genuinamente exclusivo do
  Master por natureza — dados agregados de TODAS as empresas-clientes
  (Painel SaaS/cobrança) ou configuração verdadeiramente global/compartilhada
  (Login/capa da tela de login).
- ✅ **Bug de permissão corrigido (v2.3.11)**: o Master tem acesso a **todo o
  sistema**, mas o **Painel SaaS é exclusivo dele** — é quem emite as cobranças
  mensais/anuais das empresas-clientes (conforme o plano escolhido). O backend
  (`GlobalConfigController.ts`) liberava esse módulo também pra qualquer Admin
  da empresa de id 1 (`profile === "admin" && companyId === 1`), resquício de
  uma versão sem o conceito de Master — corrigido pra exigir só `isSuper` em
  todas as 6 checagens do arquivo (dashboard, financeiro, cobranças, upload de
  branding do login etc.).
- ✅ **Bug de UX corrigido (v2.3.14) — salvar só em `onBlur` é frágil**: campos
  de texto que salvam configuração (ex.: nome da empresa em
  `Whitelabel.js`) não devem depender só do evento `onBlur` — se o usuário
  digitar e recarregar a página (ou navegar) antes do campo perder o foco, a
  alteração nunca é enviada e parece um bug de "não salva". Corrigido com um
  debounce (~900ms depois de parar de digitar) além do `onBlur`. Vale esse
  padrão pra qualquer campo de texto "salva ao sair do campo" no projeto.
- **"Minha assinatura" x módulo Financeiro (v2.3.14)**: são conceitos
  diferentes que não devem ficar na mesma tela — assinatura é a fatura da
  **empresa-cliente com o AtendeFlow** (emitida pela Confianza Technologies,
  dona do sistema); o módulo Financeiro é sobre a **operação da própria
  empresa** (clientes/fornecedores/produtos dela). Assinatura agora vive em
  Configurações; Financeiro ficou livre pra ser só sobre a Fase 1+ do roadmap
  da seção 6.2.
- ✅ **Bug corrigido (v2.3.15) — `required` do MUI `Select` é só visual**:
  o campo de plano no cadastro de empresa tinha `required={true}` mas isso
  não bloqueia sozinho o envio de um `Select` do Material UI (não é um
  `<select>` nativo) — dava pra cadastrar empresa sem plano vinculado.
  Corrigido validando explicitamente antes de enviar (frontend) e recusando
  no backend (`CreateCompanyService`) se `planId` vier vazio. Vale conferir
  esse mesmo padrão em outros formulários com campo obrigatório via
  `Select`/`Field as={Select}` no projeto.
- ✅ **Bug crítico corrigido (v2.3.18) — branding do menu lateral lido de um
  endpoint fixo na empresa 1**: era a causa raiz real do "logo/nome
  desconfigura no F5" relatado várias vezes ao longo desta etapa (v2.3.4 até
  v2.3.14 tentaram corrigir sintomas relacionados — debounce de salvamento,
  upload imediato — mas nenhum deles era a causa real desse sintoma
  específico). `frontend/src/App.js` buscava `appLogoLight`/`appName`/cores
  via `GET /public-settings/:key`, que no backend
  (`GetPublicSettingService`) é **hardcoded pra `companyId: 1`** — correto
  seria usar `GET /settings` (autenticado, escopado por `req.user.companyId`).
  Pra quem estava logado na empresa 1 isso nunca dava problema; pra Admin de
  **qualquer outra empresa**, a logo/nome configurados apareciam certo só
  enquanto durava o estado em memória (`colorMode.setAppLogoLight(...)`
  chamado no próprio upload) — um F5 recarregava `App.js` do zero, que ia
  buscar de novo no endpoint errado (empresa 1) e sobrescrevia com o valor
  errado. Corrigido usando `/settings` com sessão logada (fallback pra
  `/public-settings` só sem login ou se a chamada autenticada falhar) — ver
  `frontend/src/utils/brandingEvents.js` pro detalhe de como isso também
  passou a atualizar **logo após o login**, sem esperar um F5 (`App.js`
  monta uma vez só pra vida inteira da SPA; login é troca de rota, não
  reload). **Lição**: ao investigar "salva mas não persiste" com sintomas
  parecidos entre versões, sempre conferir se a tela de LEITURA está lendo
  do lugar certo antes de assumir que é sempre um problema de
  salvamento/timing — não são a mesma coisa. Se o pedido volta descrito de
  forma quase idêntica depois de uma correção anterior, é sinal de que a
  correção anterior atacou um sintoma parecido mas não a causa raiz.
- ✅ **Bug corrigido (v2.3.19) — permissão "Módulo Financeiro" aparecia mesmo
  fora do plano contratado**: a aba Permissões do cadastro de usuário
  (`UserModal.js`) sempre mostrava o toggle "Módulo Financeiro" pro Admin de
  qualquer empresa, mesmo quando o plano contratado por aquela empresa **não**
  inclui o add-on (ex.: um plano "Prata" mais barato, sem
  `Plan.useFinancial`). O acesso real já era bloqueado no backend
  (`EnsureFinancialAccess`), mas a opção ficava visível e "habilitável" na UI,
  dando a falsa impressão de que o Admin podia ligar um módulo que a empresa
  não pagou. Corrigido buscando `GET /finance/access` (mesmo endpoint que a
  tela do Financeiro já usa) ao abrir o modal e só renderizando o toggle
  quando `planHasModule === true`. Mesma lógica vale pra qualquer outra
  permissão/toggle que dependa de um add-on por plano: **a UI não deve deixar
  a opção "aberta" (visível/clicável) quando o plano não inclui aquela
  funcionalidade** — esconder, não só bloquear no backend.
- ✅ **Bug crítico corrigido (v2.3.21) — plano contratado não aparecia em
  "Minha assinatura" mesmo com plano válido vinculado**: diferente da v2.3.17
  (empresa SEM planId no banco — dado ausente), este bug acontecia mesmo com
  um `planId` correto. Causa raiz: `SubscriptionPanel.js` só mostrava
  nome/usuários/conexões/filas/valor do plano **dentro de cada linha da
  tabela de faturas** (`invoices.map(...)`) — e faturas só são criadas pelo
  cron `handleInvoiceCreate` (`backend/src/queues.ts`) quando faltam **menos
  de 20 dias** pro vencimento da empresa. Resultado: qualquer empresa nova ou
  fora dessa janela de 20 dias tinha ZERO faturas, então a tabela ficava
  totalmente vazia — nenhuma informação do plano aparecia, como se a empresa
  não tivesse plano nenhum, mesmo tendo. Corrigido adicionando um cartão
  "Plano atual" fixo (mostra sempre que `companyPlan` existir, **independente
  de haver fatura**) logo abaixo do cabeçalho, e um estado vazio explícito
  ("Nenhuma fatura emitida ainda...") na tabela/cards de faturas em vez de
  ficarem em branco. Também corrigidos dois bugs relacionados encontrados no
  caminho:
  - `PlanController.show` (backend) comparava o `id` da rota com
    `company.planId.toString()` sem checar `null` primeiro — numa empresa sem
    plano vinculado isso quebrava com `TypeError` (500), em vez do 400
    esperado de "sem permissão". Corrigido com `company?.planId` +
    `if (!PlanCompany || ...)`.
  - `SubscriptionPanel.js` fazia uma chamada extra (`GET /plans/:id`) só pra
    buscar o que `GET /companies/:id` já retorna via `include: ["plan"]`
    (`ShowCompanyService`) — removida a chamada redundante, usando
    `company.plan` direto. Menos uma volta de rede e um ponto a menos de
    falha (o bug acima só existia por causa dessa chamada extra).
  - `MainListItems.js` (menu lateral, roda em toda página autenticada) também
    acessava `planConfigs.plan.useCampaigns` sem checar `null` — mesma causa
    (empresa sem plano), só que quebrava silenciosamente (`try/catch` já
    engolia o erro) em vez de aparecer pro usuário; corrigido com optional
    chaining mesmo assim, por robustez.
  **Lição**: quando uma informação "principal" (aqui, o plano) só é exibida
  como um SUBPRODUTO de outra lista (aqui, faturas), qualquer condição que
  esvazie essa lista esconde a informação principal junto — mesmo que os
  dados dela estejam perfeitos. Informação que precisa "sempre aparecer" não
  pode depender da existência de itens de uma lista relacionada; tem que ter
  seu próprio bloco de exibição, com sua própria condição (`companyPlan &&
  ...`), independente da lista ter itens ou não.
- ⚠️ **Incidente de deploy (não é bug de código) — `.sequelizerc` aponta as
  migrações pra pasta COMPILADA (`dist/database/migrations`), não pro
  código-fonte (`src/database/migrations`)**: se `npm run build` do backend
  não recompilar TODOS os arquivos (aconteceu em produção por algum motivo
  ainda não identificado — possivelmente um build anterior parcial/
  incompleto), `npx sequelize-cli db:migrate` só enxerga o subconjunto de
  migrações que existem em `dist/`, e reporta **"database schema was
  already up to date"** mesmo faltando tabelas inteiras no banco (ex.:
  `FinanceReceivables`, `FinanceExpenses`) — porque a CLI nem sabe que
  aquelas migrações existem. Sintoma: "Internal server error" generalizado
  no módulo que depende da tabela faltante (`relation "X" does not exist`,
  Postgres código `42P01`), sem nenhuma mensagem óbvia apontando pra causa
  (migração "dizendo" que está tudo certo). **Correção aplicada**: apagar
  `dist/` inteiro e rodar `npm run build` do zero (`rm -rf dist && npm run
  build`), conferir que `ls src/database/migrations | wc -l` bate com `ls
  dist/database/migrations | wc -l`, e só então rodar `db:migrate` de novo.
  **Lição pra qualquer deploy futuro**: depois de um `git pull` que trouxe
  migrações novas, sempre conferir essa contagem bater ANTES de confiar no
  resultado do `db:migrate` — "up to date" da CLI não é garantia se o build
  local não foi realmente completo. Vale considerar trocar o `.sequelizerc`
  pra rodar as migrações direto do `.ts` (via `ts-node`) no futuro, eliminando
  essa classe de problema por completo.
- ✅ **Bug crítico corrigido (v2.3.24) — campo "Valor (R$)" aceitava texto
  livre, quebrando o Painel Financeiro inteiro**: os campos de valor
  monetário nos formulários de conta a pagar/receber e produto
  (`financeConfig.js`) não tinham `type: "number"` — eram inputs de texto
  comuns. Um usuário digitando no formato brasileiro natural ("150,00", com
  vírgula) salvava essa string literal no banco. Dois efeitos:
  1. Na listagem, `money(value)` faz `Number("150,00")` → `NaN` → cai no
     fallback `|| 0` → aparece **"R$ 0,00"** mesmo o registro tendo sido
     salvo (o "valor não muda depois do cadastro" relatado);
  2. No Painel Financeiro, o `CAST("value" AS NUMERIC)` do
     `FinanceReportService` **quebra com erro do Postgres** assim que existe
     UM registro com valor nesse formato ("150,00" não é sintaxe numeric
     válida) — e como é um `SUM()` sobre todos os registros da empresa, essa
     UMA linha derruba o relatório inteiro (500) até ela ser corrigida.
  Corrigido em duas camadas:
  - Frontend: campos de valor (`financeExpenseFields`, `financeReceivableFields`,
    `financeProductFields` — `value`/`price`/`costPrice`) agora são
    `type: "number"` com `step: "0.01"` — o `<input type="number">` do
    navegador sempre reporta o `.value` em formato `.` (ponto), nunca vírgula,
    independente de como o usuário digita/vê;
  - Backend (defesa em profundidade, pra não voltar a quebrar com dados já
    salvos incorretamente ou uma chamada de API externa): `sumValue()` em
    `FinanceReportService.ts` trocou o `CAST` direto por um `CASE WHEN
    "value" ~ '^-?[0-9]+(\.[0-9]+)?$' THEN CAST(...) ELSE 0 END` — um valor
    mal formatado agora conta como 0 no relatório em vez de quebrar a
    consulta inteira. Registros com valor corrompido continuam aparecendo
    normalmente na listagem (não travam o CRUD) — só precisam ser editados e
    salvos de novo (agora com o campo numérico) pra corrigir o valor.
  **Lição**: todo campo que vai virar operando de uma função SQL agregada
  (`SUM`, `AVG`, `CAST ... AS NUMERIC`) no backend precisa ser validado/
  tipado já na entrada do formulário — sem isso, um único registro com
  formato errado pode derrubar uma tela inteira que depende de agregação,
  não só aquele registro específico.

---

## 8. Histórico de versões

Ver [`CHANGELOG.md`](../CHANGELOG.md) na raiz do repositório para o detalhamento de cada
etapa entregue e as próximas etapas planejadas.

## 9. Avaliação do projeto legado (zappro-legado)

Relatório completo da avaliação que embasou a decisão de adotar este projeto como nova
base do AtendeFlow: [`docs/AVALIACAO_ZAPPRO_LEGADO.md`](AVALIACAO_ZAPPRO_LEGADO.md).

---

## 10. Runbook: migrar código-fonte de um backup local para o GitHub

**Ambiente testado:** Ubuntu 24.04 (também vale para outras distros baseadas em Debian/Ubuntu).

Roteiro usado para resgatar o `zappro-legado` de um backup de servidor (zip de 5,1GB) e
publicá-lo num repositório GitHub, já limpo de dependências, mídia de cliente e backups
redundantes. Serve de referência para qualquer migração parecida no futuro.

### 10.1 Instalar o Git (se necessário)

```bash
sudo apt update
sudo apt install git -y
git --version
```

### 10.2 Configurar identidade do Git (uma vez por máquina)

```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu-email@exemplo.com"
git config --global init.defaultBranch main
```

### 10.3 Extrair o backup (se ainda estiver zipado)

```bash
mkdir -p ~/projeto-antigo
unzip "/caminho/para/o/arquivo.zip" -d ~/projeto-antigo
cd ~/projeto-antigo
```

### 10.4 Descobrir o que está ocupando espaço

Backups de servidor costumam vir com `node_modules`, builds, mídia de cliente e cópias
redundantes — o código-fonte de verdade normalmente é uma fração pequena do total.

```bash
# Tamanho total da pasta
du -sh .

# Lista as maiores subpastas (até 3 níveis), da maior pra menor
du -h --max-depth=3 . 2>/dev/null | sort -rh | head -30
```

### 10.5 Remover o que não é código-fonte

```bash
# Dependências, builds e caches (seguros de apagar — são gerados de novo com npm install/build)
find . -type d \( -name node_modules -o -name .git -o -name dist -o -name build \
  -o -name .next -o -name vendor -o -name uploads -o -name storage \
  -o -name logs -o -name tmp -o -name cache \) -prune -exec rm -rf {} +

# Backups redundantes (ex.: pastas tipo nome_backup_AAAAMMDD_HHMMSS)
rm -rf caminho/para/*_backup_*

# Mídia de clientes/usuários (fotos, áudios, vídeos recebidos em produção — não é código)
find caminho/para/public -maxdepth 1 -type d -name "empresaN*" -exec rm -rf {} +

# Confirma o tamanho final (esperado: poucas dezenas de MB para código-fonte puro)
du -sh .
```

### 10.6 ⚠️ Procurar credenciais sensíveis antes de subir

**Nunca** suba certificados, chaves privadas ou arquivos `.env` reais para o Git — mesmo em
repositório privado.

```bash
# Procura por extensões/nome comuns de credenciais
find . -type f \( -iname "*.p12" -o -iname "*.pem" -o -iname "*.key" \
  -o -iname ".env" -o -iname "*.pfx" \)
```

Se encontrar algo, remova do controle de versão (mantendo o arquivo no disco, se precisar
dele localmente) e adicione ao `.gitignore` **antes** do primeiro push:

```bash
git rm --cached caminho/para/arquivo-sensivel.p12
echo "caminho/para/arquivo-sensivel.p12" >> .gitignore
```

Se a credencial já foi commitada (mesmo que depois removida), considere-a exposta e
**revogue/troque-a** — remover do commit atual não apaga do histórico do Git.

### 10.7 Inicializar o repositório e commitar

```bash
cd ~/projeto-antigo
git init
git add .
git commit -m "Código-fonte do projeto antigo"
git branch -M main
```

### 10.8 Criar o repositório vazio no GitHub

No navegador, acesse **https://github.com/new**:
- Dê um nome ao repositório
- Marque **Private** se não for público
- **Não** marque nenhuma opção de README/.gitignore/license (o repositório precisa ficar
  vazio para receber o `git push` inicial)
- Clique em **Create repository** e copie a URL mostrada (formato
  `https://github.com/usuario/nome-do-repo.git`)

### 10.9 Gerar um token de acesso (Personal Access Token)

Desde 2021 o GitHub não aceita mais a senha normal da conta para operações Git por HTTPS —
é obrigatório usar um token.

1. Acesse **https://github.com/settings/tokens/new** (token **clássico** — não confundir
   com "fine-grained", que exige configuração extra de permissão por repositório)
2. Em **Note**, dê um nome (ex.: `push-projeto-antigo`)
3. Em **Expiration**, escolha um prazo (ex.: 30 dias)
4. Marque a caixa **`repo`** (dá acesso completo de leitura/escrita aos repositórios)
5. Clique em **Generate token** e copie o valor gerado (começa com `ghp_`)

> ⚠️ **O token é como uma senha — nunca cole ele num chat, e-mail ou qualquer lugar que não
> seja o prompt do próprio terminal.** Se ele vazar, revogue imediatamente em
> https://github.com/settings/tokens e gere outro.

### 10.10 Subir o código

```bash
git remote add origin https://github.com/usuario/nome-do-repo.git
git push -u origin main
```

Quando pedir:
- **Username** → seu usuário do GitHub
- **Password** → cole o token gerado no passo anterior (não aparece nada na tela ao colar
  — é o comportamento normal do terminal, não quer dizer que falhou)

### 10.11 Erros comuns e como resolver

| Mensagem de erro | Causa | Solução |
| --- | --- | --- |
| `Password authentication is not supported for Git operations` | Foi digitada a senha normal da conta em vez do token | Gerar um token (passo 10.9) e usá-lo no campo de senha |
| `remote: Repository not found` | A URL do remote (`git remote add origin ...`) está errada ou o repositório não existe | Confirmar com `git remote -v` e corrigir com `git remote set-url origin <url-correta>` |
| `remote: Write access to repository not granted` (403) | O token usado é do tipo **fine-grained** sem permissão de escrita configurada, ou não tem o escopo certo | Gerar um token **classic** com o escopo `repo` marcado (passo 10.9) |
| `fatal: repositorio ... no encontrado` (com a URL literal `SEU-USUARIO/NOME-DO-REPO`) | Um comando de exemplo foi copiado sem substituir pelos dados reais | Rodar `git remote set-url origin <url-real-copiada-do-github>` |
| `remote: Claude doesn't have GitHub access to <repo> for your organization` (403, ao dar push a partir de uma sessão do Claude Code) | O GitHub App do Claude não tem (ou perdeu) acesso a esse repositório específico | Acessar **https://github.com/apps/claude/installations/select_target**, abrir a instalação da conta/organização e adicionar o repositório à lista de acesso (ou marcar "All repositories") |

### 10.12 Depois de subir

- Se o repositório contiver algo que você já sabe que não devia estar lá (credencial,
  mídia grande demais), é mais seguro **apagar o repositório e recomeçar** do que tentar
  limpar o histórico do Git — reescrever histórico já publicado é arriscado.
- Conecte o novo repositório a uma sessão do Claude Code (ou clone normalmente) para dar
  sequência ao trabalho de avaliação/integração do código.

---

## 11. Backup em nuvem (diário, para o Google Drive do cliente)

Script `backup-para-drive.sh`, na raiz do projeto — gera um dump do banco (Postgres,
compactado) e um `.tar.gz` dos arquivos enviados (`backend/public/`: currículos do
módulo de RH, mídia recebida/enviada pelo WhatsApp, fotos de perfil etc.) e envia os
dois pro Google Drive combinado com o cliente, via `rclone`. Não apaga nada — cada
execução soma um par de arquivos novo (nome com timestamp) na pasta de destino.

**Pasta de destino no Drive (definida pelo cliente):**
[https://drive.google.com/drive/folders/17fYidSzfl_co2wONMs_XwI1-uCFL5cUQ](https://drive.google.com/drive/folders/17fYidSzfl_co2wONMs_XwI1-uCFL5cUQ)

### 11.1 Configuração inicial (uma vez só, no servidor)

```bash
# 1. Instalar o rclone
curl https://rclone.org/install.sh | sudo bash

# 2. Configurar o acesso ao Google Drive (fluxo interativo)
rclone config
```

No assistente do `rclone config`:
- `n` → novo remote
- nome: `gdrive` (se usar outro nome, rodar o script depois com
  `RCLONE_REMOTE=outro-nome ./backup-para-drive.sh`, ou editar a variável no topo do
  script)
- tipo: `drive` (Google Drive)
- `client_id`/`client_secret`: deixar em branco (usa as credenciais padrão do rclone)
- `scope`: `drive.file` (rclone só enxerga/gerencia o que ele mesmo cria — mais seguro
  que dar acesso a todo o Drive)
- login: o assistente abre (ou pede pra abrir manualmente) um link do Google pra
  autorizar — se o servidor não tem interface gráfica/navegador, use a opção de
  autorização remota que o próprio assistente oferece (`rclone authorize "drive"` numa
  máquina com navegador, colando o token de volta no servidor)
- confirmar `y` no final

Testar:
```bash
rclone lsd gdrive:
```
Deve listar as pastas do Google Drive da conta autorizada.

### 11.2 Rodando manualmente

```bash
cd /home/sandro/Bernardino   # ajustar pro caminho real do servidor
./backup-para-drive.sh
```

### 11.3 Agendando (todo final do dia)

```bash
crontab -e
```

Adicionar uma linha (roda todo dia às 23:30, horário do servidor):
```
30 23 * * * /home/sandro/Bernardino/backup-para-drive.sh >> /home/sandro/Bernardino/backend/logs/backup.log 2>&1
```

(criar a pasta de log antes, se não existir: `mkdir -p /home/sandro/Bernardino/backend/logs`)

### 11.4 Observações importantes

- O dump do banco contém **todos os dados de todas as empresas-clientes** (mensagens,
  contatos, financeiro, candidaturas de RH etc.) — é informação sensível. O acesso à
  pasta do Drive deve ficar restrito a quem realmente precisa.
- ✅ **Adicionado na v2.3.28**: além do dump do banco e dos arquivos enviados, o script
  agora também gera um terceiro arquivo (`atendeflow_config_<timestamp>.tar.gz`) com a
  **configuração crítica do servidor**: `backend/.env`, `frontend/.env`, a configuração
  do Cloudflare Tunnel (`~/.cloudflared/` e `/etc/cloudflared/`, se existirem) e o
  `crontab` atual. Isso existe por causa de um incidente real (ver seção 12.4) — sem
  isso, o dump do banco sozinho não é suficiente pra recuperar um servidor do zero,
  porque toda a configuração de domínio/túnel/variáveis de ambiente teria que ser
  refeita manualmente. **Esse arquivo é ainda mais sensível que o dump do banco** — tem
  senha de banco de dados e tokens do túnel em texto puro.
- O script não remove backups antigos do Drive nem do servidor — o histórico cresce
  indefinidamente. Definir uma política de retenção (ex.: apagar dumps com mais de 90
  dias) fica como melhoria futura, se o volume de dados justificar.
- Se o caminho do projeto no servidor mudar (como aconteceu na renomeação
  `Bernardino`/`AtendeFlow` desta mesma etapa), lembrar de atualizar o caminho na linha
  do `crontab`.

---

## 12. Acesso remoto (login de fora da rede local) via Cloudflare Tunnel

O servidor de produção do cliente (`ConfianzaThechnologies`) não tem IP público
próprio — está numa rede local, atrás de um roteador (IP interno `192.168.3.14`,
provedor de internet Flytec Telecom/Paraguai). Isso foi descoberto na hora de tentar
liberar acesso remoto: um registro DNS tipo `A` apontando pro IP "público" do link
(`45.228.136.187`, na verdade o IP do roteador) resultava em erro 522 (Cloudflare não
conseguia alcançar o servidor) — port forwarding no roteador seria uma opção, mas o
cliente já usa **Cloudflare Tunnel** pra outro serviço dele (um bot de Instagram,
túnel `instagram-agente`), então essa mesma tecnologia foi reaproveitada em vez de
mexer na rede/roteador.

### 12.1 Como funciona

O `cloudflared` (agente instalado no servidor) abre uma conexão de **saída** até o
Cloudflare — não precisa abrir porta nenhuma de entrada no roteador/firewall. O
Cloudflare recebe as requisições HTTPS dos visitantes e repassa pelo túnel até o
`cloudflared`, que entrega pro serviço local certo (backend/frontend), conforme
regras de "ingress" num arquivo de configuração.

### 12.2 Domínios em uso (`confiancatechnologies.com`, gerenciado no Cloudflare)

| Subdomínio | Serve | Aponta para (via túnel) |
| --- | --- | --- |
| `atendeflow.confiancatechnologies.com` | Frontend do AtendeFlow (o que o usuário acessa) | `http://localhost:3000` |
| `api.confiancatechnologies.com` | Backend/API do AtendeFlow | `http://localhost:8080` |
| `instagram-bot.confiancatechnologies.com` | Outro serviço do cliente (bot de Instagram) — **não mexer** | túnel `instagram-agente` (outra máquina) |
| `www.confiancatechnologies.com` | Outro serviço do cliente — **não mexer** | túnel `instagram-agente` (outra máquina) |

Os dois primeiros usam o túnel **`atendeflow`** (ID `cc12b65a-538f-4719-b80c-f488cd01e96f`),
criado especificamente pro AtendeFlow, rodando **nesta** máquina. Os dois últimos usam
um túnel **diferente** (`instagram-agente`), de outro serviço do cliente, rodando em
**outra** máquina — nunca alterar ou apagar esses registros ao mexer no AtendeFlow.

### 12.3 Configuração no servidor

- `~/.cloudflared/config.yml` e `/etc/cloudflared/config.yml` (cópia usada pelo
  serviço systemd) — regras de ingress:
  ```yaml
  tunnel: cc12b65a-538f-4719-b80c-f488cd01e96f
  credentials-file: /home/sandro/.cloudflared/cc12b65a-538f-4719-b80c-f488cd01e96f.json

  ingress:
    - hostname: atendeflow.confiancatechnologies.com
      service: http://localhost:3000
    - hostname: api.confiancatechnologies.com
      service: http://localhost:8080
    - service: http_status:404
  ```
- Rodando como serviço systemd (`cloudflared.service`, instalado via
  `cloudflared service install`) — sobe sozinho no boot e reinicia se cair.
- `backend/.env`: `FRONTEND_URL=https://atendeflow.confiancatechnologies.com` (usado
  pelo CORS — ver `backend/src/app.ts`).
- `frontend/.env`: `REACT_APP_BACKEND_URL=https://api.confiancatechnologies.com`
  (precisa rebuildar o frontend — `npm run build` — depois de qualquer mudança nessa
  variável, já que o Create React App "queima" esse valor dentro do bundle na hora do
  build, não lê em tempo de execução).
- `pm2` (backend + frontend) registrado como serviço systemd (`pm2-sandro.service`,
  via `pm2 startup` + `pm2 save`) — também sobe sozinho no boot.
- PostgreSQL e Redis já vêm habilitados por padrão numa instalação via `apt`
  (confirmado com `systemctl is-enabled postgresql`/`redis-server`).

### 12.4 Incidente durante a configuração (registros de DNS apagados por engano)

Ao criar os registros novos (`app`/`api`, depois trocado por `atendeflow`) direto pelo
painel do Cloudflare, os 3 registros do **outro serviço do cliente**
(`atendeflow`/`instagram-bot`/`www`, apontando pro túnel `instagram-agente`) foram
apagados por engano durante a tentativa de corrigir um erro de formulário (confusão
entre os campos de registro tipo `A`/IPv4 e `AAAA`/IPv6). Recuperados manualmente a
partir dos valores exatos de um export de zona DNS feito minutos antes do incidente —
sem esse export, a recuperação teria sido bem mais difícil (precisaria saber de cabeça
o ID exato do túnel do outro serviço).

**Lição**: antes de mexer em registros DNS de um domínio que já hospeda outros
serviços em produção, **sempre exportar a zona primeiro** (Cloudflare: DNS → Records →
Export) e guardar esse arquivo em lugar seguro — é a rede de segurança mais rápida de
usar se algo for apagado sem querer. Esse mesmo motivo é o que levou à decisão de
incluir a configuração do túnel no backup diário (seção 11.4) — depender só da
memória/histórico do chat pra recuperar uma configuração de produção não é
sustentável.

---

## 13. Bug corrigido: usuário deslogado ao clicar em Configurações (v2.3.29)

**Sintoma relatado pelo cliente**: ao clicar em "Configurações" no CRM, o usuário era
deslogado — sempre, de forma consistente.

### Causa raiz

O `backend/.env.example` sempre trouxe `COOKIE_DOMAIN=localhost` como valor padrão pro
cookie de refresh token (`jrt`, `httpOnly`, usado em `backend/src/helpers/
SendRefreshToken.ts`). Isso nunca deu problema em ambiente de desenvolvimento
(rodando literalmente em `localhost`) — mas assim que uma instância vai pra produção
num domínio de verdade e esse `.env` é copiado do exemplo sem essa linha específica
ser ajustada, o cookie passa a ser configurado com um **atributo `Domain` incompatível
com o host real da requisição**. Por especificação, o navegador **rejeita
silenciosamente o `Set-Cookie` inteiro** quando o `Domain` não é o próprio host nem um
sufixo dele — sem gerar nenhum erro visível no console. Resultado: o cookie `jrt`
nunca chega a ser salvo de verdade no navegador do cliente.

A "explosão" acontecia especificamente ao entrar em Configurações porque essa tela
dispara várias chamadas em sequência (dados da empresa, configurações antigas/novas,
e mais chamadas ainda se for Master) — a primeira vez que o token de acesso (curta
duração) precisa ser renovado durante o uso normal do sistema, o frontend chama
`POST /auth/refresh_token` (ver interceptor de resposta em
`frontend/src/hooks/useAuth.js/index.js`), o backend lê `req.cookies.jrt` — que não
existe, porque nunca foi salvo — e responde `ERR_SESSION_EXPIRED` (401). O frontend
interpreta isso como sessão inválida e desloga o usuário. Qualquer tela poderia
disparar isso na hora certa, mas Configurações, por fazer mais chamadas de uma vez,
tinha mais chance de "pegar" esse instante.

⚠️ **Por que isso passou despercebido em todos os testes anteriores desta sessão**:
o ambiente de desenvolvimento usado pra testar cada etapa deste projeto roda mesmo em
`localhost` — ou seja, o valor padrão problemático (`COOKIE_DOMAIN=localhost`) é
**válido** nesse contexto específico, então o bug nunca se manifestava em teste, só em
produção com um domínio real. Essa é uma lição geral: um valor padrão só correto por
coincidência do próprio ambiente de teste é um risco escondido — vale sempre perguntar
"esse default ainda faz sentido fora do `localhost`?" pra qualquer configuração nova.

### Correção

- `backend/.env.example`: removido o valor `localhost` — `COOKIE_DOMAIN` agora vem
  comentado/em branco por padrão (comportamento correto: cookie restrito ao próprio
  host do backend, que é o único que precisa lê-lo).
- `backend/src/helpers/SendRefreshToken.ts`: adicionada validação defensiva —
  `getRefreshTokenCookieOptions` agora recebe a `req` e verifica se o `COOKIE_DOMAIN`
  configurado é de fato um sufixo válido do host da requisição. Se não for, a
  configuração é **ignorada** (loga um aviso claro no servidor) em vez de gerar um
  cookie que o navegador vai rejeitar de qualquer forma. Isso protege contra a mesma
  classe de erro se `COOKIE_DOMAIN` for configurado errado de novo no futuro (ex.: uma
  instância migrando de domínio e esquecendo de atualizar essa variável).
- `RefreshTokenService.ts`/`SessionController.ts`: ajustados pra repassar o `req` até
  `SendRefreshToken`/`getRefreshTokenClearCookieOptions`, necessário pra validação
  acima funcionar.

**Ação necessária no servidor do cliente**: conferir o `backend/.env` de produção —
se a linha `COOKIE_DOMAIN=localhost` estiver lá, **apagar essa linha** (ou deixar em
branco) e reiniciar o backend (`pm2 restart atendeflow-backend`). A correção de
código sozinha já evita o cookie quebrado mesmo que a variável continue errada no
`.env` (ela passa a ser ignorada com um aviso no log), mas o ideal é limpar a
configuração na origem.

---

## 14. Cadastro obrigatório de cliente novo + encaminhamento automático pro Kanban (v2.3.30)

Pedido do cliente: cliente novo (ou que trocou de número) precisa ter o cadastro
completo preenchido pelo atendente, com a coluna do Kanban já escolhida, **antes**
de fechar o atendimento — ao fechar, o atendimento cai direto na coluna do Kanban
escolhida (via a mesma tag usada pelo Kanban, `Tag.kanban = 1`).

### Como um contato é considerado "novo" ou "já cadastrado"

**Não existe uma flag separada de "cliente novo"** — a regra é simplesmente: um
contato é considerado **incompleto** se algum dos campos obrigatórios abaixo ainda
não foi preenchido. Isso cobre os dois casos pedidos pelo cliente sem precisar de
lógica extra:
- **Cliente novo**: quando o WhatsApp cria um `Contact` automaticamente na primeira
  mensagem recebida, os campos novos (documento, endereço, contato 2) começam
  vazios — cai automaticamente na regra.
- **Cliente que trocou de número**: como `Contact.number` é único, um número novo
  sempre vira um `Contact` novo — mesmo que a pessoa já tivesse um cadastro
  completo no número antigo, o novo registro começa vazio e cai na mesma regra.

Depois que o cadastro é completado uma vez, o cliente nunca mais é interrompido —
os campos continuam preenchidos nas próximas vezes que ele entrar em contato.

### Campos obrigatórios (Contact)

Além dos já existentes (nome, e-mail, `number` = WhatsApp), foram adicionados 3
campos novos ao model `Contact` (migração
`20260916120000-add-mandatory-registration-fields-to-contacts.ts`):
- `document` (STRING) — CPF ou Identidade
- `address` (TEXT) — endereço completo (campo único de texto livre, não
  estruturado em rua/número/bairro/cidade/CEP separados — decisão deliberada pra
  manter simples)
- `contact2` (STRING) — um segundo telefone de contato

Helper `backend/src/services/ContactServices/IsContactFullyRegistered.ts` centraliza
a checagem (nome + e-mail + document + address + contact2, todos não-vazios).

### Onde a trava acontece

`backend/src/services/TicketServices/UpdateTicketService.ts` — logo depois de
carregar o ticket, antes de qualquer efeito colateral do fechamento: se a
transição for pra `status: "closed"` **e** for iniciada por um agente autenticado
pela tela de atendimento (`loggedInUserId` presente — só o `TicketController`
informa isso; bots, filas, webhooks e outros fluxos automáticos nunca passam esse
campo, então nunca ficam travados esperando um formulário que ninguém vai
preencher) **e** o contato do ticket estiver incompleto, lança
`AppError("ERR_CONTACT_REGISTRATION_REQUIRED", 400)`.

⚠️ **Bug pré-existente encontrado e corrigido nesta mesma etapa**: o `catch` no
final do `UpdateTicketService` capturava **qualquer** erro (inclusive `AppError`s
intencionais, como o de cima) e substituía por um genérico `ERR_UPDATE_TICKET`
(404) — escondendo a causa real do bloqueio. Corrigido adicionando
`if (err instanceof AppError) throw err;` antes do fallback genérico, preservando
a mensagem/status originais de qualquer erro intencional lançado dentro da função
(não só o novo, também um `ERR_UPDATE_TICKET_QUEUE_NOT_FOUND` pré-existente que
tinha o mesmo problema).

A escolha da tag do Kanban em si **não** é validada separadamente no backend — o
formulário do frontend (abaixo) já exige a escolha antes de deixar salvar, o que é
suficiente na prática e evita duplicar a mesma regra nos dois lados.

### Frontend

- `frontend/src/components/MandatoryContactRegistrationModal/index.js`: formulário
  com os campos obrigatórios + seletor de coluna do Kanban (busca as tags via
  `GET /tag/kanban/`, mesmo endpoint já usado pela página Kanban). Modal sem botão
  de cancelar e sem fechar no Esc/clique fora — é mandatório de verdade. Ao salvar:
  `PUT /contacts/:id` (dados do cadastro) → `DELETE /ticket-tags/:ticketId` (limpa
  tag de kanban anterior, se tinha) → `PUT /ticket-tags/:ticketId/:tagId` (aplica a
  nova) → chama `onSaved()`, que tenta fechar o atendimento de novo.
- `frontend/src/components/TicketActionButtonsCustom/index.js`: os dois pontos que
  fecham um atendimento (`handleUpdateTicketStatus` e
  `handleCloseTicketWithoutFarewellMsg`, este último usado quando o atendente
  fecha sem mandar mensagem de despedida) capturam especificamente o erro
  `ERR_CONTACT_REGISTRATION_REQUIRED` e abrem o modal acima em vez de só mostrar
  um toast de erro; guardam a própria função de fechamento numa ref
  (`pendingCloseRef`) pra rechamar automaticamente assim que o modal salvar.

### Testado

Fluxo completo validado (via chamadas diretas à API e depois via UI real com
Playwright): tentativa de fechar atendimento de contato incompleto → bloqueado
com `ERR_CONTACT_REGISTRATION_REQUIRED` → modal abre pré-preenchido (nome já traz
o que o WhatsApp mandou, ex. o próprio número) → preenche os campos + escolhe a
coluna do Kanban → salva → atendimento fecha automaticamente → ticket aparece com
a tag de kanban aplicada. Testado também que um **segundo** atendimento do
**mesmo** contato (já cadastrado) fecha direto, sem interromper o atendente de
novo. Dados de teste removidos do banco depois.

---

## 15. Seletor de idiomas com bandeiras (v2.3.31)

Pedido do cliente: reduzir o seletor de idiomas (ícone de globo na barra superior)
pra só 4 opções, cada uma com a bandeira do país ao lado — **Português (Brasil)**,
**Espanhol (Paraguai)**, **Espanhol (Espanha)** e **Inglês (Estados Unidos)**. O
Turco (`tr`), que existia antes, saiu da lista.

- `frontend/src/components/UserLanguageSelector/index.js`: cada `MenuItem` agora
  tem um emoji de bandeira (🇧🇷 🇵🇾 🇪🇸 🇺🇸) antes do nome do idioma. Emoji em vez de
  imagem — sem asset extra pra manter, funciona em qualquer tamanho de tela.
- **Espanhol (Paraguai) e Espanhol (Espanha) usam o mesmo texto traduzido por
  enquanto** — criado `frontend/src/translate/languages/esES.js` (código `es-ES`)
  como cópia de `es.js` (código `es`, que passou a representar especificamente o
  Paraguai). Não existe ainda um texto diferente pro espanhol da Espanha — se um
  dia for necessário (vocabulário/formalidade diferentes), é só editar
  `esES.js` isoladamente, sem afetar o `es.js` do Paraguai.
- `frontend/src/translate/languages/index.js`: passou a importar/mesclar
  `esES.js`; parou de importar `tr.js` no bundle ativo (o arquivo continua no
  repositório, só não é mais oferecido no seletor — reversível se for pedido de
  volta).
- Rótulos de cada idioma (`languages.*`, usados via `i18n.t`) atualizados nos 4
  arquivos de tradução ativos (`pt.js`, `en.js`, `es.js`, `esES.js`) pra
  desambiguar as duas variantes de espanhol: "Espanhol (Paraguai)"/"Espanhol
  (Espanha)" etc., cada um no próprio idioma do arquivo.

---

## 16. Cadastro obrigatório unificado no "Editar contato" + remoção do botão de fechamento redundante (v2.3.32)

Feedback do cliente depois de testar a v2.3.30 em produção: achou redundante ter
um popup novo e separado (`MandatoryContactRegistrationModal`) só pra preencher o
cadastro obrigatório, já que o app já tem uma tela de "Editar contato" pra isso.
Pediu pra unificar tudo ali, e também percebeu que existiam **dois botões
diferentes** pra fechar um atendimento — um redundante que não tinha a trava do
cadastro obrigatório.

### 1. Cadastro obrigatório passou a usar o "Editar contato" existente

- `frontend/src/components/ContactModal/index.js` (o modal de "Adicionar/Editar
  contato" já usado em Contatos, no drawer do ticket, etc.) ganhou os 3 campos
  novos (`document`, `address`, `contact2`) — agora sempre visíveis, pra qualquer
  contato, não só quando o cadastro é obrigatório.
- Dois novos props opcionais, só usados pelo fluxo de fechamento obrigatório:
  - `ticketId`: quando informado junto com `requireFullRegistration`, mostra um
    seletor extra de **Coluna do Kanban** (busca as tags via `GET /tag/kanban/`,
    igual antes) e, ao salvar, faz `DELETE /ticket-tags/:ticketId` + `PUT
    /ticket-tags/:ticketId/:tagId` pra aplicar a tag escolhida.
  - `requireFullRegistration`: exibe um aviso (`Alert` azul) explicando que o
    cadastro está incompleto, torna `email`/`document`/`address`/`contact2`
    obrigatórios no Yup (schema construído dinamicamente por
    `buildContactSchema(requireFullRegistration)`), e troca o texto do botão de
    salvar pra "Salvar e fechar atendimento".
  - Sem esses dois props (uso normal em Contatos, no drawer, etc.) o modal se
    comporta exatamente como antes — nenhum campo novo é obrigatório e o seletor
    de Kanban não aparece.
- `frontend/src/components/TicketActionButtonsCustom/index.js`: ao receber
  `ERR_CONTACT_REGISTRATION_REQUIRED`, agora abre o `ContactModal` (com
  `contactId`, `ticketId` e `requireFullRegistration`) em vez do modal dedicado
  antigo. A lógica de guardar a ação de fechamento pendente numa ref
  (`pendingCloseRef`) e rechamar automaticamente ao salvar continua igual.
- `frontend/src/components/MandatoryContactRegistrationModal/` foi **removido**
  do repositório (ficou sem nenhuma referência depois da troca acima).

### 2. Botão de fechamento redundante removido

`frontend/src/components/TicketOptionsMenu/index.js` tinha seu **próprio**
`handleCloseTicketWithoutFarewellMsg`, com um item de menu ("Fechar sem mensagem
de despedida") que chamava `PUT /tickets/:id` diretamente — sem nenhum
tratamento do erro `ERR_CONTACT_REGISTRATION_REQUIRED`. Fechar por esse caminho
simplesmente mostrava um toast de erro sem nunca dar ao atendente uma forma de
completar o cadastro, o que explica reclamações de "o mesmo erro sempre
aparece". Esse item de menu (e a função/estado que só ele usava) foi **removido**
— agora só existe **um** jeito de fechar um atendimento pela tela: o botão
"Resolver" em `TicketActionButtonsCustom`, que já tem a trava e o modal
corretos.

### Testado

Fluxo completo revalidado via Playwright na v2.3.32: contato incompleto + ticket
aberto → clique em "Resolver" → confirma → abre o modal **"Editar contato"**
(não mais um popup separado) já com o aviso de cadastro incompleto, os campos
`document`/`address`/`contact2` e o seletor "Coluna do Kanban" → preenche tudo →
"Salvar e fechar atendimento" → confirmado no banco: contato com os campos
salvos, ticket com `status: "closed"`, `TicketTags` com a tag do Kanban
aplicada. Dados de teste removidos do banco depois.

---

## 17. Corrigido: atendimento fechado com tag de Kanban sumia do board (v2.3.33)

Feedback do cliente logo depois da v2.3.32 no ar: o encaminhamento pro Kanban
(feature da v2.3.30) **parou de aparecer** — o atendimento fechava e a tag era
aplicada certinho (confirmado em teste), mas o board do Kanban não mostrava o
card. Causa raiz encontrada em
`backend/src/services/TicketServices/ListTicketsServiceKanban.ts`: a consulta
que alimenta a tela do Kanban (`GET /ticket/kanban`, usada por
`frontend/src/pages/Kanban/index.js`) sempre filtrava
`status: { [Op.or]: ["pending", "open"] }` **incondicionalmente** — ou seja, um
ticket fechado nunca aparecia no board, mesmo com uma tag de Kanban aplicada.
Isso não é um bug novo desta etapa — já existia desde antes da v2.3.30, só que
só ficou visível agora que passou a existir um fluxo que fecha o atendimento
**e** aplica a tag no mesmo passo.

**Por que isso importa pro cliente**: o Kanban aqui não é só uma fila de
atendimentos em aberto — é usado pra **segmentação/triagem de clientes**, por
exemplo pra disparar uma campanha de mensagens só pra quem está na coluna
"Inadimplentes". Pra isso funcionar, o card precisa continuar visível na coluna
mesmo depois que o atendimento que o colocou ali foi fechado.

### Correção

Em `ListTicketsServiceKanban.ts`, antes de montar a condição de status, busca-se
agora os ids de todos os tickets que já têm alguma tag de Kanban aplicada
(`TicketTag` com join em `Tag` filtrando `kanban: 1` e `companyId`), e o filtro
de status passa a ser: **pending/open OU o ticket estar nessa lista** —
em vez de só pending/open. Assim, um ticket fechado continua aparecendo na
lane da tag que foi atribuída a ele, e o board continua não mostrando
atendimentos fechados **sem** tag de Kanban (comportamento antigo preservado
pra quem não usa essa tag).

⚠️ Nota técnica: esse arquivo já tinha um padrão pré-existente de alguns blocos
(`dateStart`/`dateEnd`, `updatedAt`) que **substituem** `whereCondition` inteiro
em vez de mesclar — não foi mexido nesta correção porque a tela do Kanban do
frontend nunca envia esses dois parâmetros (envia `startDate`/`endDate`, nomes
diferentes), então esses blocos nunca disparam nesse fluxo. Fica registrado
como possível dívida técnica se um dia esses parâmetros passarem a ser usados
de verdade.

### Testado

Criado ticket fechado (`status: "closed"`) com uma tag de Kanban aplicada
diretamente no banco → chamada a `GET /ticket/kanban` autenticada → confirmado
que o ticket aparece na resposta com a tag correta. Dados de teste removidos
do banco depois.

---

## 18. Botão de fechar atendimento com rótulo dinâmico: "Cadastrar Contato" / "Resolver" (v2.3.34)

Pedido do cliente pra deixar mais claro o que o único botão de fechamento faz
em cada situação, já que ele mesmo serve pras duas coisas (fechar direto, ou
abrir o cadastro obrigatório primeiro): em vez de sempre mostrar "Resolver", o
botão agora mostra **"Cadastrar Contato"** enquanto o cliente do ticket ainda
não tem o cadastro completo (mesma regra de
`IsContactFullyRegistered` do backend — nome, e-mail, documento, endereço e
contato 2 preenchidos), e volta a mostrar **"Resolver"** assim que o cadastro
estiver completo. O clique continua fazendo exatamente a mesma coisa nos dois
casos — só o texto/tooltip muda, pra avisar o atendente do que vai acontecer
antes de clicar.

- `frontend/src/helpers/isContactFullyRegistered.js` (novo): mesma checagem do
  backend, em JS puro, sem chamada de API — usa os dados do contato que já
  vêm carregados junto com o ticket.
- `frontend/src/components/TicketActionButtonsCustom/index.js`: calcula
  `resolveButtonLabel` uma vez (`i18n.t("messagesList.header.buttons.resolve")`
  ou `i18n.t("messagesList.header.buttons.registerContact")`) e usa nos três
  lugares que hoje mostram esse texto (tooltip do ícone no desktop, item do
  menu mobile).
- Nova chave de tradução `messagesList.header.buttons.registerContact`
  ("Cadastrar Contato" / "Register Contact" / "Registrar Contacto") nos 4
  idiomas ativos.

⚠️ **Bug relacionado encontrado e corrigido nesta mesma etapa**: o serviço que
carrega os dados do ticket ao abrir a tela de atendimento
(`backend/src/services/TicketServices/ShowTicketFromUUIDService.ts`) não
incluía `document`/`address`/`contact2` nos atributos do `Contact` —
diferente do `ShowTicketService.ts` (usado em outro fluxo), que já tinha sido
corrigido na v2.3.30. Sem isso, o frontend nunca via esses campos pro ticket
atualmente aberto, então o rótulo dinâmico sempre calculava "incompleto"
mesmo pra contato já cadastrado. Corrigido adicionando os 3 campos na lista de
`attributes`.

### Testado

Ticket com contato incompleto → botão mostra "Cadastrar Contato" (confirmado
via atributo `title` do elemento). Depois de completar os 5 campos
obrigatórios do mesmo contato direto no banco e recarregar a página → botão
volta a mostrar "Resolver". Dados de teste removidos do banco depois.

---

## 19. Painel Vigia — monitoramento de SLA em tempo real (v2.3.35)

Pedido do cliente: um painel de supervisão pra ver, ao vivo, quais
atendimentos estão demorando demais — com dois limiares configuráveis
("risco de atraso" e "fora do prazo"), alerta automático no sino, indicação
de quem está online, e um jeito do supervisor mandar uma mensagem direta pro
atendente durante o atendimento (ex.: "confirme o CPF antes de fechar").
Usado tanto pra cobrar o atendimento em tempo real quanto pra métricas
gerais (gráfico da operação).

### Novo módulo: add-on por plano + por usuário

Mesmo padrão do Financeiro/RH (`docs/MANUAL_TECNICO.md`, seção 6.2):
`Plan.useSupervisorPanel` (o Master libera por plano) + `User.supervisorPanelAccess`
(o Admin da empresa libera usuário a usuário) + `EnsureSupervisorPanelAccess.ts`
(`backend/src/services/SupervisorPanelService/`). Admin e Master sempre têm
acesso quando o módulo está ativo no plano.

### Regras de SLA (`SlaRule`)

Nova tabela `SlaRules` (migração `20260917100200-create-sla-rules.ts`):
`name`, `riskMinutes` (padrão 15), `overdueMinutes` (padrão 20), `queueId`
opcional (regra específica de uma fila) ou `null` (regra padrão da empresa,
aplicada a filas sem regra própria). CRUD completo (criar/editar/excluir) em
`backend/src/services/SupervisorPanelService/SlaRuleService.ts` +
`SlaRuleController.ts`, rotas `/sla-rules`. Se a empresa não tiver nenhuma
regra cadastrada, cai no padrão hardcoded 15/20 minutos.

### Cálculo de atraso: baseado em `TicketTraking.startedAt`, não em `Ticket.createdAt`

`backend/src/services/SupervisorPanelService/SupervisorPanelService.ts`:
`listLiveTickets(companyId)` busca todos os tickets com `status: "open"`,
resolve a regra de SLA aplicável (da fila do ticket, senão a padrão da
empresa, senão 15/20 hardcoded) e calcula `elapsedMinutes` a partir do
`TicketTraking.startedAt` do atendimento atual (`finishedAt: null`) — é o
mesmo campo já usado pelo Dashboard pra `avgSupportTime`/`avgWaitTime`, não
um campo novo no `Ticket`. Classifica cada ticket em `onTime`/`risk`/`overdue`.
`getSummary(companyId)` agrega isso em totais (pra os cards) e por fila (pro
gráfico de barras).

### Verificação automática (cron) + alerta

`backend/src/services/SupervisorPanelService/SlaMonitorService.ts`
(`runSlaMonitor`) roda a cada minuto (`handleSupervisorSlaMonitor` em
`backend/src/queues.ts`, mesmo padrão `CronJob` do
`handleCloseTicketsAutomatic` — Bull `repeat` foi evitado de propósito nesse
arquivo por já ter travado silenciosamente antes, ver comentários no próprio
`queues.ts`). Pra cada ticket em risco/fora do prazo, cria **no máximo uma
vez por ticket/tipo desde o início do atendimento atual** (dedupe checando se
já existe uma `Notification` daquele tipo criada depois do `startedAt` atual
— importante pra um ticket reaberto poder alertar de novo) uma notificação
persistida (tabela `Notifications`, migração
`20260917100300-create-notifications.ts`) e emite em tempo real: pra sala
pessoal do atendente (`user-${userId}`) e pra sala `supervisors` (todo mundo
com acesso ao Painel Vigia).

### Salas de socket novas (`backend/src/libs/socket.ts`)

Ao conectar, todo socket autenticado (não-API-oficial) entra automaticamente
em `user-${userId}` (mensagens/alertas dirigidos a ele). Além disso, é feita
uma checagem (`EnsureSupervisorPanelAccess`) e, se autorizado, o socket
também entra em `supervisors` (alertas de SLA da empresa toda). Isso é só
pra roteamento de eventos em tempo real — a API REST sempre revalida o
acesso a cada chamada, então essa checagem no socket não é a única barreira.

### Mensagem ao vivo do supervisor pro atendente

`POST /supervisor-panel/message` (`SupervisorPanelController.sendMessage`,
exige `EnsureSupervisorPanelAccess`): persiste como `Notification` (tipo
`supervisor_message`) e emite `company-${companyId}-supervisorMessage` só
pra sala do atendente (`user-${userId}`). O frontend mostra isso como um
toast imediato (`SupervisorAlertsBell`) — não trava a tela do atendente, só
avisa.

### Frontend

- `frontend/src/pages/SupervisorPanel/index.js` (rota `/painel-vigia`, menu
  lateral "Painel Vigia"): duas abas.
  - **Ao vivo**: 4 cards (atendimentos ativos, risco de atraso, fora do
    prazo, tempo médio em aberto), dois gráficos ECharts (donut de
    distribuição por status + barras empilhadas por fila — mesma biblioteca
    já usada no Dashboard principal) e uma tabela com atendente (bolinha
    verde/cinza de online, reaproveitando `User.online`, o mesmo campo do
    Dashboard), cliente, fila, tempo decorrido, status e um botão pra mandar
    mensagem ao atendente daquele ticket. Atualiza via polling (15s) e via
    socket (`company-${companyId}-notification` força um refresh imediato
    quando um novo alerta chega).
  - **Regras de SLA**: reaproveita o componente genérico `FinanceRecordList`
    (já usado no módulo Financeiro) — CRUD completo (criar/editar/excluir)
    sem precisar de nenhum componente novo de tabela/modal.
- `frontend/src/hooks/useSupervisorPanel/index.js`: wrapper de API, mesmo
  padrão do `useFinance`.
- `frontend/src/components/SupervisorAlertsBell/index.js`: sino **separado**
  do sino normal de tickets (`NotificationsPopOver`) — decisão deliberada
  pra não mexer num componente já complexo (notificação do navegador, push,
  som, lista de tickets). Mostra os alertas de SLA e as mensagens do
  supervisor; qualquer usuário vê os próprios, quem tem acesso ao Painel
  Vigia vê todos da empresa; apagar (individual ou "apagar todas") é
  restrito a quem tem acesso ao módulo — o backend revalida isso de novo
  (`EnsureSupervisorPanelAccess`) mesmo que o frontend já esconda o botão.

### Bug corrigido durante o teste

`SlaRuleService.create/update` quebrava com `invalid input syntax for type
integer` ao salvar uma regra "padrão" (sem fila específica) — o seletor de
fila manda `queueId: ""` (string vazia) pro campo `select` sem opção
marcada, e a coluna é `INTEGER`. Corrigido normalizando `""`/`undefined`
pra `null` antes de gravar.

### Testado

Ticket aberto com `TicketTraking.startedAt` de 25+ minutos atrás → aparece
como "Fora do prazo" em `/supervisor-panel/live` e no card/gráfico da tela →
rodar o monitor manualmente cria a `Notification` (confirmado que rodar de
novo **não** duplica) → aparece no sino novo com o atendente/cliente certos
→ criar uma Regra de SLA pela tela (aba "Regras de SLA") → mandar uma
mensagem ao vivo pelo botão da tabela → toast de confirmação + `Notification`
tipo `supervisor_message` persistida e listada no sino. Dados de teste
removidos do banco depois.

---

## 20. Painel Vigia unificado dentro do "Painel" existente (v2.3.36)

Feedback do cliente logo depois da v2.3.35: o sistema já tinha uma tela
chamada só **"Painel"** (menu lateral, rota `/moments`, componente
`frontend/src/components/MomentsUser/index.js`) — bem mais antiga, mostra os
atendimentos agrupados por atendente com um aviso de SLA próprio (baseado em
"minutos sem resposta do atendente", limiares fixos 15/40 min, chip
"Dentro do prazo/Risco de atraso/Fora do prazo" por ticket). O cliente testou
essa tela achando que era a nova, não viu os gráficos nem o botão de mandar
mensagem (que só existiam na tela nova e separada "Painel Vigia",
`/painel-vigia`) e pediu pra **unificar tudo num lugar só**.

### O que mudou

- **Removida** a tela separada "Painel Vigia" (`frontend/src/pages/SupervisorPanel/`,
  rota `/painel-vigia`, item de menu "Painel Vigia") — nada no backend foi
  removido, só a página/rota/menu duplicados no frontend.
- Os mesmos pedaços de UI que estavam lá foram **extraídos em componentes
  reutilizáveis** e embutidos dentro do "Painel" (`MomentsUser`) já existente:
  - `frontend/src/components/SupervisorOverviewPanel/index.js`: os 4 cards
    de KPI + os dois gráficos ECharts (donut de status + barras por fila).
    Renderizado logo abaixo da barra de ferramentas do Painel, acima das
    colunas por atendente — só aparece pra quem tem acesso ao módulo
    (`canSupervise`).
  - `frontend/src/components/SupervisorSlaRulesPanel/index.js`: o CRUD de
    Regras de SLA (reaproveitando `FinanceRecordList`), agora aberto num
    `Dialog` a partir de um ícone de engrenagem na barra de ferramentas do
    Painel (em vez de uma aba separada).
  - `frontend/src/components/SupervisorMessageDialog/index.js`: o diálogo de
    mandar mensagem ao vivo pro atendente.
- `frontend/src/components/MomentsUser/index.js`: ganhou um botão novo
  (ícone de enviar) ao lado do já existente botão "olho" (que já era o
  "modo espião" — abre o ticket pra acompanhar a conversa ao vivo, o Admin
  sempre pôde abrir qualquer ticket sem precisar responder nada). O botão
  novo abre o `SupervisorMessageDialog` e manda a mensagem via
  `POST /supervisor-panel/message` — mesmo endpoint da v2.3.35, sem mudança
  nenhuma no backend. Both botões (olho + enviar) só aparecem quando
  `canSupervise` é verdadeiro (mesma checagem `EnsureSupervisorPanelAccess`,
  agora feita direto dentro do `MomentsUser` via `useSupervisorPanel().getAccess()`).

### Nota sobre duas contagens de SLA coexistindo

O "Painel" já tinha sua própria lógica de atraso, baseada em **tempo desde a
última mensagem do atendente** (chip por ticket, limiares fixos 15/40 min) —
essa lógica **não foi alterada**, continua funcionando exatamente como
antes. Os novos cards/gráficos usam uma métrica **diferente**: tempo desde
que o atendimento foi **aceito** (`TicketTraking.startedAt`), com limiares
configuráveis via Regras de SLA (padrão 15/20 min) — por isso os rótulos dos
cards novos têm o sufixo "(SLA)" pra deixar claro que é uma métrica separada
da dos chips por ticket. Ficam as duas coexistindo por enquanto; unificar as
duas métricas em uma só fica como possível melhoria futura, se o cliente
pedir.

### Testado

Reaberto o mesmo cenário de teste (ticket com 25+ min de
`TicketTraking.startedAt`) dentro do `/moments`: cards e gráficos aparecem
corretos junto com as colunas por atendente já existentes; botão de mandar
mensagem no ticket abre o diálogo, envia e confirma com toast; ícone de
engrenagem abre o CRUD de Regras de SLA num diálogo, sem sair da tela.
Dados de teste removidos do banco depois.

---

## 21. Painel Vigia passa a monitorar "aguardando", não só "atendendo" (v2.3.37)

Feedback do cliente: criou uma Regra de SLA e não viu nada mudar no painel.
Causa raiz: `SupervisorPanelService.listLiveTickets` só buscava tickets com
`status: "open"` (já aceitos por um atendente) — um cliente parado
**"aguardando"** (`status: "pending"`, ainda na fila, sem atendente
atribuído) nunca entrava na conta, nos gráficos, nem disparava alerta no
sino. Pra quem está do lado do supervisor, um cliente esperando sem ninguém
responder é tão ou mais urgente quanto um atendimento já em andamento.

### Correção

`backend/src/services/SupervisorPanelService/SupervisorPanelService.ts`:
o filtro de status virou `{ [Op.or]: ["open", "pending"] }`. Um ticket
"aguardando" costuma não ter `userId` nem uma `TicketTraking` com
`startedAt` preenchido ainda (só é criada/atualizada quando alguém aceita) —
o código já tinha o fallback `traking?.startedAt || ticket.createdAt`, então
o tempo decorrido de um ticket aguardando é calculado a partir de quando ele
**entrou** no sistema, que é a métrica certa pra esse caso. Adicionado um
campo novo `ticketStatus` ("pending"/"open") em cada linha, e o texto da
notificação (`SlaMonitorService.ts`) agora diz explicitamente "aguardando"
ou "em atendimento" pra ficar claro qual dos dois casos disparou o alerta —
inclui "(sem atendente ainda)" quando for um ticket aguardando, já que nesse
caso o alerta só vai pra sala `supervisors` (não tem atendente pra avisar
individualmente).

### Testado

Criado ticket com `status: "pending"`, sem `userId`, criado há 30 minutos →
`GET /supervisor-panel/live` retorna o ticket com `ticketStatus: "pending"`
e `status: "overdue"` → `runSlaMonitor` cria a notificação com o texto
"...30 min aguardando (sem atendente ainda)." Dados de teste removidos do
banco depois.

---

## 22. Alerta "fora do prazo" repetitivo/geral + transferir atendimento pelo Painel (v2.3.38)

Pedido do cliente: (1) quando um atendimento vira "fora do prazo", o alerta
não pode disparar só uma vez — tem que repetir a cada 5 minutos enquanto
continuar fora do prazo, e avisar **todos os atendentes conectados**, não só
o responsável pelo ticket; (2) quem tem acesso ao Painel Vigia precisa
conseguir **transferir** o atendimento pra outro atendente direto dali, além
de já poder mandar mensagem.

### Alerta repetitivo e geral (`SlaMonitorService.ts`)

- "Risco de atraso" continua como antes: dispara **uma vez** por atendimento
  (dedupe desde `startedAt`), avisando só o atendente responsável + a sala
  `supervisors`.
- "Fora do prazo" agora **repete a cada 5 minutos** (constante
  `OVERDUE_REPEAT_MINUTES`) enquanto o atendimento continuar fora do prazo —
  o dedupe passou a checar só os últimos 5 minutos, não desde o início do
  atendimento. E em vez de avisar só o responsável + supervisores, emite
  `company-${companyId}-notification` pro **namespace inteiro da empresa**
  (`io.of(String(companyId)).emit(...)`, sem `.to(sala)`) — todo mundo com o
  sistema aberto (atendente ou não) recebe, exatamente como pedido
  ("todos os atendentes online").

### Transferir atendimento direto do Painel

`frontend/src/components/MomentsUser/index.js` ganhou um terceiro botão por
ticket (ícone de troca, ao lado do olho e do enviar mensagem), visível só
pra quem tem `canSupervise`. Em vez de construir um formulário novo,
reaproveita o `TransferTicketModalCustom` já existente (o mesmo usado na
tela normal de atendimento) — mesma busca de atendente, escolha de fila e
mensagem interna, sem duplicar lógica. Nenhuma rota nova no backend; é o
mesmo `PUT /tickets/:id` de sempre.

### Testado

Ticket de 25 min (fora do prazo) → `runSlaMonitor` roda e cria o alerta →
rodando de novo imediatamente **não** duplica (dentro dos 5 min) → depois de
simular 6 minutos passados (`UPDATE ... SET "createdAt" = now() - interval
'6 minutes'` no registro de teste), rodar de novo **cria um segundo alerta**
— confirma a repetição a cada 5 min. Botão de transferir testado na tela:
abre o `TransferTicketModalCustom` normalmente, com o ticket certo. Dados de
teste removidos do banco depois.

---

## 23. Painel Vigia lê "fora do expediente" do módulo Horário de Atendimento (v2.3.39)

O cliente criou uma "Regra de SLA" chamada "Atendimento fora do expediente
ADM" tentando descrever um horário semanal (seg-sex 18h-21h, sábado
12h-17h, domingo 8h-17h, feriados 8h-17h) — mas o formulário de Regras de
SLA só tem `riskMinutes`/`overdueMinutes` por fila, não serve pra isso.
Esclarecido que "fora do expediente" não é uma configuração nova: o sistema
já tem um módulo completo pra isso — **Horário de Atendimento**
(`/attendance-schedule`, `Company`/`Queue`/`Whatsapp.schedules` +
`CompaniesSettings.scheduleType`), com horários por dia da semana, dois
turnos por dia, feriados com data específica, e escopo por empresa/fila/
conexão — exatamente o que cada empresa-cliente já configura com seus
próprios horários. O Painel Vigia passou a **ler direto desse módulo**, sem
nenhuma configuração duplicada.

### Implementação

`backend/src/services/SupervisorPanelService/SupervisorPanelService.ts`:
nova função `buildOutOfHoursChecker(companyId)` — lê
`CompaniesSettings.scheduleType` uma vez (`"company"`, `"queue"`,
`"connection"` ou `"disabled"`) e devolve uma função que, pra cada ticket,
chama o mesmo `VerifyCurrentSchedule` já usado pra decidir a mensagem
automática de fora de expediente (`backend/src/services/CompanyService/VerifyCurrentSchedule.ts`)
— com cache por fila/conexão dentro da mesma chamada, pra não repetir a
consulta pra tickets da mesma fila. Se `scheduleType` for `"disabled"` (ou
não configurado), `outOfHours` fica sempre `false` — o recurso só liga
quando a empresa já usa o módulo de horário. Cada linha de
`listLiveTickets` ganhou o campo `outOfHours: boolean`, e `getSummary`
ganhou `totalOutOfHours`.

`frontend/src/components/SupervisorOverviewPanel/index.js`: novo card
"Fora do expediente" ao lado dos outros KPIs.

### Testado

Configurado `scheduleType: "company"` com `Company.schedules: []` (nenhum
horário cadastrado pro dia da semana atual) → ticket de teste veio com
`outOfHours: true` e `totalOutOfHours: 1`. Depois, configurado um horário
cobrindo o dia inteiro de hoje → o mesmo ticket passou pra
`outOfHours: false` imediatamente, sem reiniciar nada — confirma que lê o
horário certo em tempo real. Configuração da empresa restaurada
(`scheduleType: "disabled"`) e dados de teste removidos depois.

---

## 24. Backup do código-fonte completo (v2.3.40)

Pedido do cliente: além do dump do banco, dos arquivos enviados e da
configuração crítica do servidor (já cobertos desde a v2.3.28), o
`backup-para-drive.sh` passou a enviar também **todo o código-fonte** do
projeto pro mesmo Google Drive combinado com o cliente — um backup
independente do GitHub, útil se um dia faltar acesso à conta/repositório.

### Implementação

Um quarto artefato foi adicionado ao script, gerado com `tar` a partir da
raiz do projeto (`backend/`, `frontend/`, `api_oficial/`, `docs/`),
excluindo:

- `node_modules`, `dist`, `build` — tudo gerado, reconstruído a partir do
  código-fonte com `npm install && npm run build`;
- `.git` — histórico do GitHub, não faz sentido duplicar aqui;
- `./backend/public` — dados de cliente (mídia do WhatsApp, currículos do
  RH, fotos de perfil) já cobertos pelo backup de "uploads" existente;
- `*.env`, `*.env.local`, `*.log` — segredos (senhas, tokens) já vão no
  backup de configuração existente; não precisa duplicar aqui.

O arquivo resultante (`atendeflow_codigo_fonte_<timestamp>.tar.gz`) é
enviado com `rclone copy ... "${RCLONE_REMOTE}:codigo-fonte/"` — uma
subpasta própria dentro da mesma pasta do Drive, pra não misturar com os
dumps de banco/uploads/config que já ficam soltos na raiz da pasta.

### Testado

`tar -czf` rodado numa cópia de teste do projeto (sandbox) gerou um
arquivo de ~12MB (a árvore original passa de alguns GB por causa dos
`node_modules` de `backend/`, `frontend/` e `api_oficial/`, todos
excluídos). Conferido com `tar -tzf ... | grep -E
"node_modules|/dist/|/build/|\.git/|backend/public/|\.env$"` — nenhum
resultado, confirmando que as exclusões funcionaram. `bash -n
backup-para-drive.sh` validado sem erros de sintaxe. Execução real (com
envio pro Drive) só é possível no servidor do cliente, que tem as
credenciais do rclone configuradas — não reproduzível neste ambiente de
desenvolvimento.

---

## 25. Cartão "Fora do expediente" ao lado de "Fora do prazo" + backup automático a cada atualização (v2.3.41)

Dois ajustes pedidos pelo cliente, sem relação direta entre si:

### Reordenação do card "Fora do expediente"

No Painel, os cartões de totais seguiam a ordem: Atendimentos ativos,
Risco de atraso, Fora do prazo, Tempo médio em aberto, Fora do
expediente (esse último tinha sido adicionado no fim, na v2.3.39). O
cliente pediu pra esse card ficar **ao lado do "Fora do prazo"**, seguindo
o mesmo padrão visual dos demais (o card já usava o mesmo `Paper`/estilo
dos outros — só a posição mudou).
`frontend/src/components/SupervisorOverviewPanel/index.js`: nova ordem —
Atendimentos ativos, Risco de atraso, Fora do prazo, **Fora do
expediente**, Tempo médio em aberto.

### Backup automático a cada atualização de código

O cliente pediu que, toda vez que o código-fonte for alterado (ou seja, a
cada atualização feita no servidor), o backup pro Google Drive rode
automaticamente — sem depender de lembrar de rodar o
`backup-para-drive.sh` manualmente depois. Como o `instalador.sh` já é o
script que o cliente roda no servidor pra puxar/instalar cada atualização
(`npm install`, `npm run build`, `pm2 restart all`), ele passou a chamar o
`backup-para-drive.sh` automaticamente no final, se o script existir na
raiz do projeto — cobrindo tanto o backup de código (seção 24) quanto os
já existentes (banco, uploads, config), tudo numa passada só, sem passo
manual extra.

### Independência do sistema em relação ao Claude

O cliente perguntou se o AtendeFlow depende de alguma conexão com o
Claude pra funcionar. Resposta: **não** — o Claude (este assistente) é
usado só durante o **desenvolvimento**, nesta sessão de trabalho no
código-fonte; o sistema em produção (backend Node/Express, frontend
React, WhatsApp via Baileys) não faz nenhuma chamada de API pra Claude/
Anthropic em tempo de execução — conferido buscando por "claude"/
"anthropic" em todo `backend/src` e `frontend/src`, sem nenhum resultado.
O AtendeFlow roda de forma independente no servidor do cliente (Node +
Postgres + Redis + pm2), e o Claude só volta a ser acionado quando o
cliente pedir uma nova atualização.

### Testado

Revisão manual do novo trecho do `instalador.sh` (`bash -n` validado) —
chamada ao backup só acontece se `backup-para-drive.sh` existir, então não
quebra em cópias antigas do projeto sem o script. Reordenação do card
testada visualmente no sandbox (Playwright): os cinco cards aparecem na
nova ordem, com os mesmos estilos/cores de antes.

---

## 26. Painel Vigia ganha card e gráfico ao vivo por Regra de SLA (v2.3.42)

O cliente insistiu num ponto que ficou incompleto na seção 25: reposicionar
o card "Fora do expediente" ao lado do "Fora do prazo" resolvia só a
posição de **um** card fixo — mas o pedido de fundo era outro: **cada
Regra de SLA cadastrada** (seção 20, CRUD acessível pelo ícone de
engrenagem no Painel) precisa ganhar o **próprio painel visual ao vivo**
assim que é criada, não só entrar como mais uma linha invisível no cálculo
agregado. Antes desta etapa, os cards "Risco de atraso"/"Fora do prazo" e
o gráfico "Por fila" mostravam só o total geral — não dava pra saber,
olhando o Painel, se um atraso específico vinha da regra "Atendimento fora
do expediente ADM", de uma regra por fila, ou da regra padrão do sistema.
Isso que o cliente descreveu como "ir no local mais rápido" pra decisão —
sem granularidade por regra, o supervisor via só o número total e tinha
que investigar caso a caso.

### Por que não existia isso desde o início

As Regras de SLA (`SlaRule`) sempre alimentaram o cálculo de
risco/atraso (`resolveSlaRule`), mas o resultado usado por
`listLiveTickets` descartava a identidade da regra — só guardava os
minutos (`riskMinutes`/`overdueMinutes`) resolvidos pra cada ticket. Não
havia como agrupar depois "quantos tickets estão em atraso pela regra X",
porque o dado de qual regra tinha sido usada já tinha sido jogado fora.
Faltava então: (1) manter o `ruleId`/`ruleName` em cada ticket calculado,
e (2) agregar por regra no resumo (`getSummary`), do mesmo jeito que já
era feito por fila (`byQueue`).

### Implementação

`backend/src/services/SupervisorPanelService/SupervisorPanelService.ts`:

- `resolveSlaRule` agora devolve também `ruleId`/`ruleName` (usa um
  sentinela `ruleId: 0`, nome "Padrão do sistema (15/20 min)", pros
  tickets que não caem em nenhuma regra cadastrada — nem específica da
  fila, nem padrão da empresa).
- `LiveTicketRow` ganhou os campos `ruleId`/`ruleName`.
- `getSummary` passou a buscar todas as `SlaRule` da empresa (com a fila
  associada) e monta `byRule`: um registro por regra com
  `ruleName`/`queueName`/`riskMinutes`/`overdueMinutes` e as contagens
  `total`/`onTime`/`risk`/`overdue` — **inicializado a partir das regras
  cadastradas**, não só dos tickets em andamento, então uma regra nova
  aparece com zero atendimentos assim que é criada (confirmando
  visualmente que já está sendo monitorada, sem esperar um atendimento
  entrar em risco).

`frontend/src/components/SupervisorOverviewPanel/index.js`:

- Nova seção "Regras de SLA (ao vivo, por regra)" logo abaixo da fileira
  de cards principais (a mesma fileira que tem o "Fora do prazo") — um
  card por regra cadastrada, com nome da regra, fila (ou "Padrão (todas as
  filas)"), e três contadores (no prazo/risco/atraso). O card ganha borda
  vermelha se tiver algum atendimento em atraso por aquela regra, ou
  amarela se só tiver risco — pra chamar atenção visualmente sem precisar
  ler os números.
- Novo gráfico de barras empilhadas "Por regra de SLA" (mesmo padrão dos
  gráficos "Distribuição por status" e "Por fila" que já existiam),
  mostrando a mesma quebra por regra de forma gráfica — pedido explícito
  do cliente ("criar o gráfico visual para monitoramento"), complementando
  os cards com números.
- Tudo atualiza no mesmo ciclo que já existia (poll de 15s + refresh
  imediato ao receber `company-${companyId}-notification` por socket) —
  nenhum novo mecanismo de tempo real precisou ser criado.

### Limitação conhecida (não implementada nesta etapa)

Clicar num card de regra **não** leva direto ao atendimento específico
("ir no local") — o Painel (`MomentsUser`) organiza os atendimentos por
**atendente**, não por fila/regra, então não existe hoje uma âncora visual
por fila pra rolar a tela até lá. Implementar isso exigiria reorganizar a
lista de atendimentos por fila (ou adicionar um filtro), o que é uma
mudança maior na tela — não foi pedido explicitamente ainda e fica como
possível próximo passo caso o cliente confirme que quer.

### Testado

Sandbox: criada uma `SlaRule` de teste vinculada a uma fila específica →
card da regra apareceu imediatamente com 0/0/0 (fila sem atendimento
ainda). Criado um ticket de teste nessa fila com `TicketTraking.startedAt`
21 minutos atrás → card da regra passou a mostrar 1 em "atraso" e ganhou
borda vermelha; gráfico "Por regra de SLA" mostrou a mesma barra. Ticket e
regra de teste removidos do banco depois.

---

## 27. SLA não zera mais ao sair de "aguardando" para "atendendo" (v2.3.43)

Bug relatado pelo cliente: quando um atendimento saía de "aguardando"
(pending, na fila, sem atendente) e um atendente aceitava (virava "open"),
a contagem do SLA no Painel Vigia **zerava** — o atendimento que já estava
há 18 minutos esperando voltava a mostrar poucos minutos assim que era
aceito, escondendo o tempo real de espera do cliente.

### Causa

`listLiveTickets` calculava o início da contagem com
`traking?.startedAt || ticket.createdAt`. Só que
`TicketTraking.startedAt` **não é** o horário em que o atendimento chegou
— é o horário em que um atendente **aceitou/foi atribuído** ao ticket, e é
reescrito pra "agora" em mais de um lugar do `UpdateTicketService.ts`
(inclusive numa transferência). Ou seja, o campo usado como "início" era,
na prática, o horário da última mudança de responsável, não o horário de
chegada do cliente — daí o "zerar" ao mudar de fase.

### Correção

`backend/src/services/SupervisorPanelService/SupervisorPanelService.ts`:
trocado `traking?.startedAt` por `traking?.createdAt` — o `createdAt` da
linha de `TicketTraking` é gravado **uma única vez**, quando a linha é
criada (`FindOrCreateATicketTrakingService`, chamado assim que a primeira
mensagem cria/reabre o atendimento) e nunca é reescrito depois — nem ao
aceitar, nem ao transferir dentro do mesmo ticket. Com isso a contagem de
minutos no Painel (cards, gráficos, alertas do sino) passa a refletir o
tempo total desde que o cliente entrou na fila, contínuo através de
"aguardando" → "atendendo", exatamente como pedido.

Único caso em que a contagem reinicia de propósito: quando a transferência
fecha o ticket antigo e cria um **ticket novo** (`closeTicketOnTransfer`
ligado) — aí é mesmo um atendimento novo, com seu próprio
`TicketTraking`, e reiniciar faz sentido.

### Testado

Ticket de teste criado como "pending" (na fila) com o `TicketTraking`
criado há 18 minutos → Painel mostrou 18 min, status "risco de atraso".
Ticket então aceito por um atendente (`status: "open"`, o que reescreve
`startedAt` pra "agora" como sempre fez) → Painel continuou mostrando ~18
min (não zerou), confirmando que a contagem agora usa `createdAt` da
tracking e ignora a reescrita de `startedAt`. Dados de teste removidos do
banco depois.

---

## 28. Clicar no card de uma Regra de SLA vai direto ao atendimento (v2.3.44)

Completa o pedido da seção 26: o cliente queria não só ver o card/gráfico
por regra, mas também **clicar** nele e ir direto pro atendimento mais
urgente daquela regra ("indo no local mais rápido e uma posterior tomada
de decisão").

### Por que não dava pra simplesmente rolar a tela

O Painel (`MomentsUser`) organiza os atendimentos em colunas **por
atendente** (mais a coluna de "Pendentes"), não por fila/regra — não
existia nenhuma âncora ligando um atendimento renderizado na tela à regra
de SLA que se aplica a ele. Era preciso: (1) uma forma de saber qual
atendimento, entre os que existem agora, é o mais urgente pra uma regra
específica, e (2) uma forma de "achar" esse atendimento no DOM já
renderizado, onde quer que ele esteja (dentro da coluna do atendente dele,
ou nos "Pendentes").

### Implementação

`frontend/src/components/SupervisorOverviewPanel/index.js`: os cards de
regra (seção 26) ganharam `onClick`, chamando uma função `onSelectRule`
passada pelo componente pai com a regra clicada.

`frontend/src/components/MomentsUser/index.js`:

- Nova função `handleSelectRule(rule)`: em vez de tentar reproduzir a
  lógica de precedência de regras (fila específica > padrão da empresa >
  padrão do sistema) aqui no front, ela busca a lista `/supervisor-panel/live`
  (que já vem com o `ruleId` resolvido por ticket, seção 26) e pega o
  **primeiro** atendimento com aquele `ruleId` — como a lista já vem
  ordenada por minutos decrescentes (mais urgente primeiro), isso já é o
  atendimento mais crítico daquela regra.
- Cada linha de atendimento (`renderTicket`) ganhou um `id` de DOM
  (`ticket-row-<id do ticket>`), único em toda a tela (independente da
  coluna). Ao clicar num card de regra, `handleSelectRule` acha o elemento
  por esse id com `document.getElementById` e chama
  `scrollIntoView({ behavior: "smooth", block: "center" })`, além de
  aplicar um destaque visual temporário (borda + sombra roxa, 4 segundos)
  pra chamar atenção do supervisor sobre qual atendimento é aquele.
- Casos sem atendimento pra mostrar: se a regra não tem nenhum atendimento
  ativo no momento, ou se o atendimento existe mas por algum motivo não
  está renderizado na tela (dessincronia momentânea entre o
  `/usersMoments` que alimenta o Painel e o `/supervisor-panel/live`),
  mostra um toast informativo em vez de falhar silenciosamente.

### Testado

Sandbox: criado ticket de teste em risco de atraso numa fila com regra
específica → clique no card da regra rolou a tela até a linha certa
(dentro da coluna do atendente correspondente) e aplicou o destaque roxo
por ~4 segundos. Clique numa regra sem nenhum atendimento ativo → toast
"Nenhum atendimento ativo no momento para a regra...". Dados de teste
removidos do banco depois.

---

## 29. "Atendimento fora do expediente ADM" vira card automático no Painel (v2.3.45)

O cliente reportou que a SLA "Atendimento fora do expediente ADM" que ele
cadastrou manualmente (seção 23 — na época já explicado que Regras de SLA
não servem pra representar horário semanal) não aparecia como card na
faixa "Regras de SLA" nova (seção 26), e pediu pra esse card aparecer
**automaticamente**, com relação direta ao módulo Horário de Atendimento.

### Por que não aparecia (e por que não devia)

A faixa "Regras de SLA" (seção 26) só lista `SlaRule` cadastradas — e
"fora do expediente" nunca foi uma `SlaRule` de verdade, é calculado à
parte, direto do módulo Horário de Atendimento (`buildOutOfHoursChecker`,
seção 23). Cadastrar uma `SlaRule` chamada "Atendimento fora do
expediente ADM" não fazia esse card aparecer porque os dois sistemas
sempre foram independentes — e não tem como serem unificados numa
`SlaRule` de verdade, porque o cálculo de "fora do expediente" é uma
condição de horário (dia da semana, feriado, turno), não um limite de
minutos de espera.

### Implementação

`frontend/src/components/SupervisorOverviewPanel/index.js`: a faixa
"Regras de SLA" ganhou um **primeiro card fixo, automático**, chamado
"Atendimento fora do expediente ADM" — não vem da tabela `SlaRule`, é
alimentado direto por `summary.totalOutOfHours` (o mesmo número que já
existia isolado no card "Fora do expediente" da fileira principal de KPIs
— esse card antigo foi removido daquela fileira pra não duplicar o mesmo
número em dois lugares). Clicável, igual aos cards de regra: usa o mesmo
`/supervisor-panel/live` (campo `outOfHours` por ticket, já existente
desde a seção 23) pra achar o atendimento fora do expediente mais urgente
e rolar/destacar a tela até ele (`handleSelectOutOfHours`, mesmo mecanismo
de `handleSelectRule` da seção 28, só que filtrando por `outOfHours` em
vez de `ruleId`).

### Atenção: SlaRule manual antiga fica redundante

A `SlaRule` "Atendimento fora do expediente ADM" que o cliente cadastrou
manualmente **continua existindo no banco** (não foi apagada por este
código — a Claude não tem acesso ao banco de produção do cliente, só ao
código-fonte) e vai continuar aparecendo como card separado na mesma
faixa, com números de onTime/risco/atraso que não têm relação nenhuma com
horário de expediente de verdade (porque `riskMinutes`/`overdueMinutes`
dela são só números, não horários). Recomendado: o cliente apagar essa
regra manual pelo ícone de engrenagem do Painel, pra não ficar com dois
cards de nome parecido — um automático (correto) e um manual (sem
função).

### Testado

Sandbox: com `CompaniesSettings.scheduleType: "company"` e nenhum horário
cadastrado pro dia atual, ticket de teste veio `outOfHours: true` → novo
card automático mostrou 1, com borda roxa. Clique no card rolou a tela até
o ticket certo. Configurado um horário cobrindo o dia inteiro → contador
voltou a 0 no próximo refresh (15s), sem precisar recarregar a página.
Configuração e dados de teste revertidos depois.

---

## 30. Corrige build quebrado do frontend (import inválido no FlowBuilder) (v2.3.46)

Ao rodar `./instalador.sh` na v2.3.45, o `npm run build` do frontend
falhou com `Failed to compile. Attempted import error: 'onElementsRemove'
is not exported from 'react-flow-renderer'`, interrompendo a atualização
antes do `pm2 restart all` — bug real, sem relação com as mudanças do
Painel Vigia dessa sessão.

### Causa

`frontend/src/pages/FlowBuilderConfig/index.js` importava
`onElementsRemove` de `"react-flow-renderer"` junto com outros itens
(`Controls`, `useNodesState`, `addEdge` etc.), mas esse nome **nunca foi
um export de verdade** da biblioteca instalada (confirmado: a versão
exata `10.3.17`, a mesma travada em `package.json`, não tem esse export —
`onElementsRemove` é o nome de uma *prop* que se passa pro componente
`<ReactFlow>`, não uma função exportada pelo pacote). O import nunca era
usado em nenhum outro lugar do arquivo (confirmado por busca no arquivo
inteiro) — código morto que, por algum motivo do cache/resolução do `npm
install` em builds anteriores, não travava o build, mas passou a travar
depois do `rm -rf node_modules package-lock.json` do `instalador.sh`.

### Correção

Removida a linha `onElementsRemove,` do import — sem nenhum outro efeito,
já que não era referenciada em lugar nenhum do arquivo.

### Testado

Build de produção rodado neste ambiente de desenvolvimento
(`npx craco build`) com o `node_modules` já instalado (mesma versão
`10.3.17` do `react-flow-renderer` que causou o erro no servidor do
cliente) → `Compiled successfully.`, confirmando que a remoção do import
resolve o problema sem quebrar o FlowBuilder (nenhuma outra função do
arquivo dependia dele).

---

## 31. Sino do Painel Vigia para de mostrar alerta de atendimento já fechado (v2.3.47)

Bug relatado pelo cliente: depois que um atendimento era **fechado**, o
alerta dele (risco de atraso / fora do prazo) continuava aparecendo no
sino do Painel Vigia — poluindo a lista com avisos de atendimentos que já
tinham terminado. O pedido foi claro: o sino só precisa mostrar (1)
clientes que ainda estão esperando pra ser atendidos (aguardando ou
atendendo) e (2) avisos que não são de um atendimento específico
(mensagens gerais/atualizações do sistema).

### Causa

`SlaMonitorService.runSlaMonitor` já só cria **novos** alertas pra
atendimentos "aguardando"/"atendendo" (`listLiveTickets` nunca inclui
tickets fechados) — isso sempre esteve certo. O problema era outro: um
alerta criado **antes** do atendimento ser fechado continuava gravado na
tabela `Notifications`, e `NotificationService.list` (usada pelo sino)
devolvia todo o histórico da empresa sem checar se o ticket relacionado
ainda estava em aberto — então o alerta antigo simplesmente nunca saía da
lista, mesmo depois do atendimento encerrado.

### Correção

`backend/src/services/SupervisorPanelService/NotificationService.ts`:
`list` passou a excluir notificações cujo ticket relacionado já está
`closed`, mantendo só: notificações de tickets ainda "aguardando"/
"atendendo", e notificações sem ticket nenhum (`ticketId: null` —
reservado pra um futuro aviso geral do sistema, sem atendimento
associado). A notificação **não é apagada do banco** (continua existindo
pra histórico/auditoria) — só para de aparecer no sino a partir do
momento em que o atendimento é fechado.

Tecnicamente, o include de `Ticket` virou `required: false` (LEFT JOIN,
pra não excluir sem querer as notificações sem ticket) e o filtro usa a
referência `"$ticket.status$"` do Sequelize pra comparar a coluna do
ticket relacionado direto no `WHERE`, com `subQuery: false` pra garantir
que o `LIMIT` não quebre essa combinação de `JOIN` + condição na tabela
relacionada.

### Testado

Script direto contra `dist/models` (sem precisar do servidor rodando):
criados três avisos de teste — um preso a um ticket "open", um preso a um
ticket "closed" e um sem ticket nenhum. Chamando
`NotificationService.list` como super admin, só vieram os dois primeiros
(o do ticket aberto e o sem ticket) — o do ticket fechado ficou de fora,
confirmando o comportamento pedido. Dados de teste removidos do banco
depois.

---

## 32. Deploy do AtendeFlow via Coolify (v2.3.48)

O cliente montou um VPS novo com Coolify e um recurso de PostgreSQL já
configurado, pra migrar o AtendeFlow inteiro pra lá (backend, frontend,
redis), saindo do servidor atual (pm2 + Cloudflare Tunnel, ver seções
anteriores sobre `instalador.sh`/`backup-para-drive.sh`). Coolify é uma
plataforma self-hosted que builda e roda containers Docker a partir de um
repositório Git — o jeito mais direto de integrar um projeto com ele é
fornecer um `docker-compose.yml` (ou Dockerfiles) que ele saiba buildar.

### Por que não existia isso antes

O `docker-compose.yml` da raiz do projeto **já existia**, mas só sobe
Postgres + Redis — é só pra desenvolvimento local (ver `README.md`,
"Início rápido"). O backend e o frontend sempre rodaram direto com
`npm`/`pm2` (via `instalador.sh`) no servidor físico do cliente, sem
nunca terem sido containerizados. Pra rodar no Coolify, precisava de
Dockerfiles pro backend e pro frontend, e um compose separado que suba os
dois.

### O que foi criado

- **`backend/Dockerfile`** — build em duas etapas: instala dependências e
  compila TypeScript (`npm run build`) num estágio, copia só o
  necessário pro estágio final (`dist/`, `node_modules`, `.sequelizerc`).
  Ao subir, roda `npx sequelize-cli db:migrate` (idempotente — só aplica
  migrations pendentes) antes de iniciar `node dist/server.js`. A pasta
  `public/` (uploads: mídia do WhatsApp, currículos do RH, fotos de
  perfil) fica marcada como `VOLUME`, pra não sumir a cada novo deploy.
  A sessão do WhatsApp (Baileys) **não precisa de volume** — ela já é
  salva direto no Postgres (`backend/src/helpers/authState.ts`), não no
  disco.
- **`frontend/Dockerfile`** — build com o mesmo ajuste de
  `--legacy-peer-deps` + `ajv@^8.17.1`/`ajv-keywords@^5.1.0` que já era
  usado no `instalador.sh` (conflito de peer-dependency conhecido do
  projeto). Serve o build estático com `serve -s build`, igual já era
  feito via pm2 no servidor atual.
- **`docker-compose.coolify.yml`** (na raiz, separado do
  `docker-compose.yml` de desenvolvimento) — sobe `backend` + `frontend`
  + `redis`. **Não sobe um Postgres próprio** — o backend se conecta no
  Postgres que o Coolify já tem configurado no VPS, via variáveis de
  ambiente (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`).
- **`.env.coolify.example`** (na raiz) — lista todas as variáveis que
  precisam ser preenchidas na aba de variáveis de ambiente do recurso
  "Docker Compose" no Coolify, com comentário explicando de onde tirar
  cada uma.
- **`backend/.dockerignore`** e **`frontend/.dockerignore`** — evitam
  copiar `node_modules`, `.env` e `.git` pra dentro da imagem.

### Ponto de atenção: variáveis do frontend são de BUILD, não de runtime

As variáveis `REACT_APP_BACKEND_URL`, `REACT_APP_NUMBER_SUPPORT` e
`REACT_APP_WA_CONNECT_URL` do Create React App são gravadas dentro dos
arquivos JS estáticos **no momento do build** — trocar a variável depois
e só reiniciar o container não muda nada, precisa reconstruir a imagem.
No `docker-compose.coolify.yml` elas entram como `args` do build do
serviço `frontend` (não como `environment`), e no Coolify precisam ser
configuradas como variável disponível pro build (a aba certa pode se
chamar "Build Variables" ou similar, dependendo da versão do Coolify).

### Passo a passo pra configurar no Coolify

1. No painel do Coolify, criar um novo recurso do tipo **Docker Compose**,
   apontando pro repositório Git do AtendeFlow, branch de produção, e
   usando o arquivo `docker-compose.coolify.yml` (não o `docker-compose.yml`
   padrão) como compose file.
2. Descobrir o **host interno do Postgres já configurado** no Coolify:
   normalmente aparece nos detalhes do recurso de banco (algo como
   `nome-do-servico-postgres` na rede interna do Coolify, com a porta
   `5432`) — copiar esse host pra variável `DB_HOST`.
3. Preencher as variáveis de ambiente do recurso Docker Compose usando o
   `.env.coolify.example` como roteiro — `BACKEND_URL`/`FRONTEND_URL` com
   os domínios reais, `DB_*` com os dados do Postgres do passo 2,
   segredos (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `MASTER_KEY`,
   `REDIS_SECRET_KEY`) gerados novos (nunca reaproveitar os do servidor
   antigo), e `REACT_APP_BACKEND_URL` apontando pro domínio público da
   API.
4. Configurar os domínios/proxy do Coolify: um domínio pro serviço
   `backend` (porta 8080) e outro pro `frontend` (porta 3000) — o próprio
   Coolify cuida do certificado HTTPS.
5. Rodar o deploy. A primeira subida do backend já aplica todas as
   migrations no Postgres do Coolify (banco novo, do zero) — não precisa
   rodar nada manualmente antes.
6. Testar login com o `ADMIN_USERNAME`/`ADMIN_PASSWORD` configurados, e
   conectar uma conexão de WhatsApp de teste pra confirmar que a sessão
   está sendo salva certinho no Postgres novo.

### O que fica de fora deste primeiro passo

- **`api_oficial/`** (microsserviço da API Oficial da Meta, NestJS +
  Prisma) já tinha seu próprio `Dockerfile` antes desta etapa, mas não
  foi incluído no `docker-compose.coolify.yml` — só entra em cena se a
  empresa-cliente usar `USE_WHATSAPP_OFICIAL=true`. Pode ser adicionado
  como um serviço a mais (ou um recurso separado no Coolify) quando for
  necessário.
- **Backup automático** (`backup-para-drive.sh`) foi pensado pro servidor
  físico atual (via `pg_dump` local, cron). Rodando no Coolify, o backup
  do Postgres deve ser feito pelo mecanismo de backup do próprio recurso
  de banco no Coolify (a maioria das versões tem isso embutido) — não
  faz sentido tentar reaproveitar o script atual como está.
- Migração dos **dados existentes** (banco atual → Postgres novo do
  Coolify) não foi feita aqui — se for pra migrar dados de produção, e
  não começar do zero, o caminho é um `pg_dump` do banco atual seguido de
  `pg_restore`/`psql` no banco novo, antes do primeiro deploy.

### Testado

`docker compose -f docker-compose.coolify.yml config` rodado com valores
de teste pra todas as variáveis obrigatórias — o arquivo faz parse e
interpola corretamente, sem erro de sintaxe. **Não foi possível** buildar
as imagens de verdade neste ambiente de desenvolvimento (o daemon do
Docker não roda dentro deste sandbox — limitação do ambiente, não do
Dockerfile) — a validação completa do build precisa acontecer no VPS
real, o que o próprio Coolify faz automaticamente ao criar o recurso.

---

## 33. Cloudflare Tunnel embutido no docker-compose.coolify.yml (v2.3.49)

Durante a migração real pra um VPS com Coolify (cliente usando um recurso
"Docker Compose" colado direto na interface, não conectado a um
repositório Git — ver seção 32 sobre a diferença), ficou definido que o
acesso público ao AtendeFlow novo seguiria o mesmo padrão do servidor
físico atual: **Cloudflare Tunnel**, em vez de expor porta/IP do VPS
direto. Motivo prático: o VPS só tinha um IP do Tailscale (privado, só
alcançável pelos dispositivos da própria rede Tailscale do cliente) no
momento da migração — Cloudflare Tunnel não depende de IP público nem de
porta aberta, então resolve isso sem precisar esperar/mexer em rede.

### Implementação

`docker-compose.coolify.yml` ganhou um quarto serviço:

```yaml
cloudflared:
  image: cloudflare/cloudflared:latest
  command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
  depends_on:
    - backend
    - frontend
```

Ele se conecta de dentro pra fora até a borda do Cloudflare (não precisa
de porta publicada nem de configuração de rede especial). Os hostnames
públicos são configurados do lado de fora, no painel do Cloudflare (Zero
Trust > Networks > Tunnels), apontando pra `http://backend:8080` e
`http://frontend:3000` — os nomes dos próprios serviços deste compose,
que o Docker resolve sozinho dentro da rede interna criada pelo Coolify
pra esse recurso. `.env.coolify.example` ganhou a variável
`CLOUDFLARE_TUNNEL_TOKEN`.

### Subdomínios usados nesta migração

Pra não derrubar o servidor antigo (que já usa
`atendeflow.confiancatechnologies.com` em produção), a migração/teste no
VPS novo usou subdomínios temporários:
- Frontend: `atendeflow-novo.confiancatechnologies.com`
- Backend: `atendeflow-novo-api.confiancatechnologies.com`

Quando o cliente validar que o VPS novo está funcionando igual ou melhor
que o antigo, o corte final é só repontar o túnel do domínio definitivo
(`atendeflow.confiancatechnologies.com`) pro VPS novo e desligar o túnel
do servidor antigo — não precisa mudar nada no código nem no
`docker-compose.coolify.yml`, só a configuração do túnel no painel do
Cloudflare e as variáveis `BACKEND_URL`/`FRONTEND_URL`/
`REACT_APP_BACKEND_URL` (essa última exige rebuild do frontend, por ser
variável de build).

### Passo a passo do lado do Cloudflare

1. No painel do Cloudflare, ir em **Zero Trust > Networks > Tunnels >
   Create a tunnel**, escolher o tipo **Cloudflared**, dar um nome (ex:
   `atendeflow-vps-novo`).
2. Copiar o **token** gerado — é o valor que vai na variável
   `CLOUDFLARE_TUNNEL_TOKEN` no Coolify.
3. Na mesma tela de configuração do túnel, aba **Public Hostname**,
   adicionar duas entradas:
   - `atendeflow-novo.confiancatechnologies.com` → Service `HTTP`,
     `frontend:3000`.
   - `atendeflow-novo-api.confiancatechnologies.com` → Service `HTTP`,
     `backend:8080`.
4. Salvar. O Cloudflare já cuida do certificado HTTPS público — não
   precisa configurar nada de domínio nem SSL do lado do Coolify.

### Testado

`docker compose -f docker-compose.coolify.yml config` com
`CLOUDFLARE_TUNNEL_TOKEN` de teste — o comando do serviço `cloudflared`
foi montado corretamente (`tunnel --no-autoupdate run --token <valor>`).
Mesma limitação da seção anterior: build real das imagens e teste de
conectividade do túnel só são possíveis no VPS real, não neste ambiente
de desenvolvimento.

---

## 34. Suporte a SSL na conexão com o Postgres (v2.3.50)

Durante a configuração real do VPS, duas informações da tela do recurso
Postgres no Coolify se mostraram inconsistentes entre si: o campo "Port
mappings" mostrava `5433:5433`, mas o campo "Postgres URL (internal)"
(gerado pelo próprio Coolify) mostrava a porta `5432` — **e** terminava
em `?sslmode=require`. A `Postgres URL (internal)` é a fonte confiável
(é literalmente a string de conexão que o Coolify monta pra uso entre
containers), então a porta certa pra `DB_PORT` é **5432**, não 5433 como
tinha sido usado antes nesta mesma migração. Além disso, esse Postgres
**exige conexão criptografada (SSL)** mesmo internamente — e o
AtendeFlow **não tinha nenhum suporte a SSL** na conexão com o banco até
essa etapa (`backend/src/config/database.ts` nunca configurava
`dialectOptions.ssl`), então a conexão falharia sem esse ajuste.

### Implementação

`backend/src/config/database.ts`: nova variável `DB_SSL` (`"true"` liga o
SSL) que, quando ativa, adiciona `dialectOptions.ssl = { require: true,
rejectUnauthorized: ... }`. `rejectUnauthorized` fica `false` por padrão
(controlado por `DB_SSL_REJECT_UNAUTHORIZED`) porque bancos Postgres
gerenciados por Coolify/Docker tipicamente usam certificado autoassinado
— exigir validação de certificado (`rejectUnauthorized: true`) sem ter um
CA de verdade configurado quebraria a conexão. A criptografia em trânsito
continua ativa de qualquer forma; só a validação da identidade do
certificado fica mais permissiva, o que é aceitável pra tráfego que já
fica dentro da rede interna do Docker/Coolify, não exposto à internet.

`docker-compose.coolify.yml` e `.env.coolify.example` ganharam
`DB_SSL`/`DB_SSL_REJECT_UNAUTHORIZED`, com uma nota explicando pra
conferir a "Postgres URL (internal)" (não o "Port mappings") como fonte
confiável de host/porta.

### Testado

`npx tsc --noEmit` depois da mudança — compila sem erros. Não foi
possível testar a conexão SSL de verdade contra o Postgres do Coolify
neste ambiente de desenvolvimento (banco só acessível de dentro da rede
do VPS do cliente) — a validação final acontece no próprio deploy.

---

## 35. Deploy via SSH/docker compose direto, não pelo recurso "Docker Compose" do Coolify (v2.3.51)

Na tentativa real de deploy no VPS do cliente, o tipo de recurso "Docker
Compose" do Coolify usado (o de colar o YAML direto numa caixa de texto,
sem conectar repositório Git — ver seção 32) travou com um erro definitivo:

```
unable to prepare context: path "/data/coolify/services/.../backend" not found
```

### Causa

Esse tipo específico de recurso do Coolify **nunca clona o repositório**
— ele só guarda o texto do compose. Os serviços `redis` e `cloudflared`
funcionaram normalmente (usam `image:` pronta, não precisam de código-
fonte), mas `backend` e `frontend` usam `build: context: ./backend` /
`./frontend`, que exigem o código-fonte de verdade presente no disco do
servidor — e esse código nunca foi baixado, porque esse tipo de recurso
não tem esse conceito de "fonte Git". Diferente do que foi assumido na
seção 32 (que já alertava pra essa possibilidade e sugeria migrar pra
"Application" resources como alternativa).

### Solução adotada

Em vez de recriar tudo como recursos "Application" separados no Coolify
(o que exigiria reconfigurar tudo de novo pela interface, com o mesmo
tipo de atrito já visto), a decisão foi rodar o `docker compose` **direto
via SSH no próprio VPS**, sem depender dessa tela específica do Coolify
pra essa parte:

```bash
git clone -b claude/tender-carson-h1zc86 https://github.com/sandrobssti-pixel/Bernardino.git atendeflow
cd atendeflow
# .env criado manualmente com as mesmas variáveis (ver .env.coolify.example)
docker compose -f docker-compose.coolify.yml --env-file .env up -d --build
```

O banco de dados Postgres continua exatamente como estava, gerenciado
pelo Coolify normalmente (nada mudou nele) — só a aplicação (backend,
frontend, redis, cloudflared) passou a ser gerenciada por `docker
compose` direto, fora da interface do Coolify. Reduz a superfície de
atrito da interface (que já causou: erro de parsing por texto colado
errado, variáveis que precisam existir tanto na aba "Environment
Variables" quanto referenciadas dentro do próprio YAML colado, e agora
esse bloqueio de build) em troca de comandos de terminal diretos e mais
previsíveis.

### Removidas as portas publicadas (`ports:`) de backend/frontend

Durante essa mesma tentativa de deploy, o `docker compose up` falhou de
novo, agora por conflito de porta:

```
failed to bind host port 0.0.0.0:3000/tcp: address already in use
```

A porta 3000 (e potencialmente a 8080) já estava em uso por outro
processo no VPS. Como o Cloudflare Tunnel acessa `backend`/`frontend`
direto pela rede interna do Docker (por nome de serviço, não por porta
publicada no host), **as seções `ports:` de `backend` e `frontend` foram
removidas** do `docker-compose.coolify.yml` — nunca foram necessárias pra
esse desenho (só serviriam pra acessar os containers direto pelo IP do
host, o que não é o caso aqui). Isso também reduz a superfície exposta no
host.

### Testado

`docker compose -f docker-compose.coolify.yml config` com variáveis de
teste — confirmado que nenhuma porta aparece mais como `published` na
configuração final. No VPS real do cliente, o build completo (backend +
frontend) rodou com sucesso via SSH (~150s de build), confirmando que os
Dockerfiles funcionam de ponta a ponta num ambiente real — o bloqueio
anterior era estritamente da falta de código-fonte no disco, não dos
Dockerfiles em si.
