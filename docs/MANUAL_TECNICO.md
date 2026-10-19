# Manual Técnico — AtendeFlow

**Versão do documento:** 2.3.155
**Etapa:** 6.2 Fase 7 — Cobrança Pix/boleto (Mercado Pago + Asaas), layout lado a lado
**Última atualização:** 2026-10-19

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

## 6.2 Roadmap — módulo Financeiro completo (Etapa 4 — Fases 1, 2 e 5 concluídas; Fase 3 iniciada e não validada contra gateway real; Fase 4 adiada; Fase 6 iniciada v2.3.95)

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

### Fase 6 — Cadastro de armas/munições/insumos (clube de tiro, loja de armas, armaria) — iniciada v2.3.95

Pedido do cliente pra atender o segmento de clube de tiro/loja de armas/armaria
(marcas citadas: Taurus, CBC, Glock, Imbramun — fabricante de espoletas/pólvoras),
seguindo como referência regulatória o Decreto 11.615/2023, o Decreto 12.345/2024 e o
Estatuto do Desarmamento (Lei 10.826/2003). **Decisão confirmada com o cliente antes de
começar** (3 perguntas, ver histórico de decisão): (1) estender o `FinanceProduct`
existente em vez de criar entidades dedicadas (`FinanceWeapon`/`FinanceAmmunition`);
(2) contas bancárias entram "junto com o resto" (ver item em aberto abaixo, ainda não
implementado nesta etapa); (3) prioridade de implementação: Cadastro de Armas primeiro.

**⚠️ Aviso de responsabilidade, já comunicado ao cliente**: os campos abaixo foram
levantados com base no livro de registro/SIGMA do Exército e nos decretos citados,
mas **não há validação automática de conformidade legal** nesta versão (ex.: não se
calcula automaticamente se uma combinação calibre/energia cinética é "permitida" ou
"restrita" conforme os decretos). O campo "Classificação de uso" é preenchido
manualmente — a responsabilidade por preenchê-lo corretamente, e por qualquer
obrigação legal correlata (livro de registro físico, relatório ao Exército/SIGMA,
etc.), é do cliente/especialista legal, não do sistema.

- **`FinanceProduct` estendido** (`backend/src/models/FinanceProduct.ts`,
  migration `20261015120000-add-weapon-fields-to-finance-products.ts`): novo `type`
  pode ser `"weapon"` ou `"ammunition"` (além de `"product"`/`"service"` já
  existentes). Campos novos, todos opcionais a nível de banco (só relevantes conforme
  o `type`):
  - **Arma**: `weaponType` (tipo — pistola/revólver/fuzil/carabina/espingarda/
    submetralhadora/outro), `brand` (marca/fabricante, texto livre), `model`,
    `caliber` (calibre nominal), `serialNumber` (número de série — **obrigatório e
    único por empresa** quando `type = "weapon"`), `cartridgeCapacity` (capacidade de
    cartuchos), `operatingMode` (regime de funcionamento), `barrelCount` (quantidade
    de canos), `barrelLength` (comprimento do cano, cm), `boreType` (lisa/raiada),
    `kineticEnergyJ` (energia cinética da munição, Joules), `useClassification`
    (permitido/restrito), `sigmaRegistrationNumber` (nº de registro SIGMA/SINARM),
    `origin` (nacional/importada), `weaponStatus` (em estoque/vendida/em manutenção/
    baixada).
  - **Munição/insumo** (reaproveita `brand`/`caliber`/`kineticEnergyJ`/
    `useClassification`/`origin` da arma, mais dois campos próprios):
    `manufacturingLotNumber` (número do lote de fabricação, rastreabilidade) e
    `packageBarcode` (código de barras/código da embalagem).
  - **Fora de escopo nesta fase, identificado durante o levantamento**: CPF do
    titular, número do CRAF, quantidade vendida, chave de acesso da NF-e e status de
    entrega ao cliente **não** são campos do cadastro de produto — são dados da
    **venda** de um item controlado a um comprador específico (documentação do
    comprador/CR, já prevista como item futuro do roadmap). Registrado aqui pra não
    perder o levantamento feito com o cliente; a implementação liga ao `Sale`/
    `SaleItem` já existentes (Fase 3), não ao `FinanceProduct`.
  - **Número de série único**: índice único parcial no Postgres
    (`idx_finance_products_company_serial_unique`, `WHERE "serialNumber" IS NOT NULL
    AND "serialNumber" <> ''`) — não afeta produtos/serviços comuns (ficam com
    `serialNumber` NULL). `FinanceProductService` faz um checque amigável antes do
    insert/update (`ERR_FINANCE_PRODUCT_DUPLICATE_SERIAL`) e também captura
    `SequelizeUniqueConstraintError` como rede de segurança contra corrida entre duas
    requisições simultâneas.
  - **Validação condicional** (Yup, backend e frontend): `serialNumber` só é
    obrigatório quando `type = "weapon"` (`Yup.string().when("type", {...})` — yup
    0.32, sintaxe de objeto antiga, não a função `(schema) => schema` do yup 1.x).
- **Frontend** (`frontend/src/pages/Financeiro/financeConfig.js`): `PRODUCT_TYPE_OPTIONS`
  ganhou "Arma" e "Munição / Insumo"; novos campos de arma/munição têm
  `visibleWhen: (values) => boolean`, uma capacidade **nova** adicionada ao
  `FinanceRecordModal` (`frontend/src/components/FinanceRecordModal/index.js`) —
  antes desse componente não suportava nenhuma visibilidade condicional, todo campo
  do array `fields` sempre renderizava. Dois comportamentos novos:
  - `field.visibleWhen(values)`: se existir e devolver `false`, o campo não renderiza
    (checado dentro do `fields.map`, usando os `values` atuais do Formik).
  - Ao submeter, `stripHiddenFieldValues` zera (pro `defaultValue` ou vazio) qualquer
    campo que ficou invisível no momento do submit — evita que, ao trocar o Tipo de
    "Arma" pra "Produto" antes de salvar, dados de arma escondidos continuem sendo
    enviados junto com um produto comum.
  - `field.requiredWhen(values)` (usado só por `serialNumber`): mesma ideia, pra
    validação (`Yup.string().test(...)`, lendo `context.parent` pra acessar os outros
    valores do form).
- **Convenção de i18n deste módulo, confirmada antes de decidir não traduzir os
  novos rótulos**: `financeConfig.js` nunca usou o catálogo de 5 idiomas
  (`frontend/src/translate/languages/`) — todo rótulo de campo/coluna é string fixa
  em PT-BR, e **nenhum** código de erro `ERR_FINANCE_*` (nem os já existentes antes
  desta fase, ex. `ERR_FINANCE_PRODUCT_INVALID_NAME`) tem entrada em
  `backendErrors` em nenhum dos 5 idiomas — cai pro fallback de `toastError.js`, que
  mostra o código bruto. Isso é consistente com o módulo inteiro ser voltado à
  regulamentação brasileira (CPF/CNPJ, NF-e, SIGMA/SINARM), então os novos campos e
  os dois novos códigos de erro (`ERR_FINANCE_PRODUCT_SERIAL_REQUIRED`,
  `ERR_FINANCE_PRODUCT_DUPLICATE_SERIAL`) seguiram a mesma convenção — **não** é uma
  violação da regra geral de i18n do projeto (seção 3 da skill `atendeflow-dev`),
  é um módulo que já nasceu fora desse catálogo. Débito pré-existente, não criado
  nesta fase: se algum dia decidirem internacionalizar o Financeiro, são **todos** os
  `ERR_FINANCE_*`/rótulos de uma vez, não só os desta fase.

#### Testado
- `npx tsc --noEmit` limpo no backend (instalado `npm ci` nesta sessão pra validar
  de verdade — sem isso, `npx tsc` cai num TypeScript global incompatível com o
  `tsconfig.json` do projeto e dá erro falso de configuração).
- `eslint` limpo em `financeConfig.js`/`FinanceRecordModal/index.js` (só aviso
  pré-existente de import não usado em `FinanceRecordModal`, não introduzido nesta
  fase).
- Migration não executada contra um banco real nesta sessão (sem Postgres disponível
  no ambiente) — revisão manual cuidadosa do SQL do índice único parcial e dos
  `addColumn`, seguindo exatamente o padrão de outras migrations do projeto.
  **Pendente**: cliente validar em homologação antes do deploy em produção.
- Pendente (próxima parte, "fazer por parte"): importação de produtos/clientes/
  fornecedores via Excel (detecção automática de coluna, atualiza registro existente
  em caso de duplicata por CPF/CNPJ ou SKU/nome) e contas bancárias.

#### Importação via Excel (v2.3.96)

Decisão confirmada com o cliente antes de implementar (outra pergunta com mais de um
caminho razoável — detecção automática de coluna vs. tela de mapeamento manual, qual
cadastro entra primeiro, o que fazer com duplicata): detecção automática por nome de
cabeçalho, nos três cadastros (Produtos, Clientes, Fornecedores) desde já, e duplicata
sempre atualiza o registro existente.

- **`FinanceImportService.ts`** (`backend/src/services/FinanceService/`): lê a
  planilha com a lib `xlsx` (mesma já usada por `ContactListService/ImportContacts.ts`,
  dependência já existente no backend — não precisou instalar nada novo), normaliza
  o nome de cada cabeçalho (remove acento, deixa minúsculo, só `[a-z0-9]`) e casa
  contra uma lista de aliases por campo — ex.: a coluna de nome do produto reconhece
  "nome", "name", "produto" ou "descricao", a de calibre reconhece "calibre" ou
  "calibrenominal". Mesma técnica de normalização de cabeçalho do
  `ContactListService/ImportContacts.ts`, reescrita localmente (helpers próprios, não
  um util compartilhado) porque os campos/entidades são completamente diferentes —
  ver seção 11 da skill `atendeflow-dev` antes de duplicar esse padrão de novo.
  - **Produtos**: reconhece também todos os campos de arma/munição da Fase 6 acima
    (marca, calibre, número de série, energia cinética...). A coluna "Tipo" aceita o
    rótulo em português ("Produto"/"Serviço"/"Arma"/"Munição"/"Insumo") ou o valor
    interno ("product"/"weapon"/...).
  - Cada linha chama `FinanceProductService.create`/`update` (não grava direto no
    model) — reaproveita a mesma validação Yup e o mesmo checque de número de série
    único já implementados na Fase 6, em vez de duplicar a regra.
  - **Dedup**: produto com SKU preenchido na planilha → casa por
    `(companyId, sku)`; sem SKU → casa por `(companyId, name)`. Cliente/fornecedor
    com CPF/CNPJ preenchido → casa por `(companyId, document)` (dígitos só, sem
    máscara); sem documento → casa por `(companyId, name)`. Se achar, chama
    `.update(...)`; se não, `.create(...)`.
  - **Inferência de tipo de documento**: se a planilha não trouxer uma coluna de
    tipo de documento, infere CPF (11 dígitos) x CNPJ (14 dígitos) pelo tamanho —
    sem isso, toda importação de fornecedor cairia no default do modelo ("cpf"),
    errado pra maioria dos fornecedores (pessoa jurídica).
- **Rotas** (`backend/src/routes/financeRoutes.ts`): `POST
  /finance/products|customers|suppliers/import`, `isAuth` + `multer`
  (`upload.array("file")`, mesma config `uploadConfig` já usada por
  `contactListRoutes.ts` pra importação de lista de contatos).
- **Risco identificado e corrigido antes de expor o endpoint**: `uploadConfig` salva
  o arquivo em `public/company{id}/`, servido estaticamente pelo Express — o mesmo
  padrão usado por `ContactListController.upload` (que **não** remove o arquivo
  depois, deixando a planilha de contato acessível por URL indefinidamente, debito
  pré-existente não tocado aqui). Como a planilha do Financeiro pode ter dado
  comercial mais sensível (preço de custo, documento de cliente/fornecedor),
  `FinanceImportController.ts` remove o arquivo temporário no `finally` de cada
  endpoint (sucesso ou erro), em vez de repetir o mesmo risco.
- **Frontend**: `useFinance` (`makeResource`) ganhou `importSpreadsheet(file)`
  (`FormData` + `POST /finance/<recurso>/import`). `FinanceRecordList` ganhou a prop
  `allowImport` (só ligada nas abas Produtos/Clientes/Fornecedores em
  `Financeiro/index.js` — Contas a Pagar/Receber não têm endpoint de import, não
  ligar `allowImport` nelas) — mostra um botão "Importar planilha" que abre um
  `<input type="file">` oculto, sobe o arquivo e mostra um toast-resumo
  (criados/atualizados/inválidos) ao final, recarregando a lista.

#### Testado
- `npx tsc --noEmit` limpo no backend.
- `eslint` limpo em `useFinance/index.js`, `FinanceRecordList/index.js`,
  `Financeiro/index.js` (zero erros/avisos novos).
- Endpoint não testado contra um banco/arquivo real nesta sessão (sem Postgres
  disponível no ambiente) — revisão manual do fluxo de leitura/dedup/upsert.
  **Pendente**: cliente testar em homologação com uma planilha real antes do deploy
  em produção, incluindo o caso de reimportar a mesma planilha (deve atualizar, não
  duplicar).
- Pendente (próxima parte): contas bancárias.

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

---

## 36. Containers do compose entram na rede "coolify" (v2.3.52)

Depois do deploy via SSH (seção 35) funcionar de ponta a ponta pro build,
o container do `backend` subiu e ficou **"Up" mas travado**, sem nunca
terminar de rodar `sequelize-cli db:migrate` — o log parava logo depois
de "Loaded configuration file", sem avançar nem dar erro visível.

### Causa

Quando o `docker compose` é rodado direto (fora da interface do
Coolify), ele cria uma rede Docker **própria e isolada** pro projeto
(`atendeflow_default`) — diferente da rede `coolify`, onde o container do
Postgres gerenciado pelo Coolify vive (confirmado com
`docker inspect <host-do-postgres> --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}'`
→ retornou `coolify`). Containers em redes Docker diferentes não
enxergam uns aos outros pelo nome — por isso o backend nunca conseguia
resolver o host do Postgres, e ficava preso tentando (o `retry` do
Sequelize em `database.ts` tenta até 100 vezes, sem logar cada
tentativa, por isso parecia "travado" em vez de dar erro na hora).

### Correção

`docker-compose.coolify.yml`: declarada a rede `coolify` como `external:
true` (ela já existe, criada pelo próprio Coolify — não é criada por
este arquivo), e todos os quatro serviços (`backend`, `frontend`,
`redis`, `cloudflared`) passaram a se conectar nela em vez da rede padrão
que o `docker compose` criaria sozinho. Com isso, o backend consegue
resolver o host do Postgres pelo nome, e o `cloudflared` continua
enxergando `backend`/`frontend` normalmente (mesma rede pra todo mundo).

### Testado

`docker compose -f docker-compose.coolify.yml config` confirma a rede
`coolify` marcada como `external: true` e todos os serviços conectados
nela. Validação de que o backend passa a completar as migrations de
verdade depende de recriar os containers no VPS real do cliente com essa
mudança — não reproduzível neste ambiente de desenvolvimento (sem acesso
à rede `coolify`/Postgres do cliente).

---

## 37. Migração dos dados de produção pro novo VPS e troca do domínio definitivo (v2.3.53)

Com o novo deploy (seções 32-36) já rodando com banco vazio, faltavam
dois passos pra ele virar o servidor de produção de verdade: trazer os
dados reais do servidor antigo, e apontar o domínio definitivo
(`atendeflow.confiancatechnologies.com`) pra ele.

### Migração dos dados

O servidor "antigo" e o novo VPS são a mesma máquina física (confirmado
pelo prompt do SSH continuar `sandro@ConfianzaThechnologies` nas duas
pastas) — então a migração foi feita com `pg_dump`/`psql` local, sem
precisar transferir arquivo entre hosts:

```bash
PGPASSWORD=postgres pg_dump -h localhost -p 5432 -U postgres -d atendeflow \
  --no-owner --no-acl > /tmp/atendeflow_dump.sql
```

Pra restaurar no Postgres gerenciado pelo Coolify, o banco `atendeflow`
precisou ser dropado e recriado vazio primeiro. Isso esbarrou num
problema: `DROP DATABASE` falhava com "being accessed by other users"
mesmo depois de `pg_terminate_backend`, porque as conexões voltavam
imediatamente. A causa: o **backend continuava rodando** (não tinha sido
parado de fato) e ficava reconectando. A correção foi bloquear novas
conexões *antes* de derrubar as existentes:

```sql
UPDATE pg_database SET datallowconn = false WHERE datname = 'atendeflow';
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'atendeflow';
DROP DATABASE atendeflow;
CREATE DATABASE atendeflow;
```

Com o banco realmente vazio, o restore rodou limpo:

```bash
sudo docker exec -i -e PGPASSWORD <container-postgres> psql -U postgres \
  -d atendeflow < /tmp/atendeflow_dump.sql
```

Depois do restore, era preciso **recriar** o container do backend (não
só `restart`) pra ele abrir conexões novas contra o banco populado — um
`docker compose restart` sozinho não refaz a inicialização da aplicação
da forma esperada quando o banco foi trocado por baixo dele durante a
execução. Confirmado funcionando pelos logs: `No migrations were
executed, database schema was already up to date` e reconexão automática
a uma sessão real do WhatsApp (`[WBOT] listener bound`).

### Troca do domínio definitivo

Com os dados migrados e confirmados (login real funcionando, tickets/
contatos/WhatsApp OK), o domínio real `atendeflow.confiancatechnologies.com`
e `api.confiancatechnologies.com` (que antes apontavam pro túnel
Cloudflare do servidor antigo) foram apontados pro túnel do novo VPS. Passos:

1. `.env` do novo servidor atualizado: `BACKEND_URL`, `FRONTEND_URL` e
   `REACT_APP_BACKEND_URL` trocados pros domínios reais (sem o sufixo
   `-novo`), com rebuild do frontend (variável de build) e **recriação**
   do backend (`up -d --force-recreate`, não `restart` — necessário pra
   ele reler o `.env` atualizado).
2. No Cloudflare Zero Trust, as rotas antigas foram removidas do túnel
   do servidor antigo e recriadas no túnel do novo VPS, apontando pra
   `http://frontend:3000` e `http://backend:8080` (nomes dos serviços do
   compose).

Dois problemas apareceram nesse processo, importantes de registrar:

- **Apagar um túnel inteiro por engano também derruba outros domínios
  que moram nele.** O túnel antigo tinha 3 rotas (o AtendeFlow e mais um
  site institucional não relacionado, `site.confiancatechnologies.com`,
  em outra porta). Ao apagar o túnel inteiro em vez de só as 2 rotas do
  AtendeFlow, o terceiro site também saiu do ar. Corrigido criando um
  túnel novo dedicado só pra esse serviço. **Lição:** nunca apagar um
  túnel Cloudflare sem antes conferir todas as rotas que vivem nele.
- **Error 1033 (Cloudflare Tunnel error) mesmo com tudo aparentemente
  certo.** Ao recriar manualmente os registros de DNS (CNAME apontando
  pra `<id>.cfargotunnel.com`), foi usado por engano o **Connector ID**
  do túnel (identifica uma réplica/instância específica do `cloudflared`
  rodando) no lugar do **Tunnel ID** de verdade (identifica o túnel em
  si — é o valor certo pro alvo do CNAME). São dois UUIDs parecidos e
  fáceis de confundir. A correção definitiva foi deixar o próprio
  Cloudflare criar o registro DNS automaticamente pelo botão "Adicionar
  rota" do túnel (em vez de criar o CNAME manualmente), que sempre usa o
  Tunnel ID correto.

### Testado

Login real (`master`/usuário da empresa) funcionando em
`https://atendeflow.confiancatechnologies.com/login` com dados de
produção (tickets, contatos, sessão de WhatsApp), depois da correção do
DNS e da recriação do backend com o `FRONTEND_URL` atualizado (necessário
pro CORS aceitar requisições vindas do novo domínio). `site.confiancatechnologies.com`
restaurado num túnel próprio, sem afetar o AtendeFlow.

---

## 38. Backup local (NAS) e correção do backup-para-drive.sh (v2.3.54)

Com o VPS já estável, a próxima etapa foi montar uma política de backup
própria (banco de dados + arquivos), sem depender só do Google Drive:
um NAS Synology na mesma rede, com 8 TB de armazenamento.

### 38.1. Backup local no NAS (novo)

O NAS (Synology DS223j, sem suporte a NFS nesse modelo) foi integrado via
**SMB**, com duas pastas compartilhadas dedicadas:

- `atendeflow-backup` (cota de 200 GB) — dump do banco + arquivos enviados
- `seafile-data` — reservada pra próxima etapa (solução tipo "Google
  Drive" das empresas, com Seafile)

Um usuário de serviço dedicado (`atendeflow-sync`, sem ser o admin) recebeu
permissão de leitura/gravação nas duas pastas. As pastas são montadas no
VPS via `cifs-utils`, com credenciais num arquivo protegido:

```bash
sudo apt install -y cifs-utils
sudo mkdir -p /mnt/nas-backup /mnt/nas-seafile /etc/samba

# /etc/samba/credentials-atendeflow-sync (chmod 600):
# username=atendeflow-sync
# password=<senha>
```

`/etc/fstab`:

```
//192.168.3.21/atendeflow-backup /mnt/nas-backup cifs credentials=/etc/samba/credentials-atendeflow-sync,uid=1000,gid=1000,iocharset=utf8,vers=3.0,_netdev 0 0
//192.168.3.21/seafile-data /mnt/nas-seafile cifs credentials=/etc/samba/credentials-atendeflow-sync,uid=1000,gid=1000,iocharset=utf8,vers=3.0,_netdev 0 0
```

O script `~/scripts/backup-atendeflow.sh` roda `pg_dump` via `docker exec`
no container do Postgres, compacta o volume Docker
`atendeflow_atendeflow_public` (arquivos enviados) e salva os dois com
timestamp em `/mnt/nas-backup`, apagando backups com mais de 30 dias.
Agendado via cron às 3h da manhã:

```
0 3 * * * /home/sandro/scripts/backup-atendeflow.sh
```

#### Problema encontrado: pasta compartilhada com nome errado

Ao criar a pasta `seafile-data` no DSM, ela ficou registrada como
`seafile-data Confianca` (nome com espaço, provavelmente autocompletar do
navegador) e, ao tentar corrigir removendo só o espaço, virou
`seafile-dataconfianca` (as palavras se juntaram). Nomes de
compartilhamento com espaço complicam o `mount.cifs`/fstab. Corrigido
apagando a pasta (ainda vazia) e recriando do zero com o nome exato
`seafile-data`.

#### Problema encontrado: "Permission denied" mesmo com a permissão certa

Depois de corrigir o nome, o mount da pasta `seafile-data` continuou
falhando com `mount error(13): Permission denied`, mesmo com a permissão
de Leitura/Gravação do usuário `atendeflow-sync` visivelmente marcada no
DSM. Testando com `smbclient //192.168.3.21/seafile-data -U
atendeflow-sync -c 'ls'`, o erro exato era `NT_STATUS_ACCESS_DENIED` no
"tree connect" — ou seja, negado na conexão com o compartilhamento em si,
não num arquivo específico. Isso indica um estado de permissão
inconsistente, provavelmente resíduo das tentativas de renomear a pasta
com o nome errado. Resolvido apagando a pasta (vazia) e recriando do
zero, com a permissão marcada já na tela de criação (em vez de editar
depois).

### 38.2. Bug real corrigido: backup-para-drive.sh fazia backup do banco errado

Ao revisar o cron do servidor, apareceu um backup diário já existente
(`backup-para-drive.sh`, criado antes desta sessão — ver histórico do
arquivo), rodando às 23h30 e enviando pro Google Drive combinado com o
cliente. Esse script lia o banco a partir de
`~/Bernardino/backend/.env`, que aponta pra `DB_HOST=localhost,
DB_PASS=postgres` — **o Postgres local antigo, de antes da migração pro
Coolify** (seções 32-37).

Ou seja: desde a migração, esse backup rodava "com sucesso" todas as
noites, mas fazia backup de uma cópia **congelada no momento da
migração** do banco, sem nenhum dado de produção criado depois disso
(tickets, mensagens, contatos novos). O cliente tinha uma falsa sensação
de segurança — o backup "funcionava", só que não continha os dados reais
atuais.

#### Correção

`backup-para-drive.sh` passou a:

- Ler o `.env` do diretório de deploy real (`~/atendeflow` por padrão,
  configurável via `ATENDEFLOW_DEPLOY_DIR`), não mais de
  `~/Bernardino/backend/.env`.
- Gerar o dump do banco via `docker exec` no container do Postgres do
  Coolify (mesmo mecanismo do backup local pro NAS), em vez de
  `pg_dump -h $DB_HOST` direto no host (que não alcança o Postgres
  containerizado da mesma forma).
- Compactar o volume Docker `atendeflow_atendeflow_public` (arquivos
  enviados) em vez da pasta `backend/public`, que não recebe mais uploads
  desde que o backend passou a rodar em container.
- Incluir `docker-compose.coolify.yml` no backup de configuração, além do
  `.env`.

O restante do script (configuração do túnel Cloudflare, crontab,
código-fonte completo, envio via `rclone` pro Google Drive do cliente)
foi mantido — continua sendo uma cópia **fora do local físico** do
VPS+NAS, complementar ao backup no NAS (seção 38.1).

### 38.3. Backup no Google Drive desativado (custo mensal)

Depois da correção acima, o cliente decidiu não continuar pagando a
assinatura do Google One/Workspace mantida só por causa desse backup, e
não tem por enquanto outro local físico disponível pra montar uma cópia
externa gratuita (ex.: um HD/mini-PC em outro endereço, acessível via
Tailscale). Por isso, a linha do `backup-para-drive.sh` foi **removida do
crontab** — o backup ativo hoje é só o local, no NAS (seção 38.1).

O script continua no repositório, já corrigido (seção 38.2), e pode ser
reativado a qualquer momento (basta adicionar a linha de volta no
crontab) se o cliente conseguir um local físico externo pra guardar essa
cópia sem custo recorrente, ou decidir voltar a pagar o espaço no Google
Drive.

### Testado

Backup local no NAS executado manualmente com sucesso: dump do banco
(1006K) e arquivos (729K) salvos em `/mnt/nas-backup`, log confirmando
início/fim e remoção de backups antigos. Escrita testada nas duas pastas
montadas (`touch`/`rm`). A correção do `backup-para-drive.sh` foi
validada por leitura de código (lê o `.env` do diretório de deploy
correto e usa `docker exec` para o dump) — não reproduzível neste
ambiente de desenvolvimento por falta de acesso ao Docker/rclone/Google
Drive reais do cliente; validação funcional plena depende de rodar o
script no VPS real.

---

## 39. Bug real: colisão de nome do Redis derrubava as sessões do WhatsApp (v2.3.55)

Depois de um dia inteiro de reinícios do servidor e dos containers
(seções 36-38), o AtendeFlow parou de enviar/receber mensagens do
WhatsApp. O painel mostrava a conexão como desconectada, sem QR code
novo aparecendo.

### Diagnóstico

O log do backend mostrava, repetidas vezes:

```
[ioredis] Unhandled error event: ReplyError: NOAUTH Authentication required.
ERROR: Session <nome>: init timeout: não recebeu open/qr dentro do prazo
ERROR: ERR_WAPP_INIT_TIMEOUT: 4
```

As credenciais da sessão do Baileys (WhatsApp) **não ficam num arquivo**
neste projeto — ficam salvas no Redis (ver
`backend/src/helpers/useMultiFileAuthState.ts`, chaves
`sessions:<whatsappId>:<arquivo>`). Se o backend não consegue autenticar
no Redis, a sessão inteira do WhatsApp trava: não lê as credenciais
salvas, não consegue gerar/renovar o QR code, e a inicialização estoura
o tempo limite.

O `docker-compose.coolify.yml` configura um Redis próprio pro AtendeFlow
(serviço `redis`, `container_name: atendeflow-redis-prod`, sem senha) —
mas esse serviço, junto com todos os outros do compose, está na rede
Docker externa **`coolify`** (necessária pra enxergar o Postgres do
Coolify, ver seção 36). Essa mesma rede também é usada pelo **Redis
interno do próprio Coolify** (`coolify-redis`), que EXIGE senha. Como o
nome do serviço no compose (`redis`) vira automaticamente um apelido de
rede (alias) dentro de QUALQUER rede a que o container se conecta —
inclusive a externa/compartilhada — e é provável que o compose interno
do Coolify use esse mesmo nome genérico `redis` pro serviço dele, os dois
containers podem registrar o mesmo alias `redis` na rede `coolify`. A
resolução de nome do Docker nessa situação pode devolver ora um
container, ora outro — nas vezes em que o backend caía no Redis do
Coolify (que pede senha) em vez do seu próprio, dava `NOAUTH` e a sessão
do WhatsApp parava de funcionar.

### Correção

`docker-compose.coolify.yml`: as variáveis `REDIS_URI`, `REDIS_HOST` e
`IO_REDIS_URI` do backend passaram a apontar pro **nome único do
container** (`atendeflow-redis-prod`, o `container_name` já definido no
próprio serviço) em vez do nome genérico do serviço (`redis`), que é o
que colide. O `container_name` de um container sempre gera um nome de
rede próprio e não-ambíguo, diferente do alias baseado no nome do
serviço, que pode ser reaproveitado por qualquer outro compose na mesma
rede externa.

```yaml
REDIS_URI: redis://atendeflow-redis-prod:6379
REDIS_HOST: atendeflow-redis-prod
IO_REDIS_URI: redis://atendeflow-redis-prod:6379
```

**Lição geral**: ao colocar múltiplos containers de composes/stacks
diferentes numa mesma rede Docker externa/compartilhada (necessário aqui
pra alcançar o Postgres do Coolify), nomes de serviço genéricos
(`redis`, `db`, `app`, etc.) são um risco real de colisão de alias — sempre
usar `container_name` explícito e único, e referenciar esse nome nas
variáveis de ambiente de outros serviços, nunca o nome genérico do
serviço do compose.

### Testado

Depois de aplicar a correção e recriar o container do backend
(`docker compose ... up -d --force-recreate backend`), o erro `NOAUTH`
parou de aparecer no log, e a inicialização da sessão do WhatsApp passou
a completar sem o timeout `ERR_WAPP_INIT_TIMEOUT`.

## 40. Seafile — solução tipo "Google Drive" para arquivos das empresas (v2.3.56)

Segunda parte do projeto do NAS (a primeira foi o backup local, seção
38): uma solução própria de compartilhamento/sincronização de arquivos
das empresas, hospedada na própria infraestrutura, em vez de depender de
um serviço de terceiros.

### Decisões de arquitetura

- **Software escolhido:** Seafile (Community Edition, imagem oficial
  `seafileltd/seafile-mc:12.0-latest`), em vez de FileBrowser (opção mais
  simples, mas sem sincronização de verdade nem histórico de versões).
- **Onde os dados ficam:** inicialmente o plano era usar o NAS via SMB
  (pasta `seafile-data` criada na seção 38), mas foi trocado por **disco
  local dedicado** — surgiu uma partição de 240GB nova na própria VPS
  (`/dev/sdb2`, antes só montada automaticamente pelo ambiente gráfico em
  `/run/media/sandro/Aequivo 2`, sem sobreviver a reboot). Motivo: banco
  de dados/servidor de arquivos em disco local é mais rápido e confiável
  que acessar via rede (SMB) a cada operação; o NAS continua entrando,
  mas só como **destino do backup** (ver mais abaixo), mantendo o padrão
  3-2-1 já usado pro AtendeFlow.
- **Isolamento do stack:** roda separado do `docker-compose.coolify.yml`
  do AtendeFlow, em `docker-compose.seafile.yml` próprio, com nome de
  projeto Docker Compose dedicado (`-p seafile`) pra nunca ser confundido
  com o stack do AtendeFlow em comandos `up`/`down`.

### Montagem da partição local

```bash
sudo umount "/run/media/sandro/Aequivo 2"
sudo mkdir -p /srv/seafile-data
echo "UUID=7ae4044d-88a4-4f70-8196-4ce2592bf04d /srv/seafile-data ext4 defaults,noatime 0 2" | sudo tee -a /etc/fstab
sudo mount -a
sudo chown -R sandro:sandro /srv/seafile-data
```

### Stack Docker (`docker-compose.seafile.yml`)

Três serviços: `seafile-db` (MariaDB), `seafile-memcached` e `seafile`
(Seahub + servidor de arquivos + Nginx interno). O banco e o memcached
ficam numa rede interna isolada (`seafile-internal`, exclusiva desse
stack); só o container `confianza-seafile` entra também na rede externa
`coolify`, pra ser alcançado pelo túnel Cloudflare — replicando a lição
da seção 39: todos os `container_name` são únicos e prefixados
`confianza-` pra nunca colidir com outro stack numa rede compartilhada.

```bash
cd ~/atendeflow
cp .env.seafile.example .env.seafile
# preencher SEAFILE_DB_ROOT_PASSWORD, SEAFILE_JWT_PRIVATE_KEY,
# SEAFILE_ADMIN_EMAIL, SEAFILE_ADMIN_PASSWORD (senhas geradas com
# openssl rand, direto no arquivo, sem passar pelo chat)
sudo docker compose -p seafile -f docker-compose.seafile.yml --env-file .env.seafile up -d
```

### Problemas reais encontrados e correções

1. **`JWT_PRIVATE_KEY` obrigatória, não documentada no compose inicial**
   — a imagem `seafileltd/seafile-mc:12.0` (Seafile 9+) exige essa
   variável (usada internamente entre Seahub e o servidor de arquivos).
   Sem ela: `Cannot find JWT_PRIVATE_KEY value from environment... .env
   file not found`, e o container falha no boot. Corrigido gerando um
   valor com `openssl rand -base64 32` e passando via `.env.seafile`.

2. **`docker compose down` sem nome de projeto ("`-p`") reconhece
   containers de OUTRO stack como "órfãos"** — como o
   `docker-compose.seafile.yml` e o `docker-compose.coolify.yml` do
   AtendeFlow ficam na mesma pasta (`~/atendeflow`), o Compose usa o nome
   da pasta como projeto por padrão pros dois, e um `down` do Seafile sem
   escopo próprio lista os containers do AtendeFlow como "orphan
   containers". Nenhum foi removido (não foi passado `--remove-orphans`),
   mas pra eliminar esse risco por completo todo comando do Seafile agora
   usa `-p seafile` explícito.

3. **Container "seafile" ignora `MEMCACHED_HOST`/`MEMCACHED_PORT`** — ao
   contrário do `DB_HOST` (que é de fato configurável), o Seahub sempre
   tenta resolver o hostname fixo `memcached`, não o valor passado por
   variável de ambiente. Sintoma: `pylibmc.ServerDown ... host:
   memcached:11211` no log (`/shared/seafile/logs/seahub.log`, dentro do
   container) e erro 500 ("Página indisponível") ao tentar logar.
   Corrigido dando um **alias de rede** `memcached` pro container
   `confianza-seafile-memcached`, só dentro da rede interna
   `seafile-internal` (exclusiva desse stack — diferente da rede
   `coolify` compartilhada, não repete o risco de colisão da seção 39):
   ```yaml
   seafile-memcached:
     networks:
       seafile-internal:
         aliases:
           - memcached
   ```

4. **Senha do admin inicial não funcionou no primeiro login** — resetada
   direto pelo script oficial do Seafile dentro do container:
   ```bash
   printf 'admin@confiancatechnologies.com\n<nova-senha>\n<nova-senha>\n' \
     | docker exec -i confianza-seafile /opt/seafile/seafile-server-12.0.14/reset-admin.sh
   ```

### Acesso público (Cloudflare Tunnel)

Reaproveitado o mesmo túnel do AtendeFlow (`atendeflow-vps`), já que ele
roda na mesma VPS e mesma rede Docker `coolify`. Rota criada pelo painel
Cloudflare Zero Trust (Networks → Tunnels → túnel → Public Hostname →
Add a public hostname):

| Campo | Valor |
|---|---|
| Subdomain | `arquivos` |
| Domain | `confiancatechnologies.com` |
| Type | `HTTP` |
| URL | `confianza-seafile:80` |

Resultado: `https://arquivos.confiancatechnologies.com` → tela de login
do Seafile.

### Backup do Seafile (`backup-seafile.sh`)

Mesma lógica do `backup-atendeflow.sh` (dump + tar com timestamp,
retenção de 30 dias): dump das 3 bases MySQL (`ccnet_db`, `seafile_db`,
`seahub_db`) via `docker exec ... mysqldump`, mais um `tar` da pasta
`/srv/seafile-data/seafile` (excluindo `logs`), salvos em
`/mnt/nas-seafile` — a mesma pasta do NAS criada na seção 38 pra ser o
armazenamento principal, reaproveitada agora como destino do backup
depois que a decisão mudou pra disco local. Agendado no cron:

```
30 3 * * * /home/sandro/scripts/backup-seafile.sh
```

### Bug real encontrado durante a configuração do backup: NAS desmontado silenciosamente

Ao conferir o backup, `/mnt/nas-seafile` e `/mnt/nas-backup` apareceram
como **desmontados** (o `df` mostrava o disco raiz `/dev/sda2` por
baixo do ponto de montagem, não o compartilhamento SMB) — provavelmente
caíram num reboot anterior, já que as entradas do `/etc/fstab` desses
dois compartilhamentos não tinham `x-systemd.automount` (diferente do
`nas-confianza`, que já tinha).

Dois problemas ficaram claros com isso:

1. **Os scripts de backup só checavam se a *pasta* existia
   (`[ -d "$BACKUP_DIR" ]`), não se ela era de fato um *ponto de
   montagem*.** Com o NAS desmontado, a pasta local (vazia) ainda
   existe — o script "funcionaria" gravando o backup no disco local da
   própria VPS, sem nenhuma proteção real, e sem erro nenhum no log.
   Corrigido nos dois scripts (`backup-atendeflow.sh` e
   `backup-seafile.sh`) trocando a checagem por `mountpoint -q`, que
   falha alto se não for um mount de verdade.

2. **`/etc/fstab` sem `x-systemd.automount`/`nofail`** nos
   compartilhamentos `atendeflow-backup` e `seafile-data` — corrigido
   alinhando com o `confianza-backup`, que já tinha essa configuração:
   ```
   //192.168.3.21/atendeflow-backup /mnt/nas-backup cifs credentials=/etc/samba/credentials-atendeflow-sync,uid=1000,gid=1000,iocharset=utf8,vers=3.0,_netdev,nofail,x-systemd.automount,x-systemd.after=network-online.target 0 0
   //192.168.3.21/seafile-data /mnt/nas-seafile cifs credentials=/etc/samba/credentials-atendeflow-sync,uid=1000,gid=1000,iocharset=utf8,vers=3.0,_netdev,nofail,x-systemd.automount,x-systemd.after=network-online.target 0 0
   ```

`backup-atendeflow.sh` também foi trazido pro repositório nesta etapa
(antes existia só na VPS, fora do controle de versão).

### Testado

- Login no painel do Seafile funcionando via
  `https://arquivos.confiancatechnologies.com` após o reset de senha.
- `backup-seafile.sh` rodado manualmente com sucesso: dump do banco
  (19K) + tar dos arquivos (397K) salvos em `/mnt/nas-seafile`.
- Os dois compartilhamentos do NAS remontados corretamente após a
  correção do `fstab` (`df -h` confirmando o tamanho real do
  compartilhamento SMB, não mais o disco raiz).

## 41. Bug real: `PROXY_PORT` quebrava toda mídia (imagem/áudio/vídeo) desde a migração pro Cloudflare Tunnel (v2.3.57)

### Sintoma

Cliente reportou: mensagens de imagem, áudio e vídeo (recebidas e
enviadas) apareciam na conversa — o texto/miniatura "chegava" — mas sem
visualização nem opção de baixar. No console do navegador (F12):

```
net::ERR_SSL_PROTOCOL_ERROR
  https://api.confiancatechnologies.com:8080/public/company3/....jpeg

Solicitud de origen cruzado bloqueada (CORS)
  https://api.confiancatechnologies.com:8080/public/company3/....jpeg
```

### Diagnóstico (descartando hipóteses até achar a causa real)

1. **Não era o backend Postgres/Redis nem o `docker-compose.coolify.yml`
   dessa sessão** — o arquivo salvo em disco (`docker exec ... file`)
   estava correto e era servido com `HTTP 200` quando testado direto
   por `curl https://api.confiancatechnologies.com/public/...`
   (sem porta, funcionando).
2. **Não era cache do navegador nem Service Worker** — reproduzido em
   aba anônima e em outro navegador (Firefox), com o mesmo erro.
3. **Não era o bundle do frontend** — depois de um rebuild
   (`docker compose build --no-cache frontend`), o JS gerado não tinha
   mais nenhuma referência a `:8080` além de coincidências inofensivas
   (`#808080`, um placeholder de exemplo `127.0.0.1:8080`), e o hash do
   arquivo (`main.792b4ebf.js`) confirmava ser o build novo (timestamp
   batendo com o horário do build).
4. **Achado**: mesmo assim, mensagens **novíssimas** continuavam vindo
   com `:8080` na URL — ou seja, a porta não vinha do frontend, e sim
   de algo montado **no backend, em tempo de leitura**.

### Causa raiz

`backend/src/models/Message.ts` (e o mesmo padrão repetido em
`Contact.ts`, `Announcement.ts`, `QuickMessage.ts` e
`helpers/BuildWebchatPublicUrl.ts`) tem um getter `mediaUrl` que monta a
URL pública da mídia **dinamicamente a cada leitura** (não fica gravada
fixa no banco), concatenando `BACKEND_URL` + `PROXY_PORT`:

```ts
const buildBackendBaseUrl = (): string => {
  const rawBackendUrl = (process.env.BACKEND_URL || "").trim();
  const proxyPort = (process.env.PROXY_PORT || "").trim();
  ...
  const parsedUrl = new URL(rawBackendUrl);
  if (proxyPort && !parsedUrl.port) {
    parsedUrl.port = proxyPort;   // <- aqui
  }
  return parsedUrl.toString().replace(/\/$/, "");
};
```

No `docker-compose.coolify.yml`, `PROXY_PORT: "8080"` — resquício de
quando o backend era acessado direto por `IP:8080` (antes da migração
pro Cloudflare Tunnel, seção 37). Resultado:
`BACKEND_URL=https://api.confiancatechnologies.com` +
`PROXY_PORT=8080` → `https://api.confiancatechnologies.com:8080/...`,
uma porta que **não existe publicamente** (o túnel Cloudflare serve tudo
por HTTPS/443; a porta 8080 só existe dentro da rede Docker interna).

### Correção

```yaml
# docker-compose.coolify.yml, serviço backend
PROXY_PORT: ""
```

Como a checagem em todos os getters é `if (proxyPort && !parsedUrl.port)`,
uma `PROXY_PORT` vazia desliga a concatenação da porta **em todos os
lugares de uma vez só** (imagem/áudio/vídeo de mensagem, foto de
contato, anexo de anúncio, webchat) — sem precisar editar 5 arquivos
diferentes.

**Importante**: como a URL é montada em tempo de leitura (não gravada
fixa no banco), essa correção resolve **mensagens antigas e novas ao
mesmo tempo**, só recriando o container do backend — não precisou de
nenhuma migração ou correção manual no banco de dados.

```bash
cd ~/atendeflow
sudo docker compose -f docker-compose.coolify.yml --env-file .env up -d --force-recreate backend
```

### Testado

Cliente confirmou (via navegador, testando imagem/áudio/vídeo em
conversa individual) que a mídia passou a abrir e baixar normalmente
depois da correção.

## 42. Sino do Painel Vigia voltou a mostrar alerta de atendimento fechado — agora no front-end (v2.3.58)

### Sintoma

Cliente relatou: "quando finaliza o atendimento faz tudo certo, porém
está ficando registro de mensagens e alertas — só é pra ficar em
mensagens e alertas de atendimento novo, não quando finaliza". Esse é
literalmente o mesmo bug da **seção 31** (v2.3.47) — mas a correção de
lá continuava funcionando certinho; o problema reapareceu numa peça
**nova** construída depois, que não herdou a mesma regra.

### Causa

A seção 31 corrigiu o endpoint `NotificationService.list` (usado pra
carregar o sino) pra excluir notificações de tickets já `closed` — e
esse filtro **continua correto e intacto**. O que mudou desde então foi
a chegada do componente `SupervisorAlertsBell` (frontend), que:

1. Busca a lista do backend **uma única vez**, quando o componente é
   montado (`useEffect(() => { fetchItems() }, [])`).
2. Depois disso, só **acrescenta** ao estado local os alertas que
   chegam ao vivo por socket (`company-${companyId}-notification`,
   `company-${companyId}-supervisorMessage`).
3. Nunca reconsulta o backend de novo, e não tinha nenhum listener pra
   remover um alerta quando o ticket dele é fechado.

Resultado: um alerta de SLA criado enquanto o atendimento ainda estava
aberto ficava preso na lista local do navegador pra sempre, mesmo depois
do atendimento ser fechado — mesmo o backend nunca tendo devolvido esse
alerta de novo numa nova consulta.

### Correção

`frontend/src/components/SupervisorAlertsBell/index.js`:

1. **Remoção ao vivo**: novo listener no socket
   `company-${companyId}-ticket` — quando chega um evento com
   `ticket.status === "closed"`, remove do estado local qualquer alerta
   cujo `ticket.id` seja o do atendimento fechado.
2. **Reconsulta ao abrir**: `handleClick` (abrir o sino) agora chama
   `fetchItems()` sempre que o popover está fechado e vai abrir — cobre
   o caso de um atendimento ter sido fechado por outro atendente/aba
   antes do evento de socket chegar nessa sessão.

### Lição

A regra "alerta de atendimento fechado não aparece mais" precisa ser
respeitada em **toda** peça que lê notificações — backend (`list`,
seção 31) e frontend (estado ao vivo, aqui). Um filtro correto só no
backend não é suficiente quando o frontend guarda seu próprio cache
local alimentado por eventos em tempo real e nunca o resincroniza.

### Testado

Lint (`eslint`) limpo no arquivo alterado. Aguardando confirmação do
cliente em uso real (fechar um atendimento com alerta de SLA ativo e
confirmar que ele some do sino).

## 43. Lista de Contatos: "Importar Arquivo" com campos extras da planilha (v2.3.59)

### Pedido do cliente

Na tela de Campanha → Lista de Contatos, só existiam: baixar planilha
exemplo, ver contatos, importar contatos do sistema, editar lista e
excluir lista. Pedido: uma opção de **importar um arquivo Excel** e
montar a lista já organizada com todos os campos do arquivo (ex.: uma
planilha de cobrança de "filiados inadimplentes" com colunas de nome,
telefone, e-mail, CPF, vigência de/até, mês e status) — os campos extras
ficam só pra uso interno/organização; a campanha continua usando só o
número de WhatsApp.

### O que já existia (descoberto ao investigar, antes de construir)

- O **backend** já tinha um endpoint completo pra isso:
  `POST /contact-lists/:id/upload` →
  `ContactListService/ImportContacts.ts` — lê a planilha (`xlsx`),
  detecta nome/número/e-mail por uma lista de apelidos de cabeçalho
  (`nome`, `telefone`, `email`, etc.), normaliza o número
  (`normalizeCampaignContactNumber` — já resolve o formato
  `55DDDNÚMERO`, sem caracteres, aceitando o número com ou sem `55`
  na frente) e valida no WhatsApp.
- A tela "Ver Contatos" (`ContactListItems`, um nível abaixo na
  navegação) **já tinha** um botão "Importar" usando esse mesmo
  endpoint — só não existia na tela de cima (lista de listas,
  `ContactLists`), que era onde o cliente esperava encontrar.

### O que foi adicionado

1. **Botão "Importar Arquivo" na tela de Listas de Contatos**
   (`frontend/src/components/ImportFileContactsModal`, plugado em
   `ContactLists/index.js`) — escolhe o arquivo, mostra o progresso
   (reaproveitando o socket `company-{id}-ContactListImport-{listId}`
   que o backend já emitia) e fecha sozinho quando termina. Convive com
   o botão que já existia dentro de "Ver Contatos".

2. **Campo `extraData` (JSON) no `ContactListItem`** — migration
   `20260920120000-add-extradata-to-contactlistitems.ts`. Guarda todas
   as colunas da planilha que não foram usadas como nome/número/e-mail
   (CPF, vigência de/até, mês, status, ou qualquer outra coluna que a
   planilha do cliente tiver). Só uso interno: a campanha nunca lê esse
   campo, só o número normalizado.

3. **`ImportContacts.ts` corrigido pra planilha com cabeçalhos
   arbitrários**: a detecção de nome dependia de um cabeçalho
   reconhecido (`nome`/`name`/`contato`) — a planilha real do cliente
   usa `atirador` como primeira coluna, que não batia com nenhum alias,
   então **todo contato importava sem nome**. Corrigido caindo pra
   **primeira coluna da planilha** quando nenhum alias de nome bate
   (sempre existe, e normalmente é o identificador da linha).

4. **Reimportação atualiza o contato existente**: antes, reimportar a
   mesma planilha (ex.: lista de inadimplentes atualizada todo mês) só
   contava como "duplicado" e não atualizava nada. Agora atualiza
   nome/e-mail/`extraData` do contato já existente (mantém número e
   validação de WhatsApp já feitos), pra status/vigência ficarem
   sempre com o dado mais recente.

5. **Botão "Ver dados da planilha" na listagem de contatos**
   (`ContactListItems`) — só aparece quando o contato tem `extraData`;
   abre um diálogo simples listando todas as colunas extras
   (chave/valor), sem precisar de uma coluna fixa por campo (cada
   planilha pode ter colunas diferentes).

### Testado

- Lint (`eslint`) limpo nos arquivos de frontend alterados.
- `tsc --noEmit` limpo no backend inteiro (nenhum erro introduzido).
- Não testado ainda em produção com a planilha real do cliente
  (`Planilha_de_cobrança_filiados_vencidos_ago-set.xlsx`) — pendente de
  rodar a migration e importar de verdade após o deploy.

## 44. Campanha: mandar direto pra grupo do WhatsApp ou contato individual (v2.3.60)

### Pedido do cliente

"Essas campanhas são disparos em massa para grupos, contatos individuais
e lista de contatos prontas" — na tela de campanha só existia a opção de
escolher uma lista de contatos pronta (ou uma tag). Faltava dar pra
escolher, na hora de criar a campanha, entre: lista de contatos, grupo
do WhatsApp ou um número avulso — sem precisar sair da tela de campanha
pra montar uma lista antes.

### Descoberta importante antes de construir

Investigando o motor de disparo (`queues.ts`) pra saber por onde
implementar isso com o menor risco possível, achou-se que ele **já
suporta mandar campanha pra um grupo**:

```ts
const chatId = campaignShipping.contact.isGroup
  ? `${campaignShipping.number}@g.us`
  : campaignChatKey || `${campaignShipping.number}@s.whatsapp.net`;
```

Ou seja: `ContactListItem` já tem o campo `isGroup`, e a fila de envio já
sabe montar o JID de grupo (`@g.us`) quando esse campo é `true`. Isso
significa que **não foi preciso mudar nada no `Campaign`, no
`CampaignShipping` nem na fila de envio** — só automatizar a criação do
item certo numa lista, e apontar a campanha pra essa lista. Uma mudança
grande (que mexeria no motor de disparo mais crítico do sistema) virou
uma mudança pequena e de baixo risco.

Outra descoberta: os **grupos já existem como `Contact`** normal (não
`ContactListItem`) com `isGroup: true` — todo grupo que já trocou
mensagem com a conexão já está lá (ver `verifyContact` em
`wbotMessageListener.ts`). Não foi preciso chamar o Baileys
(`groupFetchAllParticipating`) pra listar grupos: só reaproveitar
`GET /contacts` com o filtro que já existia.

### O que foi construído

1. **`GET /contact-lists/quick-list`** — pega (ou cria, na primeira vez)
   uma lista fixa por empresa chamada "Envios avulsos (grupos e contatos
   individuais)" (`GetOrCreateQuickListService`). É essa lista que
   recebe os itens avulsos escolhidos na campanha.

2. **`POST /contact-list-items/group`** — adiciona um grupo como item de
   lista (`AddGroupItemService` → arquivo `AddGroupService.ts`), **sem**
   validar o número como telefone de pessoa (diferente do
   `CreateService` normal): o ID de um grupo (ex.:
   `120363042078274095`) não é um número de WhatsApp e falharia na
   validação normal.

3. **Componente `CampaignRecipientPicker`** (frontend), plugado no
   `CampaignModal` ao lado do campo "Lista de contatos": botão "Grupo ou
   contato avulso" abre um diálogo com duas abas —
   - **Grupo do WhatsApp**: lista os grupos já conhecidos da conexão
     selecionada (`GET /contacts?isGroup=true`, filtrado por
     `whatsappId` no front).
   - **Contato individual**: nome (opcional) + número, reaproveitando o
     `POST /contact-list-items` normal (com toda a validação de
     WhatsApp que uma lista de contatos já tem).

   Ao confirmar, o item é criado/reaproveitado na lista "guarda-chuva" e
   o campo `contactListId` da campanha é preenchido automaticamente —
   como se o usuário tivesse escolhido essa lista manualmente.

### Bug real encontrado no caminho: `isGroup=true` era ignorado

`ListContactsService` (usado por `GET /contacts`) só tinha a checagem
`if (isGroup === "false")` — o valor `"true"` caía no vazio e devolvia
**todos** os contatos (grupos e pessoas juntos), não só os grupos.
Faltava também `whatsappId` na lista de atributos retornados, quebrando
o filtro por conexão no picker novo. Os dois corrigidos.

### Testado

- Lint (`eslint`) limpo nos arquivos de frontend alterados.
- `tsc --noEmit` limpo no backend inteiro.
- Não testado ainda em uso real (escolher um grupo/contato avulso e
  confirmar que a campanha realmente dispara pra ele) — pendente de
  deploy.

## 45. Bug real: fuso horário do container do backend (rodava em UTC) — horário de campanha errado (v2.3.61)

### Sintoma

Cliente relatou: agendou uma campanha pra `19:20`, e ela salvou/apareceu
como `16:15` na listagem — a **data** ficou certa, só a **hora** veio
errada, sempre "adiantada" (mostrando um horário mais cedo do que o
digitado).

### Causa

O container do backend roda em **UTC** por padrão (comportamento normal
do Docker — nenhuma imagem base define fuso horário sozinha). O
`scheduledAt` da campanha chega do frontend como uma string **sem fuso
explícito**:

```js
// CampaignModal/index.js
dataValues.scheduledAt = moment(value).format("YYYY-MM-DD HH:mm:ss");
// -> "2026-09-20 19:20:00" (sem "Z", sem offset)
```

Quando o Node (rodando em UTC) recebe essa string sem fuso, ele
interpreta como **19:20 UTC** — que corresponde a **16:20 no horário de
Brasília** (UTC-3). Ao carregar a campanha de volta, o navegador do
cliente (já no fuso certo) mostra esse valor errado sem re-converter
nada, daí o "adiantamento" de ~3h.

**Achado ao investigar**: essa mesma classe de bug (fuso ambíguo por
causa do container rodar em UTC) já tinha sido corrigida manualmente,
ponto a ponto, em vários lugares do código —
`backend/src/jobs/BirthdayJob.ts`, `backend/src/queues.ts` e
`backend/src/utils/logger.ts` chamam explicitamente
`moment().tz('America/Sao_Paulo')`, e `backend/src/config/database.ts`
já tinha `timezone: 'America/Sao_Paulo'` na config do Sequelize. Só que
cada ponto novo do sistema que lida com data precisa lembrar de fazer
essa compensação manualmente — a tela de agendamento de campanha
(mais nova) não tinha.

### Correção (na raiz, não ponto a ponto)

Em vez de adicionar mais um `.tz('America/Sao_Paulo')` manual (que só
resolveria esse caso específico e deixaria a mesma armadilha pra
próxima tela nova), a correção foi no **nível do container**: fazer o
processo do Node já rodar no fuso certo por padrão, pra qualquer código
futuro que lide com data sem se preocupar com isso.

`docker-compose.coolify.yml`, serviço `backend`:
```yaml
TZ: America/Sao_Paulo
```

`backend/Dockerfile` (estágio final): a imagem `node:20-bookworm-slim`
**não vem com os dados de fuso horário instalados** — sem isso, a
variável `TZ` seria ignorada silenciosamente e o container continuaria
em UTC mesmo com a variável definida:
```dockerfile
RUN apt-get update \
  && apt-get install -y --no-install-recommends tzdata \
  && rm -rf /var/lib/apt/lists/*
```

### Importante: campanhas já agendadas antes da correção

O valor errado já ficou gravado no banco pras campanhas criadas antes
desse fix (ex.: a campanha "renovação filiação 2026", agendada com
`16:15` em vez de `19:20`). A correção só vale pra novos agendamentos —
**precisa reabrir e reagendar manualmente** as campanhas afetadas depois
do deploy.

### Testado

- `tsc --noEmit` limpo (mudança só em config/Dockerfile, sem código
  TypeScript alterado).
- Não testado ainda em produção — pendente rebuildar a imagem do
  backend (mudança no Dockerfile) e recriar o container.

## 46. Bug real: campanha "entregue" mas mensagem não chegava — número sem o 9º dígito (v2.3.63)

### Sintoma

Cliente testou uma campanha real ("filiacao") pra 3 contatos: o sistema
marcou os 3 como entregues (`deliveredAt` preenchido no
`CampaignShipping`), mas testando manualmente com o número
`5571988789015`, a mensagem **não chegou**. Depois relatou: "teve alguns
que chegaram" — comportamento inconsistente, sem padrão aparente.

### Diagnóstico

Conferindo o banco direto: dois dos três contatos da lista
(`ContactListItems`) estavam salvos com o número `557188789015` — **12
dígitos**, faltando o 9º dígito do celular (o certo seria
`5571988789015`, 13 dígitos). Mesmo assim, `isWhatsappValid` estava
`true` pra esses dois.

Causa: `CheckContactNumber` (`backend/src/services/WbotServices/
CheckNumber.ts`), usado tanto na hora de criar um contato quanto de
importar uma planilha, monta uma lista de "candidatos" (variações do
número) e testa cada um contra o WhatsApp (`wbot.onWhatsApp(jid)`) até
achar um que exista, gravando esse como o número final do contato. Pra
um número brasileiro de 12 dígitos (sem o 9), a ordem antiga testava
**primeiro a forma incompleta** e só depois a completa (com o 9). Como
o WhatsApp às vezes retorna `exists=true` pra essa forma incompleta por
tolerância do próprio servidor (sem necessariamente resolver pro mesmo
número real do destinatário), o contato ficava salvo com o número
errado — "válido" pro sistema, mas sem entrega real garantida.

### Correção

`CheckNumber.ts`: a forma **completa** (13 dígitos, com o 9) agora é
sempre testada **antes** da incompleta — nunca o contrário:

```ts
if (digits.startsWith("55") && digits.length === 12) {
  push(addBrVariant(digits)); // -> 13 dígitos (com o 9) — tenta primeiro
  push(digits);                // -> 12 dígitos original — só de reserva
} else if (digits.startsWith("55") && digits.length === 13) {
  push(digits);                 // -> já está certo, tenta como veio
  push(addBrVariant(digits));  // -> 12 dígitos — só de reserva
}
```

**Importante**: essa correção vale só pra contatos criados/importados
**depois** dela — os dois contatos já salvos com o número errado
(`557188789015`) continuam errados no banco e precisam ser corrigidos
manualmente (editar o número certo, ou apagar e reimportar).

### Melhorado no mesmo pacote: reconhecimento de números de outros países

Pedido do cliente: "tem que ter reconhecimento de DDD do país de
origem pois 100% dos contatos são de whatsApp mesmo fora do país."

`backend/src/utils/normalizeCampaignContactNumber.ts` passou a usar a
biblioteca **`libphonenumber-js`** (dados oficiais de numeração de
qualquer país), em vez de só contar dígitos (12-14):

- Número com `+` na frente (ex.: `+595986283937`, Paraguai) é validado
  pelas regras reais daquele país.
- Número sem `+` continua assumindo Brasil por padrão (comportamento
  já existente, mantido — é a imensa maioria dos contatos).
- **Limite conhecido**: a biblioteca sozinha **não resolve** a
  ambiguidade do 9º dígito brasileiro (um número de 12 dígitos é uma
  forma válida de **telefone fixo**, então a lib não pode "adivinhar"
  que era celular incompleto). Quem resolve isso de verdade é a ordem
  de checagem no `CheckNumber.ts` acima — os dois fixes se
  complementam: a lib melhora o reconhecimento internacional, o
  `CheckNumber.ts` resolve a ambiguidade nacional continuando a
  validar direto no WhatsApp.

### Testado

```
557188789015   (BR sem o 9)  -> ainda "válido" pra lib (parece fixo),
                                  mas CheckNumber agora tenta o 9 primeiro
5571988789015  (BR com o 9)  -> válido, sem alteração
+595986283937  (Paraguai)    -> válido, reconhecido como Paraguai
595986283937   (sem +)       -> mantido como veio (fallback seguro,
                                  não tenta virar Brasil por engano)
+14155552671   (EUA)         -> válido, reconhecido como EUA
```

`tsc --noEmit` limpo. Ainda não testado em produção — pendente rebuild
do backend (nova dependência `libphonenumber-js`).

## 47. Listagem de campanhas com envio real, edição total, relatório em Excel (v2.3.64)

### Pedido do cliente (3 itens)

1. "Coloque uma opção pra editar que todos os campos possa ser
   modificados, às vezes acontece de errar e o botão editar não abre
   todos os campos."
2. "Dentro de listagem o campo confirmação coloca o status: bolinha
   verde confirmado o envio, bolinha vermelha não confirmado envio."
3. "Tem que informar um painel de quantos foram enviados e recebidos e
   de quantos não foram enviados, baixar um arquivo em excel mostrando
   os contatos que não foram enviados e os que foram enviados."

### 1. Edição total da campanha

`CampaignModal`: o campo `campaignEditable` (que trava os campos
quando a campanha já foi enviada, está em andamento, ou está agendada
pra menos de 1h) virou um valor **derivado**, não mais um estado bruto:

```js
const [naturalEditable, setNaturalEditable] = useState(true); // regra normal
const [forceEditAll, setForceEditAll] = useState(false);      // override manual
const campaignEditable = naturalEditable || forceEditAll;
```

Quando `naturalEditable` é falso, aparece um aviso no topo do
formulário com um botão "Habilitar edição total" — todos os campos
(que já usavam `disabled={!campaignEditable}`) liberam automaticamente,
sem precisar mexer em cada um. O override reseta sozinho ao fechar o
modal ou trocar de campanha (não "vaza" pra próxima).

### 2. Bolinha de status real na listagem

**Importante**: a primeira versão dessa bolinha (v2.3.62) usava
`campaign.confirmation` — só que esse campo é a config de **"mensagem
de confirmação"** (um recurso separado, de duplo aviso), não o status
de entrega. O cliente corrigiu o pedido: a bolinha precisa refletir se
a campanha **enviou de verdade**.

Corrigido em duas pontas:

- **Backend** (`CampaignService/ListService.ts`): depois de buscar a
  página de campanhas (20 por vez), uma consulta extra e leve busca só
  `campaignId` + `deliveredAt` de `CampaignShipping` pras campanhas
  daquela página, e calcula `shippingTotal`/`shippingDelivered` por
  campanha (evita um JOIN pesado na consulta principal).
- **Frontend** (`Campaigns/index.js`): `getSendStatusMeta(campaign)`
  decide a cor —
  - **cinza**: `shippingTotal === 0` (campanha ainda não rodou);
  - **vermelha**: tentou enviar mas `shippingDelivered === 0`;
  - **verde**: `shippingDelivered > 0` (enviou, mesmo que parcial).

### 3. Relatório em Excel (enviados + não enviados)

A tela de relatório (`CampaignReport`) já calculava os números certos
de válidos/entregues/pendentes a partir de `campaign.contactList.contacts`
e `campaign.shipping` (sem limite/paginação na consulta — números
exatos, não estimativa) — e já tinha um botão de exportar **CSV só dos
pendentes**. Trocado por um **Excel com duas abas** ("Enviados" e "Não
enviados"), reaproveitando a biblioteca `xlsx` (SheetJS) já usada em
outras telas do sistema (`Reports/index.js`).

### Nota sobre o "1/1" visto antes de todos esses fixes

Durante a investigação, um relatório mostrou "1 Contatos Válidos, 1
Entregues" pra uma campanha que na verdade tinha 3 contatos válidos e 3
entregues (confirmado direto no banco). Como a consulta do relatório
não tem paginação nem limite, e os 3 disparos foram criados e entregues
dentro do mesmo minuto do envio, o mais provável é que a tela tenha
sido vista **no meio do processamento** (antes do 2º/3º disparo
terminar), não um bug de contagem — recarregar a página depois do envio
concluído mostrou os números corretos.

### Testado

- Lint (`eslint`) limpo nos três arquivos de frontend alterados.
- `tsc --noEmit` limpo no backend (mudança em `ListService.ts`).
- Não testado ainda em produção — pendente rebuild do frontend e do
  backend.

## 48. Após importar arquivo em "Adicionar nova lista", abre a tela de contatos da lista (v2.3.65)

### Pedido do cliente

"Em Lista de Contatos, manda 'Adicionar nova lista', aí vai em 'Anexar
arquivo'; quando clicar nessa função tem que abrir um formulário
contendo todos os dados da lista de contatos — os números que vão ser
enviados — para conferir, adicionar ou até mesmo excluir um contato da
lista."

### Situação antes

O fluxo "Importar Arquivo" (botão na tela `ContactLists`, componente
`ImportFileContactsModal`) fazia o upload da planilha, acompanhava o
progresso via socket (`company-${companyId}-ContactListImport-${id}`)
e, ao terminar (`payload.status === "done"`), só fechava o modal
(`onClose(true)`) e mostrava um toast — o usuário continuava na tela de
"lista de listas", precisando clicar manualmente em "Ver Contatos" pra
conferir o que foi importado.

Já existia, no sistema, uma tela pronta pra isso: `ContactListItems`
(rota `/contact-lists/:id/contacts`), que lista todos os contatos da
lista com busca, edição, exclusão e até um botão de importação própria
— só faltava chegar nela automaticamente depois do import feito pela
tela de listas.

### Correção

Em `frontend/src/components/ImportFileContactsModal/index.js`:

```js
import { useHistory } from "react-router-dom";
// ...
const history = useHistory();
// ...
if (payload?.status === "done") {
  setUploading(false);
  toast.success("Arquivo importado com sucesso.");
  onClose(true);
  history.push(`/contact-lists/${contactList.id}/contacts`);
}
```

Assim que o socket confirma que o processamento da planilha terminou,
o usuário é levado direto pra tela de contatos daquela lista — já
populada com todos os números importados — onde pode conferir, editar,
adicionar manualmente (botão "+") ou excluir qualquer contato, sem
precisar procurar a lista de novo.

O fluxo de importação que já existia **dentro** da própria tela
`ContactListItems` (usado quando o usuário já está vendo os contatos de
uma lista e importa uma planilha por lá) não precisou de nenhuma
mudança — ele já mantém o usuário na mesma tela durante e depois da
importação, mostrando o card de progresso (`importProgress`) e a
listagem atualizada.

### Testado

- Lint (`eslint`) limpo no arquivo alterado.
- Não há mudança de backend nesta etapa.
- Não testado ainda em produção — pendente rebuild do frontend.

## 49. Edição total em qualquer status de campanha + grupos do WhatsApp direto da conexão (v2.3.66)

### Pedido do cliente (3 itens)

1. "Na opção editar campanha, ajustar o nome 'habilitar edição total',
   está comendo a frase — campo pequeno para o texto."
2. "Quando edita, serve para todas as campanhas: inativas, programadas,
   em andamento ou campanhas finalizadas."
3. "No sistema adicionei a opção grupos e não habilitou os grupos que o
   número tem, consequentemente não tem a opção do envio da campanha
   para escolha de grupos."

### 1. Texto do banner sobrepondo o botão

O `Box` do aviso (`CampaignModal`) usava `display="flex"` sem
`flexWrap`, com o texto (`Typography`) sem `flex`/`minWidth` definidos
— em telas menores (ou com o aviso mais longo), o texto não quebrava
linha e empurrava/sobrepunha o botão "Habilitar edição total".

Corrigido com `flexWrap="wrap"` no `Box` e `flex: "1 1 260px"` +
`minWidth: 0` no `Typography` do aviso — agora o texto ocupa a largura
disponível e quebra pra própria linha, o botão desce pra debaixo dele
quando não cabe mais na mesma linha, sem cortar nem sobrepor nada.

### 2. Edição total não funcionava para campanha em andamento/finalizada

O botão "Habilitar edição total" (adicionado na v2.3.64, ver seção 47)
já liberava os campos do formulário na tela, pra qualquer status. O
problema estava um passo depois, no **salvar**: o backend
(`CampaignService/UpdateService.ts`) tinha essa checagem:

```ts
if (["INATIVA", "PROGRAMADA", "CANCELADA"].indexOf(data.status) === -1) {
  throw new AppError("Só é permitido alterar campanha Inativa e Programada", 400);
}
```

Como o formulário sempre reenvia o `status` atual da campanha junto
(`dataValues.status`), tentar salvar uma campanha `EM_ANDAMENTO` ou
`FINALIZADA` — mesmo com "edição total" habilitada — caía nesse erro e
o PUT `/campaigns/:id` falhava. Corrigido ampliando a lista de status
aceitos:

```ts
if (
  ["INATIVA", "PROGRAMADA", "EM_ANDAMENTO", "FINALIZADA", "CANCELADA"].indexOf(
    data.status
  ) === -1
) {
  throw new AppError("Status de campanha inválido", 400);
}
```

Agora a edição total funciona de ponta a ponta pra qualquer status.

### 3. Grupos do WhatsApp não apareciam pra escolha na campanha

O seletor "Grupo ou contato avulso" (`CampaignRecipientPicker`, ver
seção 44) buscava grupos em `GET /contacts?isGroup=true` — e um grupo
só vira registro na tabela `Contacts` (`isGroup: true`) depois de
trocar pelo menos uma mensagem com aquela conexão (`verifyContact` em
`wbotMessageListener.ts`). Resultado: grupos que a conexão participa
mas nunca mandaram/receberam mensagem por ali simplesmente não
apareciam na lista — exatamente o problema relatado.

Corrigido buscando os grupos **direto do WhatsApp**, via Baileys
(`groupFetchAllParticipating()`), que traz TODOS os grupos que aquela
conexão participa, sem depender de histórico de mensagem:

- **Backend** (novo `WbotServices/ListWhatsappGroupsService.ts`): pega
  a sessão ativa da conexão (`tryGetWbot`), chama
  `wbot.groupFetchAllParticipating()` e devolve `{ number, name,
  participantsCount }` por grupo (`number` = ID numérico do grupo, sem
  `@g.us`, no formato que `ContactListItemService/AddGroupService` já
  espera).
- Nova rota `GET /whatsapp/:whatsappId/groups` (`GroupController.listAll`
  + `groupRoutes.ts`).
- **Frontend** (`CampaignRecipientPicker`): troca a chamada de
  `/contacts?isGroup=true` pra `/whatsapp/${whatsappId}/groups` — exige
  que a campanha já tenha uma conexão (WhatsApp) selecionada antes de
  abrir a aba de grupos (mostra aviso pedindo pra selecionar a conexão
  primeiro, se ainda não tiver).

### Testado

- `tsc --noEmit` limpo no backend (`UpdateService.ts`,
  `ListWhatsappGroupsService.ts`, `GroupController.ts`).
- Lint (`eslint`) limpo em `CampaignModal` e `CampaignRecipientPicker`
  (sem novos erros/avisos).
- Não testado ainda em produção com uma conexão real — pendente rebuild
  do frontend e do backend.

## 50. Atendimentos de grupo do WhatsApp não apareciam no Kanban (v2.3.67)

### Pedido do cliente

"Só aparece grupos dentro da aba atendimento e não grupos no quadro do
lado [Kanban] — em baixo de CRM/Kanban dentro do kanban fica a opção
também para arrastar o grupo caso necessite."

### Causa raiz

Quando um grupo do WhatsApp vira atendimento, o `status` do `Ticket`
não é `pending`/`open` como um atendimento normal — é um status
próprio, `"group"` (ver `FindOrCreateTicketService.ts`), usado sempre
que a conexão **não** está configurada para tratar grupo como
atendimento comum (`whatsapp.groupAsTicket !== "enabled"`, que é o
padrão). Esse status tem seu próprio filtro/aba só na tela de
Atendimento (`ListTicketsService.ts`, filtro `status === "group"`).

O Kanban (`ListTicketsServiceKanban.ts`), porém, só busca tickets com:

```ts
[Op.or]: [
  { status: { [Op.or]: ["pending", "open"] } },
  { id: { [Op.in]: kanbanTaggedTicketIds } } // já classificado antes
]
```

Como o ticket do grupo nasce com `status: "group"` e nunca tinha sido
classificado numa coluna do Kanban antes (porque nem aparecia lá pra
poder ser arrastado — problema do ovo e da galinha), ele nunca entrava
nem na lane padrão ("sem lane").

### Correção

Adicionado `"group"` na mesma condição de `pending`/`open`:

```ts
[Op.or]: [
  { status: { [Op.or]: ["pending", "open", "group"] } },
  { id: { [Op.in]: kanbanTaggedTicketIds } }
]
```

Agora o atendimento de grupo aparece na lane padrão do Kanban (igual
qualquer outro atendimento sem tag ainda) e pode ser arrastado pra
qualquer coluna — a partir daí, mesmo que o status volte a mudar, ele
continua aparecendo no board por já estar marcado com a tag do kanban
(regra que já existia antes pra atendimentos fechados).

### Nota

Se a conexão do WhatsApp estiver configurada com "tratar grupo como
atendimento" habilitado (`groupAsTicket: "enabled"`), o ticket do grupo
já nasce com status `pending` e já aparecia no Kanban normalmente —
esse fix cobre o caso (mais comum) em que essa opção está desabilitada.

### Testado

- `tsc --noEmit` limpo no backend (`ListTicketsServiceKanban.ts`).
- Não testado ainda em produção — pendente rebuild do backend.

## 51. Item "Grupos" na barra lateral (v2.3.68)

### Pedido do cliente

"Barra de opções lateral do sistema: quando habilita a opção grupos nas
permissões, ficava grupos do lado para clicar e ver todos os grupos
atrelados ao módulo atendimento — e dentro do kanban, para arrastar os
grupos para um quadro kanban." (o segundo ponto, grupo aparecer no
Kanban, foi resolvido na seção 50; esta seção cobre o item da barra
lateral.)

### Investigação no código-fonte antigo

A pedido do cliente, consultado o repositório `zappro-legado` (base
original de onde o AtendeFlow evoluiu, ver
`docs/AVALIACAO_ZAPPRO_LEGADO.md`) — especificamente
`frontend/src/layout/MainListItems.js` (o menu lateral) e
`frontend/src/pages/*` (lista de páginas). **Não existe lá** um item de
menu "Grupos" nem uma página dedicada de grupos — a única coisa
relacionada a grupos no legado (igual ao AtendeFlow atual) é a
permissão `allowGroup` do usuário, que já libera uma **aba** "Grupos"
dentro do módulo de Atendimento (`TicketsManagerTabs`, aba ao lado de
"Abertos"/"Pendentes").

Ou seja: o pedido é uma melhoria nova (atalho direto na barra lateral
pra essa aba que já existe), não a restauração de algo que existia
antes e quebrou.

### Implementação

Reaproveitando 100% a aba "Grupos" que já existe dentro do Atendimento
(sem duplicar lista/backend):

- **`frontend/src/layout/MainListItems.js`**: novo item "Grupos" (ícone
  `Group`, cor roxa `#7c3aed`), posicionado logo abaixo de "CRM /
  Kanban" — visível só quando `user.allowGroup` é verdadeiro (mesma
  permissão "Permitir grupos" do formulário de usuário, seção
  Permissões do `UserModal`). O componente interno `ListItemLink` ganhou
  suporte a um `onClick` opcional (repassado pro `ListItem` do
  Material UI, que já navega via `RouterLink` — os dois convivem sem
  conflito).
- Ao clicar, o item chama `setTabOpen("group")` (contexto
  `TicketsContext`, já usado pela aba de Grupos internamente) e navega
  pra `/tickets` — chegando lá com a aba de Grupos pré-selecionada.
- **`frontend/src/components/TicketsManagerTabs/index.js`**: pequeno
  ajuste — como a subaba "Grupos" vive dentro da aba principal
  "Abertos" (`tab === "open"`), um `useEffect` novo garante que, sempre
  que `tabOpen` vier como `"group"` (inclusive vindo de fora, do clique
  na barra lateral), a aba principal volte pra "Abertos" automaticamente
  — assim o atalho funciona mesmo se o usuário estivesse antes na aba
  "Fechados" ou "Busca".
- **i18n**: chave `mainDrawer.listItems.groups` adicionada em
  `pt.js` ("Grupos"), `en.js` ("Groups"), `es.js`/`esES.js` ("Grupos"),
  `tr.js` ("Gruplar").

### Testado

- Lint (`eslint`) limpo nos arquivos alterados (só avisos
  pré-existentes, nenhum novo).
- Não testado ainda em produção — pendente rebuild do frontend.

## 52. Bug real: id de grupo com hífen ficava corrompido (campanha não entregava) (v2.3.69)

### Relato do cliente

"Apareceu o grupo, porém mandei um teste e não chegou — os grupos que
estão nessa conexão."

### Causa raiz

O id de um grupo do WhatsApp **não é um número de telefone**. Grupos
criados há mais tempo usam o formato:

```
NNNNNNNNNN-NNNNNNNNNN@g.us
```

(dois números separados por hífen — o primeiro é um timestamp de
criação, o segundo o número de quem criou o grupo). Grupos mais novos
usam só um id longo sem hífen.

O seletor "Grupo ou contato avulso" da campanha, implementado na seção
44/49 desta sessão, tinha dois pontos que tratavam esse id como se
fosse um número de telefone comum, usando (direta ou indiretamente) a
função `digitsOf` de `CheckGroupAdmin.ts` — que existe pra extrair só
os dígitos de um número de PARTICIPANTE (ex.: `"5511999999999:12@s.whatsapp.net"`)
e por isso remove **qualquer** caractere não numérico, hífen incluso:

- `ListWhatsappGroupsService.ts` (lista os grupos direto do WhatsApp):
  usava `digitsOf(group.id)` pra montar o `number` de cada grupo.
- `AddGroupService.ts` (salva o grupo escolhido na lista de contatos):
  usava `String(data.number).replace(/\D/g, "")`.

Resultado: um grupo com id `"1234567890-1622547890@g.us"` virava
`"12345678901622547890"` — um id que **não corresponde a nenhum grupo
real**. A campanha aceitava o envio numa boa (não tem como validar um
id de grupo antes de mandar, diferente de número de pessoa), mas a
mensagem nunca chegava a lugar nenhum, porque o JID final
(`"<id>@g.us"`) montado pela fila de disparo (`queues.ts`, linha
~1518) apontava pra um grupo inexistente.

O fluxo antigo que já funcionava — grupo virar `Contact` automaticamente
ao trocar mensagem (`wbotMessageListener.ts`, função `verifyContact`) —
sempre fez isso certo, só removendo o sufixo `"@g.us"`
(`msgContact.id.replace("@g.us", "")`), sem tocar no resto do id. O bug
era exclusivo do código novo desta sessão.

### Correção

- **`ListWhatsappGroupsService.ts`**: troca `digitsOf(group.id)` por
  uma função local `groupIdFrom` que só corta o sufixo `"@g.us"`
  (`String(rawId).split("@")[0].trim()`), preservando hífen.
- **`AddGroupService.ts`**: troca `.replace(/\D/g, "")` por
  `.split("@")[0].trim().replace(/[^0-9-]/g, "")` — sanitiza (tira
  espaço, corta `@g.us` se vier por engano) sem remover o hífen.

### Atenção — dado já salvo errado não se corrige sozinho

Um grupo adicionado numa lista de contatos (via seletor da campanha)
**antes** desse fix ficou com o id errado gravado no banco
(`ContactListItems.number`). É preciso excluir esse item e adicionar o
grupo de novo pelo seletor "Grupo ou contato avulso" depois do rebuild,
pra pegar o id certo.

### Testado

- `tsc --noEmit` limpo no backend (`ListWhatsappGroupsService.ts`,
  `AddGroupService.ts`).
- Não testado ainda em produção — pendente rebuild do backend.

## 53. Bug grave: número BR de 12 dígitos era testado (e aceito) antes do certo (v2.3.70)

### Como foi descoberto

Cliente relatou que campanhas simplesmente pararam de entregar — nem
pra contato individual, nem pra lista, nem pra grupo. Investigação
direta no banco de uma lista real importada (96 contatos, "Clientes
Inadimplentes"):

```
 tam | isWhatsappValid | count
-----+-----------------+-------
  12 | f               |     2
  12 | t               |    89   <- BUG: 12 dígitos = sem o 9º dígito
  13 | f               |     5
```

**89 de 96 contatos** (quase todos) tinham número de **12 dígitos**
(DDI+DDD+8 dígitos, sem o 9º dígito do celular) e estavam marcados
como `isWhatsappValid = true`. Ou seja: o sistema aceitava como válido
exatamente o formato que a correção da v2.3.63 deveria ter impedido.

### Causa raiz

Em `CheckNumber.ts`, a função `buildCandidates` montava a lista de
candidatos a testar contra o WhatsApp assim:

```ts
// ANTES (bug)
push(normalizeCampaignContactNumber(digits) || null); // <- SEMPRE primeiro
if (digits.startsWith("55") && digits.length === 12) {
  push(addBrVariant(digits)); // 13 dígitos, só depois
  push(digits);
}
```

O comentário do código dizia "a forma completa (com 9) SEMPRE é
testada antes da incompleta" — mas isso só valia pros candidatos
adicionados a partir da segunda linha. O **primeiro** candidato,
`normalizeCampaignContactNumber(digits)`, é chamado com o número
**sem o `+`** — e olhando `normalizeCampaignContactNumber.ts`:

```ts
const parsed = parsePhoneNumberFromString(forParsing, hasExplicitCountry ? undefined : "BR");
if (parsed && parsed.isValid()) {
  return parsed.number.replace(/^\+/, "");
}
// ...
// Fallback: número que a lib não conseguiu validar
let digits = trimmed.replace(/\D/g, "");
if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
return digits; // <- devolve o MESMO número de 12 dígitos, sem tocar
```

Passado sem `+`, a `libphonenumber-js` trata o número como um número
**nacional** dentro do Brasil (não reconhece os 2 primeiros dígitos
como DDI) e não consegue validar — cai no fallback, que só sabe tratar
os casos de 10/11 dígitos (sem DDI); um número de **12 dígitos** volta
exatamente como entrou, **sem adicionar o 9º dígito**.

Resultado: o candidato de 12 dígitos (errado) virava sempre o
**primeiro** a ser testado contra o WhatsApp — e o WhatsApp, por
tolerância do próprio servidor, às vezes responde `exists: true` pra
essa forma incompleta (comportamento já documentado na seção 46). O
sistema aceitava esse primeiro resultado e nunca chegava a testar a
forma de 13 dígitos (correta), que ficava depois na lista.

### Correção

Removida a chamada solta a `normalizeCampaignContactNumber` do topo da
função. Ela só é usada agora dentro do `else` final (números que **não**
são BR de 10-13 dígitos — ou seja, DDI de outro país), onde já fazia
sentido e não atrapalhava a ordem. Pros três casos brasileiros (12
dígitos, 13 dígitos, sem DDI) a ordem de candidatos agora é exatamente
a que os comentários sempre descreveram: forma completa (com o 9)
**sempre** testada primeiro.

### Ferramenta nova: "Revalidar números" (corrige listas já importadas)

Esse bug não se corrige sozinho pra quem já foi importado antes do
fix — o `number`/`isWhatsappValid` já estão errados, gravados. Em vez
de pedir pra reimportar a planilha inteira (perdendo `extraData` e
duplicando o trabalho), foi criada uma ação nova:

- **Backend**: `ContactListItemService/RevalidateNumbersService.ts` —
  percorre todos os itens (não-grupo) de uma lista e chama de novo
  `CheckContactNumber` (agora com a ordem corrigida) pra cada um,
  atualizando `number`/`isWhatsappValid` conforme o resultado real.
  Rota `POST /contact-lists/:id/revalidate-numbers`
  (`ContactListController.revalidateNumbers`).
- **Frontend**: botão "Revalidar números" na tela de contatos de uma
  lista (`ContactListItems`), ao lado de "Importar Arquivo" — mostra
  um resumo ao final (quantos foram corrigidos, quantos já estavam
  certos, quantos inválidos).

Esse botão precisa ser usado manualmente em qualquer lista que já
existia antes dessa correção (ex.: a lista "Clientes Inadimplentes" do
relato, e qualquer outra importada antes da v2.3.70).

### Testado

- `tsc --noEmit` limpo no backend (`CheckNumber.ts`,
  `RevalidateNumbersService.ts`, `ContactListController.ts`).
- Lint (`eslint`) limpo no frontend (`ContactListItems/index.js`), só
  avisos pré-existentes.
- Não testado ainda em produção — pendente rebuild do backend e do
  frontend, e rodar "Revalidar números" na lista já importada.

## 54. Tags usadas como coluna do Kanban não apareciam na campanha (v2.3.71)

### Relato do cliente

"Filiados inadimplentes tenho essa tag adicionada e no kanban, quando
vai fazer nova campanha e vai adicionar a tag, não aparece Filiados
inadimplentes."

### Causa raiz

O campo `Tag.kanban` marca se uma tag é usada como **coluna do
quadro Kanban** (`kanban: 1`) ou é uma tag "normal" (`kanban: 0`),
usada em outros lugares do sistema (etiqueta de contato, filtro de
ticket, etc.). `CampaignModal` buscava as tags disponíveis pra
segmentar a campanha assim:

```js
api.get(`/tags/list`, { params: { companyId, kanban: 0 } })
```

Ou seja, só trazia tags **não**-Kanban. Uma tag criada como coluna do
board (como "Filiados inadimplentes") nunca aparecia na lista, mesmo
já tendo contatos — o que contraria o próprio propósito documentado do
Kanban (seção 50): "o board é usado pra segmentação/triagem de
clientes (ex.: disparo de campanha só pra quem está na coluna
'Inadimplentes')".

### Correção

`CampaignModal` agora busca as duas categorias em paralelo e junta o
resultado:

```js
Promise.all([
  api.get(`/tags/list`, { params: { companyId, kanban: 0 } }),
  api.get(`/tags/list`, { params: { companyId, kanban: 1 } })
]).then(([normalTagsRes, kanbanTagsRes]) => {
  const fetchedTags = [...normalTagsRes.data, ...kanbanTagsRes.data];
  // ...
});
```

Não foi alterado o comportamento padrão da API `/tags/list`
(`TagServices/SimpleListService.ts`), porque outros componentes (ex.:
`TagsFilter`) dependem de chamar essa rota sem o parâmetro `kanban` —
mudar o default ali afetaria esses outros lugares sem necessidade.

### Testado

- Lint (`eslint`) limpo em `CampaignModal/index.js` (só avisos
  pré-existentes).
- Não testado ainda em produção — pendente rebuild do frontend.

## 55. Tag do Kanban ainda não aparecia na campanha — 0 contatos associados (v2.3.72)

### Investigação

Depois do fix da seção 54, o cliente ainda não via "Filiados
Inadimplentes" na campanha. Consulta direta no banco:

```
 id |         name           | kanban | total_contatos
----+-------------------------+--------+----------------
  6 | Filiados Inadimplentes  |      1 |              0
 13 | Filiados inadimplentes  |      0 |              0
```

A tag existe, está corretamente marcada como `kanban=1`, mas tem
**zero contatos** associados — mesmo já tendo vários tickets na coluna
do board (confirmado por print da tela: só apareciam na campanha as
tags que já tinham contato de verdade, como "Atendimento Finalizado
(10)").

### Causa raiz

Duas relações diferentes no banco:

- **`TicketTag`** (tag ↔ ticket): é o que o Kanban usa. Arrastar um
  ticket pra uma coluna chama `PUT /ticket-tags/:ticketId/:tagId`
  (`TicketTagController.store`), que só cria um registro em
  `TicketTag`.
- **`ContactTag`** (tag ↔ contato): é o que a campanha usa pra listar
  tags disponíveis e seus contatos (`TagServices/SimpleListService.ts`,
  `include: [{ model: Contact, as: "contacts" }]`).

Uma tag do Kanban nunca ganhava um `ContactTag` correspondente — por
isso, mesmo com tickets nela, `contacts.length` sempre ficava em 0 e a
tag nunca aparecia disponível pra campanha.

### Correção

`TicketTagController.store` agora, depois de criar o `TicketTag`,
também garante (`findOrCreate`) o `ContactTag` correspondente (mesmo
`tagId`, contato do ticket):

```ts
if (ticket?.contactId) {
  await ContactTag.findOrCreate({
    where: { contactId: ticket.contactId, tagId: Number(tagId) }
  });
}
```

Daqui pra frente, toda vez que um ticket é arrastado pra uma coluna do
Kanban, o contato dele também fica marcado com aquela tag — passando a
aparecer certinho na campanha.

Por decisão de design, a tag **não é removida** do contato quando o
ticket sai da coluna (`TicketTagController.remove` não mexe em
`ContactTag`) — evita perder segmentação de campanha por causa de uma
mudança de status do atendimento; quem quiser desmarcar o contato faz
isso manualmente na tela de Contatos.

### Correção retroativa (tickets que já estavam na coluna antes do fix)

Esse fix só vale pra movimentações **novas**. Pra sincronizar o que já
existe (tickets que já estavam numa coluna do Kanban antes da v2.3.72),
rodar direto no Postgres:

```sql
INSERT INTO "ContactTags" ("contactId", "tagId", "createdAt", "updatedAt")
SELECT DISTINCT t."contactId", tt."tagId", NOW(), NOW()
FROM "TicketTags" tt
JOIN "Tickets" t ON t.id = tt."ticketId"
WHERE NOT EXISTS (
  SELECT 1 FROM "ContactTags" ct
  WHERE ct."contactId" = t."contactId" AND ct."tagId" = tt."tagId"
);
```

### Testado

- `tsc --noEmit` limpo no backend (`TicketTagController.ts`).
- Não testado ainda em produção — pendente rebuild do backend e rodar
  a query de correção retroativa.

## 56. Aba "Grupos" vazia mesmo com a conexão participando de grupos (v2.3.73)

### Relato do cliente + investigação

"A tela grupos, quando loga via WhatsApp, tem que mostrar os grupos
vinculados nela e não mostra; por isso quando faz uma campanha pra
grupos não vai poder fazer, pois não reconhece grupos na conexão."

Print da aba "Grupos" (dentro de Atendimento) mostrando "Nada aqui!
Nenhum atendimento encontrado". Consulta direto no banco:

```
 id |      name       | allowGroup | groupAsTicket |  status
----+------------------+------------+---------------+-----------
  4 | faderacaobaiana  | f          | disabled      | CONNECTED
```

### Causa raiz nº 1 — `Whatsapp.allowGroup` desabilitado

Existe um campo de configuração **por conexão** chamado "Permitir
grupos" (`Whatsapp.allowGroup`, editável no formulário de edição da
conexão) — diferente da permissão "Permitir grupos" do **usuário**
(`User.allowGroup`, seção 51) que só controla a aba dentro do
Atendimento. Em `wbotMessageListener.ts`:

```ts
if (!whatsapp.allowGroup && isGroup) {
  logger.info(`[GROUP] Mensagem de grupo ignorada (allowGroup=false)...`);
  return; // descarta a mensagem inteira, nem chega a criar Contact/Ticket
}
```

Com `allowGroup=false` na conexão, **toda mensagem de grupo recebida é
descartada antes mesmo de gerar Contact/Ticket** — por isso a aba
Grupos nunca teve nada pra mostrar, mesmo o grupo mandando mensagem de
verdade. **Ação necessária do cliente**: em Conexões → editar a
conexão → habilitar "Permitir grupos".

### Causa raiz nº 2 — sem descoberta proativa de grupos

Mesmo com `allowGroup=true`, a aba Grupos só preenche **depois** que
alguém manda uma mensagem no grupo (reativo) — não existia nenhuma
forma de "descobrir" de uma vez todos os grupos que a conexão já
participa (como o seletor de campanha já faz desde a seção 49, via
Baileys `groupFetchAllParticipating`).

### Correção: botão "Sincronizar grupos"

- **Backend**: novo `WbotServices/SyncWhatsappGroupsService.ts` —
  busca todos os grupos da conexão (`groupFetchAllParticipating`) e,
  pra cada um, chama `CreateOrUpdateContactService` (garante o
  Contact, `isGroup: true`) e `FindOrCreateTicketService` (garante o
  Ticket, seguindo a mesma regra de status já documentada — `"group"`
  quando `groupAsTicket` está desabilitado, `"pending"` quando
  habilitado). Recusa rodar se `whatsapp.allowGroup` estiver
  desabilitado (mensagem orientando a habilitar primeiro). Rota
  `POST /whatsapp/:whatsappId/groups/sync`
  (`GroupController.sync`).
- **Frontend**: botão "Sincronizar grupos" (ícone de grupo) na tela de
  Conexões, ao lado de "Migrar mensagens" — só aparece pra conexão
  Baileys/wuzAPI (não Meta/API Oficial) com "Permitir grupos" ativo, e
  fica desabilitado se a conexão não estiver `CONNECTED`.

Depois de rodar essa sincronização (com `allowGroup` já habilitado), os
grupos passam a aparecer na aba Grupos do Atendimento, no Kanban (seção
50) e no seletor de destinatário da campanha (seção 44/49) — os três
lugares passam a enxergar os mesmos grupos, resolvendo a relação entre
eles que o cliente apontou.

### Testado

- `tsc --noEmit` limpo no backend (`SyncWhatsappGroupsService.ts`,
  `GroupController.ts`).
- Lint (`eslint`) limpo no frontend (`Connections/index.js`), sem
  nenhum aviso novo.
- Não testado ainda em produção — pendente rebuild do backend e do
  frontend, habilitar "Permitir grupos" na conexão e rodar a
  sincronização.

## 57. Lista de Contatos vira o único lugar de onde toda lista nasce (v2.3.74)

### Pedido do cliente

"Em campanhas → lista de contatos → criar nova lista, colocar a opção
importar contatos de grupos, selecionar 1 ou mais grupos ou todos os
grupos; quando selecionar, mostre carregando os números, no painel de
gerência dos números tenha opção de adicionar número ou retirar depois
de montada a lista. Tem mais essa opção de adicionar ou remover algum
contato. Deixar esse módulo gerenciável, que a partir dele se crie
todas as listas de contatos — individual, coletivo por listagem em
arquivo padrão do sistema já implantado, ou por grupos. Depois de
criadas as listas, na parte 'Nova Campanha' não precisa mais colocar
grupos ou contatos avulsos, pois essa opção é exclusiva de Lista de
Contatos — já definidas todas as listas antes."

Confirmado por perguntas de esclarecimento antes de implementar:
"importar de grupos" cobre os dois modos (participantes OU o grupo em
si — escolha na hora), e selecionando vários grupos de uma vez o
resultado é **uma lista só**, sem duplicar quem está em mais de um
grupo.

### Mudança de arquitetura

Antes desta etapa, existiam **dois** lugares que criavam destinatário
de campanha:

1. Lista de Contatos (manual, por arquivo) — já existia.
2. Dentro do formulário de Nova Campanha, o botão "Grupo ou contato
   avulso" (`CampaignRecipientPicker`, seções 44/49), que criava uma
   lista "guarda-chuva" reaproveitada (`GetOrCreateQuickListService`)
   por baixo dos panos.

Agora só existe **um**: Lista de Contatos. A campanha voltou a só
escolher entre listas já prontas (`contactListId`), sem nenhuma forma
de criar destinatário "no meio do caminho".

### 1. Menu "Adicionar nova lista" (`ContactLists/index.js`)

O botão virou um `Menu` com 4 opções:

- **Lista vazia** — mesmo fluxo de sempre (`ContactListDialog`, só
  pede o nome).
- **Anexar arquivo** — antes exigia 2 passos (criar a lista vazia,
  depois ir na linha da tabela clicar em "Importar Arquivo"). Agora é
  1 fluxo guiado: abre o mesmo `ContactListDialog` (pede o nome), e ao
  salvar (novo callback `onSaved` no `ContactListDialog`, opcional,
  não quebra quem já usava o componente sem ele), abre automaticamente
  o `ImportFileContactsModal` apontando pra lista recém-criada.
- **Importar de grupos** (novo) — abre `ImportGroupContactsModal`.
- **Contato avulso** (novo) — abre `AddSingleContactListModal`.

### 2. `ImportGroupContactsModal` (novo componente)

Formulário com: nome da lista, `Select` de conexão (`GET /whatsapp`),
`RadioGroup` "Participantes dos grupos" vs "Os grupos como
destinatário", lista de checkboxes dos grupos da conexão escolhida
(reaproveita `GET /whatsapp/:id/groups`, já existente desde a seção
44) com opção "Selecionar todos". Ao confirmar, chama
`POST /contact-lists/import-groups` e mostra o resumo (quantos
importados/repetidos/sem número identificável).

### 3. `AddSingleContactListModal` (novo componente)

Formulário simples: nome da lista + nome do contato (opcional) +
número. Cria a `ContactList` (`POST /contact-lists`) e o item
(`POST /contact-list-items`) em sequência — reaproveita as mesmas rotas
já existentes, só que criando uma lista nova por vez, em vez daquela
lista guarda-chuva compartilhada de antes.

### 4. Backend — `ImportGroupContactsService.ts` (novo)

Recebe `whatsappId`, `groupIds[]`, `mode` (`"participants"` |
`"groups"`) e `name`. Sempre cria uma `ContactList` nova primeiro.

- **`mode: "groups"`**: pra cada grupo, busca o nome
  (`wbot.groupMetadata`) e cria um `ContactListItem` com
  `isGroup: true` (mesma lógica que já existia no extinto
  `AddGroupService` — id do grupo tratado como texto, nunca com
  `replace(/\D/g, "")`, pra não repetir o bug da seção 52 com grupos
  de id com hífen).
- **`mode: "participants"`**: pra cada grupo, busca
  `wbot.groupMetadata(...).participants` e extrai o número de cada
  um. Participante endereçado por `@lid` (sem número exposto
  diretamente) tenta resolver via `Contact.lid` já salvo na empresa;
  se não conseguir, conta como "não identificado" e segue (não
  quebra a importação). Usa um `Set` pra nunca duplicar o mesmo
  número entre grupos diferentes selecionados junto.
- Retorna `{ contactList, totalGroups, imported, duplicates,
  unresolved }`.

Rota: `POST /contact-lists/import-groups`
(`ContactListController.importGroups`).

### 5. Removido: seletor de grupo/avulso de dentro da campanha

- `frontend/src/components/CampaignRecipientPicker/` — componente
  inteiro removido (nenhum outro lugar do código importava mais ele).
- `CampaignModal/index.js` — removida a renderização e o import do
  `CampaignRecipientPicker`.
- Backend: `GetOrCreateQuickListService.ts` e `AddGroupService.ts`
  removidos, junto das rotas que só existiam pra eles
  (`GET /contact-lists/quick-list`, `POST /contact-list-items/group`)
  e das actions correspondentes nos controllers — nenhum consumidor
  restante depois da remoção do picker.

### Testado

- `tsc --noEmit` limpo no backend (`ImportGroupContactsService.ts`,
  `ContactListController.ts`, `ContactListItemController.ts`, rotas).
- Lint (`eslint`) limpo nos arquivos de frontend alterados/criados
  (`ContactLists`, `ImportGroupContactsModal`,
  `AddSingleContactListModal`, `ContactListDialog`, `CampaignModal`) —
  só os mesmos avisos pré-existentes de sempre, nenhum novo.
- Não testado ainda em produção — pendente rebuild do backend e do
  frontend.

## 58. Bug grave: campanha ignorava a lista/grupo e mandava pra uma tag (v2.3.75)

### Relato do cliente

"Fiz um teste, criei um envio teste para um grupo interno — foi pra um
contato que não tem nada a ver com o grupo. Coloquei a tag como
fornecedor e direcionou a mensagem para o fornecedor e não para o
grupo. Estou no Paraguai e o grupo é do Brasil."

### Causa raiz

`CampaignController.ts`, na criação da campanha (`store`):

```ts
// ANTES (bug)
if (typeof data.tagListId === 'number') {
  // ... sempre cria uma ContactList nova a partir da TAG e a usa,
  // mesmo que data.contactListId já tivesse um valor (o grupo/lista
  // escolhida pelo usuário) — o contactListId enviado no body é
  // completamente ignorado nesse caso.
}
```

O formulário (`CampaignModal`) tem dois campos independentes — "Lista
de Contato" e "Tag" — e **nenhum dos dois limpava o outro** ao ser
selecionado. Bastava o campo Tag ter ficado com um valor de uma
tentativa anterior (ex.: o cliente testou por tag antes de decidir
usar o grupo) pra que, na hora de salvar, o backend ignorasse
silenciosamente a lista/grupo escolhida e mandasse a campanha pros
contatos daquela tag — sem nenhum aviso na tela de que isso aconteceria.

### Correção

- **Frontend** (`CampaignModal/index.js`): os dois `Select` (Lista de
  Contato e Tag) ganharam `onChange` customizado — escolher um limpa o
  outro (`setFieldValue` do campo oposto pra `""`), tornando os dois
  campos mutuamente exclusivos na prática, não só na intenção.
- **Backend** (`CampaignController.ts`): a condição passou a exigir
  também que `contactListId` esteja vazio —
  `if (typeof data.tagListId === 'number' && !data.contactListId)` —
  então mesmo que um valor de tag chegue por engano (ex.: uma
  requisição feita fora do formulário padrão), a Lista de
  Contato/grupo já escolhida tem prioridade e nunca é substituída
  silenciosamente.

### Testado

- `tsc --noEmit` limpo no backend (`CampaignController.ts`).
- Lint (`eslint`) limpo em `CampaignModal/index.js` (só os mesmos
  avisos pré-existentes de sempre).
- Não testado ainda em produção — pendente rebuild do backend e do
  frontend.

## 59. Investigação: "Importar de grupos → Participantes" trouxe contato errado (v2.3.76)

### Relato do cliente

Testou "Importar de grupos" → "Participantes dos grupos" selecionando
o "Grupo Administração" (7 membros reais). A lista criada
(`ContactList` id=14) ficou com **1 único contato**: "Joao Paulo"
(`5511934976190`) — um fornecedor de móveis de escritório, sem
nenhuma relação com o grupo.

### Hipótese descartada

A primeira hipótese foi que a resolução de participantes endereçados
por `@lid` (`ImportGroupContactsService.ts`, bloco que tenta casar o
`@lid` do participante contra `Contact.lid` já salvo na empresa)
estava batendo no `Contact` errado. Uma consulta SQL na própria
`Contacts` do "Joao Paulo" mostrou a coluna `lid` **vazia**:

```
id    | name        | number         | lid | jid
11374 | Joao Paulo  | 5511934976190  |     | 5511934976190@s.whatsapp.net
```

Como o `WHERE lid = '<algo>@lid'` não bate contra uma coluna vazia,
essa hipótese foi descartada — o mecanismo real ainda não estava
identificado.

### Diagnóstico adicionado (sem mudar comportamento)

`ImportGroupContactsService.ts` ganhou logs (`logger.warn`) para o
próximo teste revelar o mecanismo real, sem alterar nenhuma regra de
negócio:

- Por grupo selecionado: nome do grupo, id completo (`...@g.us`) e a
  lista crua de participantes que o `wbot.groupMetadata()` devolveu
  (`id`, `jid`, `lid`, `admin` de cada um).
- Por participante: o `rawId` usado, se foi tratado como `@lid`, e o
  `numberDigits` final resolvido (ou vazio, se ficou "sem número
  identificável").

Esses logs vão para o log do container do backend (mesmo destino dos
demais `logger.warn`/`logger.error` já usados no projeto) e permitem
ver, no próximo teste, se:

- o `groupMetadata()` realmente devolveu os 7 membros certos (e o bug
  está em como um deles foi resolvido), ou
- devolveu poucos participantes / participantes de outro grupo (bug
  de id de grupo trocado — ver a seção 52, sobre hífen no id de grupo,
  como precedente de bug nesse mesmo formato de id), ou
- o "Joao Paulo" realmente veio como participante direto (não `@lid`)
  nos dados crus do WhatsApp para esse grupo — o que empurraria a
  investigação pro lado do próprio Baileys/conta do WhatsApp, e não
  pro código deste projeto.

### Status

**Resolvido — ver seção 60.**

## 60. Causa raiz e correção: número errado ao importar participantes de grupo por `@lid` (v2.3.77)

### O que o reteste mostrou

Reproduzindo pelo caminho certo (Lista de Contatos → Adicionar nova
lista → Importar de grupos → Participantes → Grupo Administração, um
grupo com 7 membros reais), a lista criada trouxe **4 contatos, com
números diferentes dos 7 membros reais do grupo**. Isso descartou de
vez a suspeita de "grupo errado" ou "dado stale de uma lista
duplicada" (seção 59) — o código realmente rodava e realmente
resolvia número errado.

### Causa raiz

O tipo `GroupParticipant` do Baileys (`node_modules/baileys/lib/Types/Contact.d.ts`)
tem **três campos de identidade separados** por participante:

```ts
export interface Contact {
  /** ID either in lid or jid format (preferred) **/
  id: string;
  /** ID in LID format (@lid) **/
  lid?: string;
  /** ID in PN format (@s.whatsapp.net)  **/
  phoneNumber?: string;
  ...
}
```

Em grupos que usam `addressingMode: "lid"` (modo de privacidade do
WhatsApp, que evita expor o número de telefone real dos membros pros
outros participantes), o campo `id`/`jid` do participante vem como
`...@lid` — um identificador que **não tem nenhuma relação numérica
com o telefone real** da pessoa. O Baileys já expõe o número de
telefone verdadeiro, pronto pra uso, no campo `phoneNumber` do próprio
participante.

O código de `ImportGroupContactsService.ts` (v2.3.74/v2.3.76) nunca
olhava pra `phoneNumber`. Para participantes `@lid`, ele tentava
"adivinhar" o número batendo o LID contra a coluna `lid` já salva nos
`Contacts` da empresa (`Contact.findOne({ where: { lid: lidKey } })`)
— um match que pode perfeitamente cair num contato completamente sem
relação com o grupo, porque LID não é derivado do número de telefone,
é só um identificador opaco. Foi exatamente isso que aconteceu nos
dois testes do cliente: primeiro trouxe 1 contato errado ("Joao
Paulo", um fornecedor), depois 4 contatos com números diferentes dos
membros reais do grupo.

### Correção

`ImportGroupContactsService.ts`: removida por completo a tentativa de
resolver `@lid` via banco de dados (`Contact.findOne`). Agora, quando
o participante é `@lid`, o número vem direto do campo `phoneNumber`
que o próprio `wbot.groupMetadata()` já devolve:

```ts
// ANTES (bug) — adivinhava batendo o LID contra o banco
if (!numberDigits && isLid) {
  const matchedContact = await Contact.findOne({
    where: { companyId, lid: rawId.toLowerCase() }
  });
  if (matchedContact?.number) numberDigits = digitsOf(matchedContact.number);
}

// DEPOIS (correto) — usa o número que o Baileys já expõe
const numberDigits = isLid
  ? digitsOf(String(participant?.phoneNumber || ""))
  : digitsOf(rawId);
```

Quando o WhatsApp não expõe o `phoneNumber` de um participante `@lid`
pra essa conexão (pode acontecer — é o próprio ponto do modo de
privacidade), o participante fica em "sem número identificável"
(contado em `unresolved`) em vez de ser adivinhado errado — mais
seguro entregar menos contatos do que entregar um número errado numa
campanha.

Os logs de diagnóstico da seção 59 foram mantidos (agora também
mostrando o `phoneNumber` cru de cada participante), úteis pra
confirmar em produção que a resolução está batendo certo.

### Testado

- `tsc --noEmit` limpo no backend.
- **Confirmado pelo cliente em produção**: mandou uma campanha de
  teste pro Grupo Administração inteiro (usando uma lista nova,
  importada do zero pelo fluxo correto) e a mensagem chegou nos
  membros reais do grupo.

## 61. Bug real: editar qualquer tag no ticket apagava a tag-coluna do Kanban do contato (v2.3.78)

### Relato do cliente

Além do bug de importação de grupos, o cliente notou que tags usadas
como coluna do Kanban ("Fornecedor", "Inadimplente") voltaram a sumir
do campo "Tags" de Nova Campanha — o mesmo sintoma das seções 54/55,
mesmo depois daquela correção (que ensinou o Kanban a também gravar em
`ContactTag`) e do backfill retroativo já terem sido aplicados.

### Causa raiz

Uma segunda via, além do drag-and-drop do Kanban, também escreve em
`ContactTag`: o widget de tags do cabeçalho do ticket
(`TagsContainer/index.js`), usado pra adicionar/remover tag de um
contato durante o atendimento. Só que esse widget:

- Busca as opções de tag só com `kanban: 0` (`GET /tags/list?kanban=0`)
  — ele nem sabe que tags-coluna do Kanban existem.
- Ao mudar qualquer seleção (adicionar ou remover qualquer tag, mesmo
  uma sem nada a ver com o Kanban), chama `POST /tags/sync` mandando a
  lista inteira de tags selecionadas.
- `SyncTagsService.ts` fazia um "replace total": apagava **todas** as
  linhas de `ContactTag` daquele contato e recriava só a partir do que
  foi mandado. Como a lista mandada nunca inclui tags-coluna do
  Kanban (o widget não as conhece), qualquer edição de tag no
  cabeçalho do ticket apagava de vez a marcação Kanban do contato pra
  fins de campanha — sem ninguém ter tirado a tag do Kanban.

### Correção

`SyncTagsService.ts`: o "replace" agora é escopado só às tags normais
(`kanban: 0`) — busca os ids das tags `kanban: 1` da empresa do
contato e:

- Apaga só as linhas de `ContactTag` cujo `tagId` **não** está nessa
  lista (preserva as tags-coluna do Kanban, sejam quais forem).
- Recria só a partir das tags mandadas que também não estão nessa
  lista (evita recriar uma tag-coluna que por acaso viesse no payload,
  já que ela não foi apagada).

Assim o widget de tags do ticket continua gerindo só as tags normais,
igual sempre foi a intenção dele, e nunca mais mexe na marcação feita
pelo Kanban.

### Testado

- `tsc --noEmit` limpo no backend.
- Pendente: reteste do cliente — editar uma tag normal num ticket cujo
  contato também tem tag-coluna do Kanban, e confirmar que ela
  continua aparecendo em Nova Campanha depois.

## 62. Bug real: ticket de grupo voltava pra "Aguardando" quando alguém respondia (v2.3.79)

### Relato do cliente

"Quando qualquer usuário falar em algum grupo não é pra ficar no
status aguardando atendimento, é pra deixar só na aba Grupos mesmo —
mesmo que qualquer um responda não é pra mudar pro status aguardando."

### Causa raiz

Um ticket de grupo usa o status `"group"` pra ficar só na aba Grupos
(ver seção 50). Só que existiam **4 lugares** no backend que, ao
reabrir um ticket **fechado** por causa de uma nova mensagem chegando,
forçavam o status pra `"pending"` (aba Aguardando) sem checar se o
ticket era de grupo:

- `wbotMessageListener.ts`, três ocorrências do padrão
  `if (!msg.key.fromMe && ticket.status === "closed") { ... status:
  "pending" ... }` — usadas em pontos diferentes do fluxo de
  recebimento de mensagem (mídia, texto, flowbuilder).
- Uma dessas três ainda tinha uma segunda escrita logo depois, via
  `UpdateTicketService({ ticketData: { status: "pending", ... } })`,
  que reforçava o "pending" mesmo se a primeira escrita tivesse sido
  corrigida.
- `FindOrCreateTicketService.ts`: o bloco que reaproveita um ticket
  **recente** (dentro da janela de "tempo pra criar novo ticket" da
  conexão) também forçava `status: "pending"` incondicionalmente.

Ou seja: bastava um grupo ter o ticket fechado (ex.: atendente
encerrou) e qualquer participante mandar uma mensagem nova pra ele
"vazar" pra aba Aguardando, misturando com o atendimento normal — só
não acontecia enquanto o ticket já estivesse aberto/pendente/em
"group" (o fluxo principal de match de ticket existente, que não mexe
no status, já preservava isso corretamente).

### Correção

Nos 4 pontos, o status de reabertura passou a depender de
`ticket.isGroup`:

```ts
// ANTES (bug)
await ticket.update({ status: "pending" });

// DEPOIS (correto)
await ticket.update({ status: ticket.isGroup ? "group" : "pending" });
```

Com isso, um ticket de grupo fechado sempre reabre como `"group"`
(aba Grupos), nunca como `"pending"`, não importa quem do grupo
mandou a mensagem.

### Testado

- `tsc --noEmit` limpo no backend.
- Pendente: reteste do cliente — fechar um ticket de grupo, mandar uma
  mensagem nova nele (de qualquer participante) e confirmar que ele
  volta pra aba Grupos, não pra Aguardando.

## 63. Continuação da seção 62: mais 3 pontos do backend forçavam "pending" num ticket de grupo (v2.3.80)

### Relato do cliente

Mesmo depois da correção da seção 62, o cliente testou de novo e o
ticket de grupo caiu na aba Atendendo, exigindo selecionar uma fila
pra aceitar — confirmado que a conexão usada tinha "Tratar grupos como
ticket" **desabilitada** (comportamento padrão, então não é isso).
Pediu: grupo é só pra mandar mensagem, responder e disparo em massa,
ficando sempre no módulo Grupos, sem NENHUMA troca de status, pra
qualquer usuário habilitado a responder grupos.

### Causa raiz

A seção 62 corrigiu 4 pontos, mas existia outro handler de mensagem
inteiramente separado (usado no fluxo principal atual de recebimento
de mensagem) com a mesma lógica de reabrir ticket fechado, também sem
checar grupo:

- `wbotMessageListener.ts`: bloco
  `if (ticket.status === "closed" && !msg.key.fromMe) { ... status:
  "pending" ... }`, dentro do handler principal de mensagem recebida
  (`reopenedFromClosed`) — esse é o caminho realmente percorrido pela
  conexão testada, diferente dos 3 já corrigidos na seção 62.

Além dele, mais dois pontos "de segurança" (menos prováveis de bater,
mas na mesma categoria) também foram corrigidos preventivamente:

- `FindOrCreateTicketService.ts`: bloco de fallback quando dois
  processos tentam criar o mesmo ticket ao mesmo tempo (conflito de
  chave única lid/jid) também forçava `"pending"`.
- `UpdateTicketService.ts`: a regra "transferência sem atendente
  definido → força pending" (`isTransfered && !userId`) também não
  checava grupo — usada tanto por transferência manual quanto por
  fluxos de chatbot/flowbuilder que transferem pra fila.

### Correção

Mesma regra nos 3 pontos: o status de reabertura/transferência passa
a depender de `ticket.isGroup` (buscado do banco quando o objeto
`ticket` ainda não estava carregado no escopo, como no
`UpdateTicketService`), nunca mais `"pending"` fixo.

Com os 4 pontos da seção 62 somados a esses 3, todos os lugares do
backend que reabrem/transferem um ticket já existente respeitam
`isGroup` — grupo nunca mais deveria "vazar" pra Aguardando/Atendendo,
não importa por qual caminho a mensagem chegou.

### Testado

- `tsc --noEmit` limpo no backend.
- Pendente: reteste do cliente no cenário exato que falhou (grupo com
  ticket fechado recebendo mensagem de um participante) confirmando
  que fica só na aba Grupos, sem pedir fila.

## 64. Bug real: mensagem de grupo aparecia no sino "Mensagens e Alertas" (v2.3.81)

### Relato do cliente

"Quando recebe mensagens de grupo não é pra ficar registrado em
Mensagens e Alertas — nenhum grupo, os existentes ou os novos que por
ventura façam parte, não se deve ficar registrado no campo mensagens e
alertas."

### Causa raiz

O sino de notificações (`NotificationsPopOver/index.js`) monta a lista
que aparece nas abas "Mensagens" (ícone de chat) e "Alertas" (ícone de
sino) a partir de um único estado (`notifications`), preenchido de
duas formas:

- Na carga inicial/atualização periódica: `[...tickets,
  ...pendingTickets].filter(canAccessTicket)` — os hooks `useTickets`
  que alimentam `tickets`/`pendingTickets` não excluíam ticket de
  grupo.
- Em tempo real, via socket (`onCompanyAppMessageNotificationsPopover`):
  a condição só bloqueava grupo quando `showGroupNotification` (um
  estado que já nasce `false`, mas é alterável) estivesse desligado —
  ou seja, dependia de uma configuração, não era uma regra fixa.

### Correção

Os dois pontos passaram a excluir `ticket.isGroup` de forma
incondicional, sem depender de nenhuma configuração:

- `[...tickets, ...pendingTickets].filter(ticket =>
  !ticket.isGroup).filter(canAccessTicket)` na montagem inicial.
- A condição do socket ganhou `!data.ticket?.isGroup` obrigatório —
  removida a exceção que deixava passar quando
  `showGroupNotification === true`. Como consequência, mensagem de
  grupo também não toca mais som nem gera notificação de
  desktop por esse caminho (o handler inteiro passa a ignorar
  mensagens de grupo).

Grupo continua tendo sua própria notificação/contador dentro do módulo
Grupos (isso não foi tocado) — só deixou de aparecer no sino geral de
Mensagens/Alertas, que é compartilhado com o atendimento normal.

### Testado

- `eslint` limpo em `NotificationsPopOver/index.js` (só os mesmos
  avisos pré-existentes de sempre).
- Pendente: reteste do cliente — grupo (existente e um novo) recebendo
  mensagem, confirmando que nada aparece no sino Mensagens/Alertas.

## 65. Bug grave: campanha "Renovação 2026" mandou mensagem pra contato sem relação (v2.3.82)

### Relato do cliente

"Mandei uma campanha de disparos para lista de contato de arquivo e
foi para um número que não faz parte: Tereza Cristina Py, +59 (59)
9327-3303, tereza@gmail.com."

### Investigação

A campanha "Renovação 2026" foi consultada no banco: o nome da lista
de contatos auto-gerada era "Renovacao 2026 | TAG: 7 - ...", ou seja,
foi criada com `tagListId = 7` (a lógica de `CampaignController.store`
que cria uma lista a partir de uma tag, ver seção 58), não com a lista
de arquivo de 96 registros que o cliente pretendia usar.

A tag id=7 é **"Atendimento Pendente"** — uma tag genérica, sem
nenhuma relação com "Renovação 2026". "Tereza Cristina Py" (contato
id=8771) está marcada com essa tag (provavelmente por ter tido um
ticket pendente em algum momento), e foi assim que ela entrou na lista
de destinatários sem ter nada a ver com a campanha de renovação.

O código da correção anterior (v2.3.75 — Lista de Contato e Tag
mutuamente exclusivas, seção 58) foi revisado e está funcionando
corretamente: escolher a Lista de Contato limpa a Tag automaticamente,
nos dois campos. `tagListId` também não é uma coluna persistida no
model `Campaign` (só existe no momento da criação), então não haveria
como uma tag "vazar" de uma edição ou duplicação de campanha antiga —
o valor só pode vir de uma seleção feita no próprio formulário no
momento da criação. Ou seja: **não foi encontrado um bug de código
reincidente** aqui — o cenário mais provável é a tag ter ficado
selecionada no formulário sem o cliente perceber, com a Lista de
Contato nunca tendo sido de fato escolhida.

### Correção: confirmação antes de enviar

Como o risco (mensagem pro destinatário errado) é alto e o erro é
silencioso — nada na tela avisa qual vai ser o público final antes de
enviar —, foi adicionada uma tela de confirmação obrigatória antes de
criar ou atualizar qualquer campanha, mostrando exatamente pra quem
vai a mensagem:

> "Essa campanha vai enviar mensagens para: Lista de Contato
> "<nome>" (X contatos). Confirma?"
>
> ou: "Essa campanha vai enviar mensagens para: Tag "<nome>". Confirma?"

- `frontend/src/components/CampaignModal/index.js`: `handleSaveCampaign`
  agora só faz a validação e monta esse resumo (`getRecipientSummary`),
  abrindo um `ConfirmationModal` (o mesmo componente já usado pra
  confirmar exclusão de mídia) em vez de salvar direto. O salvamento em
  si (POST/PUT + upload de anexo) virou uma função separada
  (`performSaveCampaign`), chamada só depois que o usuário confirma no
  modal.
- `backend/src/services/ContactListService/FindService.ts` (usado por
  `GET /contact-lists/list`, o combo "Lista de Contato" da campanha):
  passou a devolver `contactsCount` (contagem via subquery em
  `ContactListItems`) junto de cada lista, pra alimentar a quantidade
  mostrada nesse resumo. A tag já trazia a contagem embutida no nome
  desde a v2.3.71 (`"<nome> (<contatos>)"`).

Esse resumo funciona como uma última checagem visual — mesmo que o
usuário tenha selecionado a lista/tag errada sem perceber, ele vê
exatamente pra quem vai antes de confirmar, e ainda tem a chance de
cancelar.

### Testado

- `tsc --noEmit` limpo no backend.
- `eslint` limpo em `CampaignModal/index.js` (só os mesmos avisos
  pré-existentes de sempre).
- Pendente: reteste do cliente — criar uma campanha e confirmar que a
  tela de confirmação aparece com o resumo certo antes de salvar.

### Backfill retroativo aplicado

A tag "Filiados Inadimplentes" (id=6, coluna do Kanban) tinha voltado
a ficar com 0 contatos em `ContactTags` (mesmo bug da seção 61, dessa
vez porque a v2.3.78 ainda não tinha sido implantada quando o problema
aconteceu de novo). Rodado o mesmo backfill retroativo da seção 55 a
partir de `TicketTags`, recuperando as associações.

## 66. Tag de campanha desacoplada do Kanban + aviso de país diferente na confirmação (v2.3.83)

### Relato do cliente

Uma segunda campanha ("Renovação Filiação 2026") foi criada com a tag
"Filiados Inadimplentes" (a mesma tag-coluna do Kanban da seção 65) —
dessa vez a tela de confirmação mostrou corretamente "Tag: Filiados
Inadimplentes", então não foi engano de campo. O problema real: essa
tag tinha um contato do Paraguai ("Punto a Punto",
`595976323537`, email de teste `SASASA@JJJJJJ.COM`) marcado nela no
Kanban — provavelmente por engano/teste — e meu backfill retroativo da
seção 65 replicou essa marcação errada pra `ContactTags`, fazendo a
campanha mandar mensagem pra ele.

O cliente então decidiu: **tag do módulo Campanhas não deve ter
nenhuma relação com o Kanban** — são usos diferentes (triagem de
atendimento x segmentação de campanha) e misturar os dois é a raiz
recorrente desses bugs.

### Correção 1: desacoplar Tag de campanha do Kanban

Revertida a mudança das seções 54/55 que fazia a Nova Campanha
enxergar tag-coluna do Kanban (`kanban=1`):

- `frontend/src/components/CampaignModal/index.js`: volta a buscar só
  `kanban: 0` em `/tags/list` (removido o `Promise.all` com
  `kanban: 1`).
- `backend/src/controllers/CampaignController.ts`: `store` agora
  valida a tag antes de criar a lista — se `Tag.kanban === 1`, rejeita
  com `ERR_CAMPAIGN_TAG_IS_KANBAN_COLUMN` (proteção mesmo se a
  requisição não vier do formulário padrão).

O sync `ContactTag` do drag-and-drop do Kanban (seção 55) e o widget de
tag do ticket (seção 61) continuam funcionando normalmente — só o elo
"campanha pode usar tag do Kanban" foi cortado.

### Correção 2: aviso de número de outro país na confirmação

A pedido do cliente, a tela de confirmação de campanha (seção 65)
ganhou um aviso quando a lista/tag escolhida mistura número de fora do
Brasil (formato BR: `"55"` + 11 dígitos = 13 no total):

- `backend/src/services/ContactListService/FindService.ts`: além de
  `contactsCount`, agora também devolve `otherCountryCount` (contagem
  via subquery de `ContactListItems` cujo número não bate o formato
  BR, ignorando grupos).
- `frontend/src/components/CampaignModal/index.js`: pro combo de Tags,
  a contagem "fora do Brasil" é calculada no próprio front a partir da
  lista de contatos que `/tags/list` já devolve (`tag.contacts`), via
  o helper `isBrazilNumber`.
- `getRecipientSummary` (usado pela tela de confirmação) agora anexa
  um aviso — "⚠️ Atenção: N contato(s) dessa lista/tag tem/têm número
  de fora do Brasil — confira se é mesmo esperado antes de confirmar."
  — sempre que `otherCountryCount > 0`, na lista e na tag.

### Testado

- `tsc --noEmit` limpo no backend.
- `eslint` limpo em `CampaignModal/index.js` (só os mesmos avisos
  pré-existentes de sempre).
- Pendente: reteste do cliente — confirmar que a tag do Kanban não
  aparece mais no campo Tag da Nova Campanha, e que uma lista/tag com
  número de fora do Brasil mostra o aviso na confirmação.

## 67. Falso alarme: aviso de "número de outro país" disparava pra número BR legítimo (v2.3.84)

### Relato do cliente

Testou o disparo real de uma campanha com a lista de 96 números (todos
`+55 (71/73/75)...`, confirmado na seção 66 que não tem nenhum número
do Paraguai) e a tela de confirmação (v2.3.83) mostrou o aviso de
"número de fora do Brasil" mesmo assim — falso alarme.

### Causa raiz

`isBrazilNumber` (frontend) e a regex SQL de `otherCountryCount`
(`FindService.ts`) só reconheciam o formato **completo** de número BR
(13 dígitos: `"55"` + DDD + 9 dígitos, com o 9º dígito do celular).
Mas o próprio sistema já trata como BR válido também o formato
**antigo**, de 12 dígitos (sem o 9º dígito) — ver `CheckNumber.ts`,
seção "BR: DDI(2)+DDD(2)+local(8)". Boa parte da lista do cliente
tinha número nesse formato antigo (ex.: `+55 (71) 96989744`, local de
8 dígitos), e cada um desses batia como "não-BR" no meu filtro simples
demais.

### Correção

- `backend/src/services/ContactListService/FindService.ts`: regex
  `^55[0-9]{10,11}$` (aceita 12 OU 13 dígitos), em vez de só
  `^55[0-9]{11}$`.
- `frontend/src/components/CampaignModal/index.js`: `isBrazilNumber`
  ajustado pra `/^55\d{10,11}$/` (mesma lógica).

### Testado

- `tsc --noEmit` limpo no backend.
- `eslint` limpo em `CampaignModal/index.js` (só os mesmos avisos
  pré-existentes de sempre).
- Pendente: reteste do cliente confirmando que a lista de 96 números
  não dispara mais o aviso de país diferente.

## 68. disk-monitor — correções e funcionalidades novas (server-toolkit/disk-monitor v1.13.1 → v1.16.1)

Módulo independente, versionamento próprio (`1.x`, não segue o `v2.3.x`
do AtendeFlow acima — nenhum arquivo do backend/frontend do AtendeFlow
mudou nesta leva). Documentação completa de cada item, incluindo seções
de honestidade sobre o que foi testado contra hardware real, está em
`server-toolkit/disk-monitor/README.md` — aqui só o resumo.

### Bugs corrigidos

- **Divergência de uso de disco** entre o painel principal e o card de
  "Discos físicos" pro mesmo disco: a biblioteca `check-disk-space`
  calculava "livre" excluindo os blocos reservados pra root no Linux
  (~5% do disco), a `systeminformation` não — unificado numa fonte só
  (`lib/diskUsage.js` passou a usar `systeminformation`), removida a
  dependência antiga do `package.json`.
- **Certificado autoassinado do Synology DSM**: `DSM_ALLOW_SELF_SIGNED`
  era opt-in (exigia o cliente configurar `.env` manualmente) — virou
  opt-out, já que praticamente todo NAS Synology numa rede local usa
  certificado autoassinado por padrão. Mensagem de erro de TLS trocada
  por uma explicação acionável (`lib/synologyApi.js`).
- **Tamanho de disco do NAS inflado 1024x** (um HD de 4TB aparecia como
  3726TB): `size_total` da API do Synology já vem em bytes nesta versão
  do DSM, o código multiplicava por 1024 achando que vinha em KB —
  validado contra hardware real (dois HDs Seagate/WDC de 4TB).
- **Status "Atenção" (vermelho) falso** pro status `not_use` do DSM, que
  só significa "disco presente mas fora de qualquer pool/volume" (ex.:
  disco recém-colocado, antes de formatar) — agora distingue
  saudável / com falha real / não configurado, mesmo princípio já usado
  no badge de SMART dos discos locais (nunca assumir falha a partir de
  dado ambíguo).
- **Discos do NAS indistinguíveis** quando dois têm o mesmo modelo (ex.:
  dois HDs de 4TB comprados juntos) — tabela agora sempre mostra a
  posição física (ex. `sata2`) junto com o modelo.

### Funcionalidades novas

- **Montar partição sem ponto de montagem** (`lib/diskMount.js`): detecta
  partições existentes sem mountpoint, preview do comando + linha de
  fstab antes de executar, opção de persistir (com backup automático do
  `/etc/fstab`, nunca duplica entrada). Só `/mnt` ou `/media` por
  segurança.
- **Limpeza avançada por categorias seguras** (`lib/diskCleanupScan.js`):
  temporários, lixeira, cache de navegador, cache de pacotes do sistema
  (apt/Homebrew), revisões antigas de Snap — com gráfico de uso por
  categoria. Deliberadamente **não** inclui "achar executável sem uso"
  nem "desfragmentação" (pedidos e recusados por risco real de quebrar o
  sistema do cliente / ser obsoleto em SSD — decisão documentada no
  README).
- **Gerador de roteiro pra espelhar o disco do sistema em RAID1**
  (`lib/raidMirror.js`): detecta disco do mesmo tamanho do sistema ou
  maior (sobra vira partição de backup automática, fora do array) e gera
  o roteiro de comandos exato (`sgdisk`/`mdadm`/`rsync`/`grub-install`)
  — **a única ação deste painel que nunca vira um botão "executar"**,
  por envolver bootloader e reinicialização (erro pode deixar o servidor
  sem ligar). Inclui parar/religar containers Docker em volta da cópia,
  pra garantir consistência dos dados do AtendeFlow/Seafile.

### Uso real nesta sessão

Motivado por manutenção real na VPS de produção: adição de dois HDs de
4TB no NAS (daí os bugs de tamanho/status acima) e planejamento de
migrar o disco do sistema da VPS (120GB) pra um RAID1 num disco de
240GB (partição espelhada + partição de backup), usando o próprio
gerador de roteiro construído aqui.

## 69. Remove o gate de token do `/public-settings` — causa raiz do 403 crônico na logo/nome da tela de login (v2.3.85)

### Relato do cliente

Depois de trocar a logo padrão do AtendeFlow pela da Confianza
Technologies (seção anterior de rebranding), a tela de login continuou
dando 403 ao buscar `/public-settings/appLogoLight` e
`/public-settings/appName` — confirmado no DevTools com
`?token=wtV` no final da URL.

### Histórico: por que a correção anterior não resolveu

Numa sessão anterior já tinha sido identificado que `"wtV"` era um
valor hardcoded (provavelmente um placeholder esquecido da criação do
projeto) comparado contra `process.env.ENV_TOKEN` pelo middleware
`envTokenAuth` (`GET /public-settings/:settingKey`,
`settingRoutes.ts`). A correção aplicada então trocou o literal
`"wtV"` por `process.env.REACT_APP_ENV_TOKEN` em três arquivos
(`useSettings/index.js`, `Login/index.js`, `Signup/index.js`) e
encanou a variável `ENV_TOKEN` do backend até o build do frontend via
`docker-compose.coolify.yml` → `Dockerfile` (`ARG`/`ENV
REACT_APP_ENV_TOKEN`). Confirmado por múltiplos métodos independentes
que a correção estava correta no bundle gerado pelo servidor — e ainda
assim o navegador do cliente continuava recebendo 403 com
`token=wtV`, sob o mesmo hash de arquivo, depois de rebuilds completos
sem cache. Ficou como mistério não resolvido.

### Causa raiz real

Um **quarto lugar**, nunca tocado pela correção anterior:
`frontend/public/index.html` tem um `<script>` inline (splash screen,
mostra a logo cacheada em `localStorage` e busca a logo/nome
atualizados antes do bundle React montar) com duas chamadas `fetch`
hardcoded `?token=wtV` direto no texto do HTML. Arquivos em
`frontend/public/` são copiados como estão pro build — não passam
pelas variáveis `REACT_APP_*` do Create React App, que só afetam
código dentro de `src/`. Por isso nenhum rebuild do bundle JS, por
mais zerado que fosse o cache, jamais teria corrigido esse 403: o
`token=wtV` não vinha do bundle.

### Decisão: em vez de caçar o próximo lugar hardcoded, tirar o gate

`ENV_TOKEN` é um valor único e global — não por usuário (não é JWT;
isso é o middleware `isAuth`, separado, usado em `/settings/:settingKey`
que exige login) nem por empresa/tenant (não existe esse conceito
aqui). E esse valor único vai embutido em texto plano no bundle JS
público, baixado por qualquer um que abra a tela de login — ou seja,
nunca protegeu nada de verdade, só bloqueava um `curl` anônimo
trivial. Mantê-lo era o que causava essa classe de bug (variável
threading por 3-4 lugares, frágil, já rendeu um incidente de produção
nesta sessão). A rota `/public-settings/:settingKey` já é
semanticamente pública (nome do app, logo — dados pensados pra
aparecer antes do login) — faz sentido deixá-la pública de fato.

### Correção

- Removido `backend/src/middleware/envTokenAuth.ts` e seu uso em
  `settingRoutes.ts` (`GET /public-settings/:settingKey` sem
  middleware agora). Import solto do mesmo middleware em
  `authRoutes.ts` também removido (nunca tinha sido aplicado a
  nenhuma rota ali).
- Removida a variável `ENV_TOKEN`/`REACT_APP_ENV_TOKEN` de:
  `docker-compose.coolify.yml` (env do backend + build arg do
  frontend), `.env.coolify.example`, `backend/.env.example`,
  `frontend/Dockerfile` (incluindo o bloco `RUN echo "DEBUG..."`
  temporário deixado da investigação anterior, nunca removido).
- Removido o parâmetro `token` das chamadas em `useSettings/index.js`,
  `Login/index.js`, `Signup/index.js` e das duas chamadas `fetch` no
  `<script>` inline de `frontend/public/index.html` — essa última é
  o ponto que de fato causava o 403 em produção.
- `frontend/server.js` (servidor leve alternativo, não é o usado pelo
  `Dockerfile` atual — que usa `serve -s build`) também tinha um
  fallback `SETTINGS_TOKEN = process.env.ENV_TOKEN || "wtV"`; removido
  por consistência, já que a rota não exige mais token.
- **Fora do escopo, deliberadamente não tocado**: existe uma chave de
  settings no banco literalmente chamada `"wtV"` (usada em
  `GetWhatsapp.ts`, `AddSettingService.ts`, no seed, e lida em
  `frontend/src/layout/index.js`) — coincidência de nome com o antigo
  token, não relacionada a ele. Renomear essa chave é mudança de dado
  em produção, fora do escopo desta correção.

### Testado

- `tsc --noEmit` limpo no backend depois de remover o middleware e o
  import solto.
- `eslint` limpo nos três arquivos do frontend tocados
  (`useSettings/index.js`, `Login/index.js`, `Signup/index.js`).
- Pendente: confirmar em produção, depois do deploy, que a tela de
  login carrega a logo/nome sem 403 (requer rebuild do frontend via
  Coolify — variável de ambiente removida não tem efeito até o próximo
  build).

## 70. Upload de capa/logo do login não persistia no banco — Painel Master (v2.3.86)

### Relato do cliente

Logado como Master, em Configurações → "Login / capa": enviou a imagem
de fundo (capa do login) e a logomarca nova, o sistema mostrou como
salvo, mas depois de um F5 o salvamento não se mantinha — voltava pro
estado anterior.

### Causa raiz

Esse bloco ("Login / capa", componente `Whitelabel.js` com
`loginOnly`, renderizado em `Options.js`) tem dois pontos de entrada
de dados, e nenhum dos dois de fato persistia no banco:

- **Upload de imagem** (`handleLoginBrandingUpload` em `Options.js`):
  chama `POST /global-config/upload`
  (`GlobalConfigController.uploadBrandingImage`), que só salva o
  arquivo em disco via multer e devolve a URL — **nunca grava nada em
  `Setting`**. Quem persiste a associação `LOGIN_BACKGROUND_URL`/
  `LOGIN_LOGO_URL` no banco é o `PUT /global-config`
  (`GlobalConfigController.update`, via `persistSettingValue`), usado
  pela página separada `pages/GlobalConfig/index.js` (Painel SaaS) —
  mas essa chamada nunca acontecia a partir da tela de Configurações.
  O upload só atualizava o estado React local (`loginBrandingConfig`),
  que é o que fazia a prévia aparecer "salva" na hora — e se perde ao
  recarregar, porque o GET seguinte (`/global-config`) lê do banco, que
  nunca foi escrito.
- **Campo "Link do WhatsApp do login"**: nunca teve nenhum gatilho de
  salvamento — só um `onChange` que atualiza o estado local, sem
  `onBlur` nem botão "Salvar" nenhum.

Import a notar: `removeBrandingImage` (botão "Remover") **já** persistia
corretamente (`persistSettingValue(..., "")`) — só o caminho de upload
e o de edição de texto estavam quebrados, o que explica por que
"remover" sempre funcionou mas "enviar"/"editar" não.

### Correção

- `Options.js`: nova função `persistLoginBrandingField(field, value)`
  que chama `PUT /global-config` com só o campo mudado (o backend já
  ignora campos `undefined` no corpo, graças ao early-return de
  `persistSettingValue` — então mandar só um campo não apaga os
  outros). Chamada depois do upload ter sucesso, e num novo
  `onBlur` do campo de WhatsApp (`handleLoginBrandingBlur`).
- `Whitelabel.js`: recebe a nova prop `onLoginBrandingBlur` e conecta
  no `onBlur` do `TextField` de "Link do WhatsApp do login".
- Mesmo padrão já usado pelos outros sete slots de logo/ícone na seção
  "Identidade" (favicon, apple-touch-icon, PWA, etc.) — esses sempre
  persistiram direto no upload, sem precisar de botão "Salvar"
  separado; a seção "Login / capa" só tinha ficado pra trás nesse
  ponto.

### Testado

- `eslint` limpo em `Options.js` e `Whitelabel.js` (só os mesmos avisos
  pré-existentes de sempre, não relacionados a esta mudança).
- Pendente: confirmar em produção, depois do deploy, que enviar a capa
  e editar o link do WhatsApp sobrevivem a um F5.

## 71. Indicador de carregamento ao enviar resposta rápida com anexo (v2.3.87)

### Contexto

Durante a migração de dados da Empresa 1 (zappro → AtendeFlow,
companyId=3), depois de reimportar os arquivos físicos das respostas
rápidas que tinham anexo (ver seção da migração, companyId=3), o
cliente relatou que enviar uma resposta rápida com vídeo (~8MB)
"travava" na hora de enviar — sem erro no console do navegador, sem
erro no log do backend, só demora sem feedback visual.

### Causa raiz

`handleQuickAnswersClick` (`frontend/src/components/MessageInput/index.js`)
faz duas viagens de rede quando a resposta rápida tem anexo:

1. `axios.get(value.mediaPath, { responseType: "blob" })` — baixa o
   arquivo do servidor pro navegador.
2. `handleUploadQuickMessageMedia(blob, message)` — reenvia esse mesmo
   arquivo como anexo da mensagem (`POST /messages/:ticketId`).

O passo 2 já tinha `setLoading(true)`/`setLoading(false)` num
`try/finally`, mas o passo 1 (o download) não tinha nenhum indicador —
pra um anexo grande como vídeo, essa espera (download completo antes
de sequer começar o upload) parecia travamento, mesmo o fluxo
funcionando normalmente até o fim.

Decisão de escopo: o pedido explícito era só adicionar indicador
visual, não eliminar a viagem dupla (que exigiria mudar o fluxo de
envio de mensagem/anexo no backend — área sinalizada como delicada por
histórico de bugs no WhatsApp/Baileys, fora do escopo pedido).

### O que foi feito

- `handleQuickAnswersClick`: `setLoading(true)` logo antes do
  `axios.get` do passo 1 (cobre a janela que antes ficava sem
  feedback), e `setLoading(false)` explícito no `catch` (já que nesse
  caminho de erro `handleUploadQuickMessageMedia` — que teria seu
  próprio `finally` — nunca chega a ser chamado).
- Botão de enviar mensagem (os dois, versão normal e versão
  mensagem privada): mostra um `CircularProgress` pequeno no lugar do
  ícone de enviar/encaminhar enquanto `loading` é `true`, reaproveitando
  a classe `audioLoading` já existente (mesmo padrão visual já usado no
  botão de enviar áudio gravado).

### Testado

- `eslint` limpo em `MessageInput/index.js` (só os mesmos avisos
  pré-existentes de sempre — hooks de `useEffect` e uma variável não
  usada, nada relacionado a esta mudança).
- Pendente: confirmar em produção, depois do deploy, que o spinner
  aparece durante o envio de uma resposta rápida com vídeo grande.

## 72. Documento/PDF recebido abre em nova aba, não mais em preview embutido (v2.3.88)

### Contexto

Usuário reportou que, ao clicar num documento (PDF) recebido numa
conversa, o arquivo abria dentro da própria tela do AtendeFlow (um
modal com iframe), em vez de abrir como um arquivo normal numa aba
separada do navegador — comportamento inesperado, já que o botão
"Abrir" (ícone de nova janela) ao lado do card já abria em nova aba
corretamente.

### Causa raiz

`frontend/src/components/MessagesList/index.js`: o card de documento
(`renderDocumentPreview`) só tornava clicável o card inteiro e o botão
"Visualizar PDF" quando `isPdf` era verdadeiro, e esse clique chamava
`handleOpenPdfPreview`, que guardava `{ open: true, href, name }` no
estado `pdfPreview` e abria um `<Dialog>` com um `<iframe src={href}>`
— um visualizador embutido na própria página do sistema. O botão
"Abrir" (ícone `OpenInNew`), ao lado, sempre usou `<a href target="_blank">`
e abria corretamente em nova aba — só o clique no card/"Visualizar PDF"
tinha esse comportamento diferente.

### O que foi feito

- `handleOpenPdfPreview` agora só faz `window.open(mediaHref, "_blank", "noopener,noreferrer")`,
  em vez de popular o estado do modal.
- Removido o estado `pdfPreview` (não usado mais em nenhum outro lugar),
  `handleClosePdfPreview`, e o bloco `<Dialog>` com o `<iframe>` de
  preview embutido (título, botões "Fechar"/"Abrir em nova aba"/"Baixar"
  — os dois últimos já eram redundantes com os botões do próprio card).
- Removida a importação do ícone `Close`, que só era usado nesse modal
  removido (confirmado por lint — nenhum outro uso no arquivo).
- `DialogTitle`/`Dialog`/`DialogContent`/`DialogActions` continuam
  importados normalmente, pois ainda são usados por outro modal no
  mesmo arquivo (galeria de imagens).

### Testado

- `eslint` limpo em `MessagesList/index.js` (só os mesmos avisos
  pré-existentes de sempre, nenhum novo relacionado a esta mudança —
  confirma que não sobrou import nem variável órfã do modal removido).
- Pendente: confirmar em produção, depois do deploy, que o clique no
  documento abre nova aba em vez do preview embutido.

## 74. Botão de visualizar (nova aba) em todo tipo de documento (v2.3.89)

### Contexto

Cliente (Compliance Sandro) testou o envio de Word (`.docx`) e PDF numa
conversa real e reparou que o card do `.docx` recebido não tinha o
botão de "olho" (Visualizar) que o card do PDF tinha — só o ícone
"Abrir" (nova aba) funcionava pro Word, o card inteiro também não era
clicável.

### Causa raiz

Na seção 72 (v2.3.88), o clique no card virou `window.open` em nova
aba — mas a condição `isPdf` que decidia se o card era clicável e se
mostrava o botão "Visualizar" não tinha sido removida, só o
comportamento por trás dela mudou. Então o comportamento "melhor"
(abrir em nova aba) continuava restrito a PDF por acidente, mesmo
depois de deixar de ser uma limitação técnica real (não tinha mais
iframe embutido pra justificar restringir a um tipo só).

### O que foi feito

- `isPdfDocument`/`isPdf` removidos de `renderDocumentPreview`
  (`frontend/src/components/MessagesList/index.js`) — não faziam mais
  sentido depois da seção 72.
- `handleOpenPdfPreview` renomeado pra `handleOpenDocumentPreview`
  (mais preciso, já que não é exclusivo de PDF).
- Card do documento sempre clicável, e botão "Visualizar" sempre
  presente, pra qualquer tipo (txt, Word, Excel, PDF, etc.) — mesmo
  `window.open` em nova aba que já existia só pra PDF.

### Testado

- `eslint` limpo (só os mesmos avisos pré-existentes de sempre).
- Pendente: confirmar em produção, depois do deploy no servidor, que o
  botão de olho aparece em documentos Word/Excel/txt, não só PDF.

## 75. "Visualizar" documento abre caixa, não salva/abre direto (v2.3.90)

### Contexto

Depois da seção 74 (olho em todo tipo de documento), cliente testou
com Word (`.docx`) e Excel (`.xlsx`) reais numa conversa e viu que
clicar no olho fazia o navegador sair baixando o arquivo direto (sem
nenhuma "espiada" antes) — porque `window.open` numa URL de
`.docx`/`.xlsx` não tem como ser renderizado pelo navegador, então ele
baixa sozinho, sem opção.

Perguntei se a solução seria usar um visualizador externo (Google Docs
Viewer/Microsoft Office Viewer), que mostra o conteúdo de verdade mas
manda a URL do documento pros servidores do Google/Microsoft — cliente
(Compliance Sandro) recusou essa opção por implicação de privacidade/
compliance (documento sensível passando por terceiro só pra
visualizar). Decisão: manter 100% local, sem serviço externo.

### Causa raiz

`handleOpenDocumentPreview` (seção 74) fazia `window.open` direto pra
qualquer tipo de documento. Isso funciona bem pra PDF (navegador
renderiza nativamente em nova aba) mas pra Word/Excel o navegador não
tem visualizador embutido — o resultado prático é idêntico a clicar em
"Baixar", só que sem avisar, e sem o operador decidir antes.

### O que foi feito

- `handleOpenDocumentPreview` agora abre uma caixa (estado `docPreview`
  + `<Dialog>`) em vez de `window.open` direto.
- Novo helper `isInlineRenderableDocument(message)`: `true` só pra
  `.pdf`/`.txt` (os únicos tipos que o navegador consegue mostrar
  sozinho, sem plugin nem serviço externo).
- Conteúdo da caixa: `<iframe>` apontando pro arquivo quando
  renderizável (PDF/txt — o próprio navegador desenha o conteúdo); card
  "Visualização não disponível" + nome do arquivo quando não
  (Word/Excel/outros) — mesmo padrão visual que já existe no modal de
  ENVIO de arquivo (`MessageUploadMedias`, fallback pra tipos sem
  preview).
- Caixa tem botão "Baixar" explícito (só baixa se o operador clicar) e
  "Fechar" — nenhum download acontece só por abrir a caixa.
- Os botões de ícone "Abrir" (nova aba, raw) e "Baixar" (link direto)
  que já existiam no card continuam exatamente como estavam — só o
  botão/card "Visualizar" mudou de comportamento.
- `Typography` adicionado ao import de `@material-ui/core` (precisa
  pro texto do fallback).

### Testado

- `eslint` limpo em `MessagesList/index.js` (só os mesmos avisos
  pré-existentes de sempre).
- Pendente: confirmar em produção, depois do deploy no servidor, que a
  caixa abre pra Word/Excel sem baixar sozinha, e que PDF/txt mostram
  o conteúdo dentro da caixa.

## 76. Corrige caminho errado do arquivo ao reencaminhar mídia (v2.3.91)

### Contexto

Depois da seção 74 (deixa de apagar mídia após enviar), cliente
(Compliance Sandro) continuou testando "Reencaminhar" e o erro
persistia — inclusive pra uma foto enviada na hora, nunca apagada.
Isso indicava que a causa raiz não era (só) a exclusão do arquivo.

### Causa raiz

`forwardMessage` (`backend/src/controllers/MessageController.ts`)
reconstrói o caminho físico do arquivo original a partir do
`message.mediaUrl`, pra poder relê-lo e reenviar como anexo novo. A
montagem da pasta pública estava assim:

```ts
const publicFolder = path.join(
  __dirname, "..", "..", "..", "backend", "public"
);
```

Em produção, o código compilado roda de `/app/dist/controllers/`
(`WORKDIR /app` no Dockerfile). Subir três níveis (`../../../`) a
partir daí chega na raiz do sistema de arquivos (`/`), e aí o código
ainda concatenava mais `backend/public` — resultando em
`/backend/public`, uma pasta que **nunca existiu** no container (os
uploads reais ficam em `/app/public`, declarado como `VOLUME` no
Dockerfile). Todo `readFileSync` dentro de `SendWhatsAppMedia`
disparava `ENOENT` — sempre, pra qualquer arquivo, novo ou antigo,
apagado ou não.

Esse bug é anterior a qualquer mudança feita nesta sessão — sempre
existiu desde que `forwardMessage` foi escrito. A exclusão
pós-envio (seção 74) era um problema real, mas secundário: mesmo
resolvendo ela sozinha, reencaminhar continuaria quebrado por causa
deste caminho errado.

`upload.ts` (fonte confiável de como montar esse caminho) usa:

```ts
const publicFolder = path.resolve(__dirname, "..", "..", "public");
```

Dois `".."` a partir de `dist/config/`, não três a partir de
`dist/controllers/` mais um segmento `"backend"` extra.

### O que foi feito

- `forwardMessage`: `publicFolder` agora usa
  `path.join(__dirname, "..", "..", "public")` — mesmo padrão de
  `upload.ts`, resolve corretamente pra `/app/public`.
- Confirmado por busca (`grep "backend"` em todo `backend/src`) que
  essa era a única ocorrência desse padrão de caminho errado no
  projeto.

### Testado

- `npx tsc --noEmit` limpo (só o aviso pré-existente de
  `moduleResolution` deprecated, não relacionado).
- Pendente: confirmar em produção, depois do deploy, que reencaminhar
  uma mídia enviada após este fix funciona de ponta a ponta.

## 77. Visualização real de Word/Excel/PowerPoint/OpenDocument via LibreOffice (v2.3.92)

### Contexto

Depois da seção 75 (botão de visualizar em todo documento), cliente
testou com Word/Excel/`.odt` reais e viu que a caixa só mostrava
"Visualização não disponível" — esperado até então (decisão da seção
75: sem visualizador externo tipo Google Docs Viewer, por questão de
privacidade/compliance de documentos sensíveis). Cliente pediu pra
implementar visualização real mesmo assim, usando conversão local —
confirmou explicitamente (pergunta feita antes de mexer, dado o peso
de infraestrutura): "sim, pode começar", "manter para os dois
libreOffice e para o Office da microsoft também" (ou seja, cobrir
tanto arquivos nativos do LibreOffice/OpenDocument quanto do
Microsoft Office).

### Decisão de arquitetura

Conversão **no próprio servidor**, via LibreOffice headless instalado
no container do backend — nunca manda o arquivo pra um serviço
externo. Trade-off aceito: imagem Docker do backend fica bem maior
(LibreOffice + dependências, centenas de MB a mais), e cada conversão
gasta CPU/alguns segundos — mitigado com cache em disco (converte uma
vez só por arquivo).

### O que foi feito

**Backend:**
- `backend/Dockerfile`: adiciona `libreoffice-writer`,
  `libreoffice-calc`, `libreoffice-impress` e `fonts-liberation2` no
  estágio final (runtime), com `--no-install-recommends` pra não
  puxar pacote de ambiente gráfico/idiomas desnecessários.
- `backend/src/services/DocumentServices/ConvertDocumentToPdfService.ts`
  (novo): roda `soffice --headless --convert-to pdf`, com perfil de
  usuário isolado por chamada (`-env:UserInstallation=file://...`) —
  evita o erro clássico "soffice already running" quando duas
  conversões acontecem perto uma da outra (dois atendentes clicando em
  "Visualizar" ao mesmo tempo). Timeout de 45s. Resultado em cache na
  pasta `company{id}/_previews/` — reaberturas seguintes não
  reconvertem.
- `backend/src/controllers/DocumentPreviewController.ts` (novo) +
  rota `GET /messages/:messageId/document-preview`
  (`messageRoutes.ts`): busca a mensagem, **reconfere
  `message.companyId !== req.user.companyId`** (regra de multiempresa
  da seção 4 da skill `atendeflow-dev` — nunca confiar só no id da
  mensagem), resolve o nome do arquivo direto do valor bruto salvo no
  banco (`message.getDataValue("mediaUrl")`, não precisa reparsear
  URL como o `forwardMessage` fazia antes do fix da seção 76), chama o
  serviço de conversão, devolve a URL pública do PDF convertido.
- Tipos convertíveis: `.doc .docx .xls .xlsx .ppt .pptx .odt .ods .odp
  .rtf` (cobre Microsoft Office e LibreOffice/OpenDocument).

**Frontend:**
- `MessagesList/index.js`: `isInlineRenderableDocument` virou
  `isNativelyRenderableDocument` (PDF, `.txt`, **e agora `.xml`** —
  navegador renderiza esses três sozinho, sem conversão) +
  `isConvertibleDocument` (a lista acima, precisa chamar o backend).
- `handleOpenDocumentPreview` agora é assíncrono: se renderizável
  nativo, abre a caixa direto; se convertível, abre a caixa já com
  spinner "Convertendo documento para visualização...", chama
  `GET /messages/:id/document-preview`, e troca pro PDF convertido
  quando a resposta chega; se a conversão falhar, mostra aviso
  específico ("Não foi possível converter esse documento") em vez do
  genérico "Visualização não disponível" — sempre com o botão
  "Baixar" apontando pro arquivo **original** (não o convertido),
  mesmo em erro.
- Estado `docPreview` reestruturado: `originalHref` (sempre o arquivo
  real, usado no botão Baixar) separado de `previewHref` (só setado
  quando a conversão/renderização nativa está pronta) e `status`
  (`idle`/`loading`/`ready`/`error`/`unsupported`).

### Testado

- `npx tsc --noEmit` limpo.
- `eslint` limpo em `MessagesList/index.js` (só avisos pré-existentes).
- Pendente: confirmar em produção, depois do deploy (rebuild completo
  do backend, mais demorado dessa vez por causa do `apt-get install`
  do LibreOffice), que Word/Excel/PowerPoint/`.odt` abrem com conteúdo
  real na caixa, e que o fallback de erro funciona (ex.: arquivo
  corrompido).

## 78. Corrige nome de arquivo com caractere especial (º, ç, ã...) (v2.3.93)

### Contexto

Depois do deploy da seção 77, cliente testou abrir/baixar uma nota
fiscal real (`NF_Nº_481-_MARCIO_BISPO_DOS_SANTOS_assinado.pdf` — o "º"
de "Número") e deu `Cannot GET` tanto no "Visualizar" quanto no
"Baixar". A URL que o navegador pedia era
`.../1791991777504_NF_N%C2%BA_481-..._1791991777504.pdf`.

### Causa raiz

`backend/src/config/upload.ts`, função `filename()`, usava
`file.originalname` direto, sem nenhum tratamento de encoding. O
Busboy (biblioteca usada internamente pelo `multer` pra parsear
multipart/form-data) decodifica o campo de nome de arquivo do upload
como **Latin-1 (ISO-8859-1)** por padrão — é o que a especificação
multipart tecnicamente permite — mesmo quando o navegador, na prática,
manda os bytes em UTF-8 de verdade (como fazem Chrome/Firefox hoje).

Resultado: um caractere especial como "º" (que em UTF-8 são os bytes
`0xC2 0xBA`) chega interpretado como **dois caracteres Latin-1
separados** (`0xC2` → "Â", `0xBA` → "º") — ou seja, a string em memória
já nasce errada. Quando o Node grava essa string errada no disco (ele
usa UTF-8 por padrão pra nomes de arquivo), grava os bytes UTF-8
*desses dois caracteres errados* (4 bytes: `0xC3 0x82 0xC2 0xBA`), não
os 2 bytes corretos de "º" sozinho. O nome salvo no banco (mesma
string em memória) fica consistente com o arquivo no disco — o
problema só aparece quando a URL é montada/percorrida em outro ponto
do pipeline (navegador, `encodeURIComponent`/getter do Sequelize) que
reinterpreta esses caracteres de forma diferente, produzindo uma URL
que não bate mais, byte a byte, com o nome real gravado no disco.

### O que foi feito

- `upload.ts`: `file.originalname` passa por
  `Buffer.from(file.originalname, "latin1").toString("utf8")` antes de
  virar o nome salvo — reinterpreta corretamente os bytes que o
  Busboy decodificou errado, prevenindo a mangling na origem.

### Limitação importante — não é retroativo

Esse fix só evita o problema em **uploads novos**, a partir de agora.
Arquivos que já foram salvos com o nome corrompido antes dessa
correção **continuam com o nome errado no disco** — não existe como
"corrigir" isso por código depois do fato, os bytes errados já foram
gravados no sistema de arquivos. Se um arquivo específico antigo com
caractere especial no nome for crítico recuperar, a única saída é
achar o arquivo físico no servidor (`ls` na pasta
`public/company{id}/`, procurando pelo nome visualmente parecido) e
renomear manualmente, ou pedir pro cliente reenviar o documento.

### Testado

- `npx tsc --noEmit` limpo.
- Pendente: confirmar em produção, depois do deploy, que um upload
  novo com caractere especial no nome (ex.: outra nota fiscal com "Nº")
  salva e abre corretamente.

## 79. Link de arquivo sempre funciona, mesmo com caractere fora do padrão no nome (v2.3.94)

### Contexto

Depois do deploy da seção 78, cliente testou com uma nota fiscal real
já assinada digitalmente no gov.br
(`NF_Nº_481-_MARCIO_BISPO_DOS_SANTOS_assinado.pdf`) e o mesmo erro
`Cannot GET` apareceu de novo — mas o arquivo físico no servidor
**não estava corrompido** (localizado via
`docker exec atendeflow-backend-1 find /app/public/company3 -iname
"*481*"`): o nome salvo em disco tinha a sequência `%C2%BA` como texto
**literal** (os caracteres `%`, `C`, `2`, `%`, `B`, `A`), não o
caractere "º" de verdade nem bytes mal-decodificados — ou seja, um
problema diferente do da seção 78 (aquele era sobre Latin-1 vs UTF-8
no upload; este é sobre o link gerado não escapar corretamente um "%"
literal que já vinha no nome do arquivo, venha ele de onde vier).

Confirmado manualmente: montando a URL com esse "%" literal escapado
como "%25" (`.../NF_N%25C2%25BA_481-..._assinado....pdf`), o PDF abriu
normal — o arquivo está intacto, só o link automático da tela estava
quebrado.

Cliente confirmou que o nome "fora do padrão" provavelmente vem do
processo de assinatura digital do gov.br (o nome do arquivo já chega
assim quando baixado/reenviado) — e pediu uma correção **geral**, não
um reparo pontual nesse arquivo: qualquer documento com caractere
atípico no nome, não importa a origem, deveria sempre virar um link
funcional.

### Causa raiz

`backend/src/models/Message.ts`, getter `mediaUrl`: montava a URL
pública concatenando o nome do arquivo salvo em disco (`storedMediaUrl`)
direto na string, sem nenhum `encodeURIComponent`. Pra nomes com
caractere Unicode comum (tipo "º" de verdade) isso "funcionava
sozinho" por sorte — o navegador escapa automaticamente caractere
não-ASCII ao montar a requisição HTTP a partir de um `href`. Mas um
"%" **literal** no nome do arquivo é ASCII válido, então o navegador
NÃO reescapa — manda exatamente como está, e o Express tenta decodificar
esse "%C2%BA" como se fosse um escape de verdade, resultando numa
string diferente do nome real salvo no disco.

### O que foi feito

- `Message.ts`: o getter `mediaUrl` agora aplica `encodeURIComponent`
  no nome do arquivo antes de montar a URL — centralizado nesse único
  lugar, usado por toda a aplicação (frontend principal, webchat,
  `forwardMessage`, IA/transcrição, etc.), então qualquer nome de
  arquivo — com "º" de verdade, com "%" literal, ou qualquer outra
  coisa fora do padrão — sempre gera um link que bate exatamente com o
  arquivo físico.
- Conferido que `forwardMessage` (`obterNomeEExtensaoDoArquivo`) já
  fazia `decodeURIComponent` na extração do nome a partir da URL —
  continua funcionando corretamente com o novo encoding, sem precisar
  de ajuste ali.
- `OpenAiService.ts` (transcrição de áudio e visão de imagem pra IA):
  duas ocorrências que extraíam o nome do arquivo direto de
  `mediaSent.mediaUrl!.split("/").pop()` pra montar um caminho de
  disco — precisavam de `decodeURIComponent` explícito agora que o
  getter sempre devolve o nome codificado (sem isso, a checagem
  `fs.existsSync` ia sempre falhar pra arquivo com caractere especial).
- Frontend (`MessagesList/index.js`, `safeBasename`): decodifica o
  nome extraído da URL antes de usar como rótulo de exibição (fallback
  quando não há nome mais legível vindo do `dataJson`) — evita mostrar
  o nome cru codificado (tipo "%C2%BA") pro atendente.

### Testado

- `npx tsc --noEmit` limpo.
- `eslint` limpo em `MessagesList/index.js` (só avisos pré-existentes).
- Pendente: confirmar em produção que o PDF do Márcio Bispo (ou outro
  documento com nome fora do padrão) abre pelos botões normais da
  tela, sem precisar do link manual com "%25".

## 80. Cadastro de armas/munições/insumos no módulo Financeiro (v2.3.95)

### Contexto

Cliente pediu pra atualizar o módulo Financeiro (que já existia, considerado "muito
básico") pra atender clube de tiro/loja de armas/armaria — cadastro de armas,
munições e insumos (marcas citadas: Taurus, CBC, Glock, Imbramun), seguindo como
referência o Decreto 11.615/2023, o Decreto 12.345/2024 e o Estatuto do Desarmamento
(Lei 10.826/2003). Pedido explícito de fazer por partes ("vamos fazer por parte"), com
esta sendo a primeira: Cadastro de Armas.

Como o pedido admitia mais de um caminho razoável de implementação — entidade nova
dedicada (`FinanceWeapon`) vs. estender o `FinanceProduct` já existente; conjunto de
campos regulatórios (não há uma única lista "óbvia") — e o `CLAUDE.md` do projeto
pede pra pausar e perguntar antes de codar nesses casos, foram feitas duas rodadas de
pergunta ao cliente antes de qualquer código: (1) arquitetura — estender Produto
existente (confirmado) ou criar entidade dedicada; implementar contas bancárias agora
ou depois; qual item priorizar primeiro; (2) conjunto exato de campos pra arma e pra
munição/insumo, e se o número de série deveria ser único por empresa.

### Causa raiz (do "muito básico")

`FinanceProduct` (Fase 1 do roadmap) foi desenhado só pra produto/serviço genérico —
nome, SKU, unidade, preço, estoque. Não existia nenhum campo que capturasse as
características regulatórias de uma arma de fogo ou munição/insumo controlado (marca,
modelo, calibre, número de série, classificação de uso etc.), então não dava pra usar
esse cadastro pro segmento de clube de tiro/loja de armas sem perder informação
essencial pro negócio (e, potencialmente, pra conformidade legal do cliente).

### O que foi feito

Ver detalhamento completo na seção 6.2, "Fase 6 — Cadastro de armas/munições/insumos",
mais acima neste documento (campos adicionados, migration, validação condicional,
capacidade nova de visibilidade condicional em `FinanceRecordModal`, e o que ficou
fora de escopo — dados de venda/comprador, que pertencem ao `Sale`, não ao
`FinanceProduct`).

### Testado

Ver "Testado" no final da seção 6.2, Fase 6.

### Pendente / próximas partes deste mesmo pedido

- Importação de produtos/clientes/fornecedores via planilha Excel (detecção
  automática de coluna por nome do cabeçalho; duplicata por CPF/CNPJ ou SKU/nome
  atualiza o registro existente) — decisão já confirmada com o cliente, implementação
  ainda não iniciada nesta versão.
- Contas bancárias (`FinanceBankAccount` — entidade nova, sem nenhum cadastro
  equivalente hoje) — cliente confirmou implementar "junto com o resto", ainda não
  implementada nesta versão.
- Cadastro de munição/insumo: os campos de catálogo (lote de fabricação, código de
  barras/embalagem) já foram implementados nesta versão; os campos de venda
  controlada (CPF do titular, nº do CRAF, chave de acesso da NF-e, status de entrega)
  ficam pro item de "documentação do comprador" já previsto no roadmap, ligado ao
  `Sale`/`SaleItem`.

## 81. Importação de produtos/clientes/fornecedores via Excel (v2.3.96)

### Contexto

Segunda parte do pedido de atualização do módulo Financeiro ("vamos fazer por
parte"): cliente pediu importação por Excel dos cadastros de produto/cliente/
fornecedor, pra facilitar o cadastro inicial (principalmente de produtos — incluindo
armas/munições recém-adicionadas na v2.3.95). Antes de implementar, confirmado com o
cliente (pedido admitia mais de um caminho razoável): detecção automática de coluna
por nome do cabeçalho (não tela de mapeamento manual), nos três cadastros desde já, e
duplicata sempre atualiza o registro existente.

### O que foi feito

Ver detalhamento completo na seção 6.2, "Fase 6", subseção "Importação via Excel
(v2.3.96)", mais acima — serviço de leitura/dedup/upsert, rotas, remoção do arquivo
temporário depois de processado (diferente do import de lista de contatos existente,
que não remove), e a UI (botão "Importar planilha" nas três abas).

### Testado

Ver "Testado" no final da subseção correspondente, seção 6.2 Fase 6.

### Pendente

- Validação em homologação com planilha real, incluindo reimportação da mesma
  planilha (deve atualizar, não duplicar).
- Contas bancárias (próxima parte deste mesmo pedido, ainda não implementada).

## 82. Migration de armas/munições travava em produção — corrigida pra idempotente (v2.3.97)

### Contexto

Ao rodar `db:migrate` em produção pra aplicar a v2.3.95, o cliente recebeu:

```
ERROR: column "weaponType" of relation "FinanceProducts" already exists
```

logo na primeira coluna da migration `20261015120000-add-weapon-fields-to-finance-products`,
mesmo sendo (pelo histórico do deploy) a primeira vez que esse código realmente chegou no
servidor — as duas tentativas anteriores tinham rodado com código antigo (sem essa
migration), por causa da divergência git/GitHub descrita no acompanhamento do deploy desta
versão.

### Causa raiz

A migration original fazia uma sequência de `queryInterface.addColumn(...)`, um por coluna,
**sem nenhuma transação explícita envolvendo todos eles**. O runner do Sequelize só marca
uma migration como concluída (`SequelizeMeta`) depois que a função `up` inteira termina sem
erro — mas se ela falhar no meio (nesse caso, provavelmente numa corrida/timing entre o
`docker compose up --force-recreate` ainda de pé da tentativa anterior e o `exec ... migrate`
rodando contra o mesmo banco, ou qualquer outro erro transitório depois de já ter criado as
primeiras colunas), as colunas já criadas **continuam no banco** — só a migration como um
todo não fica registrada como aplicada. Rodar `db:migrate` de novo faz o Sequelize tentar
executar a função `up` do zero, batendo em "already exists" na primeira coluna que já tinha
sido criada da vez anterior, e travando ali pra sempre — nenhuma tentativa seguinte
conseguiria progredir sem intervenção manual.

### O que foi feito

- Reescrita a migration inteira pra idempotente: cada coluna agora usa
  `ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "<coluna>" <tipo>;` via SQL puro
  (`queryInterface.sequelize.query`) em vez de `queryInterface.addColumn`. O índice único
  parcial também passou a usar `CREATE UNIQUE INDEX IF NOT EXISTS` (em vez de `CREATE UNIQUE
  INDEX`). Rodar a migration de novo agora sempre completa — pula qualquer coluna/índice que
  já exista e cria só o que falta, terminando sem erro e sendo corretamente registrada no
  `SequelizeMeta`.
- **Lição pro futuro**: qualquer migration nova com mais de um `addColumn`/`addIndex` em
  sequência deveria preferir SQL com `IF NOT EXISTS` (Postgres aceita isso em `ALTER TABLE
  ADD COLUMN`/`CREATE INDEX` desde a 9.5/9.6) em vez do `queryInterface.addColumn` padrão do
  Sequelize, que não tem esse idempotência embutida — evita esse exato tipo de trava numa
  tentativa futura que falhe no meio por qualquer motivo.

### Testado

- `npx tsc --noEmit` limpo no backend.
- Não testado contra um banco com o estado exato de produção (coluna `weaponType` já criada,
  resto faltando) nesta sessão — a lógica `IF NOT EXISTS` é padrão e bem estabelecida do
  Postgres, mas o cliente deve confirmar que `db:migrate` completa sem erro desta vez antes
  de considerar a v2.3.95/96/97 totalmente no ar.

## 83. Importação reconhece o Relatório de Produtos do ERP da loja de armas (v2.3.98)

### Contexto

Depois de validar o cadastro manual de arma, o cliente pediu "vamos adequar uma tabela de
produtos" — a princípio descrita como XML, mas o arquivo enviado foi na verdade um `.xlsx`:
`RELATORIO_DE_PRODUTOS_GERAIS_DE_ARMAS...xlsx`, um relatório exportado do sistema atual da
loja (cabeçalho "CONFIANCA COMERCIO DE ARMAS BAHIA LTDA" — ERP tipo Procfy, já mencionado
antes nesta mesma etapa do roadmap). Pedido confirmado com o cliente antes de implementar
(campos que vêm automático vs. os que ficam em branco pra preencher manual — "mantém o que
tem no sistema pra preencher manual").

### Causa raiz (por que o importador genérico da v2.3.96 não bastava)

O importador da v2.3.96 assume uma planilha simples: cabeçalho na primeira linha, um
produto por linha. O relatório real enviado pelo cliente é completamente diferente:

- O cabeçalho de verdade ("Cód. Produto", "Nome Produto", "Categoria"...) está na **linha
  10**, não na primeira — linhas acima têm nome/endereço da empresa e o título "Relatório de
  Produtos".
- Usa **células mescladas**: o texto do cabeçalho "Nome Produto" fica na coluna E, mas o
  dado real de cada produto está um a coluna à esquerda, na D (os merges do cabeçalho e dos
  dados começam em colunas diferentes no mesmo relatório — inconsistência do próprio
  template do ERP de origem, não um padrão a generalizar).
- O cabeçalho **se repete a cada página** do relatório (confirmado: reaparece na linha 65).
- Existe uma **linha de rodapé** entre blocos de página ("Emissão: 15/10/2026" / "Página:
  1") que não é produto nem cabeçalho.
- Números vêm em **dois formatos diferentes na mesma planilha**: "Qtde." e "Tabela 1"
  (preço) em formato pt-BR com separador de milhar ("3.000,00", "R$ 7,80"), enquanto "Custo
  Un." já vem com ponto decimal direto ("6797.64") — um importador genérico que só troca
  vírgula por ponto quebraria o primeiro formato.

### O que foi feito

- `FinanceImportService.ts`, nova função `parseGunStoreReport`: detecta esse formato
  automaticamente (procura a célula com texto exato "Cód. Produto" pra achar a linha do
  cabeçalho) e, se achar, usa um mapeamento de coluna **fixo por posição** (A=SKU, D=Nome,
  L=Categoria, P=Qtde., S=Preço, V=Ativo, X=Controla Estoque, AC=Unidade, AE=NCM, AM=Custo)
  em vez de alias de cabeçalho — essas colunas são fixas nesse template de relatório, então
  buscar por nome de cabeçalho não funcionaria de qualquer forma (a célula de dado real não
  fica embaixo do cabeçalho correspondente, por causa do merge). Se a planilha enviada não
  tiver essa assinatura, `importProducts` cai pro importador genérico por alias (v2.3.96),
  sem quebrar o caso já existente.
- **Categoria → Tipo do produto**: "PISTOLA"/"REVÓLVER"/"CARABINA"/"ESPINGARDA"/"RIFLE"/
  "ARMA" → `type: "weapon"` (+ `weaponType` quando a categoria for específica o bastante,
  ex. "CARABINA" → `"carbine"`); "MUNIÇÃO"/"ESPOLETA"/"CARTELA"/"POLVORA" →
  `type: "ammunition"`; qualquer outra categoria → `type: "product"` (fallback seguro).
- **`parseBrazilianDecimal`**: remove tudo que não é dígito/vírgula/ponto/sinal (tira o
  "R$ " de propósito), e só trata "." como separador de milhar quando a string também tem
  vírgula — detecta e lida com os dois formatos vistos no mesmo arquivo sem precisar saber
  de antemão qual coluna usa qual formato.
- **Marca e calibre — best-effort, por decisão explícita do cliente** ("tentar também se
  tiver no arquivo", não adivinhar): `extractBrandFromName`/`extractCaliberFromName`
  procuram na descrição do produto (texto livre, abreviado, sem padrão fixo) por:
  - Marca: lista de marcas conhecidas do mercado de armas/munição brasileiro (Taurus, CBC,
    Glock, Imbramun, Beretta, Rossi, CZ, Sig Sauer, etc.), busca textual simples — **não**
    tenta reconhecer marca por código de modelo (ex. "G2C" → Taurus), porque isso estaria
    fora do que "tem no arquivo" e arriscaria adivinhar errado. Na prática, a maioria dos
    produtos CBC e Glock testados teve marca reconhecida (a descrição cita a marca); a
    maioria dos modelos Taurus (G2C, G3, GX4, TH380...) **não** cita "Taurus" na descrição
    e fica com marca em branco — consistente com "mantém o que tem no sistema pra preencher
    manual".
  - Calibre: só padrões de alta confiança (notação com ponto ".38TPC", com X "9X19", bitola
    de espingarda "12/70", "MM" explícito, ou sufixo de cartucho colado no número — "380ACP",
    "38SPL", "357MAG", "40S&W") — de propósito NÃO tenta reconhecer número solto nenhum como
    calibre (evitaria confundir código de modelo como "7022" ou comprimento de cano "76" com
    calibre).
- **Teste com o arquivo real** enviado pelo cliente (planilha de produtos da Confiança
  Technologies/Cactus Clube de Tiro, 60 produtos): 36 reconhecidos como arma, 24 como
  munição/insumo, 0 caiu no fallback genérico "product"; marca reconhecida em 35 e calibre
  em 43 dos 60. Validado rodando o parser isolado (`ts-node --transpile-only`) contra o
  arquivo real antes de considerar pronto — não só revisão de código.

### Testado

- `npx tsc --noEmit` limpo no backend.
- Parser testado isoladamente (fora do fluxo HTTP completo, sem banco disponível nesta
  sessão) contra o arquivo real do cliente — resultado em "O que foi feito" acima.
- **Pendente**: cliente rodar a importação de verdade (fluxo completo, upload → banco) em
  homologação/produção com esse arquivo, e revisar manualmente os produtos sem marca/calibre
  reconhecidos antes de considerar o catálogo completo.

## 84. Vincula Contato do Atendimento a Cliente do Financeiro (v2.3.99)

### Contexto

Cliente pediu que o cadastro de cliente usado pelo Atendimento (`Contact`, quem fala com o
atendente pelo WhatsApp) e o cadastro de cliente do Financeiro (`FinanceCustomer`, usado em
vendas/contas a receber) "virem uma base só": o atendente cadastra o contato no Atendimento
e isso deveria refletir no cadastro de Clientes do Financeiro; quem trabalha só no Financeiro
continua podendo cadastrar um cliente direto por lá; tudo isso condicionado à permissão de
acesso ao módulo Financeiro que o Admin já concede por usuário.

Pedido admitia mais de um caminho (gatilho automático vs. manual; sincronia uni ou
bidirecional depois do vínculo) — confirmado com o cliente antes de implementar: (1) o
vínculo só acontece quando alguém marca explicitamente o Contato como cliente financeiro
(não todo Contato vira Cliente automaticamente — evitaria encher a base financeira com todo
contato de WhatsApp que nunca comprou nada); (2) depois de vinculado, o Contato manda
nome/telefone (edição no Financeiro não volta pro Contato) — CPF/CNPJ/endereço só existem e
só são editáveis no Financeiro.

### O que foi feito

- **`FinanceCustomer.contactId`** já existia desde a Fase 1 (FK opcional pro `Contact`), mas
  sem nenhuma forma de usar isso pela interface — ficava um campo de banco sem uso real.
  Nenhuma migration nova precisou ser criada nesta etapa.
- **`FinanceCustomerService.ts`**, duas funções novas:
  - `linkFromContact(contactId, companyId)`: busca o `Contact` (reconferindo `companyId`,
    regra de multiempresa), e se já existir um `FinanceCustomer` com esse `contactId` pra
    essa empresa, devolve ele (idempotente — clicar duas vezes não duplica). Senão, cria um
    novo `FinanceCustomer` copiando `name`→`name`, `number`→`phone`, `email`→`email`,
    `document`→`document` (inferindo `documentType` cpf/cnpj pela quantidade de dígitos,
    mesma heurística já usada no importador de Excel da v2.3.98).
  - `showByContact(contactId, companyId)`: busca o `FinanceCustomer` vinculado a um
    `Contact`, usado pelo frontend só pra saber se já existe vínculo (mostrar o botão ou o
    indicador "vinculado").
- **Rotas** (`financeRoutes.ts`): `GET /finance/customers/by-contact/:contactId` e `POST
  /finance/customers/link-contact/:contactId`, registradas ANTES da rota genérica `GET
  /finance/customers/:id` — sem essa ordem, Express tentaria casar `"by-contact"`/
  `"link-contact"` como se fossem o parâmetro `:id`.
- **Frontend** (`ContactModal/index.js`): ao abrir o modal de um Contato já existente (não
  aparece em "Adicionar contato", só em "Editar contato"), busca `finance.getAccess()` (o
  MESMO endpoint que a tela do Financeiro usa — reaproveita a regra Admin/Master/plano já
  correta no backend, em vez de replicar essa lógica no frontend) e, se tiver acesso, busca
  se já existe vínculo (`getCustomerByContact`). Mostra um botão "Cadastrar como cliente
  (Financeiro)" (chama `linkContactAsCustomer`) ou, se já vinculado, um `Chip` "Cliente
  financeiro vinculado" — ação independente do formulário principal do Contato (Formik),
  não interfere no salvar/editar normal do Contato.
- **i18n**: `contactModal.finance.*` (botão, label do chip, mensagem de sucesso) — esse
  componente (`ContactModal`, diferente do módulo Financeiro) já usa o catálogo de 5
  idiomas normalmente, então as chaves novas entraram nos 5 (`pt.js`, `en.js`, `es.js`,
  `esES.js`, `tr.js`), ao contrário dos textos do próprio módulo Financeiro (ver seção 11
  da skill `atendeflow-dev` — convenção diferente, cada uma no seu lugar certo).

### Testado

- `npx tsc --noEmit` limpo no backend.
- `eslint` limpo em `ContactModal/index.js` e `useFinance/index.js`.
- `node --check` limpo nos 5 arquivos de tradução.
- Não testado end-to-end (sem banco disponível nesta sessão). **Pendente**: cliente testar
  em homologação/produção — abrir um Contato existente com usuário que tem acesso ao
  Financeiro, clicar "Cadastrar como cliente (Financeiro)", e confirmar que aparece em
  Financeiro > Clientes com nome/telefone corretos.

## 85. Diagnóstico: importação de produtos não reconheceu o relatório em produção (v2.3.100)

### Contexto

Depois do deploy da v2.3.98 (seção 83), cliente testou a importação do arquivo real
(`RELATORIO_DE_PRODUTOS_GERAIS_DE_ARMAS...xlsx`, o mesmo enviado nesta sessão) pela tela em
produção e recebeu o toast "Importação concluída: 0 criado(s), 0 atualizado(s), 165
inválido(s)/ignorado(s))" — ou seja, a requisição chegou no backend e respondeu normalmente
(sem erro HTTP), mas **nenhuma linha foi reconhecida como produto válido**.

Isso é inesperado: o arquivo enviado é confirmado como sendo o mesmo (cliente confirmou
explicitamente), e rodar `parseGunStoreReport` contra essa mesma cópia local do arquivo,
usando exatamente o código da v2.3.98/99 (reconferido nesta sessão, depois do relato),
continua reconhecendo os 60 produtos normalmente. A causa raiz da divergência entre o teste
local e o comportamento em produção **não foi identificada ainda** — hipóteses não
descartadas: versão da lib `xlsx` resolvida diferente no `npm install` do Dockerfile (usa
`npm install`, não `npm ci` — não é garantido pegar exatamente a mesma versão que o
`package-lock.json` fixa) vs. o `node_modules` desta sessão (instalado via `npm ci`);
diferença de encoding/acento na célula "Cód. Produto" que só se manifesta em certas
condições; ou algo específico do ambiente de produção ainda não mapeado.

### O que foi feito (diagnóstico, não correção definitiva)

- `parseGunStoreReport` (`FinanceImportService.ts`): quando não encontra o cabeçalho "Cód.
  Produto" (condição que faz cair no importador genérico), agora registra via `logger.info`:
  a versão da lib `xlsx` efetivamente carregada em produção, e o conteúdo bruto das
  primeiras 15 linhas da coluna A da planilha — isso revela exatamente o que o código está
  enxergando ali, em vez de precisar reproduzir o ambiente de produção pra descobrir.
- **Próximo passo, assim que o cliente testar de novo com o log do backend aberto**: a
  linha de log vai aparecer com o prefixo `[FinanceImportService] parseGunStoreReport:` —
  o conteúdo dela decide o próximo passo (se a versão da lib `xlsx` for diferente da
  esperada, trocar `npm install` por `npm ci` no Dockerfile pra fixar a versão; se o texto
  da célula estiver sutilmente diferente, ajustar a comparação pra ser mais tolerante —
  ex. `trim()` + normalização de espaço, já que `trim()` sozinho não remove um espaço
  não-quebrável (` `) no meio do texto).

### Testado

- `npx tsc --noEmit` limpo no backend.
- Reconfirmado nesta sessão (depois do relato do cliente) que `parseGunStoreReport` continua
  reconhecendo os 60 produtos corretamente contra a cópia local do arquivo exato enviado
  pelo cliente — a lógica em si não regrediu; o log novo existe justamente porque a causa da
  divergência com produção não é óbvia a partir do código sozinho.
- **Pendente**: cliente rodar `docker compose logs -f backend` e tentar importar de novo —
  o log vai apontar a causa exata.

### Atualização (v2.3.101) — o log da v2.3.100 nunca apareceu

Cliente confirmou, em mais de uma tentativa, que o terminal com `logs -f backend | grep
FinanceImportService` ficava completamente em branco mesmo depois de importar a planilha
de novo — nem a linha de diagnóstico, nem nenhum erro. Isso por si só é uma pista: outras
partes do sistema logam bastante (`[WBOT] upsert event`, `DADOS DO USUÁRIO...`) e aparecem
normalmente — todas via `console.log`/`console.warn` direto, nunca via o utilitário
`logger` (`backend/src/utils/logger.ts`, Pino + transporte `pino-pretty`).

**Causa provável** (não confirmada com certeza absoluta, mas evidência forte): o transporte
`pino-pretty` do Pino roda numa worker thread separada — se essa thread falhar silenciosamente
nesse ambiente de produção (ex.: `pino-pretty` resolvido de um jeito diferente dentro do
container Docker), o Pino engole a saída sem erro visível nenhum, e nada chega no `stdout`
que o `docker compose logs` lê. Como nunca tinha existido um log de diagnóstico via `logger`
testado em produção antes (só `console.log` espalhado pelo sistema), esse problema nunca
tinha sido notado.

**Correção**: trocado `logger.info` por `console.log` no log de diagnóstico de
`parseGunStoreReport`, e adicionados dois logs a mais em `importProducts` (`console.log` no
início, com o caminho do arquivo recebido, e no fim, com o resumo final) — isso serve tanto
pra ver a causa raiz da planilha não ser reconhecida quanto, como fallback, confirmar se a
função está sendo chamada de verdade.

**Lição pro futuro, já registrada na skill `atendeflow-dev`**: não confiar que `logger.info`
do Pino vai aparecer nos logs do Docker neste projeto sem antes confirmar — preferir
`console.log` pra qualquer log de diagnóstico temporário que precise ser visto com certeza.

## 86. Causa raiz real do "deploy não aplicou nada" + planilha-modelo pra download (v2.3.102)

### Contexto

Depois do log de diagnóstico da v2.3.101 também não aparecer em produção (mesmo sendo
`console.log`, à prova de falha), ficou claro que o problema não era mais no código — era
no próprio arquivo que estava sendo enviado pro build. Confirmado rodando `wc -l` no
arquivo `FinanceImportService.ts` do servidor: **310 linhas**, batendo exatamente com a
versão da v2.3.96 (antes do reconhecedor de relatório), enquanto o arquivo correto tem 514.

### Causa raiz

O roteiro de deploy usado desde a divergência git/GitHub (seção 7 da skill
`atendeflow-dev`) copia cada arquivo individualmente com
`git show origin/claude/tender-carson-h1zc86:<caminho> > <caminho>`. Esse comando lê do
**cache local** da referência `origin/claude/tender-carson-h1zc86` — que só é atualizado
rodando `git fetch` (ou `git pull`). A primeira tentativa de `git pull` (que falhou na
hora de reconciliar o merge) **fez o fetch com sucesso antes de falhar**, deixando a
referência local travada no commit da v2.3.96 (`bf6ca5a`). Nenhuma instrução de deploy
dada depois disso incluiu um novo `git fetch` — então toda cópia de arquivo nas rodadas
seguintes (correção da migration v2.3.97, reconhecedor do relatório v2.3.98, vínculo
Contato/Cliente v2.3.99, os dois logs de diagnóstico v2.3.100/101) continuava lendo essa
mesma referência desatualizada, trazendo sempre o conteúdo da v2.3.96 de volta — mesmo com
os commits certos já publicados no GitHub havia várias versões.

**Por que os builds "funcionavam" sem erro**: o Docker builda o que está no disco do
servidor naquele momento — como o `git show` sempre escrevia o mesmo conteúdo antigo (só
que de novo), o build sempre completava normalmente, só que recompilando a mesma versão
desatualizada repetidas vezes. Nada indicava isso nos logs do build.

**Nem tudo foi afetado**: os arquivos da Fase 6 original (campos de arma, migration — antes
de `bf6ca5a`) já estavam corretos porque a v2.3.96 (onde a referência ficou travada) é
posterior a eles, então já continha essas mudanças. `version.ts`/`package.json` também
sempre ficaram certos, porque são alterados por `sed` direto no conteúdo atual do arquivo,
sem depender de git nenhum momento.

### O que foi feito

- Identificado e corrigido rodando `git fetch origin claude/tender-carson-h1zc86` antes de
  repetir a cópia de todos os 8 arquivos de código afetados (ver lista completa na skill
  `atendeflow-dev`, seção dedicada a isso) — confirmado via `wc -l` batendo 514 linhas no
  `FinanceImportService.ts` antes de rebuildar.
- **Lição permanente, registrada na skill**: toda instrução de deploy baseada em
  `git show origin/<branch>:<arquivo>` (o fluxo usado enquanto o servidor estiver
  divergente do GitHub, seção 7) precisa vir precedida de `git fetch origin <branch>` —
  nunca assumir que a referência local já está atualizada, mesmo que um `git pull`
  anterior tenha rodado (ele pode ter feito o fetch e falhado só no merge).

### Planilha-modelo pra download (pedido separado, mesma sessão)

Cliente pediu, depois de validar a importação funcionando, um jeito de gerar a planilha do
zero "de acordo com os campos corretos do sistema" — cadastro de Clientes e Produtos por
enquanto (Fornecedores fica pra depois, mesmo padrão "fazer por parte").

- `FinanceImportService.ts`: `buildProductTemplate()`/`buildCustomerTemplate()` geram um
  `.xlsx` (via `XLSX.utils.aoa_to_sheet` + `XLSX.write(..., {type:"buffer"})`) com uma linha
  de cabeçalho e uma linha de exemplo preenchida (produto de exemplo: pistola Taurus G2C,
  mostrando os campos de arma preenchidos; cliente de exemplo com CPF e endereço completo).
  **Os títulos de coluna foram escolhidos a dedo pra normalizar exatamente igual a um alias
  já reconhecido** pelos mapeamentos de importação (`PRODUCT_MAPPINGS`/`CUSTOMER_MAPPINGS`)
  — ex.: "Preço Venda" em vez de "Preço de Venda", porque a preposição "de" mudaria o texto
  normalizado e o campo não seria reconhecido na reimportação (o casamento de alias é por
  igualdade exata do texto normalizado, não substring). Validado rodando o parser contra o
  próprio buffer gerado antes de considerar pronto.
- Rotas novas: `GET /finance/products/import-template`, `GET /finance/customers/import-template`
  (antes das rotas genéricas `/:id`, mesmo motivo já documentado pro vínculo Contato/Cliente).
- Frontend: `useFinance().<resource>.downloadTemplate(filename)` (blob + link temporário pra
  disparar o download do navegador) e botão "Baixar modelo" em `FinanceRecordList` — nova
  prop `allowTemplateDownload` (separada de `allowImport`, porque só Produtos/Clientes têm
  o endpoint; Fornecedores continua com importação mas sem modelo pra baixar, por enquanto).

### Testado

- `npx tsc --noEmit` limpo no backend; `eslint` limpo nos arquivos de frontend tocados.
- Gerado o buffer de cada modelo e reprocessado pelo próprio parser (`ts-node`) — todas as
  colunas reconhecidas corretamente, confirmado campo a campo contra os aliases.
- Não testado o download/fluxo completo no navegador nesta sessão (sem acesso à produção).
  **Pendente**: cliente confirmar que os botões aparecem e os arquivos baixam corretamente.

## 87. Busca com filtro em Produto/Cliente/Fornecedor — Vendas e Contas (v2.3.103)

### Contexto

Depois de importar o catálogo real (65 produtos), cliente pediu que os campos de
Produto (na tela de Vendas) e Cliente/Fornecedor (Vendas, Contas a Pagar/Receber)
tivessem busca com filtro — "o usuário digita o nome ou o código do produto e filtra
pra não ficar procurando um a um" — e que o mesmo valesse pra qualquer campo do
Financeiro que aponte pra outro cadastro.

### Causa raiz (por que não dava só pra trocar o componente visual)

Os dois lugares afetados montavam a lista de opções de formas diferentes, mas ambos
com o mesmo problema de fundo:

- **`SaleModal`** (Produto/Cliente na venda): recebia os arrays `customers`/`products`
  já prontos via prop, buscados **uma única vez** pelo `FiscalSalesPanel` ao entrar na
  aba Vendas, com `searchParam: ""`.
- **`FinanceRecordModal`**, campo tipo `asyncSelect` (Fornecedor em Despesas, Cliente em
  Contas a Receber): buscava a lista uma vez, ao abrir o modal, também com
  `searchParam: ""`.

Em ambos os casos, o endpoint `list()` de Produtos/Clientes/Fornecedores é **paginado,
20 registros por página** (`FinanceProductService.list`/`FinanceCustomerService.list`/
`FinanceSupplierService.list`) — com 65 produtos reais já cadastrados, esses campos só
enxergavam os 20 primeiros (por nome, ordem alfabética) e **os outros 45 produtos eram
impossíveis de selecionar na venda**, independente de qualquer melhoria visual. Só
trocar o componente de "select simples" por um "autocomplete com filtro" sobre essa
mesma lista capada não resolveria o problema de verdade — o filtro teria que buscar no
servidor, não só filtrar o que já tinha sido carregado.

### O que foi feito

- **`FinanceAsyncAutocomplete`** (`frontend/src/components/FinanceAsyncAutocomplete/`),
  componente novo reaproveitável: `Autocomplete` (`@material-ui/lab`, mesmo padrão já
  usado em `NewTicketModal` pra busca de contato) com busca no servidor via
  `fetchOptions(searchParam)`, atraso de 350ms na digitação (debounce, evita uma
  requisição por tecla), e `initialOptions` — garante que o registro já selecionado
  (ex.: editando uma conta cujo fornecedor não está entre os 20 mais recentes) sempre
  apareça como opção, mesmo antes de qualquer busca.
- **`FinanceRecordModal`**: campo `asyncSelect` trocado pra usar esse componente —
  removida a busca única ao abrir o modal (`asyncOptions`), cada campo busca sob
  demanda. Usa `record.<singular do optionsResource>` (ex. `record.supplier`,
  já embutido na resposta de listagem, usado pela própria coluna da tabela) como opção
  inicial ao editar.
- **`SaleModal`**: campos "Cliente" e "Produto/serviço" (por item) trocados da mesma
  forma — precisou passar a prop `finance` (o hook inteiro) por toda a cadeia
  `FiscalSalesPanel` → `SaleList` → `SaleModal`, que antes só recebiam os arrays já
  prontos. Os arrays `customers`/`products` que o `FiscalSalesPanel` já buscava uma vez
  continuam existindo, agora só como opção inicial (primeira exibição, antes de
  buscar) — a busca de verdade passa a ir sempre ao servidor.
- **Busca por CPF/CNPJ/e-mail já funcionava no backend** (`FinanceCustomerService.list`/
  `FinanceSupplierService.list`, `Op.or` em nome/documento/e-mail) — não precisou de
  nenhuma mudança de backend, só reaproveitar o `searchParam` já existente.

### Testado

- `npx tsc --noEmit` limpo no backend (sem mudança de backend nesta parte, só
  reconfirmado); `eslint` limpo nos 5 arquivos de frontend tocados.
- Não testado o fluxo completo no navegador nesta sessão (sem acesso à produção).
  **Pendente**: cliente confirmar, numa venda nova, que o campo Produto encontra um dos
  produtos importados que não está entre os 20 primeiros (ex.: buscar por "RIFLE" ou
  por um SKU específico) — esse é o caso que antes não tinha solução nenhuma.

### Ajuste (v2.3.104) — rótulo longo quebrando linha

Cliente testou em produção e reportou o rótulo dos dois campos ("Cliente (nome, CPF/CNPJ
ou e-mail — vazio = consumidor não identificado)" e "Produto/serviço (nome ou SKU — vazio
= item avulso)") quebrando linha dentro do campo compacto (`size="small"`), ficando
descentralizado. Rótulo longo cabe numa label de `TextField` padrão (uma linha, acima do
campo), mas não num campo pequeno lado a lado com outros. Trocado pra rótulo curto
("Cliente"/"Produto/serviço") + o texto de apoio movido pra `placeholder` (texto dentro
do campo, nunca quebra linha, só fica visível quando o campo está vazio) —
`FinanceAsyncAutocomplete` ganhou a prop `placeholder`, repassada direto pro `TextField`
interno do `Autocomplete`.

## 88. Fiscal multi-gateway + emissão automática na venda + código do produto nas vendas (v2.3.105)

### Contexto

Cliente perguntou como configurar o certificado digital pra emitir nota fiscal na hora
da venda. Investigando, o módulo Fiscal só tinha um gateway de verdade implementado
(Focus NFe) apesar do campo `gatewayProvider` já existir no model desde a Fase 3 "pra
usar no futuro". Ao explicar a arquitetura atual, cliente mudou o pedido: não tem
certeza se vai usar a Focus NFe, quer poder **escolher** o gateway; quer que a venda já
saia com a nota emitida (PDF/XML) assim que confirmada, sem passo manual extra; e no
longo prazo quer reconhecer um certificado digital instalado na máquina e falar direto
com Prefeitura/Sefaz, sem gateway nenhum.

Expliquei (não sou especialista em legislação fiscal, isso é responsabilidade do
cliente/contador validar) que emissão direta contra Sefaz/Prefeitura sem gateway é
ordens de grandeza mais complexo do que parece — 27 webservices estaduais diferentes,
nenhum padrão único de NFS-e entre os milhares de municípios, assinatura digital XML,
tratamento de contingência, risco de nota inválida gerando problema fiscal de verdade.
Perguntado qual caminho seguir, cliente escolheu **"Vários gateways, escolhível"**:
continuar emitindo por gateway homologado (como hoje), só que com a empresa podendo
trocar de gateway, em vez de ficar travada na Focus NFe ou de eu construir integração
direta/sem assinatura.

Durante a mesma sessão, revendo a tela de Vendas, cliente pediu separadamente que o
código do produto (SKU) aparecesse no módulo de Vendas — achado, ao investigar, que o
item da venda nunca guardava o SKU em lugar nenhum, e a nota fiscal usava o **id interno
do banco** como "código do produto" na Focus NFe (bug real, não só falta de exibição).

### O que foi feito — dispatcher de gateway

- **`FiscalGatewayService.ts`** (novo): interface `FiscalGatewayAdapter` com as mesmas
  três funções que `FocusNFeService` já exportava (`emit`/`getStatus`/`cancel`, mesma
  assinatura) — zero mudança necessária no `FocusNFeService` existente, só passou a ser
  registrado num mapa `GATEWAYS` por `provider`. `getGateway(provider)` lança
  `ERR_FISCAL_GATEWAY_NOT_SUPPORTED` pra um provider não registrado.
  `SUPPORTED_GATEWAYS` é a lista exposta pro frontend montar o seletor sem hardcodar
  nada lá — hoje só tem `focusnfe`, mas o próximo gateway real adicionado aparece na
  tela automaticamente.
- **`FiscalDocumentService.ts`**: as três chamadas que importavam `FocusNFeService`
  direto (`emit`, `refreshStatus`, `cancel`) passaram a usar
  `FiscalGatewayService.getGateway(config.gatewayProvider)` antes de chamar.
- **`FiscalConfigController.ts`** + `fiscalRoutes.ts`: novo endpoint
  `GET /fiscal/gateways`, mesma trava de acesso (`EnsureFiscalAccess`) dos outros.
- **`FiscalConfigPanel`**: seção "Gateway de emissão" deixou de ter o subtítulo fixo
  "(Focus NFe)" — ganhou um seletor (`gatewayProvider`) cujas opções vêm de
  `fiscal.config.gateways()`.

### O que foi feito — emissão automática ao confirmar a venda

- Novo campo `FiscalConfig.defaultDocumentType` (migration
  `20261016120000-add-default-document-type-to-fiscal-configs.ts`, `ADD COLUMN IF NOT
  EXISTS` — mesmo padrão idempotente da migration de armas, seção 11 da skill) —
  `""` (padrão) = não emitir automático, continua manual; `"nfe"`/`"nfce"`/`"nfse"` =
  emite esse tipo assim que a venda é confirmada.
- **`SaleController.confirm`**: depois de `SaleService.confirm` criar a conta a
  receber, se `defaultDocumentType` e `gatewayToken` estiverem configurados, chama
  `FiscalDocumentService.emit(...)` dentro de um `try/catch` — **nunca** deixa uma
  falha de emissão (gateway fora do ar, token errado, etc.) impedir a confirmação da
  venda ou a criação da conta a receber, que são o que realmente não pode falhar. A
  resposta ganhou um campo extra `fiscalAutoEmit: { attempted, success, type,
  errorMessage? }` pro frontend poder refletir o resultado se quiser (ainda não
  consumido no toast de confirmação — fica pra um próximo ajuste, se o cliente notar
  falta).
- **Decisão de onde colocar a orquestração**: no controller, não dentro de
  `SaleService.confirm`. `FiscalDocumentService.ts` já importa `SaleService` (pra
  revalidar que a venda existe e pertence à empresa antes de emitir) — se
  `SaleService` importasse `FiscalDocumentService` de volta, seria import circular.
  O botão manual "Emitir NF-e/NFC-e/NFS-e" em `SaleDetailModal` continua existindo
  normalmente, como fallback/override mesmo com emissão automática configurada.
- Fluxo de certificado digital (upload direto no AtendeFlow, decisão anterior do
  cliente) **ainda não implementado** — ficou decidido antes da mudança pra
  multi-gateway, precisa ser revisto quando um segundo gateway de verdade entrar,
  porque cada gateway pode ter uma forma diferente (ou nenhuma) de lidar com
  certificado pela própria API.

### O que foi feito — código do produto (SKU) nas vendas

- Novo campo `SaleItem.sku` (migration `20261016130000-add-sku-to-sale-items.ts`,
  mesmo padrão idempotente) — snapshot do SKU no momento da venda, mesma lógica já
  usada pra `description`/`ncm`/`cfop` (cadastro do produto pode mudar depois, a venda
  e a nota já emitida não podem mudar retroativamente).
  `SaleService`: `SaleItemData`/`buildItemRows` passam o `sku` adiante.
- **`FocusNFeService.buildItemsPayload`**: `codigo_produto` agora usa `item.sku` em
  vez do id interno do banco — esse era o valor que de fato ia pra nota fiscal emitida
  até aqui, corrigido independente do dispatcher de gateway.
- **Frontend**: `SaleModal` ganhou campo "Código (SKU)" por item (preenchido
  automaticamente ao escolher o produto no autocomplete, mas editável — item avulso
  sem produto cadastrado pode digitar um código à mão); `SaleDetailModal` ganhou a
  coluna "Código" na tabela de itens da venda confirmada.

### Testado

- `npx tsc --noEmit` limpo no backend; `eslint` limpo em todos os arquivos de frontend
  tocados (`FiscalConfigPanel`, `SaleModal`, `SaleDetailModal`, `useFiscal`).
- **Não testado** contra credencial de sandbox real de nenhum gateway (mesma ressalva
  já documentada pro `FocusNFeService` desde a Fase 3 — nunca foi validado end-to-end).
  **Pendente**: cliente decidir se/quando vai testar a emissão de verdade (precisa de
  um CNPJ homologado na Focus NFe ou no gateway escolhido), e confirmar visualmente
  que o SKU aparece certo nas vendas depois do deploy.

## 89. Focus NFe: carta de correção, e-mail, pré-visualização de DANFe, inutilização de numeração (v2.3.106)

### Contexto

Depois da v2.3.105 (gateway escolhível), cliente perguntou sobre um segundo gateway.
Expliquei que, sem conseguir abrir a documentação oficial de um gateway novo (bloqueio
de rede deste ambiente — `nfe.io`, `focusnfe.com.br`, `doc.focusnfe.com.br` todos dão
`ENOTFOUND` mesmo via `WebFetch`; só a busca por palavra-chave funciona, e só traz
resumo indireto), implementar um gateway novo "às cegas" seria arriscado demais pra
nota fiscal de verdade. Cliente decidiu contratar um gateway primeiro e me mandar a
documentação depois — enquanto isso, colou o índice inteiro da documentação da Focus
NFe (`doc.focusnfe.com.br/reference/nfe`) com o método/URL de cada endpoint (ele
conseguia abrir as páginas no navegador dele, mesmo eu não conseguindo daqui).

Com os endpoints confirmados de verdade (não mais só conhecimento geral), ficou viável
expandir o que já estava implementado (emitir/consultar/cancelar) com mais cobertura —
focando só no que faz sentido pra "venda de produto" numa loja física (não logística de
transportadora, não conciliação financeira, não o lado de notas recebidas de
fornecedor — tudo isso ficou registrado como ideia de backlog, não implementado).

### O que foi feito

- **`FocusNFeService.ts`**: cinco funções novas, batendo contra os endpoints reais
  confirmados pelo cliente:
  - `emitCorrectionLetter` — `POST /v2/nfe/{ref}/carta_correcao`, body `{ correcao }`.
    Só NF-e (carta de correção não existe pra NFC-e/NFS-e).
  - `sendByEmail` — `POST /v2/{tipo}/{ref}/email`, body `{ emails: [...] }`.
  - `previewDanfe` — `POST /v2/nfe/danfe`, mesmo payload de `buildNfePayload` (reaproveitado
    de `emit`), resposta é PDF binário (`responseType: "arraybuffer"`), não JSON. Não
    transmite nada pra Sefaz nem gera `ref`/`FiscalDocument` — só prévia.
  - `invalidateNumbering` — `POST /v2/nfe/inutilizacao`, body `{ serie, numero_inicial,
    numero_final, justificativa }`.
  - `listInvalidations` — `GET /v2/nfe/inutilizacoes`.
  - **Ressalva igual ao resto do adapter**: método/URL de cada endpoint vieram de curl
    real colado pelo cliente (alta confiança), mas o **formato do corpo** de cada
    request (nomes de campo) foi reconstruído por conhecimento geral — os exemplos do
    cliente só mostravam `{}`/`{"items":[]}` genérico, sem o schema completo. Precisa
    validar contra conta de homologação de verdade.
- **`FiscalGatewayAdapter`** (`FiscalGatewayService.ts`): as cinco funções entraram como
  métodos **opcionais** na interface (`emitCorrectionLetter?`, `sendByEmail?`,
  `previewDanfe?`, `invalidateNumbering?`, `listInvalidations?`) — nem todo gateway
  futuro vai ter equivalente de cada uma. Novo helper `requireFeature(gateway, nome)`
  lança `ERR_FISCAL_FEATURE_NOT_SUPPORTED_BY_GATEWAY` se o gateway atual não implementa
  aquele método, em vez de cada service repetir o mesmo `if (!gateway.x) throw`.
- **`FiscalDocumentService.ts`**: `emitCorrectionLetter`/`sendByEmail`/`previewDanfe`
  novos — os dois primeiros exigem documento `authorized`; `previewDanfe` funciona com
  a venda ainda em rascunho (é justamente pra conferir antes de confirmar/emitir).
- **`FiscalNumberingService.ts`** (novo arquivo): `invalidate`/`list` — inutilização é
  nível empresa+série, não está ligada a nenhuma venda/FiscalDocument específico, por
  isso não entrou em `FiscalDocumentService`.
- Rotas novas em `fiscalRoutes.ts`: `POST /fiscal-documents/:id/correction-letter`,
  `POST /fiscal-documents/:id/send-email`, `POST /sales/:saleId/fiscal-documents/preview`
  (devolve o PDF direto, `Content-Type: application/pdf`, não JSON),
  `GET`/`POST /fiscal/numbering/invalidations`.
- **Frontend**: `SaleDetailModal` ganhou botões "Enviar por e-mail" e "Carta de
  correção" por nota autorizada (com diálogo próprio cada um — e-mail pré-preenchido
  com o do cliente da venda), e "Pré-visualizar DANFe" na venda confirmada (abre o PDF
  em nova aba via blob URL). `FiscalConfigPanel` ganhou uma segunda seção
  (`NumberingInvalidationPanel`, sub-componente no mesmo arquivo) com formulário de
  inutilização + tabela das já registradas — não usa Formik como o resto do painel
  porque não é um valor salvo pra reinicializar, é uma ação pontual a cada envio.

### Descartado por enquanto (fora do escopo "venda de produto")

Da documentação completa que o cliente colou, ficou de fora: Registrar/Cancelar Ator
Interessado, Registrar/Cancelar Insucesso na Entrega (logística de transportadora),
Conciliação Financeira/ECONF, Emitir/Cancelar Evento genérico, Importar NFe, DANFe
Etiqueta (HTML/PDF), Reenvio de notificação de webhook, toda a seção "Documentos
Recebidos" (CTe/NFe/NFSe recebidas — é o lado de COMPRA, reconciliação com nota de
fornecedor, feature separada e maior), "Gestão" (Criar/Listar/Atualizar/Excluir Empresa,
Backups, Emails Bloqueados, Webhooks) e "Ferramentas" (Comunicador Offline — app local
pra contingência de NFC-e sem internet no PDV, arquitetura bem diferente). Também veio
a lista de "APIs Acessórias" (CEP, CFOP, CNAE, CNPJ, Municípios, NCM) — ideia de
backlog pra facilitar cadastro (auto-preencher endereço por CEP, dados de cliente por
CNPJ, achar NCM/CFOP/código IBGE certo), não implementado.

Confirmado com o cliente: o cadastro da empresa na própria Focus NFe ("Criar Empresa")
já foi feito manualmente pelo painel deles — não é um passo que falta automatizar no
AtendeFlow.

### Testado

- `npx tsc --noEmit` limpo no backend; `eslint` limpo nos 3 arquivos de frontend
  tocados (`FiscalConfigPanel`, `SaleDetailModal`, `useFiscal`).
- **Não testado contra API real** — mesma ressalva de sempre, agora também pras cinco
  funções novas. Cliente está em contato com a Focus NFe pra conseguir o token de
  homologação; assim que tiver, é o primeiro teste de ponta a ponta de todo o módulo
  fiscal desde que ele existe.

## 90. Importação de Clientes: ajustes pro Relatório de Clientes real (v2.3.107)

### Contexto

Cliente pediu pra "migrar" o cadastro de clientes do ERP antigo — chamou de "XMLs" na
primeira mensagem, mas era na verdade `.xls` (Excel antigo). Mandou o arquivo real
("Relatorio de Clientes - Excel - Confiança Armas"), 205 linhas de clientes.

### Causa raiz

O importador genérico de Clientes/Fornecedores já existia (v2.3.96), mas o casamento de
cabeçalho é por **igualdade exata** do texto normalizado (sem acento, minúsculo, só
`[a-z0-9]`), não substring — mesma pegadinha já batida e documentada pro importador de
Produtos (planilha-modelo, v2.3.102). Três colunas do relatório real não batiam com
nenhum apelido cadastrado:
- "Nome / Razão Social" normaliza pra `nomerazaosocial`, mas só existia o apelido
  `razaosocial` (sem o prefixo "nome").
- "Telefone 1" normaliza pra `telefone1`, mas só existia `telefone` (sem o número).
- "Compl." normaliza pra `compl`, mas só existiam `complemento`/`complement` por
  extenso.

Resultado antes do ajuste: 0 de 205 linhas reconhecidas (nome sempre vazio → toda linha
cai em `summary.invalid`). Achado rodando o parser contra o arquivo real num script
Node avulso (reaproveitando a lib `xlsx` já instalada no backend) **antes** de mudar
qualquer código — mesma disciplina de "testar contra o dado real primeiro" que vinha
sendo seguida pro importador de Produtos.

### O que foi feito

- `FinanceImportService.ts`: adicionados os três apelidos que faltavam
  (`nomerazaosocial` em `name`, `telefone1` em `PHONE_ALIASES`, `compl` em
  `complement`) — correção mínima, sem mexer em mais nada do importador genérico.
- **Preservação de dado sem campo correspondente**: o relatório real tem várias colunas
  que não existem em `FinanceCustomer`/`FinanceSupplier` (Código do sistema antigo,
  Nome Fantasia/Apelido, Data Nasc., RG/IE, Telefone 2/3, Fax, Nome para Contato). Em
  vez de descartar, `buildLegacyNotes()` (novo helper) concatena esses valores no campo
  `notes`, com dedup inteligente: pula a linha quando o valor é idêntico (comparado via
  o mesmo `normalizeHeader` já usado pro casamento de cabeçalho — ignora
  acento/case/pontuação) a um campo já capturado (`name` ou `phone`) — comum nesse
  relatório real: "Nome Fantasia" igual ao nome (cliente pessoa física sem nome
  fantasia próprio) e "Telefone 2"/"Telefone 3"/"Fax"/"Nome para Contato" repetindo o
  mesmo número de "Telefone 1" com formatações diferentes.
- **Data de nascimento como serial do Excel**: `readRows()` lê com `raw: true`
  (intencional — Produtos depende disso pro parser de preço/estoque em formato
  brasileiro, não dá pra mudar o default sem revalidar aquele importador também), então
  uma célula de data vem como número (dias desde 30/12/1899), não como texto. Resolvido
  pontual, só pro campo "Data nascimento" das notas, com `excelSerialToDateString()`.

### Testado

- `npx tsc --noEmit` limpo no backend.
- **Rodado o parser (réplica fiel da lógica, sem gravar no banco) contra o arquivo real
  do cliente**: 205/205 linhas reconhecidas depois do ajuste (eram 0/205 antes). Datas
  de nascimento conferidas manualmente contra o valor bruto da planilha (bate: célula
  mostrando "4/10/88" vira "10/04/1988" nas notas). Conferido que as colunas
  redundantes (Nome Fantasia/Telefone 2-3/Fax/Nome para Contato) não aparecem
  duplicadas nas notas quando repetem valor já capturado.
- **Não rodado o import de verdade contra o banco** (sem acesso a produção/banco desta
  sessão) — só a lógica de parsing/mapeamento foi validada. Cliente precisa fazer o
  upload de verdade pela tela (Financeiro → Clientes → Importar) depois do deploy pra
  confirmar os 205 registros criados.

## 91. Paginação na lista de Produtos/Clientes/Fornecedores/Contas (v2.3.108)

### Contexto

Depois de importar o cadastro de Clientes (seção 90), cliente reportou: "tem 206
clientes cadastrados e só aparece 20 (...) a mesma coisa está para cadastro de
produto" (60 produtos cadastrados) — queria um jeito de avançar página conforme for
adicionando mais registros.

### Causa raiz

`FinanceCustomerService.list()`/`FinanceProductService.list()`/`FinanceSupplierService
.list()` (e os services de Contas a Pagar/Receber) já paginam no servidor — `limit = 20`
fixo, aceitam `pageNumber`, devolvem `{ records, count, hasMore }` — desde a Fase 1/2 do
roadmap. Mas `FinanceRecordList` (`frontend/src/components/FinanceRecordList/`), o
componente de lista/CRUD genérico usado por todos esses cadastros, **nunca mandava
`pageNumber`** no `resource.list(...)` e **não tinha nenhum controle de página na
tela** — sempre buscava (e só conseguia mostrar) a página 1. Com até 20 registros
cadastrados isso nunca apareceu como problema; só virou visível de verdade agora que o
cliente importou o cadastro de Clientes real (205 registros, seção 90) e tem 60
produtos — a partir do 21º registro, não tinha NENHUM jeito de ver o resto pela tela
(só achando um registro específico pela busca).

### O que foi feito

- `FinanceRecordList`: novo estado `pageNumber`/`count`; `fetchRecords` passa
  `pageNumber` pro `resource.list(...)` e guarda `count` da resposta. `TablePagination`
  (`@material-ui/core`, já uma dependência existente) no rodapé da tabela —
  `rowsPerPageOptions={[20]}` fixo (não é configurável aqui, só reflete o `limit` fixo
  do backend).
- Novo `useEffect` separado reseta `pageNumber` pra 1 sempre que `searchParam` ou
  `filterValues` mudam (ou ao trocar de aba — reaproveita o `resource` já usado como
  dependência “reforço” documentado na seção anterior do componente) — sem isso, uma
  busca nova podia abrir numa página sem nenhum resultado (ex.: filtrando e ficando na
  página 5 de uma busca que só tem 2 páginas).
- Nenhuma mudança de backend — os services já devolviam tudo que a paginação precisava
  desde que foram criados, só não tinha consumidor nenhum na tela.

### Testado

- `npx eslint` limpo no arquivo tocado; `npx tsc --noEmit` limpo no backend (sem mudança
  de backend nesta parte, só reconfirmado).
- Não testado no navegador nesta sessão (sem acesso à produção). **Pendente**: cliente
  confirmar, depois do deploy, que a paginação aparece nas 4 telas (Produtos, Clientes,
  Fornecedores, Contas) e que navegar entre páginas mostra os registros certos (ex.:
  achar um dos 205 clientes importados que não está na primeira página).

## 92. Homologação/Produção separadas, CFOP e Município com busca (v2.3.109)

### Contexto

Cliente conseguiu o token da Focus NFe e mandou print do painel deles pra configurar
antes de testar a emissão de verdade pela primeira vez. Olhando o print, pediu quatro
coisas:
1. CFOP com busca ("quando digitar aparece, pra não ficar procurando").
2. Código IBGE do município preenchido automático (escolhe Estado, depois Município).
3. Homologação e Produção como campos separados, cada uma com botão de ligar/desligar
   — copiando o padrão que viu no próprio painel da Focus NFe (lá os dois ambientes
   são blocos de credencial simultâneos, não um token único alternando).
4. Perguntou se precisa anexar certificado digital no AtendeFlow ou se já está
   atrelado ao token.

### Resolvido sem código — pergunta 4

Pelo próprio print que o cliente mandou: "Certificado Digital: Válido" aparece como
dado da conta **na Focus NFe** (`app-v2.focusnfe.com.br/minhas-empresas/empresas/...`),
não é nada que o AtendeFlow precise receber/guardar. O token de acesso só autentica
as chamadas de API em nome dessa empresa já com certificado anexado lá. Resolve de vez
a dúvida que ficou em aberto desde o início da Fase 3 fiscal sobre upload de
certificado — **não existe esse passo no nosso sistema, pelo menos pra Focus NFe.**

### Homologação/Produção separadas (pergunta 3)

- **Migration** `20261016140000-split-fiscal-gateway-token-by-environment.ts`:
  `gatewayToken` (coluna única antiga) não é removida do banco (evita perder token já
  salvo), mas novo código não lê/escreve mais nela. Colunas novas:
  `gatewayTokenSandbox`, `gatewayTokenProduction`, `sandboxEnabled` (default `true`),
  `productionEnabled` (default `false`). A migration copia o valor antigo de
  `gatewayToken` pra `gatewayTokenSandbox` (homologação era o único ambiente usado até
  aqui).
- **`FiscalConfigService.getActiveGatewayToken(config)`**: helper central que decide
  qual token vale AGORA (baseado em `gatewayEnvironment`) — usado por
  `FocusNFeService.buildClient`, `FiscalDocumentService` (emit/preview) e
  `FiscalNumberingService`, em vez de cada um checar os dois campos na mão.
- **`FiscalConfigService.update`** ganhou uma validação: não deixa salvar um estado
  onde o "Ambiente ativo" (`gatewayEnvironment`) aponta pra um ambiente que está sendo
  desabilitado na mesma chamada — evita "emitir sem token nenhum" sem nenhum aviso
  (`ERR_FISCAL_ENVIRONMENT_NOT_ENABLED`, sem tradução, mesma convenção do resto do
  Financeiro — ver seção 11 da skill `atendeflow-dev`).
- **Frontend**: `FiscalConfigPanel` — "Ambiente ativo" (era só "Ambiente") só lista os
  ambientes habilitados; dois cartões lado a lado "Homologação"/"Produção", cada um com
  `Switch` "Habilitada" + campo de token próprio (desabilitado quando o switch está
  desligado).

### CFOP e Município com busca (perguntas 1 e 2)

- **Sem acesso à documentação oficial de novo** (mesmo bloqueio de rede de sempre —
  `WebFetch` não abre `nfe.io`/`focusnfe.com.br`), mas dessa vez os dados não dependem
  de nenhum gateway: são tabelas públicas e fixas (CFOP é definido por Convênio/Ajuste
  SINIEF, municípios são do IBGE). `WebFetch`/`curl` CONSEGUEM acessar
  `raw.githubusercontent.com` normalmente (diferente de `nfe.io`/`focusnfe.com.br`) —
  descoberta nova: o bloqueio de rede deste ambiente parece ser por domínio
  específico, não geral.
  - CFOP: `github.com/gleisonnanet/cfop` (CSV público, MIT), 601 linhas, conferido
    manualmente contra códigos conhecidos (5101/5102/5405/5929) antes de usar.
  - Municípios: `github.com/kelvins/municipios-brasileiros` (CSV público, MIT), 5.570
    municípios + DF, conferido contra contagem oficial por estado (MG 853, SP 645,
    RS 497 batem).
- **`frontend/src/data/cfopList.js`** (novo, ~600 entradas `{value, label}`) e
  **`frontend/src/data/municipiosBrasil.js`** (novo — `UF_LIST`, `MUNICIPIOS_BY_UF`
  agrupado por sigla, `UF_BY_CODE_PREFIX` pra inferir a UF a partir dos 2 primeiros
  dígitos de um código IBGE já salvo) — gerados uma vez por script Node a partir dos
  CSVs baixados, não buscados em tempo de execução (tabela fixa, não muda com
  frequência; evita dependência de rede em produção).
- **`CfopAutocomplete`** (novo componente reaproveitável,
  `frontend/src/components/CfopAutocomplete/`): `Autocomplete` do `@material-ui/lab`
  com a lista inteira já carregada, filtro 100% client-side — diferente do
  `FinanceAsyncAutocomplete` (busca no servidor), não precisa disso aqui porque não é
  paginado nem específico de empresa. Usado no "CFOP padrão" da Configuração Fiscal e
  no CFOP de cada item em `SaleModal`.
- **`CityCodeSelector`** (sub-componente local em `FiscalConfigPanel`): select de UF
  + `Autocomplete` de Município (filtrado pela UF escolhida) — ao selecionar o
  município, preenche `cityCode` com o código IBGE. A UF não é um campo do model (só
  `cityCode` é salvo) — ao reabrir um registro já salvo, a UF inicial é inferida dos 2
  primeiros dígitos do próprio `cityCode` via `UF_BY_CODE_PREFIX`.
- Bundle do frontend cresceu ~65 KB (gzip) com as duas tabelas — aceitável pra uma
  ferramenta administrativa interna, confirmado rodando `npm run build` completo
  antes de considerar pronto.

### Testado

- `npx tsc --noEmit` limpo no backend; `eslint` limpo em todos os arquivos de
  frontend tocados (incluindo os dois arquivos de dados gerados).
- **`npm run build` completo do frontend rodado com sucesso** (não só lint) — confirma
  que os dois arquivos de dados grandes (82 KB/373 KB de código fonte) não quebram o
  build nem o bundling.
- **Não testado contra o gateway de verdade nesta parte** — o cliente já tem o token
  de homologação, mas ainda não confirmou ter configurado/testado através dessa tela
  nova. **Pendente**: cliente configurar Homologação com o token real, emitir a
  primeira NF-e/NFC-e de teste, e confirmar que CFOP/Município aparecem e filtram
  certo na tela.

### Ajuste (v2.3.110) — alinhamento do grid

Cliente testou em produção e reportou "painel desorganizado" (print). Causa: o
`Grid` (MUI, `flex-wrap`) preenche linha por linha somando a largura (`sm`) de cada
item — um campo de largura menor logo depois de um grupo que não fechava a linha em
12 "escorregava" pro lado errado. Especificamente: "Tipo de documento padrão" (`sm=6`)
deixava só 6 livres na linha, que o cartão "Homologação" (`sm=6`) preenchia; o cartão
"Produção" (`sm=6`) então abria linha nova sozinho, e "Série NF-e" (`sm=4`) grudava do
lado dele em vez de ficar junto de "Série NFC-e"/"Série NFS-e". Corrigido fazendo
"Tipo de documento padrão" e "CFOP padrão" ocuparem a linha inteira (`sm=12`) — assim
Homologação/Produção (6+6=12) e as três Séries (4+4+4=12) sempre fecham a própria
linha antes do próximo grupo começar, sem depender de sobra de espaço do grupo
anterior. **Lição**: ao montar um formulário com `Grid` misturando itens de larguras
diferentes (cartão grande + campo pequeno), somar a largura de cada "grupo" e garantir
que feche 12 antes do próximo, ou isolar grupos de tamanho diferente em linhas
(`xs=12`) próprias — não só empilhar itens na ordem e confiar no wrap automático.

### Ajuste (v2.3.111) — "Tipo de documento padrão" só NF-e/NFC-e

Cliente reportou o seletor mostrando 3 tipos (NF-e/NFC-e/NFS-e) quando só trabalha com
dois — confirma o que já tinha dito mais cedo ao escolher quais funções habilitar no
painel da Focus NFe. Removido "NFS-e" de `DEFAULT_DOCUMENT_TYPE_OPTIONS`
(`FiscalConfigPanel`). Não mexeu em mais nada NFS-e-relacionado (emissão manual
continua em `SaleDetailModal`, `FocusNFeService.buildNfsePayload` intacto) — só deixou
de aparecer como opção de emissão AUTOMÁTICA, caso o cliente volte a precisar depois
(ex.: cobrar serviço separado de venda de produto) é só adicionar de volta na lista.

## 93. Removido o seletor "Ambiente ativo" da Configuração Fiscal (v2.3.112)

### Contexto

Pedido do cliente, depois de testar a tela nova de Homologação/Produção separadas
(v2.3.109): "que só deveria ter os campos homologação e produção" — o campo "Ambiente
ativo" (select separado escolhendo qual das duas credenciais vale pra emitir) saiu,
ficando só os dois cartões (cada um com seu liga/desliga próprio). Antes de mexer,
cheguei a perguntar se a ideia era os dois toggles virarem mutuamente exclusivos — não
era isso, era simplesmente tirar o terceiro campo redundante.

### O que foi feito

- **`FiscalConfigService.isProductionActive(config)`** (novo): deriva qual ambiente
  está ativo direto de `productionEnabled` — Produção habilitada tem prioridade (é a
  "de verdade", bate com o fluxo descrito pelo cliente: testa em Homologação, quando
  valida passa a usar Produção); senão usa Homologação, se estiver habilitada; se
  nenhuma estiver, não tem token (tratado como gateway não configurado pelos
  callers). `getActiveGatewayToken` passou a usar esse helper em vez de ler
  `config.gatewayEnvironment`.
- **`FocusNFeService.buildClient`**: mesma lógica (`!!config.productionEnabled`) pra
  decidir a URL-base (homologação/produção), duplicada ali de propósito — evita
  acoplar `FocusNFeService` a `FiscalConfigService` só por uma linha.
- **`FiscalConfigService.update`**: a validação `ERR_FISCAL_ENVIRONMENT_NOT_ENABLED`
  (impedir o seletor apontar pra um ambiente desligado, da v2.3.109) saiu junto — não
  fazia mais sentido sem o seletor pra validar.
- `FiscalConfig.gatewayEnvironment` (coluna) não foi removida do banco (mesmo motivo
  de `gatewayToken`, seção 92) — só nenhum código novo lê/escreve nela.
- Frontend: campo "Ambiente ativo" e `ENVIRONMENT_OPTIONS` saíram de
  `FiscalConfigPanel`; "Gateway" virou largura cheia (sozinho na linha agora);
  helper text do token de Produção ganhou uma nota ("tem prioridade sobre
  Homologação") pra deixar a regra visível na tela, já que não tem mais um campo
  explícito mostrando qual está ativo.

### Testado

- `npx tsc --noEmit` limpo no backend; `eslint` limpo no `FiscalConfigPanel`.
- Não testado contra o gateway de verdade nesta parte (mesma ressalva de sempre).
  **Pendente**: cliente confirmar visualmente que a tela ficou só com os dois cartões,
  e que ligar/desligar Produção realmente muda qual token é usado ao emitir.

## 94. Primeiro teste real contra a Focus NFe — erro de validação de XML (v2.3.113)

### Contexto

Cliente configurou o token de Homologação e tentou emitir NF-e/NFC-e/NFS-e numa
venda de teste — primeira chamada de verdade contra a Focus NFe desde que o módulo
fiscal existe. NFS-e deu "Empresa ainda não habilitada para emissão" (esperado — só
NFe/NFCe foram habilitadas no painel deles). NF-e e NFC-e deram "Erro na validação do
Schema XML" — confirma que a chamada chegou no gateway (token/conexão funcionando),
só o payload que `FocusNFeService.buildNfePayload`/`buildNfcePayload` monta não bate
com o que a Sefaz espera em algum campo. Precisa da mensagem completa do erro pra
saber qual campo corrigir.

### Bloqueio encontrado ao diagnosticar

A mensagem de erro aparecia cortada em 40 caracteres na tela ("Erro na validação do
Schema XML, verifiq...") com o resto só visível passando o mouse (tooltip) — não dá
pra ler/copiar isso de um print de tela (que é como o cliente está me mandando a
informação). Corrigido: `SaleDetailModal` agora mostra a mensagem de erro inteira,
direto na linha (sem cortar, sem depender de hover).

### Pendente

Aguardando o cliente mandar a mensagem de erro completa (depois do deploy desta
versão) pra eu poder comparar o payload que `FocusNFeService` monta contra o que a
API da Focus NFe realmente espera, e corrigir o campo que estiver errado — é
exatamente o tipo de ajuste já previsto desde que o adapter foi escrito sem acesso a
sandbox real.

## 95. Módulo de estoque: bloqueio, desconto/devolução automática, painel de saúde (v2.3.114)

### Contexto

Testando a emissão de NF-e, cliente notou: "o produto não tem em estoque" — o sistema
nunca mexia em `stockQuantity` em venda nenhuma (nem descontava, nem bloqueava vender
mais do que tinha). Perguntado como queria que funcionasse, pediu um módulo
completo: painel pra ver se o estoque está saudável, aviso configurável de estoque
baixo por produto, e bloquear a venda quando não tiver disponível (confirmado
"opção 1" — bloquear, não só avisar). Desconto só na confirmação da venda (não no
rascunho), confirmado também.

### O que foi feito

- **Migration** `20261016150000-add-min-stock-quantity-to-finance-products.ts`:
  `FinanceProduct.minStockQuantity` (padrão `0` = sem aviso configurado pra esse
  produto).
- **`SaleService.ts`**:
  - `ensureStockAvailable(sale)`: antes de confirmar, para cada item com produto
    vinculado E `controlStock` ligado, compara `quantity` pedida contra
    `stockQuantity` disponível — se algum item pedir mais do que tem, lança
    `AppError` com mensagem listando produto/disponível/pedido (não é um código
    `ERR_*` fixo — mensagem dinâmica, mesma convenção do Financeiro de não traduzir
    esses erros, seção 11 da skill).
  - `adjustStock(sale, direction)`: `1` desconta (ao confirmar), `-1` devolve (ao
    cancelar uma venda que ESTAVA confirmada) — mesma função nos dois sentidos,
    usando `FinanceProduct.increment("stockQuantity", {by, where})`. Só mexe em
    item com produto vinculado + `controlStock` ligado, igual a validação acima.
  - `confirm()`: chama `ensureStockAvailable` antes de criar a conta a receber (se
    tiver falta, nem chega a criar a conta), e `adjustStock(sale, 1)` depois de
    criar — desconta só se tudo deu certo.
  - `cancel()`: chama `adjustStock(sale, -1)` **só se `sale.status === "confirmed"`**
    antes de cancelar — uma venda ainda em rascunho nunca descontou nada, não tem o
    que devolver. Resolve também o caso de limpar vendas de teste (cliente perguntou
    sobre isso testando a Focus NFe): cancelar uma venda de teste confirmada já
    devolve o estoque sozinho.
  - `includeOptions` (usado em `show`/`list`) ganhou `controlStock`/`stockQuantity`
    nos atributos do `product` incluído — `confirm`/`cancel` precisam desses campos
    sem fazer outra consulta.
- **`FinanceReportService.getStockHealth(companyId)`** (novo): lista produtos com
  `controlStock = true` e `active = true`, separados em `outOfStock`
  (`stockQuantity <= 0`) e `lowStock` (`stockQuantity <= minStockQuantity`, só
  quando `minStockQuantity > 0` — `0` é "sem aviso configurado", não "o mínimo é
  zero"). Rota `GET /finance/reports/stock-health`, mesmo padrão dos outros
  relatórios (`summary`/`cashflow`/`expenses-by-category`).
- **Frontend**:
  - `financeConfig.js`: novo campo "Estoque mínimo (aviso no painel, 0 = sem aviso)"
    no formulário de Produto, só visível quando "Controlar estoque" está ligado
    (`visibleWhen: hasStockControl`, mesmo padrão já usado pros campos de
    arma/munição).
  - `FinancePainel`: nova seção "Situação do estoque" — tabela com os produtos
    zerados/baixos (zerados primeiro), chip vermelho "Zerado"/laranja "Baixo". Três
    estados: nenhum produto rastreado, tudo saudável, ou lista de problemas.
  - `useFinance().reports.stockHealth()` — mesmo padrão dos outros relatórios.

### Testado

- `npx tsc --noEmit` limpo no backend; `eslint` limpo em todos os arquivos de
  frontend tocados.
- Não testado contra dado real (sem acesso a produção). **Pendente**: cliente
  confirmar, numa venda de teste, que (a) vender mais do que o estoque disponível é
  bloqueado com mensagem clara, (b) confirmar desconta o estoque certo, (c) cancelar
  uma venda confirmada devolve o estoque, (d) o Painel Financeiro mostra a seção de
  estoque corretamente.

## 96. Erro interno sempre que abria a Configuração Fiscal (v2.3.115)

### Contexto

Cliente reportou "dando erro interno toda vez que abre o módulo fiscal" (print
mostrando um toast "Internal server error" por cima da tela, mas a tela em si já
carregada com os dados reais — regime tributário, Estado/Município, gateway, token de
Homologação, tudo certo). O erro vinha de outra chamada da mesma tela, não da que
carrega a configuração.

### Causa raiz

`NumberingInvalidationPanel` (seção "Inutilizar numeração de NF-e", dentro de
`FiscalConfigPanel`) busca a lista de inutilizações já registradas assim que a tela
abre (`fiscal.numbering.list()`). Essa chamada desce até
`FocusNFeService.listInvalidations(config)` — que, revendo o arquivo, era a ÚNICA das
sete funções novas da Focus NFe (v2.3.106) sem `try/catch` em volta da chamada HTTP.
Qualquer falha ali (ex.: a Focus NFe responder de um jeito que a lib HTTP trata como
erro quando não existe nenhuma inutilização registrada ainda) virava uma exceção não
tratada, subindo até o Express e voltando como 500 — derrubando a tela inteira com
"Internal server error" mesmo ela já tendo os dados principais carregados e exibidos.

### O que foi feito

- `FocusNFeService.listInvalidations`: adicionado `try/catch` igual às outras seis
  funções do arquivo — em caso de falha, devolve lista vazia em vez de propagar o
  erro. A seção "Inutilizações já registradas" já tratava lista vazia graciosamente
  ("Nenhuma inutilização registrada ainda."), então o conserto é só não deixar a
  exceção escapar.

### Testado

- `npx tsc --noEmit` limpo no backend.
- Não testado contra o gateway de verdade nesta sessão (sem acesso a produção).
  **Pendente**: cliente confirmar que a Configuração Fiscal abre sem o erro depois
  do deploy.

## 97. Importação de vendas históricas — migração de ERP (v2.3.116)

### Contexto

Cliente migrou de outro sistema (ERP anterior) para o AtendeFlow e pediu pra
"lançar as vendas pela planilha excel pois fiz a migração de outro sistema pra
esse" — essas vendas **já aconteceram de verdade** e **já têm NF-e emitida** no
sistema anterior (confirmado: "todas com notas fiscais"). A importação precisa
só *registrar* esse histórico no AtendeFlow, nunca tratar como venda nova.

Três decisões confirmadas explicitamente com o cliente antes de implementar
(pedido ambíguo o bastante pra exigir checagem, por instrução permanente deste
repositório):

1. **Nunca chamar o gateway de emissão** (Focus NFe) — a nota já existe de
   verdade no sistema anterior; chamar o gateway geraria uma segunda nota
   fiscal real pra uma venda que já foi faturada. A numeração de produção da
   Focus NFe (quando o cliente trocar de homologação pra produção) deve
   recomeçar em 492 — mas isso é configuração no próprio painel da Focus NFe,
   não no código do AtendeFlow.
2. **Nunca mexer em `FinanceProduct.stockQuantity`** — confirmado: "não mexe
   no estoque, pois só a partir de hoje as vendas lançadas que vai mexer no
   estoque". A importação faz os registros `Sale`/`SaleItem` diretamente,
   sem passar por `SaleService.confirm()` (que é o único lugar que desconta
   estoque).
3. **Quais situações importar, e o que cada uma gera** — perguntado via
   questionário porque o relatório real do cliente ("Relatório de Notas –
   Consulta de Notas Fiscais - Analítico") trouxe 3 situações distintas
   (Aprovada / Cancelada / "NF-e Rejeitado") sem um mapeamento óbvio pro
   modelo de dados do AtendeFlow (`Sale.status` tem só
   draft/confirmed/cancelled; `FiscalDocument.status` tem
   processing/authorized/error/cancelled). Cliente confirmou: importar as 3,
   e criar `FinanceReceivable` já como "recebida" pra cada venda importada
   (pedido: "Cria conta a receber já como 'recebida'").

Sobre o pedido de "gravar o ID da nota num arquivo na pasta do AtendeFlow pra
backup" — esclarecido com o cliente que era só querer **saber em qual pasta**
esse tipo de arquivo ficaria (não necessariamente um pedido firme de construir
um novo recurso de log em arquivo). Resposta dada: o único caminho que
sobrevive a um rebuild é o volume Docker nomeado `atendeflow_public`, montado
em `/app/public` dentro do container `backend` (ver `docker-compose.coolify.yml`)
— qualquer outro caminho dentro do container é perdido em todo
`docker compose up -d --build`. Como os dados já ficam gravados no Postgres
(que já tem backup diário, segundo o próprio cliente), nenhum arquivo extra
foi criado — ficaria redundante.

### Formato do relatório — máquina de estados, não offset fixo

O "Relatório de Produtos" original (seção 6.2 Fase 6, importador de produtos)
usa um offset de linha FIXO por registro. O "Relatório de Notas" **não dá**
pra parsear assim: cada nota tem um bloco de tamanho **variável**, porque o
número de linhas de item depende de quantos produtos aquela nota teve.

Solução: `SaleImportService.parseNotesReport()` lê linha a linha e classifica
cada uma pelo *conteúdo das colunas* (reconhecimento de padrão), não pela
posição:

- **Linha de cabeçalho de nota**: coluna 0 é só dígitos (número da nota),
  coluna 3 contém "/" (é uma data) e coluna 12 é uma das 3 situações
  conhecidas (`KNOWN_STATUSES`). Início de uma nota nova.
- **Linha de item**: coluna 1 (SKU) e coluna 5 (descrição) não vazias.
  Acumula no array `items` da nota atual.
- Qualquer outra linha (resumo "Qtde Produtos: N", linha em branco, rodapé de
  página) não casa com nenhum dos dois padrões acima — ignorada por omissão,
  sem precisar de uma checagem explícita de exclusão.

Validado com o arquivo real do cliente ("Relatorio_de_Notas - Federacao
Baiana.xlsx") antes de liberar: 486 notas extraídas de 5.535 linhas, 100% com
cliente e pelo menos 1 item, soma do total das notas (R$ 801.825,25) e soma
calculada a partir dos itens (R$ 801.995,25) batendo a menos de 0,1% de
diferença (1 nota em 486 com uma diferença maior que R$ 1 — provavelmente um
desconto real do próprio sistema anterior, não um erro de parsing).

### Formato numérico americano — outro helper, não reaproveitar `parseBrazilianDecimal`

Esse relatório específico usa separador de milhar "," e decimal "."
(ex.: `"5,100.00"`) — o **inverso** do formato brasileiro que
`parseBrazilianDecimal` (usado nos outros importadores) espera. Criado um
helper dedicado, `parseUsNumber`, só pra este arquivo:

```ts
const parseUsNumber = (raw: unknown): number => {
  const n = parseFloat(String(raw ?? "").replace(/,/g, "").trim());
  return Number.isNaN(n) ? 0 : n;
};
```

**Lição**: nunca presumir que todo relatório do mesmo cliente usa o mesmo
formato de número — cada exportação de um sistema legado pode ter sido
gerada com uma configuração regional diferente. Sempre inspecionar uma
amostra de valores reais antes de escolher o parser numérico.

### Idempotência

Reimportar a mesma planilha (ex.: depois de corrigir uma linha) não duplica:
antes de criar qualquer registro, `importSales()` verifica se já existe um
`FiscalDocument` com `externalRef = "legado-nf-${numero}"` pra aquela nota —
se existir, pula (conta em `summary.skipped`). Mesmo padrão já usado nos
importadores de Cliente/Fornecedor/Produto (dedup por SKU/documento).

### Onde entra

- `backend/src/services/FiscalService/SaleImportService.ts` (novo) —
  `parseNotesReport()` (parser) + `importSales()` (grava `Sale`, `SaleItem`,
  `FiscalDocument` com `externalRef` determinístico, e `FinanceReceivable`
  já "recebida" quando a venda conta como confirmada).
- `backend/src/controllers/SaleImportController.ts` (novo) — mesmo padrão de
  `getUploadedFile`/`removeUploadedFile` do `FinanceImportController.ts`.
- `backend/src/routes/fiscalRoutes.ts` — `POST /sales/import` (multer, mesmo
  `uploadConfig` dos outros importadores).
- `frontend/src/hooks/useFiscal/index.js` — `sales.importSpreadsheet(file)`.
- `frontend/src/components/SaleList/index.js` — botão "Importar planilha" no
  topo da tela de Vendas.

### Testado

- `npx tsc --noEmit` limpo no backend.
- `npx eslint` limpo nos arquivos de frontend tocados.
- Parser validado com script local (sem gravar no banco) contra o arquivo real
  do cliente — ver números acima.
- Não testado end-to-end contra o banco de produção nesta sessão (sem acesso).
  **Pendente**: cliente rodar a importação de verdade depois do deploy e
  confirmar as contagens (486 notas esperadas, nenhuma venda tocando estoque).

## 98. Dashboard de lucro: compra × imposto × venda × lucro (v2.3.117)

### Contexto

Depois da importação histórica (seção 97), cliente apontou um problema de
fundo: "já fica registrado como vendas certas, contas a receber, só que eu
quero (...) uma visão se está gerando lucro ou não na precificação" — mesmo
com venda/conta a receber funcionando, não havia nenhum jeito de saber se o
preço de venda cadastrado cobre custo + imposto e ainda dá lucro.

Pedido chegou em várias mensagens seguidas, com bastante espaço pra
interpretação (onde gravar custo/imposto, quantos tributos detalhar, o que
exatamente "só aplicar quando for pra produção" queria dizer, onde colocar
o painel). Por instrução permanente deste repositório (pedido com mais de
um caminho razoável de implementação → perguntar antes de codar), as 4
decisões de arquitetura foram confirmadas via questionário antes de
implementar:

1. **Onde fica custo/imposto**: no cadastro do Produto (não digitado a cada
   venda) — assim todo item de venda já nasce sabendo seu custo/alíquota,
   sem trabalho manual do vendedor.
2. **Quantos tributos detalhar**: um `%` de imposto único por produto (não
   o detalhamento ICMS/PIS/COFINS/IPI/ISS separado) — mais rápido de
   cadastrar, suficiente pro que foi pedido (visão de margem, não apuração
   fiscal formal).
3. **"Só aplicar quando for pra produção"**: o painel de lucro só aparece
   quando a empresa está com a Focus NFe em modo **Produção** (não quando
   só Homologação está ligada) — assim venda de teste e o histórico
   importado da migração de ERP (seção 97, que pode ter acontecido todo em
   Homologação) não contaminam a conta de lucro.
4. **Onde entra o painel**: dentro do Painel Financeiro já existente (não
   uma tela nova) — mais uma seção, ao lado de "Situação do estoque".

### Modelo de dados — snapshot de custo/imposto no item, igual sku/ncm/cfop

`FinanceProduct` ganhou `taxRate` (string, %, default "0") — ao lado do
`costPrice` que já existia. `SaleItem` ganhou `costPrice`/`taxRate`
(migration `20261016160000-...`), gravados como **snapshot** no momento da
venda (`SaleService.buildItemRows`, que agora é `async` e busca
`costPrice`/`taxRate` dos produtos vendidos antes de montar os itens) — não
vêm do formulário de venda (o vendedor nunca vê/edita isso), e não mudam
retroativamente se o cadastro do produto for atualizado depois. Mesma
lógica de snapshot já usada pra `description`/`sku`/`ncm`/`cfop`.

### Cálculo de lucro

Por item: `lucro = totalPrice - (costPrice × quantity) - (totalPrice × taxRate / 100)`.
Margem (%) = `lucro / totalPrice × 100` (0 se totalPrice for 0, evita
divisão por zero). Isso é intencionalmente uma simplificação de
precificação (todo imposto calculado sobre o preço de venda, não sobre uma
base de cálculo fiscal formal) — adequado pra dar visão de margem ao
analista financeiro, não pra apuração fiscal (que continua sendo feita pela
contabilidade/Focus NFe de verdade).

### Onde entra

- `backend/src/models/FinanceProduct.ts` — campo `taxRate`.
- `backend/src/models/SaleItem.ts` — campos `costPrice`/`taxRate` (snapshot).
- `backend/src/database/migrations/20261016160000-...` — `IF NOT EXISTS`
  nas 3 colunas novas (mesma lição da seção 11 da skill `atendeflow-dev`).
- `backend/src/services/FiscalService/SaleService.ts` — `buildItemRows`
  agora assíncrono, busca `costPrice`/`taxRate` do produto antes de montar
  cada `SaleItem`.
- `backend/src/services/FinanceService/FinanceReportService.ts` —
  `getProfitDashboard(companyId)`: devolve `{ enabled: false }` quando a
  empresa não tem `FiscalConfig` ou não está com `isProductionActive()`
  (reaproveitado de `FiscalConfigService.ts`, sem criar um registro de
  config como efeito colateral — usa `findOne`, não o `findOrCreate` da
  tela de Configuração Fiscal); senão agrega todo `SaleItem` de venda
  `confirmed` por produto e por mês (compra/imposto/venda/lucro/margem).
- `backend/src/controllers/FinanceReportController.ts` +
  `backend/src/routes/financeRoutes.ts` — `GET /finance/reports/profit-dashboard`.
- `frontend/src/pages/Financeiro/financeConfig.js` — campo "Alíquota de
  imposto (%)" no formulário de Produto (ao lado de "Preço de custo",
  `gridSize: 6` + `6` = 12, soma certa — ver seção 11 da skill sobre Grid).
- `frontend/src/components/FinancePainel/index.js` — seção "Compra ×
  imposto × venda × lucro": cartões de totais, gráfico de barra empilhada
  por mês (custo+imposto+lucro = venda, com tooltip no hover) e tabela
  "Produtos por margem de lucro" com exportação Excel (`XLSX.writeFile`,
  mesmo padrão já usado em `pages/Reports/index.js`). Reaproveita o botão
  "Imprimir / Exportar PDF" que já existe no topo do Painel Financeiro
  (`window.print()`) — não precisou de nada novo pra isso.
- `frontend/src/components/SaleDetailModal/index.js` — mostra Valor
  bruto/Impostos/Valor líquido no detalhe da venda (calculado a partir do
  `taxRate` snapshot de cada item, não é uma dedução real do que foi
  recebido — é informativo, pro cliente visualizar a margem).

### Testado

- `npx tsc --noEmit` limpo no backend.
- `npx eslint` limpo em todos os arquivos de frontend tocados.
- Não testado end-to-end contra o banco de produção nesta sessão (sem
  acesso). **Pendente**: cliente cadastrar a alíquota de imposto nos
  produtos, confirmar que o painel aparece só depois de ligar Produção na
  Configuração Fiscal, e validar os números do dashboard contra uma venda
  de teste conhecida.

## 99. Reforma Tributária 2027 (IVA/CBS/IBS) — preparação + excluir vendas/notas de teste (v2.3.118)

### Contexto

O cliente enviou uma especificação técnica bem detalhada (campos, tipos,
telas, pseudocódigo do motor de cálculo) pedindo pra preparar o sistema
pra transição tributária de janeiro de 2027 (fim do PIS/Cofins/ICMS/ISS
tradicionais, entrada da CBS/IBS) — com uma regra central: os campos
devem existir e aparecer na tela, mas **sem nenhum efeito** no
faturamento/impressão atual até uma chave global ser ativada. Na mesma
leva de pedidos, veio também "deletar as notas feitas em homologação e
[...] a opção de deletar a venda quando tiver no modulo teste de
homologação" — consequência direta do fluxo de teste real deste cliente
(primeiras tentativas de NF-e em Homologação, catalogadas nas seções 94 e
96), que até aqui só podiam ser canceladas, nunca excluídas de verdade.

A especificação do cliente usa nomes de tabela/coluna genéricos
(`tab_clientes`, `tab_itens`, `tab_nota_itens`, `tab_financeiro_transacoes`,
`flg_ativar_reforma_2027`, `vUnComLiq` etc., em snake_case/português) — não
é o schema real deste projeto. Mapeado 1:1 pro schema existente, em
camelCase (convenção já usada em toda a base), preservando a intenção de
cada campo:

| Spec do cliente | Tabela/campo real neste projeto |
|---|---|
| `tab_clientes` | `FinanceCustomer` |
| `tab_itens` (produtos) | `FinanceProduct` |
| `tab_nota_itens` | `SaleItem` |
| `flg_ativar_reforma_2027` | `FiscalConfig.reform2027Enabled` |
| `tab_financeiro_transacoes` (Asaas) | **`FinanceReceivable`** (ver decisão abaixo, não uma tabela nova) |

### Decisão: reaproveitar `FinanceReceivable`, não criar uma tabela nova pro Asaas

A especificação pede pra criar os campos de controle do Asaas (split
payment) "na tabela de transações financeiras" — mas esse projeto não tem
(e não precisa ter) uma tabela de transações separada: cada venda confirmada
já gera exatamente UM `FinanceReceivable` (ver `SaleService.confirm`), que
É a conta a receber daquela venda. Criar uma tabela nova só pros 3 campos
do Asaas (`asaasPaymentId`/`splitIvaRetido`/`netReceivedViaAsaas`) geraria
uma tabela sem nenhuma FK de volta pra venda e sem nenhum código que a
leia/escreva (o próprio pedido do cliente é só "preparação arquitetural",
a API do Asaas ainda nem suporta isso) — exatamente o tipo de abstração
prematura que as instruções deste projeto pedem pra evitar. Os 3 campos
entraram direto em `FinanceReceivable`.

**Atenção pra não confundir**: o projeto já tem um `AsaasBillingProvider.ts`
(`backend/src/services/BillingProviders/`), mas é de outro domínio
completamente — a cobrança da própria assinatura do AtendeFlow (SaaS), não
a venda ao cliente final de uma empresa-cliente. Os campos novos aqui são
exclusivos do módulo Financeiro/Fiscal, nada a ver com aquele provider.

### Chave global e o padrão "existe mas não faz nada"

`FiscalConfig.reform2027Enabled` (switch na Configuração Fiscal) é a única
porta de entrada pra tudo isso. Com ela desligada (padrão):
- Os campos novos de Cliente/Produto aparecem na tela, mas **desabilitados**
  (`FinanceRecordModal` ganhou suporte a `disabledWhen(values, context)` —
  diferente de `visibleWhen`/`requiredWhen`, que só recebem `values`, porque
  aqui o motivo de desabilitar é um estado de FORA do formulário, lido da
  Configuração Fiscal e repassado via a nova prop `context` em
  `FinanceRecordList`/`FinanceRecordModal`, preenchida em `Financeiro/index.js`).
- `SaleService.buildItemRows` nem consulta a `FiscalConfig`/cliente pra
  isso além do necessário pra saber que está desligado — e nenhum dos 9
  campos `iva*` do `SaleItem` é calculado (ficam no default "0").
- A tela de fechamento de venda (`SaleModal`) mostra os blocos "Subtotal
  líquido"/"Previsão CBS"/"Previsão IBS" sempre, só acinzentados (`opacity:
  0.5`) enquanto desligado — igual pedido explicitamente na especificação
  ("campos aparecem desabilitados, servindo só de visualização técnica"),
  não escondidos condicionalmente.
- O motor de cálculo em si (`Iva2027Service.calculate`) é uma função pura,
  sem I/O — só é chamada de dentro do `if (reformEnabled)`.

O dia em que o cliente ligar a chave, o cálculo entra em vigor
imediatamente pra toda venda nova, sem precisar de deploy.

### Motor de cálculo (`Iva2027Service.ts`)

Implementado seguindo o pseudocódigo do cliente ao pé da letra:
- **B2C** (pessoa física): sem CBS/IBS por fora, preço final não muda
  (fica dentro do Simples/DAS).
- **B2G isento** (órgão público com isenção em edital,
  `FinanceCustomer.ivaGovExempt`): alíquotas zeradas.
- **B2B e B2G sem isenção**: regime híbrido — o preço digitado já é o
  líquido, CBS/IBS somados por fora. `FinanceProduct.ivaEducationReduction`
  aplica a redução de 60% (`Aliquota_Efetiva = Aliquota × 0,40`) pra
  curso/treinamento.

Duas lacunas do pseudocódigo do cliente, resolvidas por inferência própria
(documentadas no código, não bloqueantes porque tudo fica inerte até a
chave ligar):
- O pseudocódigo não definia a regra pra B2G SEM isenção — tratado igual
  B2B (regime híbrido), já que B2G sem isenção em edital é, em princípio,
  tributável normalmente.
- O rateio exato entre a parte estadual (UF) e municipal (Município) do
  IBS (`vIBS_UF`/`vIBS_Mun` do spec, aqui `ivaIbsStateValue`/
  `ivaIbsCityValue`) ainda não foi regulamentado por nenhuma UF/município —
  é definido jurisdição por jurisdição, mais perto de 2027. Por ora, todo
  o IBS calculado vai pra `ivaIbsStateValue`, `ivaIbsCityValue` fica "0"
  até essa regra existir de verdade.

### Snapshot no item — mesma lógica já usada pra sku/ncm/cfop/costPrice/taxRate

Os 9 campos `iva*` do `SaleItem` são gravados como **snapshot** no momento
da venda (dentro de `buildItemRows`), nunca recalculados depois — se o
cliente mudar a alíquota de um produto ou o perfil de um cliente depois,
vendas já feitas não mudam retroativamente. Consistente com o padrão já
estabelecido pro resto do item da venda.

### Excluir vendas e notas de teste (Homologação)

Problema: `FiscalDocument`/`Sale` só podiam ser **cancelados**, nunca
excluídos de verdade — bom pra nota real (cancelamento é o ato legal
correto), ruim pra limpar lixo de teste feito em Homologação antes de
passar pra Produção.

Solução: nova coluna `FiscalDocument.environment` ("sandbox"/"production"),
gravada em `FiscalDocumentService.emit` a partir de
`FiscalConfigService.isProductionActive(config)` no momento da emissão.
A partir dela:
- `DELETE /fiscal-documents/:id` (`FiscalDocumentService.remove`) exclui
  de verdade um documento — **recusa** (`ERR_FISCAL_DOCUMENT_CANNOT_DELETE_PRODUCTION`)
  se `environment === "production"`.
- `SaleService.remove`, antes só aceitava venda "draft". Agora também
  aceita "confirmed"/"cancelled" quando a venda é de teste: nenhum dos
  `FiscalDocument` dela é de Produção, E (se não tiver nenhum documento
  ainda) a empresa não está com Produção ativa agora — essa segunda
  condição existe pra não deixar excluir uma venda real confirmada que
  ainda nem foi emitida. Exclusão cascateia `FiscalDocument`/`SaleItem`/
  `FinanceReceivable` (se houver) e a própria `Sale`.
- **Explicitamente não ajusta estoque** nessa exclusão (pedido do
  cliente), mesmo que a venda tenha descontado estoque ao confirmar
  durante o teste — diferente do `cancel()` normal, que devolve.
- `Sale` ganhou `@HasMany(() => FiscalDocument) fiscalDocuments` (mesmo
  padrão circular já usado entre `Sale`/`SaleItem`) só pra essa checagem
  — incluído em `includeOptions` do `SaleService`.
- Frontend: `SaleList` mostra o botão excluir pra venda confirmada/
  cancelada só quando ela é "de teste" (mesma regra replicada em
  `isTestSale()`, cliente, pra não precisar de uma chamada extra só pra
  decidir se mostra o botão); `SaleDetailModal` mostra excluir em cada
  linha de nota com `environment !== "production"`.

### Onde entra

- Migrations `20261016170000`–`20261016170400` (chave global, campos de
  Cliente/Produto/SaleItem/Receivable da Reforma) e `20261016180000`
  (`FiscalDocument.environment`) — todas `IF NOT EXISTS`.
- `backend/src/services/FiscalService/Iva2027Service.ts` (novo).
- `backend/src/services/FiscalService/SaleService.ts` — `buildItemRows`
  (cálculo da Reforma) e `remove` (exclusão de teste) reescritos.
- `backend/src/services/FiscalService/FiscalDocumentService.ts` — `emit`
  grava `environment`; novo `remove`.
- `backend/src/models/Sale.ts` — nova associação `fiscalDocuments`.
- `frontend/src/components/FinanceRecordModal/index.js` — suporte a
  `disabledWhen`/`context` e ao pseudo-campo `sectionTitle`.
- `frontend/src/pages/Financeiro/index.js` — busca `reform2027Enabled` uma
  vez (só se tiver acesso ao Fiscal) e repassa via `context`.
- `frontend/src/pages/Financeiro/financeConfig.js` — campos novos de
  Cliente/Produto.
- `frontend/src/components/FiscalConfigPanel/index.js` — switch global.
- `frontend/src/components/SaleModal/index.js` — preview Subtotal
  líquido/CBS/IBS.
- `frontend/src/components/SaleList/index.js` — botão excluir venda de
  teste.
- `frontend/src/components/SaleDetailModal/index.js` — botão excluir nota
  de teste.
- `frontend/src/hooks/useFiscal/index.js` — `fiscalDocuments.remove(id)`.

### Testado

- `npx tsc --noEmit` limpo no backend.
- `npx eslint` limpo em todos os arquivos de frontend tocados.
- **`craco build` (build de produção) rodado localmente antes de cada
  entrega** — lição da v2.3.117/v2.3.118 (ver seção 11 da skill
  `atendeflow-dev`): um `import default` de um pacote sem export default
  (`xlsx`) passou no dev server e no ESLint, e só quebrou no build de
  produção real.
- Não testado end-to-end contra o banco de produção nesta sessão (sem
  acesso). **Pendente**: cliente ativar a chave da Reforma 2027 num
  ambiente de teste e confirmar que uma venda nova grava os campos `iva*`
  corretamente; testar a exclusão de uma venda/nota de Homologação de
  verdade e confirmar que uma nota/venda de Produção continua protegida
  (só cancelável).

## 100. Primeiro teste real contra a Focus NFe — endereço do emitente faltando + inutilização não listava (v2.3.119)

### Contexto

Cliente fez o primeiro teste de verdade de emissão de NF-e (Homologação)
contra a Federação Baiana de Tiro Defensivo & Olímpico e todas as
tentativas vieram com "Erro na validação do Schema XML, verifique o
detalhamento dos erros" (NF-e, NFC-e e NFS-e — esta última com erro
diferente: "Empresa ainda não habilitada para emissão de NFSe"). Cliente
também mandou uma nota fiscal modelo (NF-e nº 491, emitida por outro
sistema — RenaSoft/MASTER) com os dados reais da empresa, e testou a tela
de inutilização de numeração, reportando que depois de inutilizar a lista
"Inutilizações já registradas" continuava vazia.

### Causa raiz 1 — endereço do emitente nunca existiu no sistema

Nenhum model (`Company`, `FiscalConfig`) tinha endereço da PRÓPRIA empresa
(a que emite a nota) — só o endereço do destinatário (cliente da venda) é
coletado hoje (`FocusNFeService.buildDestinatario`). Endereço do emitente
(`enderEmit`: logradouro, número, bairro, município, UF, CEP) é campo
obrigatório no XML da NF-e/NFC-e — causa mais provável do erro de schema,
confirmada comparando com a nota modelo enviada pelo cliente (mostra
exatamente esse bloco preenchido: "RUA ESPATODEAS ROXAS, 298 - JARDIM DAS
MARGARIDAS - SALVADOR - BA - CEP: 41502-445 - Fone: (71)99636-5862").

### Causa raiz 2 — inutilização nunca checava o retorno do gateway, e a lista dependia de endpoint não confirmado

Dois bugs empilhados em `NumberingInvalidationPanel`
(`frontend/src/components/FiscalConfigPanel/index.js`) e
`FiscalNumberingService.ts`:

- `handleSubmit` descartava o retorno de `fiscal.numbering.invalidate(...)`
  e sempre mostrava "Numeração inutilizada junto à Sefaz." — mesmo quando
  o gateway respondia `ok: false` (ex.: mesma falta de endereço do
  emitente acima). O usuário nunca via o erro de verdade.
- A listagem (`FiscalNumberingService.list`) dependia só de
  `GET /v2/nfe/inutilizacoes` na Focus NFe — um dos cinco endpoints de
  `FocusNFeService.ts` reconstruído por conhecimento geral (nunca
  confirmado contra a doc oficial, bloqueada nesta sessão — ver seção 11
  da skill `atendeflow-dev`), com `try/catch` que engole qualquer falha e
  devolve `[]` silenciosamente. Mesmo que o `POST` de inutilização
  funcionasse, não havia garantia nenhuma de que esse `GET` existisse ou
  devolvesse os dados certos.

### Correção

- `FiscalConfig` ganhou `emitterZipCode`/`emitterStreet`/`emitterNumber`/
  `emitterComplement`/`emitterNeighborhood`/`emitterCity`/`emitterState`/
  `emitterPhone` (texto livre, mesmo padrão já usado pro endereço do
  destinatário — não derivado do `cityCode`/IBGE já existente, que seguiu
  servindo só pra NFC-e/NFS-e). Novo seção "Endereço do emitente" na tela
  de Configuração Fiscal.
- `FocusNFeService.buildEmitente` passou a enviar
  `logradouro_emitente`/`numero_emitente`/`complemento_emitente`/
  `bairro_emitente`/`municipio_emitente`/`uf_emitente`/`cep_emitente`/
  `telefone_emitente`.
- Nova tabela `FiscalNumberingInvalidations` — `FiscalNumberingService.invalidate`
  agora grava um registro local só quando o gateway confirma (`ok: true`);
  `FiscalNumberingService.list` passou a ler dessa tabela, não mais do
  gateway. Mesmo padrão já usado pro `FiscalDocument` (fonte de verdade
  local, não re-consultar o gateway pra listar).
- `NumberingInvalidationPanel.handleSubmit` agora confere `result.ok` antes
  de mostrar sucesso — mostra `result.errorMessage` (toast de erro) quando
  o gateway rejeita.

### Pendente — logo da empresa na nota

Cliente pediu pra colocar a logo da empresa (mandou o arquivo) saindo na
nota fiscal. Não encontrada nenhuma documentação (bloqueada/sem resultado
direto via busca) confirmando que a Focus NFe aceita logo por campo no
payload de emissão — pelo padrão do setor (Alterdata/NFeasy, outros
emissores pesquisados), esse tipo de personalização do DANFe costuma ser
configurada uma vez direto no painel do próprio gateway (cadastro da
empresa), não por API a cada nota. A nota modelo que o cliente mandou (de
outro sistema) também não tem logo no bloco do emitente, só texto. Não
implementado nesta leva — precisa confirmar com o cliente/suporte da Focus
NFe se existe campo de API pra isso antes de codar algo que pode não ter
efeito nenhum na nota real.

### Arquivos alterados

- `backend/src/database/migrations/20261016190000-add-emitter-address-to-fiscal-configs.ts`
- `backend/src/database/migrations/20261017090000-create-fiscal-numbering-invalidations.ts`
- `backend/src/models/FiscalConfig.ts`
- `backend/src/models/FiscalNumberingInvalidation.ts` (novo)
- `backend/src/database/index.ts`
- `backend/src/services/FiscalService/FocusNFeService.ts`
- `backend/src/services/FiscalService/FiscalConfigService.ts`
- `backend/src/services/FiscalService/FiscalNumberingService.ts`
- `frontend/src/components/FiscalConfigPanel/index.js`

### Testado

- `npx tsc --noEmit` limpo no backend.
- `npx eslint` limpo em `FiscalConfigPanel/index.js`.
- Não testado end-to-end contra a Focus NFe nesta sessão (sem acesso).
  **Pendente**: cliente preencher o endereço do emitente na Configuração
  Fiscal, rodar a migration em produção, e tentar emitir uma NF-e de teste
  de novo — se o erro de schema mudar (em vez de sumir), o detalhamento
  completo da mensagem (já visível por inteiro desde a v2.3.113) é o
  próximo ponto de investigação. Testar também a inutilização de novo:
  deve aparecer na lista se o gateway confirmar, ou mostrar o erro real
  (toast) se não confirmar.

## 101. Depois do deploy da v2.3.119: "Pré-visualizar DANFe" dava "An error occurred!" + mesma mensagem genérica de Schema XML sem detalhe (v2.3.120)

### Contexto

Cliente rodou o deploy da v2.3.119 (migration + rebuild) e testou de novo
numa venda nova (#4): "Pré-visualizar DANFe" deu um toast genérico "An
error occurred!" (sem nenhum detalhe), e "Emitir NF-e" voltou com a MESMA
mensagem genérica de antes ("Erro na validação do Schema XML, verifique o
detalhamento dos erros") — igual, palavra por palavra, ao erro antes do
fix de endereço do emitente, o que não dava pra saber se o fix tinha
pegado ou se tinha outra coisa faltando.

### Causa raiz 1 — preview: erro verdadeiro escondido por causa do `responseType: "blob"`

`SaleDetailModal.handlePreview` chama `fiscal.fiscalDocuments.previewDanfe`,
que usa `responseType: "blob"` no axios (a resposta de SUCESSO é o PDF em
binário). Só que isso também faz o axios devolver `err.response.data` como
`Blob` numa resposta de ERRO (o backend responde 502 com JSON
`{error: "..."}`, mas o axios não sabe antecipadamente que esse body é
JSON e segue o `responseType` configurado). `toastError` só olha
`err.response.data.error` — que não existe num Blob — e cai no fallback
genérico "An error occurred!", escondendo a mensagem real do gateway.
Corrigido lendo o Blob como texto (`blob.text()` + `JSON.parse`) no
`catch` do `handlePreview` antes de desistir pro `toastError` padrão.

### Causa raiz 2 — mensagem de erro da Focus NFe: genérica engolia o detalhe

`FocusNFeService.parseDocumentResponse` montava `errorMessage` com
`data.mensagem_sefaz || data.mensagem || data.erros.join(...)` — um
`||` que PARA no primeiro campo não vazio. A Focus NFe parece devolver os
dois ao mesmo tempo num erro de schema: `mensagem` genérica ("...verifique
o detalhamento dos erros") E `erros`, um array com o detalhe campo a campo
de verdade — mas como `mensagem` vinha primeiro no `||`, `erros` nunca era
lido, e a tela sempre mostrava só a mensagem genérica, por mais detalhado
que fosse o conteúdo de `erros`. Ninguém (nem o cliente, nem esta sessão)
conseguia ver o campo específico que está falhando. Corrigido pra sempre
concatenar os dois (`mensagem — detalhe1; detalhe2; ...`) em vez de
escolher um.

**Isso não significa que o fix de endereço do emitente (seção 100) não
funcionou** — os dois documentos com erro na venda #4 do print já foram
criados ANTES desse ajuste de mensagem (dado histórico, `FiscalDocument`
já salvo), então claro que mostram o texto antigo. Só uma tentativa NOVA,
depois deste deploy, vai mostrar o detalhe de verdade.

### Arquivos alterados

- `backend/src/services/FiscalService/FocusNFeService.ts`
- `frontend/src/components/SaleDetailModal/index.js`

### Testado

- `npx tsc --noEmit` limpo no backend.
- `npx eslint` limpo em `SaleDetailModal/index.js`.
- Não testado end-to-end contra a Focus NFe nesta sessão (sem acesso).
  **Pendente**: cliente rodar o deploy e tentar de novo (preview E
  emissão) numa venda nova — se ainda der erro de schema, agora o
  detalhamento completo (`erros`) deve aparecer na tela, apontando o campo
  exato que falta/está errado.

## 102. Cabeçalho/rodapé personalizado (logo + endereço) na impressão do Painel Financeiro (v2.3.121)

### Contexto

Cliente pediu pra sair a logomarca da empresa (mandou o arquivo — escudo da
Federação Baiana de Tiro Defensivo e Olímpico) na impressão/PDF de
relatório, "personalizado, com endereço da empresa", logo no canto
superior direito, e rodapé. Diferente do pedido anterior de logo na NF-e
(seção 100, ainda pendente — depende de confirmar com a Focus NFe), este é
sobre a impressão própria do AtendeFlow (`window.print()` do Painel
Financeiro), totalmente sob controle do sistema — sem a incerteza do
gateway fiscal.

### Decisões

- **Logo**: reaproveitado o logotipo de whitelabel que a empresa já pode
  cadastrar em Configurações → Whitelabel (`appLogoLight`,
  `frontend/src/components/Settings/Whitelabel.js`) — exposto via
  `theme.calculatedLogoLight()` (já usado no Drawer/sidebar). Nenhum upload
  novo criado; se a empresa ainda não tiver cadastrado um logo próprio, usa
  o fallback padrão do sistema (mesmo comportamento do resto do app).
- **Endereço**: reaproveitados os campos `emitterStreet`/`emitterNumber`/
  `emitterNeighborhood`/`emitterCity`/`emitterState`/`emitterZipCode`/
  `emitterPhone` de `FiscalConfig` (seção 100, já existiam pro endereço do
  emitente na NF-e) — formatado no mesmo padrão da nota modelo do cliente
  ("Rua Espatódeas Roxas, 298 - Jardim das Margaridas - Salvador - BA -
  CEP: 41502-445"). Nenhum campo novo no banco; mesma fonte de dado dos
  dois lugares (nota fiscal e relatório impresso), evita cadastro
  duplicado.
- **Busca condicional**: `Financeiro/index.js` já buscava `FiscalConfig`
  pra ler `reform2027Enabled` só quando a empresa tem acesso ao Fiscal
  (`fiscalAccess?.hasAccess`) — reaproveitado o mesmo fetch (guardado em
  `fiscalConfig`, passado como prop) em vez de `FinancePainel` buscar de
  novo por conta própria. Evita o anti-padrão já documentado (seção 11 da
  skill `atendeflow-dev`): chamar `FiscalConfigService.show()` direto
  criaria uma linha de configuração fiscal vazia pra toda empresa que
  abrisse o Painel Financeiro, mesmo sem usar o módulo fiscal.
- **Nome da empresa**: `user.company.name` (já vem no payload de login,
  `AuthUserService` inclui `Company`), não `theme.appName` (esse é o nome
  "de marca" configurável no whitelabel, pode ser diferente da razão
  social que deve aparecer no relatório).
- Cabeçalho/rodapé só aparecem no papel/PDF — mesmo mecanismo inverso do
  `#finance-painel-print-hide` já existente (CSS `display: none` na tela,
  `@media print { display: flex/block !important }`), nunca poluindo a
  tela normal do painel.

### Arquivos alterados

- `frontend/src/components/FinancePainel/index.js`
- `frontend/src/pages/Financeiro/index.js`

### Testado

- `npx eslint` limpo nos dois arquivos.
- `craco build` (build de produção) rodado localmente — compilou sem erro
  (regra da seção 11 da skill: eslint sozinho não pega tudo).
- Não testado visualmente num navegador real nesta sessão (sem acesso).
  **Pendente**: cliente preencher "Endereço do emitente" em Configuração
  Fiscal (se ainda não preencheu, seção 100) e cadastrar o logo em
  Configurações → Whitelabel, depois testar "Imprimir / Exportar PDF" no
  Painel Financeiro e conferir se logo (canto superior direito), nome +
  endereço (canto superior esquerdo) e rodapé saem corretos no PDF.

## 103. IE do emitente com pontuação quebrava o schema + resposta bruta da Focus NFe agora fica salva (v2.3.122)

### Contexto

Cliente confirmou (print da Configuração Fiscal) que já tinha preenchido o
"Endereço do emitente" (seção 100) corretamente — mesmo assim a emissão
continuava com "Erro na validação do Schema XML, verifique o
detalhamento dos erros", já na v2.3.120 (que já tinha o fix de mostrar o
detalhamento junto da mensagem genérica). O detalhamento simplesmente não
vinha — sinal de que ou a Focus NFe não manda `erros` pra esse tipo de
falha, ou tinha outro campo mal formatado que nem chega a gerar erro
"de campo", só rejeita o XML inteiro.

### Causa raiz 1 — Inscrição Estadual com pontuação

No print da Configuração Fiscal, "Inscrição estadual" está como
`182.174.539` (com pontos) — `FocusNFeService.buildEmitente` mandava esse
valor DIRETO pro campo `inscricao_estadual_emitente`, sem tirar a
pontuação, diferente do CNPJ/CEP/telefone do emitente (que já passavam por
`.replace(/\D/g, "")`). A Sefaz espera só dígitos nesse campo — provável
causa real do erro de schema persistir mesmo com o endereço certo.
Corrigido: `inscricao_estadual_emitente` agora também passa por
`.replace(/\D/g, "")` antes de ir pro payload.

### Causa raiz 2 (diagnóstico) — resposta bruta da Focus NFe nunca era salva

Pra não ficar mais adivinhando qual campo a Sefaz está rejeitando,
`FiscalDocument` ganhou uma coluna `raw` (JSONB) — `FiscalDocumentService.emit`
e `.refreshStatus` agora salvam a resposta completa do gateway, não só o
`errorMessage` já resumido. Na tela de detalhe da venda
(`SaleDetailModal`), toda nota com status "Erro" ganhou um botão (ícone
`</>`) que abre um diálogo com o JSON bruto completo (+ botão copiar) — útil
pra qualquer erro futuro, não só este.

### Observação (não bloqueante)

No mesmo print, "Inscrição municipal" está como `00.914.493/001-43` —
formato de CNPJ, não de inscrição municipal. Não afeta NF-e/NFC-e (só
NFS-e usa esse campo), não mexido nesta leva — vale o cliente conferir se
esse valor está certo antes de tentar emitir NFS-e no futuro.

### Arquivos alterados

- `backend/src/database/migrations/20261017100000-add-raw-response-to-fiscal-documents.ts`
- `backend/src/models/FiscalDocument.ts`
- `backend/src/services/FiscalService/FiscalDocumentService.ts`
- `backend/src/services/FiscalService/FocusNFeService.ts`
- `frontend/src/components/SaleDetailModal/index.js`

### Testado

- `npx tsc --noEmit` limpo no backend.
- `npx eslint` + `craco build` limpos no frontend.
- Não testado end-to-end contra a Focus NFe nesta sessão (sem acesso).
  **Pendente**: cliente rodar a migration + deploy e tentar emitir de
  novo — se ainda der erro, abrir o botão "ver resposta completa" (ícone
  `</>` na linha do erro) e mandar o JSON pra investigar o campo exato.

## 104. modalidade_frete faltando + NCM mal formatado — achados pelo botão "ver resposta completa" (v2.3.123)

### Contexto

Com o botão novo (seção 103), o cliente conseguiu abrir a resposta bruta de
uma tentativa real de emissão de NF-e e mandar o JSON completo. Resultado:
o endereço do emitente e a Inscrição Estadual (seções 100/102) estavam
corretos — nenhum erro sobre eles. Os erros reais eram outros:

```json
{
  "erros": [
    { "campo": "logradouro_destinatario", "mensagem": "... não pode ser vazio" },
    { "campo": "numero_destinatario", "mensagem": "... não pode ser vazio" },
    { "campo": "bairro_destinatario", "mensagem": "... não pode ser vazio" },
    { "campo": "municipio_destinatario", "mensagem": "... não pode ser vazio" },
    { "campo": "modalidade_frete", "mensagem": "... não pode ser vazio" },
    { "campo": "itens.1.codigo_ncm", "mensagem": "... não pode ser vazio" },
    { "campo": "itens.1.codigo_ncm", "mensagem": "... não é do tamanho correto (precisa ter 8 caracteres)" }
  ],
  "codigo": "erro_validacao_schema"
}
```

### Causa raiz 1 — `modalidade_frete` nunca existia no payload

Campo obrigatório da NF-e (modalidade do frete — 0 a 4, ou 9 pra "sem
frete") que `buildNfePayload` simplesmente nunca enviava, bug de código
puro, não dado de cadastro. Corrigido com `modalidade_frete: "9"` fixo
(venda de balcão, sem transportadora — se um dia o cliente vender com
frete, precisa virar campo configurável, não hardcoded).

### Causa raiz 2 — NCM com formato inválido passava pelo fallback

`ncm: item.ncm || "00000000"` só cobre valor VAZIO — um `item.ncm` com
conteúdo mas formato errado (não exatamente 8 dígitos, ex.: um só
caractere) passa direto pelo `||` (qualquer string não-vazia é truthy) e
vai pro payload do jeito errado. Corrigido com `normalizeNcm()`: só aceita
o NCM cadastrado se tiver exatamente 8 dígitos numéricos, senão cai no
fallback "00000000".

### Causa raiz 3 (não é bug, é dado faltando) — endereço do destinatário

O cliente (`FinanceCustomer`) dessa venda específica não tinha endereço
cadastrado — a Sefaz exige o bloco completo quando o destinatário é
identificado por CPF/CNPJ (não é uma nota "balcão sem identificação").
Nenhuma mudança de código — o cliente precisa completar o cadastro do
cliente antes de emitir pra ele. Como ficou claro ver isso só depois de
uma tentativa real falhar, pode valer a pena, numa leva futura, avisar na
tela ANTES de tentar emitir se o destinatário escolhido não tem endereço
completo (validação client-side preventiva) — não implementado agora,
fora do escopo desta correção pontual.

### Arquivos alterados

- `backend/src/services/FiscalService/FocusNFeService.ts`

### Testado

- `npx tsc --noEmit` limpo no backend.
- Não testado end-to-end contra a Focus NFe nesta sessão (sem acesso).
  **Pendente**: cliente completar o endereço do cliente dessa venda,
  conferir o NCM do segundo item (pode ser produto sem NCM cadastrado
  corretamente — "00000000" é só um placeholder de fallback, não um NCM
  válido de verdade; o certo é cadastrar o NCM real do produto), rodar o
  deploy e tentar emitir de novo.

## 105. Campo NCM do item com nome errado — `ncm` em vez de `codigo_ncm` (v2.3.124)

### Contexto

Com o fix da seção 104 (`modalidade_frete` + `normalizeNcm`) já em produção,
o cliente testou uma emissão de verdade (Venda #9, token de homologação da
Focus NFe já configurado). O erro de `modalidade_frete` sumiu — confirmando
que o fix anterior funcionou — mas `itens.1.codigo_ncm` continuou dando
erro, com as DUAS mensagens ao mesmo tempo:

```json
{ "campo": "itens.1.codigo_ncm", "mensagem": "... não pode ser vazio" },
{ "campo": "itens.1.codigo_ncm", "mensagem": "... não é do tamanho correto (precisa ter 8 caracteres)" }
```

As duas mensagens juntas pro mesmo campo (vazio E tamanho errado) não batem
com o que `normalizeNcm` devolve (sempre 8 dígitos reais ou `"00000000"`,
nunca vazio) — sinal de que o valor nem estava chegando no campo que a
Focus NFe espera.

### Causa raiz

`buildItemsPayload` montava o item com a chave `ncm:`, mas o nome do campo
na API da Focus NFe é `codigo_ncm` (confirmado pelo próprio erro, que cita
`itens.1.codigo_ncm`). Como a chave enviada não existia no schema deles, a
Focus tratava o campo esperado (`codigo_ncm`) como completamente ausente —
daí os dois erros simultâneos (ausente conta como "vazio" e, sem valor, não
bate o tamanho).

Reforça a observação já registrada no cabeçalho deste arquivo (seção 7 do
header do `FocusNFeService.ts`): esse adapter foi escrito a partir da
documentação pública, sem validação end-to-end antes dessa sessão — nomes
de campo "quase certos" (como `ncm` em vez de `codigo_ncm`) são exatamente
o tipo de erro que só aparece testando contra o gateway real.

### Correção

```ts
// antes
ncm: normalizeNcm(item.ncm),
// depois
codigo_ncm: normalizeNcm(item.ncm),
```

A validação de formato (`normalizeNcm`, seção 104) não mudou — só o nome
da chave no payload.

### Arquivos alterados

- `backend/src/services/FiscalService/FocusNFeService.ts`

### Testado

- `npx tsc --noEmit` limpo no backend.
- Não re-testado end-to-end nesta sessão (sem acesso ao gateway) —
  **pendente**: cliente fazer o deploy e tentar emitir a Venda #9 de novo.
  Se ainda der erro de NCM, o próximo passo é conferir se o produto
  "MUN CBC 380 AUTO LPC 95GR POLYMATCH C" tem NCM cadastrado de verdade
  (sem isso, cai no fallback `"00000000"`, que não é um NCM válido pra
  munição — a Sefaz pode aceitar o formato mas rejeitar o código em si
  por não existir na tabela oficial).
- Lição registrada pra não repetir: ao adicionar/revisar qualquer campo
  novo em `buildItemsPayload`/`buildEmitente`/`buildDestinatario`, conferir
  o nome exato da chave contra uma resposta de erro REAL da Focus NFe
  (ela sempre ecoa o nome do campo que espera no `erros[].campo`) em vez
  de confiar só na documentação pública.

## 106. Endereço do destinatário nunca chegava na nota — `attributes` do include limitava os campos do cliente (v2.3.125)

### Contexto

Com os fixes das seções 104/105 em produção, o cliente testou a emissão
pra dois destinatários diferentes — um com cadastro completo (endereço,
bairro, cidade, UF todos preenchidos, print conferido na tela de
Clientes) — e a Sefaz continuou rejeitando com "NF-e sem a identificação
do destinatário" nos dois casos. Como o cadastro estava visivelmente
completo, a causa não podia ser dado faltando (como presumido nas seções
anteriores) — tinha que ser código.

### Causa raiz

`SaleService.ts`, `includeOptions`, o `include` de `FinanceCustomer`
(usado tanto por `SaleService.show` quanto por tudo que depende dele —
emissão, pré-visualização de DANFe, etc.) tinha uma lista de `attributes`
explícita:

```ts
attributes: ["id", "name", "document", "documentType", "email"]
```

Nenhum campo de endereço (`street`, `number`, `neighborhood`, `city`,
`state`, `zipCode`) nem `phone` estava nessa lista. Um `attributes`
explícito no Sequelize é uma lista BRANCA — qualquer coluna fora dela
simplesmente não é buscada do banco, mesmo que exista e esteja
preenchida. `buildDestinatario` (`FocusNFeService.ts`) lia
`customer.street`/`customer.city`/etc. de um objeto que nunca tinha
esses campos carregados — sempre `undefined`, não importa o cadastro.
Isso explica por que a causa raiz 3 das seções anteriores (endereço
"faltando") nunca foi realmente sobre o cadastro do cliente estar
incompleto — era sempre esse `attributes` cortando o dado antes dele
chegar no payload.

### Correção

Acrescentados `phone`, `zipCode`, `street`, `number`, `neighborhood`,
`city`, `state` à lista de `attributes` do include.

### Arquivos alterados

- `backend/src/services/FiscalService/SaleService.ts`

### Testado

- `npx tsc --noEmit` limpo no backend.
- Não re-testado end-to-end nesta sessão (sem acesso ao gateway) —
  **pendente**: cliente fazer o deploy e tentar emitir de novo (venda
  #11, ADEVAL ATANAZIO PEREIRA, que já tem CPF certo e agora deve levar
  o endereço completo também).
- Lição pra não repetir: ao adicionar um `attributes` explícito num
  `include` do Sequelize, é fácil esquecer um campo que só é consumido
  bem mais tarde na cadeia (aqui, `FocusNFeService.ts`, vários arquivos
  de distância de `SaleService.ts`) — preferir não restringir
  `attributes` num include cujo resultado alimenta mais de um consumidor
  (lista de vendas, detalhe da venda, módulo fiscal), ou, se restringir,
  grep pelo nome do model/association (`sale.customer`) no resto do
  backend pra conferir quem mais lê esse objeto antes de cortar campos.

## 107. Grupo do PIS/COFINS faltando no item da nota (v2.3.126)

### Contexto

Com os fixes das seções 104-106 em produção (modalidade_frete, NCM,
endereço do destinatário), a venda #13 avançou mais um passo na Sefaz
de verdade — passou da validação de schema e da identificação do
destinatário, e foi rejeitada só nesse novo ponto:

```json
{
  "status": "erro_autorizacao",
  "status_sefaz": "745",
  "mensagem_sefaz": "Rejeicao: NF-e sem grupo do PIS ."
}
```

### Causa raiz

`buildItemsPayload` nunca enviava nenhum campo de PIS nem COFINS — o
item só tinha `icms_origem`/`icms_situacao_tributaria`. A Sefaz exige o
grupo do PIS (e, por decorrência do mesmo motivo, do COFINS também)
mesmo quando não há valor a destacar — não é um campo opcional que some
quando zerado.

### Correção

Adicionado ao item, junto do grupo ICMS já existente:

```ts
pis_situacao_tributaria: "99",
pis_valor_base_calculo: 0,
pis_aliquota_porcentual: 0,
pis_valor: 0,
cofins_situacao_tributaria: "99",
cofins_valor_base_calculo: 0,
cofins_aliquota_porcentual: 0,
cofins_valor: 0
```

CST "99" (Outras Operações) é o código correto pro regime Simples
Nacional — mesmo regime já assumido em `icms_situacao_tributaria: "102"`
(CSOSN de Simples Nacional) e em `buildEmitente`
(`regime_tributario_emitente: "1"` quando `config.taxRegime` é
`simples`/`mei`). Empresas fora do Simples usam CST de PIS/COFINS
diferente (ex. "01", "02", com alíquota/valor calculados de verdade) —
não implementado ainda, mesma limitação já registrada pro ICMS (seção
anterior) por falta de cliente nesse regime testando.

### Arquivos alterados

- `backend/src/services/FiscalService/FocusNFeService.ts`

### Testado

- `npx tsc --noEmit` limpo no backend.
- Não re-testado end-to-end nesta sessão (sem acesso ao gateway) —
  **pendente**: cliente fazer o deploy e tentar emitir de novo. Se a
  Sefaz aceitar PIS mas rejeitar o CFOP/CSOSN do ICMS (ou qualquer outro
  campo tributário) em seguida, é o mesmo padrão: o item de munição
  (NCM 93063000) pode ter regra tributária federal específica que o
  "modo Simples Nacional genérico" hardcoded aqui não cobre — nesse caso
  vale perguntar ao cliente/contador antes de adivinhar o CST certo.
- Lição pra não repetir: campos tributários de item de NF-e (ICMS, PIS,
  COFINS, e potencialmente IPI/ISS conforme o produto) tendem a aparecer
  um de cada vez nas rejeições da Sefaz, nunca todos juntos na primeira
  tentativa — cada rodada de teste real tende a revelar o próximo grupo
  faltando. Vale perguntar ao cliente, antes de continuar adivinhando
  grupo por grupo, se ele tem acesso a um contador/XML de referência de
  nota já emitida com sucesso por outro sistema, pra copiar os CSTs
  certos de uma vez em vez de descobrir por tentativa e erro contra a
  Sefaz.

## 108. Ícone de olho x recibo na lista de Vendas abriam a mesma tela (v2.3.127)

### Contexto

Na lista de Vendas (venda confirmada), os ícones de olho ("Ver itens e
notas fiscais") e de recibo ("Emitir nota fiscal") chamavam a mesma
função (`handleViewDetail`) — abriam o mesmo modal, que já dispara a
busca do histórico de notas fiscais (`fetchDocuments`) assim que abre.
Cliente relatou que o olho, pensado só pra "visualizar as funções" da
venda, caía direto na tela de notas fiscais — incluindo o erro da
última tentativa de emissão — dando a impressão de que o sistema tinha
tentado emitir sozinho.

### Correção

`SaleDetailModal` ganhou a prop `focusFiscal` (default `false`) e um
estado interno `fiscalExpanded`:
- Com `focusFiscal=false` (ícone de olho), a seção "Notas fiscais"
  abre recolhida, atrás de um botão "Ver / emitir nota fiscal" — a
  busca do histórico (`fetchDocuments`) só dispara quando o usuário
  clica nesse botão (useEffect agora depende de `open && fiscalExpanded`,
  não só de `open`).
- Com `focusFiscal=true` (ícone de recibo), a seção já abre expandida,
  igual ao comportamento de antes.

`SaleList.js` passa `focusFiscal` de acordo com qual ícone foi clicado
(`handleViewDetail(sale, focusFiscal)`), e repassa pro modal via prop.

### Arquivos alterados

- `frontend/src/components/SaleDetailModal/index.js`
- `frontend/src/components/SaleList/index.js`

### Testado

- `npx eslint` limpo nos dois arquivos.
- `GENERATE_SOURCEMAP=false CI=false npx craco build` (build de
  produção completo) compilou sem erro.
- Não testado manualmente no navegador nesta sessão (sem ambiente de
  browser) — **pendente**: cliente conferir no navegador depois do
  deploy do frontend que o olho abre só os itens (sem a seção de notas
  fiscais expandida) e que o recibo continua abrindo direto nos botões
  de emissão.

## 109. Escritório de contabilidade sincronizado com a API de Empresas da Focus (v2.3.128)

### Contexto

Seguindo a rejeição Sefaz 487 (seções 107-108 do histórico de erro,
"Escritório de Contabilidade não cadastrado na SEFAZ"), o cliente
cadastrou o CNPJ do contador direto no painel da Focus NFe (aba
"Contabilidade" da empresa) e pediu um campo equivalente no AtendeFlow,
pra não precisar voltar lá toda vez que trocar de contador.

Investigação na doc oficial da Focus (`doc.focusnfe.com.br/reference/atualizar_empresa`
— acesso do servidor bloqueado nesta sessão, conteúdo obtido com a ajuda
do cliente) confirmou: `cpf_cnpj_contabilidade` é um campo de nível
EMPRESA na API "Empresas" da Focus (`PUT /v2/empresas/{id}`), não um
campo do payload de cada nota — por isso nunca apareceu em
`FocusNFeService.ts`. A doc da própria Focus confirma: *"CPF/CNPJ da
contabilidade da empresa. Alguns estados exigem esta informação (ex.:
BA)."*

### Decisão

Em vez de só documentar "troque no painel da Focus manualmente", o
cliente pediu a integração de verdade: campo no AtendeFlow que, ao
salvar, chama a API da Focus e atualiza lá também.

**Duas credenciais diferentes, não confundir**:
- `gatewayTokenSandbox`/`gatewayTokenProduction` (já existentes) — token
  por EMPRESA, usado só pra emitir documento fiscal
  (`FocusNFeService.ts`).
- `focusAccountToken` (novo) — token de CONTA/master da Focus, visto no
  painel deles em "Minha conta" (não na tela de uma empresa específica).
  Autentica a API "Empresas" (gerenciar o cadastro da empresa em si).

Também precisa do `focusCompanyId` — o id INTERNO da empresa na Focus
(não é o CNPJ), visível na URL do painel ao editar a empresa (ex.
`.../minhas_empresas/empresas/273913`).

### Implementação

- Migration `20261017130000-add-accounting-office-to-fiscal-configs.ts`:
  3 colunas novas em `FiscalConfigs` — `accountingOfficeDocument`,
  `focusAccountToken`, `focusCompanyId`.
- `FocusAccountService.ts` (novo arquivo, separado de
  `FocusNFeService.ts` de propósito — API diferente, autenticação
  diferente, host sempre de produção mesmo pra empresa em homologação,
  conforme a doc: *"esta API opera exclusivamente no ambiente de
  produção"*): `updateAccountingOffice(config, document)` faz o `PUT`
  com `try/catch` (padrão obrigatório pra toda chamada HTTP a gateway
  fiscal, seção 627 referenciada em outras partes deste manual).
- `FiscalConfigService.update` dispara a sincronização só quando
  `accountingOfficeDocument` muda de verdade (compara valor anterior vs.
  novo) — não a cada salvamento da tela inteira. Falha na sincronização
  NUNCA bloqueia o salvamento da config local (retorna
  `accountingOfficeSync: {ok, errorMessage}` separado do config em si).
- `FiscalConfigController.update` repassa esse resultado pro frontend
  junto do config.
- `FiscalConfigPanel.js`: 3 campos novos (CNPJ/CPF do escritório, ID da
  empresa na Focus, token de conta — este em campo `type="password"`,
  mesmo padrão dos tokens de Homologação/Produção). Toast separado
  avisando se a sincronização com a Focus falhou (salva local mesmo
  assim) ou funcionou.

### Arquivos alterados

- `backend/src/database/migrations/20261017130000-add-accounting-office-to-fiscal-configs.ts` (novo)
- `backend/src/models/FiscalConfig.ts`
- `backend/src/services/FiscalService/FocusAccountService.ts` (novo)
- `backend/src/services/FiscalService/FiscalConfigService.ts`
- `backend/src/controllers/FiscalConfigController.ts`
- `frontend/src/components/FiscalConfigPanel/index.js`

### Testado

- `npx tsc --noEmit` limpo no backend.
- `npx eslint` limpo no `FiscalConfigPanel.js`.
- `GENERATE_SOURCEMAP=false CI=false npx craco build` (build de
  produção) compilou sem erro.
- Não testado end-to-end contra a API de Empresas da Focus nesta sessão
  (token de conta foi passado pelo cliente no chat, não configurado
  nesta sessão — nunca gravado em código/commit). **Pendente**: cliente
  rodar a migration + deploy, preencher os 3 campos novos em
  Configuração Fiscal (CNPJ do contador, ID da empresa `273913`, token
  de conta), salvar, e conferir se o toast confirma sincronização com
  sucesso — depois tentar emitir a venda de novo pra ver se a rejeição
  487 sumiu de vez.
- Lição pra não repetir: ao integrar um campo de configuração de
  gateway fiscal que parece "simples" (um CNPJ a mais), sempre checar
  primeiro se é um campo do PAYLOAD DA NOTA ou um campo de CADASTRO DA
  EMPRESA no gateway — são APIs, hosts e credenciais diferentes, e
  tentar encaixar um campo de cadastro de empresa dentro do payload de
  emissão (ou vice-versa) não funcionaria de jeito nenhum.

## 110. Botões de emissão escondidos atrás de clique extra na tela de olho (v2.3.129)

### Contexto

Depois do fix da seção 108 (olho x recibo na lista de Vendas), o cliente
testou e apontou dois problemas no mesmo fluxo: o botão novo
"Ver / emitir nota fiscal" criava um passo a mais só pra chegar nos
botões de emissão, e tinha o mesmo texto ("emitir nota") do ícone de
recibo ao lado — confuso, parecia uma tela duplicada.

### Correção

Reexaminando o pedido original do cliente ("quando clica no olho é pra
visualizar as funções"): o problema nunca foi os BOTÕES aparecerem
direto — era o HISTÓRICO de tentativas/erros antigos aparecendo sem
avisar, dando a impressão de que o sistema tinha tentado emitir
sozinho. Correção:

- Os botões de emissão (`Emitir NF-e/NFC-e/NFS-e`, `Pré-visualizar
  DANFe`) agora aparecem direto na seção "Notas fiscais", tanto pelo
  olho quanto pelo recibo.
- Só a TABELA de histórico (`documents`, incluindo erros antigos) fica
  recolhida atrás de um botão "Ver histórico de tentativas" — e só
  dispara `fetchDocuments` quando expandida (estado renomeado de
  `fiscalExpanded` pra `historyExpanded`, mais claro sobre o que
  controla agora).
- `focusFiscal` (prop vinda de `SaleList.js`) continua controlando se
  esse histórico já abre expandido (ícone de recibo) ou recolhido
  (ícone de olho) — só mudou o que fica atrás do toggle.

### Arquivos alterados

- `frontend/src/components/SaleDetailModal/index.js`

### Testado

- `npx eslint` limpo.
- `GENERATE_SOURCEMAP=false CI=false npx craco build` (build de
  produção) compilou sem erro.
- Não testado manualmente no navegador nesta sessão — **pendente**:
  cliente conferir que o olho e o recibo mostram os botões de emissão
  direto, e que o histórico só aparece depois de clicar em "Ver
  histórico de tentativas".
- Lição pra não repetir: ao implementar um pedido de UX descrito em
  texto corrido (sem print/protótipo), confirmar com o cliente depois
  do primeiro teste real em vez de assumir que a primeira interpretação
  bateu — aqui levou duas rodadas (v2.3.127 escondeu demais, v2.3.129
  ajustou pra esconder só o que realmente incomodava).

## 111. Rótulo do campo CNPJ/CPF da contabilidade quebrava a borda (v2.3.130)

Rótulo "CNPJ/CPF do escritório de contabilidade" (campo novo da seção
109) era longo demais pra largura do campo (`Grid item sm={4}`) e
quebrava em duas linhas, estourando a borda arredondada do `TextField`
`variant="outlined"` do MUI — visualmente parecia "descentralizado" em
comparação aos campos vizinhos ("ID da empresa na Focus", "Token de
conta"), que têm rótulo mais curto. Encurtado pra "CNPJ/CPF da
contabilidade" — cabe numa linha só. `npx eslint` e build de produção
limpos. Arquivo: `frontend/src/components/FiscalConfigPanel/index.js`.

## 112. Botões de PDF/XML da nota autorizada + fix de URL relativa (v2.3.131)

### Marco

Depois da cadeia de correções das seções 104-109 (modalidade_frete, NCM,
endereço do destinatário, PIS/COFINS, escritório de contabilidade), o
cliente testou a venda #16 (2 itens) e **as duas notas NF-e saíram
"Autorizada"** — primeira emissão real, de ponta a ponta, confirmada em
produção/homologação. Pedido natural seguinte: baixar/imprimir o PDF
(DANFe) e o XML da nota autorizada.

### Causa raiz descoberta ao implementar

`pdfUrl`/`xmlUrl` (gravados a partir de `data.caminho_danfe`/
`data.caminho_xml_nota_fiscal` da resposta da Focus, ver
`FocusNFeService.parseDocumentResponse`) são **caminho relativo**
(ex.: `/v2/nfe/.../danfe.pdf`), não URL completa — confirmado batendo
contra as notas reais da venda #16. Se o botão novo só abrisse
`doc.pdfUrl` direto, o navegador tentaria abrir relativo ao domínio do
**frontend** (`atendeflow.confiancatechnologies.com/v2/nfe/...`), não
da Focus — 404.

### Decisão de onde resolver a URL

Duas opções: resolver no momento de SALVAR (dentro de
`FocusNFeService.ts`) ou no momento de SERVIR pro frontend (dentro de
`FiscalDocumentService.list`/`show`). Escolhido o segundo, de propósito:
resolver só ao salvar não ajudaria as notas da venda #16, já emitidas
ANTES dessa correção existir — precisaria de uma migration/backfill pra
corrigir o que já está no banco. Resolvendo ao SERVIR, usando o
`environment` ("sandbox"/"production") que já é gravado em todo
`FiscalDocument` desde a v2.3.125, as notas antigas são corrigidas de
graça, sem tocar no banco — só o próximo `GET` já devolve a URL certa.

### Implementação

- `BASE_URL_SANDBOX`/`BASE_URL_PRODUCTION` exportados de
  `FocusNFeService.ts` (eram só consts internas).
- `FiscalDocumentService.resolveDocumentUrls(document)`: prefixa
  `pdfUrl`/`xmlUrl` com o host certo conforme `document.environment`,
  só se o valor já não for uma URL completa (idempotente — seguro
  chamar em cima de um valor já resolvido). Aplicado em `list` e `show`.
- `SaleDetailModal.js`: dois ícones novos na coluna "Ação" de nota
  `authorized` — `PictureAsPdfIcon` ("Ver / imprimir DANFe (PDF)",
  abre `doc.pdfUrl` em nova aba — o navegador mostra o PDF com o botão
  de imprimir nativo dele, não precisou de lógica de impressão própria)
  e `GetAppIcon` ("Baixar XML", abre `doc.xmlUrl`). Só aparecem se o
  campo correspondente não estiver vazio (`doc.pdfUrl && (...)`).

### Arquivos alterados

- `backend/src/services/FiscalService/FocusNFeService.ts` (exports)
- `backend/src/services/FiscalService/FiscalDocumentService.ts`
- `frontend/src/components/SaleDetailModal/index.js`

### Testado

- `npx tsc --noEmit` limpo no backend.
- `npx eslint` e build de produção (`craco build`) limpos no frontend.
- Não testado contra o PDF/XML reais da Focus nesta sessão (sem acesso
  ao navegador) — **pendente**: cliente conferir que os botões abrem o
  PDF/XML de verdade (não 404) nas notas já autorizadas da venda #16,
  depois do deploy de backend E frontend (os dois mudaram dessa vez).

## 113. Lista de Vendas sem paginação na tela (v2.3.132)

Mesmo bug já corrigido antes no `FinanceRecordList` genérico (seção 90,
v2.3.108), agora encontrado em `SaleList.js`: `SaleService.list` já
pagina no backend (`limit=20`, devolve `count`/`hasMore`) desde que o
módulo fiscal existe, mas a tela de Vendas nunca mandava `pageNumber`
nem mostrava nenhum controle de página — sempre buscava só a página 1.
Passou despercebido até o cliente importar o histórico de vendas
antigas (`fiscal.sales.importSpreadsheet`, já existente desde a
v2.3.116) e ultrapassar 20 vendas de verdade.

Correção: `pageNumber`/`count` como estado, `fetchSales` manda
`pageNumber` pro backend, `TablePagination` do MUI no rodapé da
tabela — mesmo padrão exato já usado em `FinanceRecordList.js`
(`PAGE_SIZE = 20`, `page={pageNumber - 1}`,
`onPageChange={(e, newPage) => setPageNumber(newPage + 1)}`). Sem
busca/filtro nessa tela (diferente do Financeiro), não precisou do
efeito de "resetar pra página 1 ao buscar".

**Arquivo alterado**: `frontend/src/components/SaleList/index.js`.
`npx eslint` e build de produção limpos. Lição pra não repetir: ao
criar uma lista nova em cima de um recurso que já suporta paginação no
backend, sempre conferir se a tela realmente manda `pageNumber` e
mostra algum controle — já é a segunda vez que esse exato padrão de bug
aparece no projeto.

## 114. Filtro por tipo na lista de Produtos — armas x munição x geral (v2.3.133)

### Contexto

Cliente ia importar uma planilha de produtos de armas separada e
perguntou como deixar "segmentado pra não misturar os produtos" com o
que já estava cadastrado (munição, produtos gerais).

### O que já existia vs. o que faltava

O **dado** já vem segmentado desde sempre: `FinanceProduct.type`
("product"/"service"/"weapon"/"ammunition"), e o importador
(`FinanceImportService.parseGunStoreReport`, Fase 6) já detecta e
preenche esse campo automaticamente a partir da categoria do relatório
da loja de armas — nenhuma importação nova "mistura" o dado em si.

O que faltava era só a **visualização**: `FinanceProductService.list`
nunca aceitava filtrar por `type`, e a tela de Produtos
(`Financeiro/index.js`) nunca passava `filters` pro `FinanceRecordList`
genérico (diferente de Contas a Pagar/Receber, que já tinham filtro de
status desde a Fase 2) — todos os tipos sempre apareciam juntos na
mesma lista, só distinguíveis pela coluna "Tipo".

### Correção

- `FinanceProductService.list` ganhou o parâmetro `type` (filtra
  `whereCondition.type` quando informado).
- `FinanceProductController.index` repassa `req.query.type`.
- `financeConfig.js`: `financeProductFilters` novo (select "Tipo":
  Todos/Produto/Serviço/Arma/Munição-Insumo, reaproveitando
  `PRODUCT_TYPE_OPTIONS` que já existia pro formulário de cadastro).
- `Financeiro/index.js`: `filters={financeProductFilters}` na
  instância do `FinanceRecordList` de Produtos — mesmo mecanismo
  genérico já usado em Contas a Pagar/Receber, nenhuma mudança no
  componente genérico em si.

### Arquivos alterados

- `backend/src/services/FinanceService/FinanceProductService.ts`
- `backend/src/controllers/FinanceProductController.ts`
- `frontend/src/pages/Financeiro/financeConfig.js`
- `frontend/src/pages/Financeiro/index.js`

### Testado

- `npx tsc --noEmit` limpo no backend.
- `npx eslint` e build de produção limpos no frontend.
- Não testado manualmente no navegador nesta sessão — **pendente**:
  cliente conferir, depois do deploy, que o filtro "Tipo" aparece na
  tela de Produtos e separa corretamente armas/munição/produtos ao
  escolher cada opção.

## 115. Filtro de Produtos separa Armas nacionais/importadas (v2.3.134)

Pedido de ajuste imediato depois da seção 114: cliente quer "Armas
nacionais" e "Armas importadas" como opções separadas no filtro, em vez
de um "Arma" único. Não existe (nem deveria existir) um `type` próprio
pra isso — já existe exatamente esse dado no campo `origin`
("Procedência": `national`/`imported`, Fase 6) junto de `type="weapon"`.

Em vez de criar um segundo select (Tipo + Procedência) só pra esse
cruzamento, o filtro único de "Tipo" aceita um valor composto
`"weapon:national"`/`"weapon:imported"` (dois pontos como separador),
resolvido em `FinanceProductService.list`: se o valor contém `:`, quebra
em `[type, origin]` e filtra os dois campos juntos; senão, filtra só
`type` como antes. Nenhuma mudança no componente genérico
`FinanceRecordList` nem no formulário de cadastro — só a lista de opções
do filtro e o parsing no backend.

**Arquivos**: `backend/src/services/FinanceService/FinanceProductService.ts`,
`frontend/src/pages/Financeiro/financeConfig.js`. `npx tsc --noEmit`,
`npx eslint` e build de produção limpos.

**Pendente** (ainda não implementado, aguardando o cliente fechar a
lista completa de categorias antes de mexer de novo — pedido espalhado
em várias mensagens seguidas, ver lição da seção 90 sobre não
implementar no meio): adicionar "Acessórios" e "Caça & Pesca" como
`type` novos (`accessory`, `hunting_fishing` ou nome parecido) no
`PRODUCT_TYPE_OPTIONS` do formulário de cadastro e no filtro.

## 116. Tipos de produto novos: Acessório e Caça & Pesca (v2.3.135)

Fecha a lista de categorias pedida nas seções 114/115: cliente confirmou
("por enquanto só isso") que não precisa de mais nenhuma. Dois `type`
novos, flat (sem cruzamento com `origin` como "Armas nacionais/
importadas" — não foi pedido pra esses):

- `accessory` → "Acessório"
- `hunting_fishing` → "Caça & Pesca"

Adicionados em `PRODUCT_TYPE_OPTIONS` (formulário de cadastro, campo
"Tipo") e nas opções do filtro `financeProductFilters` da lista de
Produtos, na ordem pedida (Produto, Armas nacionais, Armas importadas,
Munições/Insumos, Acessórios, Caça & Pesca, Serviço por último).

Nenhuma mudança de backend necessária — `FinanceProduct.type` é coluna
de texto livre, sem whitelist/enum no banco nem validação Yup
restringindo valores, então um `type` novo só precisa existir nas
opções do frontend pra funcionar (cadastro, filtro, e qualquer
`visibleWhen`/`requiredWhen` que algum dia precise checar esse tipo
específico).

**Arquivo**: `frontend/src/pages/Financeiro/financeConfig.js`. `npx
eslint` e build de produção limpos.

## 117. Navegação de Produtos movida pro menu lateral (v2.3.136)

O filtro "Tipo" da lista de Produtos (select adicionado nas seções
114-116) não abria em produção pro cliente ("cliquei não abre") mesmo
depois de confirmado, via `curl` direto no bundle publicado
(`main.<hash>.js`), que o servidor/Cloudflare serviam o código certo —
inclusive com as strings das opções novas presentes no arquivo. Ou
seja: não era cache de CDN nem deploy desatualizado; o problema estava
em algum lugar entre o bundle correto e o `<Select>` do MUI realmente
abrir na tela do cliente (hipótese não totalmente isolada: possível
conflito entre `@material-ui/core` v4 e `@mui/material` v5 coexistindo
no projeto, mas não investigado a fundo).

Em vez de insistir num componente que já se provou pouco confiável
nesse ambiente, a navegação por categoria foi movida pro menu lateral
principal (`frontend/src/layout/MainListItems.js`), reaproveitando o
padrão que já existe aí para "Campanhas" (`openCampaignSubmenu` +
`Collapse` + `List` de sub-itens):

- **Financeiro** virou um item expansível (clique abre/fecha, não
  navega) com sub-itens: Painel Financeiro, Contas a Pagar, Contas a
  Receber, Vendas, Clientes, **Produtos**, Fornecedores, Configuração
  Fiscal.
- **Produtos**, dentro do submenu, expande de novo (segundo nível)
  mostrando: Todos os produtos, Armas nacionais, Armas importadas,
  Munições/Insumos, Acessórios, Caça & Pesca, Serviços — os mesmos
  valores de `type`/`type:origin` já usados pelo filtro antigo
  (`weapon:national`, `weapon:imported`, `ammunition`, `accessory`,
  `hunting_fishing`, `service`).
- Com o menu lateral recolhido (modo ícone), "Produtos" vira um link
  direto (sem segundo nível, que não cabe nesse modo) — só mostra a
  lista completa, sem filtro de categoria.

**Como a navegação chega até a tela certa**: cada sub-item linka pra
`/financeiro?tab=<aba>` (produtos: `&type=<valor>` também). A página
inteira do Financeiro (`frontend/src/pages/Financeiro/index.js`) é uma
SPA sem rota por aba — a navegação sempre foi controlada só por estado
React (`financeTab`), nunca pela URL. Um `useEffect` novo lê
`location.search` (via `useLocation()`) e chama `setFinanceTab(tab)`
quando o parâmetro `tab` está presente, então um link do menu lateral
realmente troca de aba mesmo a página já estando montada. O parâmetro
`type` é lido à parte e passado como `initialFilterValues={{ type }}`
pro `FinanceRecordList` da aba Produtos — com uma pegadinha: o `key`
desse componente, que antes era só `financeTab` (fixo, "products"),
virou `` `products-${productTypeParam}` ``, porque sem isso trocar de
categoria (ex.: Armas nacionais → Munições/Insumos) não remontava o
componente, e um prop `initial*` só é lido na primeira renderização —
ficaria preso na primeira categoria clicada.

`FinanceRecordList` (`frontend/src/components/FinanceRecordList/index.js`)
ganhou o prop `initialFilterValues` (default `{}`), usado só pra
inicializar o `useState` de `filterValues` — mesma lógica de sempre
dali em diante (busca, paginação, `resource.list({...filterValues})`).

O dropdown "Tipo" acima da tabela **não foi removido** — continua lá,
como caminho alternativo, caso o bug de abertura seja identificado e
corrigido depois. As duas formas de filtrar levam ao mesmo lugar
(mesmo `type`/`type:origin`).

**Arquivos**: `frontend/src/layout/MainListItems.js` (submenu +
ícones novos: `Receipt`, `MonetizationOn`, `ShoppingCart`, `Store`,
`LocalShipping`, `Gavel`, `Flag`, `Public`, `Build`, `Nature`, todos de
`@material-ui/icons`; `ListItemLink` ganhou um segundo critério de
`isActive` pra reconhecer link com query string, ex.
`/financeiro?tab=products`), `frontend/src/pages/Financeiro/index.js`,
`frontend/src/components/FinanceRecordList/index.js`. `npx eslint` e
build de produção limpos (sem erros; só os warnings pré-existentes do
arquivo, não relacionados a essa mudança).

## 118. Emojis nos itens do submenu Financeiro (v2.3.137)

Pedido estético simples, só mexe em texto de `primary` dos
`ListItemLink`/`Typography` criados na seção 117 — cada item do
submenu lateral ganhou um emoji antes do nome (📊 Painel Financeiro,
💸 Contas a Pagar, 💰 Contas a Receber, 🛒 Vendas, 👥 Clientes, 📦
Produtos — inclusive o cabeçalho do segundo nível —, 🔫 Armas
nacionais, 🌎 Armas importadas, 🧰 Munições/Insumos, 🎒 Acessórios,
🎣 Caça & Pesca, 🔧 Serviços, 🚚 Fornecedores, 🧾 Configuração Fiscal).
O cabeçalho "Financeiro" (nível mais alto, que já tem ícone colorido
do `LocalAtmIcon`) não ganhou emoji — vem de uma chave de i18n
(`mainDrawer.listItems.financeiro`) reusada em mais de um lugar,
então prefixar ali mudaria texto fora do escopo pedido.

**Arquivo**: `frontend/src/layout/MainListItems.js`. `npx eslint` e
build de produção limpos.

## 119. Painel Financeiro sem navegação duplicada (v2.3.138)

Depois da navegação migrar pro menu lateral (seção 117), a tela do
Financeiro ficou com DUAS formas de trocar de aba: o menu lateral novo
e a lista vertical de abas (`<Tabs orientation="vertical">`) que
sempre existiu dentro da própria página, à esquerda do conteúdo.
Cliente confirmou que o menu lateral já funciona e pediu pra tirar essa
segunda lista, que ficou redundante.

Removido o bloco `<Tabs>`/`<Tab>` inteiro de
`frontend/src/pages/Financeiro/index.js` (junto com os imports
`Tabs`/`Tab`, agora sem uso, e os estilos `layoutRow`/`sideTabs`/
`sideTab`) — a página passou a renderizar só `{renderPanel()}` direto,
ocupando a largura inteira. A troca de aba continua 100% funcional
pelo `financeTab`/`setFinanceTab` de sempre, só que agora controlada
só pelo menu lateral (via `?tab=...` na URL, seção 117) — nenhuma
lógica de navegação mudou, só a remoção da lista duplicada.

**Arquivo**: `frontend/src/pages/Financeiro/index.js`. `npx eslint` e
build de produção limpos.

## 120. Importação de vendas com opção de dar baixa no estoque (v2.3.139)

Cliente emitiu duas notas (492, 493) direto no painel da Focus NFe
(fora do AtendeFlow, antes de trocar o próximo número pra 494) e quis
registrá-las em Vendas a partir da mesma planilha "Consulta de Notas
Fiscais - Analítico" que o `SaleImportService` (seção... v2.3.116) já
sabe ler — mas, diferente de toda importação histórica anterior, essas
duas são recentes o bastante pra precisar baixar estoque de verdade
(a venda aconteceu, o estoque físico já saiu, só não tinha sido
refletido em lugar nenhum do sistema ainda).

`importSales` ganhou um terceiro parâmetro opcional,
`options: SaleImportOptions` (`{ deductStock?: boolean }`, default
`{}` → `false`) — o comportamento de sempre (nunca mexer em estoque)
continua sendo o padrão pra qualquer chamada que não passe essa opção
explicitamente. Quando `true`, pra cada item de cada nota que **achar**
o produto por SKU, desconta a quantidade vendida de
`FinanceProduct.stockQuantity` (`product.decrement(...)`, atômico) e
soma em `summary.stockDeducted`; quando não acha o produto pelo SKU, a
venda e o item são registrados normalmente (como sempre foi), mas
**sem** baixar estoque nenhum — e entra um aviso em `summary.errors`
avisando que esse item específico ficou sem baixa, pra não passar
batido.

A idempotência que já existia (checagem de `FiscalDocument` com
`externalRef = legado-nf-<número>` antes de criar) também protege a
baixa de estoque: reimportar a mesma planilha (por engano, ou pra
conferir) pula a nota inteira antes de chegar no código de baixa —
nunca desconta duas vezes.

**Frontend**: `SaleList/index.js` ganhou uma caixinha "Dar baixa no
estoque" ao lado do botão "Importar planilha", desmarcada por padrão e
**sempre resetada pra desmarcada** depois de cada importação (mesmo
que a importação falhe) — precisa ser marcada de novo a cada vez, de
propósito, pra uma eventual importação em massa futura nunca sair
baixando estoque sem o usuário decidir isso consciente, clique a
clique. `useFiscal.sales.importSpreadsheet(file, deductStock)` manda
esse flag como campo `deductStock` (string `"true"`/`"false"`) no
mesmo `FormData` do upload; `SaleImportController` lê
`req.body.deductStock` e repassa pro service.

**Arquivos**: `backend/src/services/FiscalService/SaleImportService.ts`,
`backend/src/controllers/SaleImportController.ts`,
`frontend/src/hooks/useFiscal/index.js`,
`frontend/src/components/SaleList/index.js`. `npx tsc --noEmit`, `npx
eslint` e build de produção limpos.

## 121. Filtro de período em Vendas; remoção da opção de baixa no estoque (v2.3.140)

Dois ajustes no mesmo commit, pedidos em sequência pelo cliente logo
depois da seção 120:

**Remoção da caixinha "Dar baixa no estoque"** — usada uma única vez
(notas 492/493) e o cliente pediu de volta pra tirar, não queria isso
como opção permanente na tela (risco de alguém marcar sem querer numa
importação de histórico futura e descontar estoque que não devia).
Revertido 100% pro estado de antes da seção 120:
`SaleImportService.importSales` sem `options`/`SaleImportOptions`,
sem `stockDeducted` no `SaleImportSummary`, sem `product.decrement(...)`;
`SaleImportController` sem ler `req.body.deductStock`;
`useFiscal.sales.importSpreadsheet` sem o parâmetro; `SaleList.js` sem
a checkbox. As duas notas específicas (492/493) já tinham sido
ajustadas manualmente no cadastro dos produtos antes dessa reversão
(instrução dada ao cliente na seção anterior) — não houve perda de
dado, só a remoção do recurso em si.

**Filtro de período em Vendas** — pedido: "ver vendas do dia, da
semana, do mês ou por período de data". Select "Período" novo ao lado
do campo de busca (`PERIOD_OPTIONS`: Todo o período/Hoje/Esta
semana/Este mês/Personalizado), com dois campos de data (De/Até) que
só aparecem quando "Personalizado" é escolhido. `resolvePeriodRange`
(função pura, local ao componente) converte o preset escolhido em
`startDate`/`endDate` (`"YYYY-MM-DD"`) usando `moment().startOf/endOf
("week"|"month")` — "Personalizado" usa as datas digitadas direto, sem
conversão.

Backend: `SaleService.list` ganhou `startDate`/`endDate` opcionais,
filtrando por `Sale.saleDate` (coluna `DATEONLY`) com `Op.gte`/`Op.lte`
independentes (cada um funciona sozinho, não precisa dos dois juntos).
`SaleController.index` só repassa os dois novos query params.

Troca de período sempre volta pra página 1 (mesmo padrão já usado em
toda lista paginada do projeto — senão a busca nova pode abrir numa
página sem resultado).

**Arquivos**: `backend/src/services/FiscalService/SaleImportService.ts`,
`backend/src/controllers/SaleImportController.ts`,
`backend/src/services/FiscalService/SaleService.ts`,
`backend/src/controllers/SaleController.ts`,
`frontend/src/hooks/useFiscal/index.js`,
`frontend/src/components/SaleList/index.js`. `npx tsc --noEmit`, `npx
eslint` e build de produção limpos.

## 122. Permissão "Importar planilha" por usuário (v2.3.141)

Pedido: usuário comum ("user") não deve ter a opção de importar
planilha em NENHUM serviço do sistema, por padrão — isso precisa ser
liberado nas permissões do cadastro do usuário, não ficar sempre
disponível. Antes dessa versão, os 4 botões "Importar planilha"
(Clientes, Fornecedores, Produtos — todos em
`frontend/src/pages/Financeiro/financeConfig.js` via
`FinanceRecordList.js` — e Vendas, `SaleList.js`) apareciam pra
qualquer usuário com acesso ao módulo (Financeiro/Fiscal), sem
distinção de perfil.

O projeto já tinha um padrão pronto pra esse tipo de permissão
granular — a seção "Permissões" do `UserModal.js` (Permitir grupos,
Ações nas conexões, Ver dashboard, Ver painel em tempo real), cada uma
um toggle próprio no cadastro do usuário, Admin sempre com tudo
liberado por padrão/implícito. Replicado o mesmo padrão pra
`allowImport` (string `"enabled"`/`"disabled"`, cai no `else` genérico
de `isPermissionEnabled`/`togglePermission` — nenhuma mudança
necessária nessas duas funções, só registrar o campo novo em
`permissionContent` e adicionar o `Grid`/`renderPermissionButtonField`
depois de "Ver painel em tempo real").

**Toda a cadeia de campos que precisou ser tocada** (lição de seções
anteriores: esse tipo de campo de permissão passa por VÁRIOS pontos
até virar algo utilizável no frontend — fácil esquecer um):

1. `backend/src/models/User.ts` — coluna nova `allowImport` (`@Default("disabled")`).
2. Migration `20261017220000-add-allowimport-to-users.ts`.
3. `ShowUserService.ts` — **crítico**: sem adicionar `"allowImport"` na
   whitelist de `attributes`, o campo nunca chega no frontend, nem no
   formulário de edição do usuário nem (mais importante) no
   `AuthContext.user` da sessão atual — `RefreshTokenService.ts` usa
   exatamente esse service pra reconstruir o usuário a cada renovação
   de token, é por aí que o valor chega na sessão já logada, não só no
   login.
4. `CreateUserService.ts`/`UpdateUserService.ts` — aceitar, persistir e
   devolver o campo (mesmo padrão de `allowRealTime`/`allowConnections`:
   `if (userData.allowImport) { ... }`, string sempre truthy tanto pra
   `"enabled"` quanto `"disabled"`).
5. `SerializeUser.ts` — incluído na resposta do login
   (`AuthUserService`/`CreateUserService`).
6. `isAuth.ts` — **o outro ponto crítico**: o middleware de autenticação
   NÃO repassa o usuário inteiro pro `req.user` das rotas, monta um
   `_baseUser` com uma whitelist própria e BEM menor (hoje:
   `id/profile/companyId/super/canViewAllContacts/canDeleteTickets/
   allowConnections/financialAccess`) — a maioria dos campos de
   permissão (`allowRealTime`, `showDashboard`, `allowGroup` etc.)
   **nunca chegava em `req.user`**, ou seja, só eram aplicados no
   FRONTEND, sem checagem nenhuma no backend. `allowImport` foi
   adicionado nessa whitelist de propósito, porque esse aqui PRECISA
   ser verificável no backend (ver abaixo).

**Frontend**: `UserModal.js` ganhou o toggle "Importar planilha" (ver
acima). `FinanceRecordList.js` e `SaleList.js` leem
`user.profile === "admin" || user.super || user.allowImport ===
"enabled"` (`canImport`) e só renderizam o botão (+ o `<input
type="file">` escondido) quando isso é verdadeiro — o botão "Baixar
modelo" (planilha em branco, sem dado nenhum da empresa) não entra
nessa regra, continua liberado pra todo mundo.

**Backend — a parte que realmente importa pra segurança**: esconder o
botão sozinho não impede ninguém de montar a requisição `POST
/finance/.../import` ou `POST /sales/import` direto (DevTools, Postman
etc.). `FinanceImportController.ts` e `SaleImportController.ts`
ganharam `ensureImportPermission(req)` (função local, mesmo padrão já
usado pro `ensureAccess` de cada controller — duplicada entre os dois
arquivos de propósito, seguindo o estilo já existente em vez de criar
um util compartilhado novo): Admin/Master (`profile === "admin"` ou
`super`) sempre passa; usuário comum precisa de
`req.user.allowImport === "enabled"`, senão `403
ERR_NO_IMPORT_PERMISSION`. Os endpoints de template em branco
(`productTemplate`/`customerTemplate`) não entram nessa checagem.

Erro novo traduzido em `frontend/src/translate/languages/pt.js`
(`ERR_NO_IMPORT_PERMISSION`) — só em português por ora, mesmo padrão
de outros códigos de erro recentes que não têm tradução nos outros 4
idiomas ainda.

**Arquivos**: `backend/src/models/User.ts`,
`backend/src/database/migrations/20261017220000-add-allowimport-to-users.ts`,
`backend/src/services/UserServices/ShowUserService.ts`,
`backend/src/services/UserServices/CreateUserService.ts`,
`backend/src/services/UserServices/UpdateUserService.ts`,
`backend/src/helpers/SerializeUser.ts`,
`backend/src/middleware/isAuth.ts`,
`backend/src/controllers/FinanceImportController.ts`,
`backend/src/controllers/SaleImportController.ts`,
`frontend/src/components/UserModal/index.js`,
`frontend/src/components/FinanceRecordList/index.js`,
`frontend/src/components/SaleList/index.js`,
`frontend/src/translate/languages/pt.js`. `npx tsc --noEmit`, `npx
eslint` e build de produção limpos.

## 123. Seleção em massa pra excluir (admin); filtro de Produtos mais limpo por categoria (v2.3.142)

Pedido do cliente, em cima do fim da fase de teste: "selecionar tudo
por página pra deletar", admin-only (sem exceção configurável por
usuário — diferente de `allowImport` da seção 122), pra limpar o
módulo Financeiro inteiro (Clientes, Fornecedores, Produtos, Vendas,
Contas a Pagar/Receber) e reimportar tudo do zero, agora em modo
produção, começando a numeração de nota fiscal em 494. Configuração
Fiscal (tokens, CNPJ da contabilidade, numeração) não é afetada — fica
de fora de propósito, só os cadastros/transações é que somem.

**Decisão de design**: em vez de um endpoint de exclusão em massa novo
(que precisaria reimplementar toda regra de negócio de cada exclusão
individual), a seleção em massa REAPROVEITA o mesmo `resource.remove`/
`fiscal.sales.remove` que o botão de excluir individual já chama —
só repete a chamada pra cada id selecionado, sequencialmente (não
`Promise.all`, pra não sobrecarregar o servidor numa seleção grande),
juntando sucesso/erro de cada um num resumo (toast). Isso significa
que toda regra de segurança que já existia continua valendo
automaticamente — em especial, **venda com nota fiscal de Produção
continua impossível de excluir** (`SaleService.remove`, guarda
antiga, seção de paginação de Vendas) — apagar uma nota já autorizada
pela Sefaz do banco local não cancela o documento fiscal de verdade,
só faz o sistema "esquecer" dele, então essa trava continua de
propósito. `SaleList.js` já reflete isso na seleção: a checkbox de uma
venda não-excluível (`isDeletable`, mesma condição que já decidia se o
ícone de lixeira individual aparecia) vem desabilitada, pra não deixar
marcar algo que o servidor vai recusar de qualquer jeito.

**Como usar pra zerar o módulo inteiro**: como a seleção é só "da
página" (20 registros por vez, não "selecionar tudo que bate o
filtro"), uma limpeza completa de uma lista com mais de 20 registros
precisa repetir marcar-tudo + excluir a cada página. Ordem recomendada
pra evitar erro de FK (registro pai referenciado por um filho que
ainda existe): Vendas primeiro (isso já leva junto os itens da venda,
documento fiscal e a conta a receber gerada por ela, via
`SaleService.remove`), depois Contas a Pagar/Receber restantes
(nenhuma dependência), por último Clientes/Fornecedores/Produtos.

**Frontend** (`FinanceRecordList.js`/`SaleList.js`, mesmo padrão nos
dois): `isAdmin = user?.profile === "admin" || !!user?.super` controla
a coluna de checkbox inteira (nem aparece pra quem não é admin,
diferente de só desabilitar o botão) + um estado `selectedIds`, limpo
a cada novo fetch (trocar de página/filtro/busca some com a seleção
antiga, de propósito — evita excluir por engano algo que não está mais
visível). Um segundo `ConfirmationModal` (`bulkConfirmOpen`), separado
do modal de exclusão individual que já existia, confirma antes de
rodar.

**Filtro de Produtos por categoria** — ajuste pequeno e relacionado
(mesma leva de pedidos): depois da navegação por categoria ter migrado
pro menu lateral (seção 117), o dropdown "Tipo" que ainda ficava acima
da tabela de Produtos virava redundante/confuso quando a tela já tinha
sido aberta através de um link de categoria específica (ex.: "Armas
nacionais") — oferecia trocar pra outra categoria ali dentro de um
painel que já é daquela categoria. `Financeiro/index.js` agora só
passa `financeProductFilters` pro `FinanceRecordList` quando
`productTypeParam` (o `type` da URL) está vazio — ou seja, só quando a
tela abriu via "Todos os produtos" (sem categoria definida); chegando
por qualquer categoria específica, `filters={[]}`, o seletor nem
renderiza.

**Arquivos**: `frontend/src/components/FinanceRecordList/index.js`,
`frontend/src/components/SaleList/index.js`,
`frontend/src/pages/Financeiro/index.js`. `npx eslint` e build de
produção limpos (nenhuma mudança de backend nessa versão — reaproveita
100% os endpoints de exclusão já existentes).

## 124. Exclusão em massa também libera vendas com nota de Produção, admin-only (v2.3.143)

Pedido direto do cliente, em seguida da seção 123: as vendas 492/493
(lançadas direto no painel da Focus, importadas pro AtendeFlow) têm
nota fiscal de Produção de verdade — a trava de `SaleService.remove`
(seção de paginação de Vendas) recusa excluir qualquer venda nessa
situação, de propósito, desde sempre. Perguntado explicitamente antes
de mexer nisso: cliente confirmou que quer poder excluir mesmo assim,
porque o XML/PDF autorizado pela Sefaz **não fica guardado no nosso
servidor** — só uma URL apontando pro servidor da própria Focus
(`FiscalDocumentService.resolveDocumentUrls`, seção 112) — então
apagar o registro local não desfaz nem afeta o documento fiscal de
verdade, só faz o AtendeFlow "esquecer" dele. O XML que vai pro
contador gerar o imposto continua intacto onde sempre esteve.

**Não foi removida a trava padrão** — só adicionado um `force`
opcional que a ignora, e só quando:

1. Quem está pedindo é Admin/Master — checado no **controller**
   (`SaleController.remove`), antes de chegar no service, lendo
   `req.user.profile`/`req.user.super` (os mesmos campos já
   disponíveis em `req.user` desde a seção 122). Um usuário comum
   mandando `?force=true` manualmente na requisição tem o parâmetro
   simplesmente ignorado — a trava continua valendo pra ele, sem
   exceção.
2. E, no frontend, só quando o checkbox "Também excluir vendas com
   nota de Produção" é marcado na confirmação da exclusão em massa —
   aparece só quando a seleção atual inclui pelo menos uma venda nessa
   situação (`hasProductionInSelection`), com um aviso em vermelho
   explicando o que significa marcar.

`SaleService.remove(id, companyId, force = false)` — `force` bypassa
as duas checagens de nota de Produção (a que já tem documento de
Produção, e a que está sem documento nenhum mas a empresa já está com
Produção ativa). Sem `force` (todo o resto do sistema, incluindo o
botão de excluir individual que sempre existiu), comportamento 100%
igual a antes.

A checkbox do item na tabela de Vendas não fica mais desabilitada pra
venda com nota de Produção (antes da seção 123 nem aparecia opção de
seleção nenhuma) — qualquer linha pode ser marcada, só mostra uma
dica (tooltip) explicando que precisa do checkbox extra pra ser
excluída de verdade; se for selecionada sem marcar o `force`, o
backend recusa normalmente e ela entra no resumo de falhas do lote,
igual qualquer outro erro — sem comportamento especial de silêncio.

**Arquivos**: `backend/src/services/FiscalService/SaleService.ts`,
`backend/src/controllers/SaleController.ts`,
`frontend/src/hooks/useFiscal/index.js`,
`frontend/src/components/SaleList/index.js`. `npx tsc --noEmit`, `npx
eslint` e build de produção limpos.

## 125. Ícone de excluir individual removido da coluna Ação em Vendas (v2.3.144)

Pedido pontual do cliente, depois de ver a seleção em massa
funcionando (seção 123/124): "pode tirar o ícone do delete embaixo de
ação" — o ícone de lixeira por linha (aparecia em rascunho, e em
venda confirmada/cancelada de teste) ficou redundante, já que marcar
só aquela linha na seleção em massa faz a mesma coisa.

Removido o `IconButton`/`Tooltip` de excluir dos três blocos de
`status` (`draft`/`confirmed`/`cancelled`) na coluna "Ação", junto com
o código que só servia pra esse fluxo e ficou sem uso: `requestDelete`,
o branch `confirmAction === "delete"` em `handleConfirmAction`, e a
entrada `delete` em `confirmModalProps`. O modal de confirmação
genérico (`confirmAction`) continua usado por "confirmar"/"cancelar"
venda, só a opção de excluir saiu dele.

**Arquivo**: `frontend/src/components/SaleList/index.js`. `npx eslint`
e build de produção limpos.

## 126. Baixar PDF/XML em massa (v2.3.145)

Pedido: "filtro pra baixar as notas fiscais iguais os outros filtros
já feitos — escolhe PDF ou XML, seleciona uma ou várias, no mesmo
padrão que já faz" (reaproveitando a seleção em massa da seção
123/124) — "separado ou por período" (nota a nota, ou usando o filtro
"Período" já existente + "selecionar tudo da página" pra pegar um lote
inteiro de uma vez). Perguntado e confirmado: cada arquivo baixa numa
aba separada (sem juntar tudo num .zip).

**Diferente da exclusão em massa, esse recurso é liberado pra
qualquer usuário** (não é admin-only) — baixar um PDF/XML já
autorizado pela Sefaz não tem o mesmo risco de apagar dado. Por isso a
coluna de checkbox (cabeçalho "selecionar tudo"/linha a linha) deixou
de ser condicionada a `isAdmin` — agora sempre aparece; só o botão
"Excluir selecionadas" continua atrás do `isAdmin`. A dica (tooltip) na
checkbox sobre "tem nota de Produção" também passou a só aparecer pra
quem é admin (só ele vê o botão de excluir, não faz sentido mostrar
esse aviso pra quem só vai baixar arquivo).

**Achado importante durante a implementação**: o `pdfUrl`/`xmlUrl` de
cada `FiscalDocument` **não vêm na listagem de Vendas** —
`SaleService.ts`, `includeOptions`, restringe o `FiscalDocument`
incluído a `["id", "type", "status", "environment"]` de propósito
(lista enxuta). Em vez de alargar essa whitelist (arriscaria deixar a
listagem de Vendas mais pesada sem necessidade, numa tela que já é
paginada e consultada com frequência), o download em massa busca o
histórico de documentos de cada venda SELECIONADA na hora
(`fiscal.fiscalDocuments.list(saleId)`, o mesmo endpoint `GET
/sales/:id/fiscal-documents` que a tela "Ver histórico de tentativas"
do `SaleDetailModal` já usa) — esse endpoint já devolve `pdfUrl`/
`xmlUrl` resolvidos pro host certo da Focus
(`FiscalDocumentService.resolveDocumentUrls`, seção 112). Zero mudança
de backend nessa versão — só reaproveitamento do que já existia.

Pra cada venda selecionada: busca os documentos, acha o primeiro com
`status === "authorized"` que tenha o campo do formato escolhido
preenchido, e `window.open(url, "_blank")`. Venda sem nota autorizada
no formato escolhido (ex.: ainda em rascunho, ou só tem nota de
homologação sem XML) é ignorada, contada à parte e avisada por toast —
não trava o lote inteiro por causa de uma venda sem documento.

**Arquivo**: `frontend/src/components/SaleList/index.js`. `npx eslint`
e build de produção limpos (nenhuma mudança de backend).

## 127. Ícone de excluir individual removido de Clientes/Fornecedores/Produtos/Contas (v2.3.146)

Mesmo pedido da seção 125, agora pro resto do Financeiro: "de todos"
(confirmado pelo cliente) — `FinanceRecordList.js` é o componente
compartilhado por Clientes, Fornecedores, Produtos, Contas a Pagar e
Contas a Receber (`frontend/src/pages/Financeiro/index.js` monta cada
aba passando `resource`/`columns`/`fields` diferentes pro mesmo
componente), então um ajuste só nele já vale pras 5 listas de uma vez.

Removido o `IconButton` de excluir da coluna "Ação" (ficava ao lado do
de editar), e o código que só servia esse fluxo: `handleRequestDelete`,
`handleConfirmDelete`, os estados `confirmOpen`/`deleteTarget`, e o
`ConfirmationModal` de exclusão individual (o de exclusão em massa,
`bulkConfirmOpen`, continua intacto). Editar (`handleEdit`) não mudou
— só a lixeira saiu.

**Arquivo**: `frontend/src/components/FinanceRecordList/index.js`.
`npx eslint` e build de produção limpos (nenhuma mudança de backend).

## 128. Imprimir / Exportar PDF e Excel — Clientes, Fornecedores, Produtos, Contas a Pagar e Contas a Receber (v2.3.147)

Retomada do pedido antigo de relatórios (ainda em aberto desde o
início da sessão), agora concretizado pra essas 5 listas: "quando
filtrar ou selecionar, ter a opção de imprimir ou gerar em PDF ou
Excel... o usuário que tenha permissão possa imprimir direto na
impressora instalada na máquina ou gerar PDF/Excel."

**Reaproveitado 100% o padrão que já existia** no Painel Financeiro
(`FinancePainel.js`, pedido/implementação anterior) em vez de inventar
um mecanismo novo:

- **PDF/impressora**: `window.print()` + CSS `@media print` escondendo
  tudo da tela (`body * { visibility: hidden }`) exceto uma área
  dedicada (`#finance-record-list-print-area`), montada SÓ na hora de
  imprimir com uma tabela HTML simples (cabeçalho = `columns` já
  existente do componente, linhas = os dados no escopo escolhido). O
  navegador decide se manda pra uma impressora instalada de verdade ou
  "Salva como PDF" — nenhum PDF é gerado no servidor, igual o Painel já
  fazia.
- **Excel**: `XLSX.utils.json_to_sheet` + `XLSX.writeFile`, 100%
  client-side (biblioteca `xlsx` já era dependência do frontend, usada
  também em `FinancePainel.js`/`Reports.js`) — usa o valor CRU de cada
  coluna (`record[col.field]`), não `col.render()` (que pode devolver
  um componente React, tipo um Chip de status — não dá pra jogar isso
  numa célula de planilha).

**Escopo "filtrar ou selecionar"**: com alguma linha marcada na seleção
em massa (seção 123), imprime/exporta só essas; sem nada marcado,
`getExportRows()` busca TODAS as páginas que batem no filtro/busca
atual — a tela só tem 20 registros carregados por vez
(`TablePagination`), então pra realmente pegar "tudo que bate o
filtro" (não só a página visível) o componente pagina sozinho por trás
dos panos (`resource.list({..., pageNumber: N})` em loop até
`hasMore` ser `false`), concatenando os resultados antes de montar a
tabela/planilha. Por isso os dois botões ficam `disabled` durante
`exporting` — pode demorar um pouco mais que o normal se o filtro
pegar muitas páginas.

**Permissão nova, separada de `allowImport`** (seção 122): o cliente
descreveu o modelo já existente (Admin libera acesso ao módulo
Financeiro pro usuário comum; dentro disso, cada função específica tem
seu próprio toggle) e confirmou que imprimir/exportar merece um toggle
próprio, não reusar o de importar — faz sentido tecnicamente também,
já que são ações de natureza oposta (uma só lê o que já está na tela,
a outra grava dado novo no banco). `allowExport` segue exatamente o
mesmo padrão de `allowImport` (migration, campo no model, atributo em
`ShowUserService`, `Create`/`UpdateUserService`, `SerializeUser`) —
com uma diferença importante: **não precisou de checagem no
backend/`isAuth.ts`**, porque não existe nenhum endpoint novo pra
proteger (tudo roda no navegador, em cima de dado que a tela já
buscou pra exibir) — só controla se os botões aparecem.

**Arquivos**: `backend/src/models/User.ts`,
`backend/src/database/migrations/20261017230000-add-allowexport-to-users.ts`,
`backend/src/services/UserServices/ShowUserService.ts`,
`backend/src/services/UserServices/CreateUserService.ts`,
`backend/src/services/UserServices/UpdateUserService.ts`,
`backend/src/helpers/SerializeUser.ts`,
`frontend/src/components/UserModal/index.js`,
`frontend/src/components/FinanceRecordList/index.js`. `npx tsc
--noEmit`, `npx eslint` e build de produção limpos.

## 129. Importação de armas não preenchia a procedência, nacional/importada (v2.3.148)

Cliente reportou: importou `armas_atualizadas.xlsx` (relatório de
produtos de loja de armas, mesmo formato de `parseGunStoreReport` —
`Cód. Produto`/`Nome Produto`/`Categoria`/... em posição fixa de
coluna) direto na categoria "Armas nacionais" do menu lateral (seção
117), e os produtos "não sincronizavam" ali.

Investigando a planilha de verdade enviada: o tipo é detectado
corretamente pela coluna "Categoria" (CARABINA/ESPINGARDA/PISTOLA/
REVÓLVER/RIFLE/ARMA → `type: "weapon"`; MUNIÇÃO/ESPOLETA/CARTELA →
`type: "ammunition"`) — isso sempre funcionou. O problema é que esse
relatório **não tem nenhuma coluna de procedência/origem**, e
`parseGunStoreReport` nunca preenchia `FinanceProduct.origin` — então
o produto virava "arma" certinho, mas o filtro "Armas nacionais"
(`type="weapon"` + `origin="national"`, seção 115) nunca batia porque
faltava a segunda metade da condição. Não dava pra simplesmente supor
"tudo nacional" — a planilha real mistura marca nacional (Taurus, CBC)
com importada (ex. duas pistolas Glock no mesmo arquivo).

**Fix**: deduzir `origin` a partir da MARCA já extraída do nome do
produto (`extractBrandFromName`, usa a mesma lista `KNOWN_BRANDS` que
já existia) — `originFromBrand()` novo, com duas listas fixas
(`NATIONAL_BRANDS`/`IMPORTED_BRANDS`, as mesmas marcas de
`KNOWN_BRANDS` já reclassificadas, nenhum fabricante novo adicionado):
Taurus/CBC/Imbel/Imbramun/Rossi/Braztech/Boito → `"national"`;
Glock/Beretta/Sig Sauer/Sig/Colt/Smith & Wesson/Walther/Mossberg/
Winchester/Remington/Savage/Ruger/Heckler & Koch/FN/CZ → `"imported"`.
Só aplicado quando `type === "weapon"` (munição não tem esse filtro na
UI). Produto cujo nome não cita marca nenhuma reconhecida (ex. SKU
"TAU00228" mas nome só "PISTOLA GX4; CAL. .38TPC...", sem a palavra
"TAURUS" escrita) continua sem `origin` — mesma limitação que já
existia pra detecção de marca (comentário original: "NÃO tenta
reconhecer por código de modelo... produto cuja descrição não cita a
marca fica em branco pra preencher manual"), não é algo novo que essa
correção piorou ou tentou resolver.

**Limitação conhecida (pré-existente, não introduzida aqui)**: a
detecção de marca é por substring simples no nome
(`upper.includes(brand)`) — um nome que contenha a sigla "CZ" por
outro motivo (não a marca checa CZ) pode casar por engano. Risco baixo
e já existia antes desta correção (só ganhou mais uma consequência:
agora também define origem, não só a marca mostrada).

Reimportar a mesma planilha corrige os produtos já criados/importados
antes dessa versão — `upsertProductRecord` localiza por SKU e
atualiza (`FinanceProductService.update`), não duplica.

**Arquivo**: `backend/src/services/FinanceService/FinanceImportService.ts`.
`npx tsc --noEmit` limpo (sem mudança de frontend).

## 130. Importação de armas em massa não exige mais número de série (v2.3.149)

Cliente reimportou a planilha depois da seção 129 e "Armas nacionais"
continuava vazio — a correção da procedência era real, mas nem chegava
a ser aplicada, porque a causa de fato era outra, mais funda:
`FinanceProductService`'s `productSchema` (Yup) exige `serialNumber`
pra qualquer produto `type === "weapon"` (`SERIAL_NUMBER_REQUIRED_TYPES`)
— regra confirmada com o cliente desde a implantação original do
cadastro de armas (seção 80, "número de série único por empresa",
seguindo o Estatuto do Desarmamento/decretos de controle). A planilha
de estoque do sistema anterior é um **catálogo por modelo** (uma
linha por SKU/produto, com `Qtde.` em estoque) — não tem, e
estruturalmente não poderia ter, uma coluna de número de série por
unidade individual. Toda linha de arma dessa planilha específica
sempre falhou essa validação, silenciosamente (virava `summary.invalid`,
sem nunca ser criada) — nunca teve relação com a correção da seção
129, que só mexia num campo (`origin`) de produtos que, na prática,
nunca chegavam a existir.

Perguntado ao cliente como resolver (afeta exigência legal, não dava
pra decidir sozinho): confirmou que quer importar mesmo sem número de
série, completando manualmente depois unidade por unidade — mas que o
campo continua **obrigatório** em qualquer outro caminho (muito
importante pra ele).

**Fix, escopado só pro relatório de estoque legado** (não afrouxa a
regra em geral): `productSchema.serialNumber` passou a considerar um
contexto novo do Yup, `$skipSerialRequired` (`.when(["type",
"$skipSerialRequired"], ...)`) — só `true` quando
`FinanceProductService.create`/`update` são chamados com
`{ skipSerialRequired: true }`, um terceiro parâmetro opcional novo
(default `{}`/`false` em todo o resto do sistema). `FinanceImportService
.upsertProductRecord` ganhou um parâmetro `skipSerialRequired` que só
`importProducts` passa como `true` — e só quando `parseGunStoreReport`
reconheceu o arquivo como o relatório de estoque legado
(`!!gunStoreRecords`). A planilha-modelo oficial (`PRODUCT_MAPPINGS`,
que tem coluna própria de número de série via alias) e o cadastro
manual pela tela (`FinanceProductController` chama `create`/`update`
sem esse parâmetro, cai no default `false`) continuam exigindo o
campo exatamente como antes — nada mudou nesses dois caminhos.

Validado com um teste isolado do Yup (5 cenários: arma sem contexto
rejeita; arma com `skipSerialRequired: true` sem número passa; arma
sem nenhum contexto — simulando o cadastro manual — rejeita; munição
nunca exige; arma com `skipSerialRequired: true` E número preenchido
continua passando, confirma que não ignora um valor real quando ele
existe) antes de subir — `node -e` direto com o pacote `yup` já
instalado, sem precisar rodar o servidor inteiro.

**Arquivos**: `backend/src/services/FinanceService/FinanceProductService.ts`,
`backend/src/services/FinanceService/FinanceImportService.ts`. `npx
tsc --noEmit` limpo (sem mudança de frontend).

## 131. Taurus também pelo prefixo do SKU; erros de linha visíveis na importação (v2.3.150)

Depois da seção 130, cliente reimportou a mesma planilha e reportou
"só importou 11 e a planilha tem mais de 20" (e, numa segunda
reimportação, "não duplicou mas ficou 1x11 de 11"). Investigado
simulando `parseGunStoreReport` isoladamente contra o arquivo real: a
planilha tem 51 linhas válidas (15 munição + 36 arma, 0 SKU
duplicado), e TODAS as 36 armas já estavam sendo criadas desde a
seção 130 — não era bug de importação. O filtro "Armas nacionais"
exige `type=weapon AND origin=national`, e `origin` só é preenchido
quando `extractBrandFromName` reconhece uma marca no NOME do produto
(ex. "TAURUS", "CBC") — por desenho (seção 129), não tenta reconhecer
por código de modelo no nome (ex. "G2C" = Taurus, decisão combinada
com o cliente, fora de escopo). Resultado: as 11 armas com "CBC"/
"TAURUS" escrito no nome apareciam em "Armas nacionais"; as outras 25
(ex. "PISTOLA G2C...", "PISTOLA GX4...") foram importadas normalmente,
só que sem procedência — ficam visíveis em "Todos os produtos", não
nos filtros por procedência.

Perguntado ao cliente (AskUserQuestion, já que mexe em como o sistema
classifica marca/procedência — mesmo cuidado de antes): confirmou que
o prefixo "TAU" do próprio código/SKU do produto (ex. "TAU00228") é
usado por uma distribuidora que revende produtos da Taurus pra loja —
sinal confiável de procedência nacional, mesmo quando o nome não cita
"TAURUS" escrito. Sobre outras marcas sem nome reconhecido na planilha
(CBC já é detectado por nome; Pavie/Sambura não estavam na lista):
cliente confirmou que o SKU "é universal, pode deixar" — ou seja, só o
prefixo "TAU" tem esse significado de distribuidora; pra qualquer outra
marca não detectada automaticamente, o cadastro fica sem procedência e
é corrigido manualmente depois, pela tela de editar (fluxo que já
existia) — não pediu detecção automática de Pavie/Sambura.

**Fix 1 — `backend/src/services/FinanceService/FinanceImportService.ts`**:
novo `BRAND_SKU_PREFIXES` (hoje só `{ prefix: "TAU", brand: "TAURUS" }`)
e `brandFromSku(sku)`, que casa o prefixo (case-insensitive) no início
do SKU. Em `parseGunStoreReport`, pra linhas `type === "weapon"`: se
`extractBrandFromName(name)` não achou nada, cai pro `brandFromSku(sku)`
como sinal extra — só então passa por `originFromBrand` normalmente
(mesma função da seção 129, sem mudança). Não mexe em munição nem em
produto comum, e não muda o reconhecimento por nome já existente (nome
continua tendo prioridade sobre o SKU).

**Fix 2 — `frontend/src/components/FinanceRecordList/index.js`**: o
backend já coletava `summary.errors` (motivo de cada linha
inválida/ignorada) desde a Fase 6 original, mas a tela só mostrava os
totais (criados/atualizados/inválidos) — `SaleList.js` já exibia esses
erros na importação de Vendas, só `FinanceRecordList.js` não.
`handleImportFile` agora também mostra até 5 desses avisos via toast,
igual ao padrão do SaleList — ajuda a diagnosticar linha por linha da
próxima vez, sem precisar simular a planilha à parte.

Reimportar a mesma planilha (`armas_atualizadas.xlsx`) atualiza por
SKU os produtos já existentes, preenchendo marca/procedência nos que
tinham código "TAU..." sem o nome "TAURUS".

**Arquivos**: `backend/src/services/FinanceService/FinanceImportService.ts`
(`npx tsc --noEmit` limpo), `frontend/src/components/FinanceRecordList/index.js`
(lint e build limpos).

## 132. Imprimir/gerar PDF de um registro no formulário de editar (v2.3.151)

Pedido do cliente: além de imprimir/exportar a LISTA (filtrada ou
selecionada, seção 128), também poder imprimir/gerar PDF de UM
registro só, direto na tela de editar — "edita um cliente e tenha
opção de imprimir ou gerar pdf, a mesma coisa para fornecedor e
produto".

**Implementação**: `FinanceRecordModal.js` (modal de editar/criar
compartilhado por Clientes, Fornecedores, Produtos, Contas a Pagar e
Contas a Receber — por isso o botão aparece nos 5, não só nos 3
citados) ganhou um botão "Imprimir / PDF" no rodapé do formulário,
reaproveitando a mesma técnica já usada na lista (`window.print()` +
`@media print`, sem gerar PDF no servidor) — mesma permissão
**"Imprimir / Exportar listas"** da v2.3.147 (`canExport`, repassada
pelo `FinanceRecordList.js` pai; Admin/Master sempre libera). Só
aparece editando um registro já salvo (`record?.id`); num cadastro
novo ainda não tem nada no banco pra imprimir.

A área de impressão é montada a partir de um snapshot dos valores
ATUAIS do formulário no momento do clique (`values` do Formik, não
precisa resalvar antes) — mesmo padrão de `printRows` em
`FinanceRecordList.js`: `setTimeout` de 150ms antes do
`window.print()` pra dar tempo do React desenhar a tabela escondida.
Fica fora do `<Dialog>` (irmão dele no JSX, não filho) de propósito —
a regra CSS `@media print` escondendo `body *` e só liberando o id
`#finance-record-modal-print-area` funciona pela especificidade do
seletor (ID bate qualquer combinação `body *`), mas manter fora do
Dialog evita depender de como o MUI porta o conteúdo do modal pro
`document.body`.

Cada campo do formulário vira uma linha "Rótulo: valor" na impressão;
campos tipo `select`/`asyncSelect` mostram o rótulo da opção (ou o
nome do registro associado), não o valor cru salvo no banco; campo
`switch` mostra "Sim"/"Não"; `sectionTitle` e campos escondidos por
`visibleWhen` não entram.

**Arquivos**: `frontend/src/components/FinanceRecordModal/index.js`,
`frontend/src/components/FinanceRecordList/index.js` (só repassa
`canExport` pro modal). Lint e build (`craco build`) limpos.

## 133. Taurus também pelo código do modelo — fecha a lacuna da planilha real (v2.3.152)

Depois da v2.3.150 (prefixo "TAU" do SKU), cliente reimportou e reportou
"aumentou de 11 para 13 itens e são 25" — ou seja, o prefixo do SKU só
fechou 2 dos ~14 que faltavam. Investigado rodando a mesma lógica do
sistema (nome + prefixo do SKU) contra a planilha real
(`armas_atualizadas.xlsx`, 36 linhas de arma):

- 13 com procedência (nome "TAURUS"/"CBC", ou SKU "TAU...")
- 3 com procedência (marca importada reconhecida no nome)
- **20 sem procedência nenhuma** — todas Taurus pelo nome, mas só com
  código de modelo (G2C, G3, G3C, GX2, GX4SC, TH380/TH380C, TX22, RT66/
  RT66C, RT889, 59S/PT59S), sem a palavra "TAURUS" e com SKU numérico
  próprio da planilha legada (ex. "10034336", "75008418") — não bate
  com o prefixo "TAU".

Isso esbarra direto na decisão original do módulo (seção/comentário em
`extractBrandFromName`): "NÃO tenta reconhecer por código de modelo —
fora do escopo combinado com o cliente". Perguntado de novo
(AskUserQuestion, pelo mesmo motivo de cautela das seções 130/131 —
mexe em como o sistema classifica procedência): cliente confirmou que
quer reverter isso **só pra essa lista fechada de 10 códigos**,
realmente vistos na planilha dele ("Sim, reconhecer esses modelos
Taurus"), e depois, perguntado se seguia pra frente mesmo com o que
sobrasse sem bater: "adiciona tudo, o que não der eu preencho manual,
vou fazer uma revisão".

**Fix — `backend/src/services/FinanceService/FinanceImportService.ts`**:
novo `WEAPON_MODEL_CODES` (`["G2C", "G3C", "G3", "GX2", "GX4SC", "TH380",
"TX22", "RT66", "RT889", "59S"]`, substring simples no nome, mesmo
estilo de `extractBrandFromName`) e `brandFromModelCode(name)`. Em
`parseGunStoreReport`, pra linhas `type === "weapon"`: a cadeia de
sinais agora é nome → prefixo do SKU → código do modelo (só tenta o
próximo se o anterior não achou nada) — `brand = extractBrandFromName(name)
|| (type === "weapon" && (brandFromSku(sku) || brandFromModelCode(name)))`.
Simulado de novo contra a planilha real depois do fix: **33 nacional + 3
importada = todas as 36 armas com procedência**, nenhuma mais em branco.

⚠️ **Risco documentado, não resolvido**: o código "G3" sozinho colide
com o fuzil G3 da Heckler & Koch (arma importada, uso militar/
paramilitar) — um produto chamado "FUZIL G3" entraria errado como
Taurus/nacional. Aceito aqui porque o catálogo desse cliente é loja de
tiro esportivo civil (pistolas/revólveres/carabinas Taurus e CBC,
munição e acessórios), sem fuzil de uso militar no estoque. Se isso
mudar no futuro (cliente passar a vender fuzil importado, G3 da HK
incluso), essa lista precisa ser revisada — não é um padrão genérico de
reconhecimento, é uma lista fechada pra essa planilha/cliente específico.

Reimportar a mesma planilha atualiza por SKU os produtos existentes.

**Arquivos**: `backend/src/services/FinanceService/FinanceImportService.ts`.
`npx tsc --noEmit` limpo. Validado simulando a lógica contra a planilha
real (`armas_atualizadas.xlsx`) com um script Python isolado, antes de
subir — mesma prática já usada nas seções 129/130/131, pra confirmar
contra dado real em vez de só confiar no código.

## 134. Cobrança Pix/boleto via Mercado Pago em Contas a Receber — Fase 1 (v2.3.153)

Pedido do cliente: receber pagamento (Pix/boleto) direto no AtendeFlow.
Antes de implementar, uma rodada de confusão real precisa ficar
registrada, porque quase virou um problema de verdade: o cliente colou
nesta conversa um texto gerado por OUTRA IA, formatado como "contexto de
sistema atual do projeto" (arquitetura Python/`asyncpg` inexistente,
tabela `leads_atendeflow` inexistente, gateway "BunkerPay" e nó
"DFlow"/`node-faturamento-deflow"). Investigado antes de tocar em
qualquer código: `bunkerpay.io` não resolve nem no DNS (`ENOTFOUND`),
nenhum resultado de busca pra confirmar a empresa — sinal de conteúdo
fabricado, não de integração real. O cliente confirmou depois que era
mesmo um prompt que ele tinha feito com outra IA sem acesso ao
repositório de verdade (ela alucinou os detalhes). Nada desse texto foi
usado — serve de lição registrada: **nunca tratar uma descrição de
"estado atual do projeto" colada no chat como verdade sem conferir
contra o repositório real**, especialmente quando envolve credencial/
gateway de pagamento.

Depois de recomeçar do zero com o cliente, confirmado: **Mercado Pago**
(gateway real, documentação pública, conta já existente do cliente) pra
gerar cobrança **Pix e boleto** em **Contas a Receber**, com confirmação
automática via webhook. Asaas (outro gateway real que o cliente também
já tem) fica pra uma Fase 2, mesma estrutura — implementar os dois ao
mesmo tempo arriscava os dois com bug junto; melhor validar um
end-to-end primeiro.

⚠️ **Mesma ressalva já registrada pra Focus NFe** (seção 6.2): este
adapter foi implementado a partir da documentação pública do Mercado
Pago (Checkout API — `POST /v1/payments`, `payment_method_id: "pix"`/
`"bolbradesco"`), mas **nunca testado ponta a ponta contra uma chave de
teste real** — este ambiente de desenvolvimento não tem saída de rede
pra `api.mercadopago.com` (proxy do sandbox bloqueia, confirmado via
`curl`/`WebFetch`, `getaddrinfo ENOTFOUND`/403). Antes de confiar em
produção: gerar uma cobrança de teste de verdade com um Access Token
"TEST-..." e comparar a resposta real com o parsing em
`parsePaymentResponse` (MercadoPagoGatewayService.ts), ajustando se o
formato vier diferente do esperado — mesmo processo que FocusNFeService
já documentou pra quando a Focus NFe foi integrada.

**Modelo novo — `FinancePaymentConfig`** (`backend/src/models/
FinancePaymentConfig.ts`, migration `20261019060000-create-finance-
payment-configs.ts`): um registro por empresa, separado de `FiscalConfig`
de propósito — são credenciais de contratos DIFERENTES (FiscalConfig é
o gateway de EMISSÃO de nota fiscal, Focus NFe; isso aqui é o gateway de
COBRANÇA/recebimento). Campos: `mercadoPagoAccessTokenSandbox`/
`mercadoPagoAccessTokenProduction` (mesmo padrão Homologação/Produção já
usado em Configuração Fiscal — Produção tem prioridade quando habilitada,
`FinancePaymentConfigService.isProductionActive`/
`getActiveMercadoPagoToken`), `mercadoPagoWebhookSecret` (valida a
assinatura do webhook), `pixExpirationMinutes` (default 60).

**`FinanceReceivable` ganhou campos novos** (migration `20261019060100-
add-payment-fields-to-finance-receivables.ts`): `paymentProvider`,
`paymentExternalId`, `paymentStatus` (status cru do gateway, só
informativo — quem decide se a conta está "recebida" de verdade continua
sendo o `status` já existente, atualizado pelo webhook), `pixQrCode`/
`pixQrCodeBase64`, `pixExpiresAt`, `boletoUrl`. Guardam só a ÚLTIMA
cobrança gerada (gerar de novo sobrescreve, sem histórico de cobranças
múltiplas por enquanto). **Intocados**: `asaasPaymentId`/
`splitIvaRetido`/`netReceivedViaAsaas` (já existiam, reservados só pro
Split Payment do IVA da Reforma 2027 — propósito diferente, confirmado
nesta mesma investigação que NÃO é a mesma coisa que "gerar cobrança pro
cliente pagar").

**`MercadoPagoGatewayService.ts`** (adapter): `createPixCharge`/
`createBoletoCharge` (`POST /v1/payments`, com `X-Idempotency-Key` novo a
cada chamada — evita cobrança duplicada em caso de retry de rede),
`getPayment` (`GET /v1/payments/{id}`, usado pelo webhook pra buscar o
status de VERDADE, nunca confiar no corpo da notificação),
`verifyWebhookSignature` (HMAC-SHA256 sobre o manifest `id:{dataId};
request-id:{requestId};ts:{ts};`, formato documentado do Mercado Pago —
validado com 6 casos de teste isolados via `node -e`, incluindo
assinatura adulterada e secret errado, antes de subir). E-mail do
pagador: Mercado Pago exige, cadastro de cliente do Financeiro não
obriga — usa um e-mail sintético (`cliente{id}@sememail.atendeflow`)
quando o cliente não tem e-mail cadastrado.

**`FinanceReceivablePaymentService.ts`** (orquestração):
`generatePixCharge`/`generateBoletoCharge` (valida cliente vinculado e
valor > 0 antes de chamar o gateway) e `handleMercadoPagoWebhook` — essa
última NUNCA atualiza o status só com o que veio no corpo da notificação:
busca o `FinanceReceivable` pelo `paymentExternalId` já gravado (não
pelo id da notificação sozinho — podia ser de outra cobrança qualquer da
mesma conta Mercado Pago), rebusca o status real via `getPayment`, e só
marca `status: "received"` quando o Mercado Pago confirma `"approved"`.

**Webhook** (`PaymentWebhookController.mercadoPago`,
`/webhook/mercadopago/:companyId` — uma URL por empresa, mesmo padrão já
usado por `MetaWebhookController`): responde 200 rápido e processa
depois (evita o Mercado Pago reenviar a notificação por timeout), valida
a assinatura antes de processar qualquer coisa, loga e para
silenciosamente se a assinatura não bater ou a empresa não tiver gateway
configurado.

**Frontend**: nova tela **Configuração de Pagamento**
(`FinancePaymentConfigPanel`, link no menu lateral Financeiro, mesmo
padrão get/upsert da Configuração Fiscal) com os campos de credencial,
a URL do webhook já montada (só copiar pro painel do Mercado Pago) e o
campo de assinatura secreta. Editando uma Conta a Receber
(`FinanceRecordModal`, prop nova `enablePayments` — só repassada pela
aba de Contas a Receber em `Financeiro/index.js`, os outros cadastros
não ganham esse botão): botões "Gerar Pix"/"Gerar boleto" no rodapé do
formulário, mostrando o QR Code (imagem base64) + código copia-e-cola
com botão de copiar, ou o link do boleto — usa um snapshot do registro
atualizado (`paymentResult`) que sobrescreve o que já veio salvo, sem
precisar fechar/reabrir o modal pra ver o resultado novo.

**Validação feita antes de subir**: `npx tsc --noEmit` limpo; as duas
migrations testadas de verdade contra um Postgres local descartável
(`CREATE TABLE`/`ALTER TABLE ADD COLUMN IF NOT EXISTS`, schema conferido
com `\d`); `verifyWebhookSignature` testado isoladamente (6 casos via
`node -e`, incluindo assinatura válida, dataId adulterado, secret
errado, header ausente/malformado e o caso sem secret configurado —
todos passaram); lint e `craco build` do frontend limpos.

**Arquivos**: `backend/src/database/migrations/20261019060000-create-
finance-payment-configs.ts`, `20261019060100-add-payment-fields-to-
finance-receivables.ts`, `backend/src/models/FinancePaymentConfig.ts`,
`backend/src/models/FinanceReceivable.ts`, `backend/src/database/
index.ts`, `backend/src/services/FinanceService/
FinancePaymentConfigService.ts`, `MercadoPagoGatewayService.ts`,
`FinanceReceivablePaymentService.ts`, `backend/src/controllers/
FinancePaymentConfigController.ts`, `FinanceReceivableController.ts`,
`PaymentWebhookController.ts`, `backend/src/routes/financeRoutes.ts`,
`webHookRoutes.ts`, `frontend/src/components/FinancePaymentConfigPanel/
index.js` (novo), `FinanceRecordModal/index.js`, `FinanceRecordList/
index.js`, `frontend/src/hooks/useFinance/index.js`,
`frontend/src/pages/Financeiro/index.js`, `frontend/src/layout/
MainListItems.js`, `frontend/src/translate/languages/pt.js`.

## 135. Asaas (Fase 2) + permissão de plano pro módulo de Pagamento (v2.3.154)

Dois pedidos do cliente na sequência, logo depois da Fase 1 (Mercado
Pago, seção 134) subir:

**1) Asaas como segundo gateway** — ele confirmou que já tem conta tanto
no Mercado Pago quanto no Asaas, e quer os dois disponíveis. Implementado
com a mesma estrutura da Fase 1, reaproveitando os campos genéricos já
criados em `FinanceReceivable` (`paymentProvider`, `paymentExternalId`,
`pixQrCode`/`pixQrCodeBase64`, `boletoUrl`, `paymentStatus` — nenhum
campo novo precisou ser criado nessa tabela). `FinancePaymentConfig`
ganhou um campo `provider` (`"mercadopago"`/`"asaas"`, mesmo padrão de
`FiscalConfig.gatewayProvider`) que decide qual gateway gera a PRÓXIMA
cobrança — trocar não afeta cobranças já geradas (cada uma guarda o
provider usado na hora, tanto pra exibir o resultado quanto pro webhook
de cada gateway só processar o que é dele).

Diferença importante do Asaas em relação ao Mercado Pago: ele exige um
**cadastro de cliente no próprio sistema deles** antes de gerar qualquer
cobrança (não dá pra mandar os dados do pagador direto no payload do
pagamento, como no Mercado Pago). `AsaasGatewayService.ensureAsaasCustomer`
busca por CPF/CNPJ antes de criar, pra não duplicar cliente no Asaas a
cada cobrança gerada pro mesmo `FinanceCustomer` local. O QR Code do Pix
também vem de uma chamada separada (`GET /payments/{id}/pixQrCode`), não
na criação do pagamento. Webhook do Asaas não usa HMAC como o Mercado
Pago — valida por um token fixo (`asaasWebhookToken`) reenviado no header
`asaas-access-token`, configurado igual nos dois lados (painel deles +
Configuração de Pagamento aqui); mesmo princípio de segurança do Mercado
Pago continua valendo: `handleAsaasWebhook` NUNCA confia no
`payment.status` do corpo da notificação, sempre rebusca na API deles
antes de marcar como recebido.

⚠️ Mesma ressalva da Fase 1: implementado a partir da documentação
pública do Asaas, nunca testado ponta a ponta contra uma chave de teste
real (mesma limitação de rede deste ambiente de desenvolvimento).

**2) Permissão de plano pro módulo de Pagamento** — cliente explicou o
modelo de negócio completo: o sistema básico é só multiatendimento por
WhatsApp (Baileys); todo o resto (Assistente IA, módulo API, Financeiro
básico, Financeiro com cobrança/split de pagamento, RH, Flowbuilder,
Chat Interno, Campanhas, módulo Fiscal...) é add-on que o Master libera
por contrato, conforme o cliente paga por mais. A maioria desses módulos
já seguia esse padrão (`Plan.useFinancial`, `useFiscal`, `useHR`,
`useOpenAi`, `useCampaigns`, `useInternalChat` — Master habilita por
plano, confirmado nesta mesma investigação que já estavam cobertos); só
faltava o módulo de Pagamento que acabou de ser construído (Fases 1/2
acima) ainda não ter o próprio flag — ficaria liberado pra qualquer
empresa com Financeiro ativo, sem o Master poder vender separado.

**Fix, mesmo padrão exato de `useFiscal`/`EnsureFiscalAccess`**:
`Plan.usePayment` (migration `20261019080000-add-usepayment-flag-to-
plans.ts`, default `false`) + `EnsurePaymentAccess.ts` (SEMPRE exige
`useFinancial` também ativo, já que a cobrança nasce de uma Conta a
Receber) + `FinancePaymentAccessController`/rota `GET /finance/payment-
access` (mesmo formato `{ planHasModule, hasAccess }` que o Financeiro/
Fiscal já usam) + gate aplicado em `FinancePaymentConfigController`
(trocado de `EnsureFinancialAccess` pra `EnsurePaymentAccess`) e nas duas
ações novas de `FinanceReceivableController` (`generatePix`/
`generateBoleto`, que agora checam os dois: acesso ao Financeiro E ao
Pagamento). Frontend: `Financeiro/index.js` busca `paymentAccess` junto
com `fiscalAccess` (mesmo efeito, mesma hora), deriva `showPaymentTab`, e
usa isso pra (a) mostrar uma tela de "não disponível" na aba Configuração
de Pagamento, igual já acontecia com Fiscal, e (b) só passar
`enablePayments` pro `FinanceRecordList` de Contas a Receber quando
`showPaymentTab` for verdadeiro (escondendo os botões "Gerar Pix"/"Gerar
boleto" de quem não tem o add-on). `PlansManager.js` (tela do Master pra
editar planos) ganhou o toggle "Pagamento — Pix/boleto (add-on)" nas duas
listas que já existiam (resumo em chips + formulário), mesmo padrão
declarativo dos outros add-ons — sem precisar duplicar JSX.

**Pendente, fora do escopo desse pedido**: o cliente também pediu pra
conferir Flowbuilder, Chat Interno, Campanha e módulo Fiscal — Chat
Interno/Campanha/Fiscal já tinham permissão de plano (confirmado acima);
só o **Flowbuilder não tem trava nenhuma hoje** (menu aparece pra
qualquer empresa). Cliente pediu explicitamente pra não mexer em nada
que seja "obrigatório" pro sistema rodar (ex.: se uma automação de fluxo
já configurada depender do motor de execução do Flowbuilder rodando por
baixo, gatear o módulo não pode quebrar isso) — investigação de como o
Flowbuilder se encaixa no fluxo de mensagem (execução de fluxo já ativo
vs. só a tela de criar/editar) em andamento antes de implementar, pra
não arriscar derrubar automação de um cliente já em produção.

**Arquivos**: `backend/src/database/migrations/20261019070000-add-asaas-
fields-to-finance-payment-configs.ts`, `20261019080000-add-usepayment-
flag-to-plans.ts`, `backend/src/models/FinancePaymentConfig.ts`,
`Plan.ts`, `backend/src/services/FinanceService/AsaasGatewayService.ts`
(novo), `FinancePaymentConfigService.ts`, `FinanceReceivablePaymentService.ts`,
`EnsurePaymentAccess.ts` (novo), `backend/src/controllers/
FinancePaymentAccessController.ts` (novo), `FinancePaymentConfigController.ts`,
`FinanceReceivableController.ts`, `PaymentWebhookController.ts`,
`backend/src/routes/financeRoutes.ts`, `webHookRoutes.ts`,
`backend/src/services/PlanService/CreatePlanService.ts`,
`UpdatePlanService.ts`, `frontend/src/components/FinancePaymentConfigPanel/
index.js`, `PlansManager/index.js`, `frontend/src/hooks/useFinance/index.js`,
`frontend/src/pages/Financeiro/index.js`, `frontend/src/translate/
languages/pt.js`. `npx tsc --noEmit` limpo; as duas migrations novas
testadas contra um Postgres local descartável; lint e `craco build` do
frontend limpos.

## 136. Configuração de Pagamento: Mercado Pago e Asaas lado a lado (v2.3.155)

Ajuste de layout pedido pelo cliente depois de ver a tela no ar: "deixa
os dois painéis um do lado do outro e centraliza as palavras nos campos
para não ficar descentralizadas". Antes, Mercado Pago e Asaas ficavam
cada um ocupando a largura toda da tela, um embaixo do outro (cada
seção com seus próprios cartões Homologação/Produção lado a lado dentro
dela) — virava uma tela bem comprida de rolar.

**Fix**: `FinancePaymentConfigPanel.js` reestruturado em duas colunas
(`Grid item md={6}` cada) — Mercado Pago à esquerda, Asaas à direita,
cada coluna com os próprios cartões Homologação/Produção empilhados
dentro dela (`maxWidth` do painel aumentado de 900 pra 1200px, senão as
duas colunas ficavam espremidas). Texto digitado nos campos de
credencial e nas URLs de webhook (somente leitura) agora centralizado
(`inputProps: { style: { textAlign: "center" } }`, via um objeto
`centeredFieldProps` reaproveitado em cada campo pra não repetir) — só o
VALOR digitado, os rótulos (`label`) continuam no lugar padrão do
Material-UI (flutuando saindo da borda), que é como o próprio componente
espera.

**Arquivos**: `frontend/src/components/FinancePaymentConfigPanel/index.js`.
Lint e `craco build` limpos.
