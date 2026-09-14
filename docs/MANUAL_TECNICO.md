# Manual Técnico — AtendeFlow

**Versão do documento:** 2.3.25
**Etapa:** 5 — módulo de RH/recrutamento (vagas + página pública de candidatura com anexo de currículo + triagem + efetivação como usuário do sistema)
**Última atualização:** 2026-09-14

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
