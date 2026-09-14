# Manual Técnico — AtendeFlow

**Versão do documento:** 2.3.15
**Etapa:** 4 — Master com acesso completo a todas as funcionalidades (isolado por empresa), plano obrigatório ao cadastrar empresa, módulo Financeiro completo (Fase 1: cadastros), assinatura movida para Configurações
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
  todas as empresas na mesma tela de login) continua **exclusiva do Master**. Ver
  limitação conhecida no Changelog: a exibição da logo no menu lateral/login hoje ainda
  lê de um endpoint fixo na empresa 1, não por empresa autenticada.

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

### Fase 2 — Financeiro operacional
- Gestão de custos fixos e variáveis (contas a pagar, categorias de despesa)
- Contas a receber ligadas aos clientes cadastrados
- Painel com gráficos (usar a mesma linguagem visual dos dashboards já existentes —
  ver skill de `dataviz` deste projeto ao desenhar os gráficos)
- Relatórios: financeiro (fluxo de caixa, DRE simplificado), estoque (se produtos
  tiverem controle de estoque), desempenho de funcionários, fornecedores

### Fase 3 — Módulo fiscal (Nota Fiscal Eletrônica / SEFAZ / Receita Federal)
Esta é a fase de maior risco técnico e regulatório do roadmap — envolve comunicação
com webservices da SEFAZ de cada estado (ou SEFAZ Virtual, pra estados sem
infraestrutura própria), certificado digital (A1 ou A3) por empresa, assinatura e
validação de XML conforme o layout vigente da NF-e/NFC-e, contingência, e
acompanhamento da **Reforma Tributária** (transição CBS/IBS iniciada em 2026,
substituindo PIS/COFINS/ICMS/ISS ao longo dos próximos anos). Antes de começar a
codificar esta fase, é preciso decidir com o cliente:
- **Emissão direta na SEFAZ** (mais barato a longo prazo, mas exige implementar e
  manter toda a integração — assinatura de XML, contingência, homologação em cada
  estado) **vs. usar um gateway de NF-e como serviço** (Focus NFe, NFe.io, PlugNotas,
  eNotas etc. — cobram por nota emitida, mas absorvem toda a complexidade de SEFAZ,
  atualizações de layout e da Reforma Tributária). Pra um SaaS multi-empresa como o
  AtendeFlow, um gateway tende a ser o caminho mais realista pra tocar isso num prazo
  razoável.
- Qual(is) documento(s) fiscal(is) emitir primeiro: NF-e (produto), NFS-e (serviço,
  que varia por prefeitura) e/ou NFC-e (consumidor final)?
- Seleção do regime tributário por empresa (Configurações da empresa): MEI, EI, SLU,
  LTDA, S/A, e enquadramento por porte (MEI, ME até R$ 360 mil/ano, EPP até R$ 4,8
  milhões/ano) — isso afeta qual regime de apuração de imposto e qual documento fiscal
  a empresa pode/deve emitir.

### Fase 4 — Módulo contábil
Cálculo e geração de guias de pagamento de impostos conforme o regime tributário
escolhido na Fase 3 (DAS do Simples Nacional para MEI/ME/EPP, ou apuração normal para
LTDA/S/A maiores), já considerando a transição da Reforma Tributária. Nível de
complexidade regulatória alto — normalmente é feito integrando com um ERP/contador
terceirizado (ex. via SPED) em vez de implementar o cálculo tributário do zero;
decisão de abordagem também deve ser validada com o cliente antes de começar.

### Fase 5 — Módulo de RH / recrutamento
Cadastro de vagas, recebimento/triagem de candidaturas, e seleção de funcionários que
podem, ao final, ser efetivados como usuários do sistema daquela empresa (reaproveitando
o cadastro de `User` já existente para a etapa de efetivação).

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
