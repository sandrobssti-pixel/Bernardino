# Changelog — AtendeFlow

Todas as etapas de desenvolvimento do projeto são registradas aqui, na ordem em que foram entregues.
Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [2.3.9] — Marca fixa "Confianza Technologies" na tela de login — 2026-09-14

### Corrigido
- A logo exibida na tela de login (topo do formulário) não aparecia porque
  dependia de configuração via banco de dados/upload (`loginLogo` em
  `Setting`), que nunca chegou a ser aplicada corretamente no ambiente do
  cliente. Como essa marca representa a **dona/fornecedora do sistema**
  (Confianza Technologies) e não uma empresa-cliente, ela deixou de ser
  configurável e passou a ser um asset fixo embutido no build do frontend
  (`frontend/src/assets/confianza-logo-dark.png`, importado diretamente em
  `frontend/src/pages/Login/index.js`) — sempre aparece, em qualquer
  instalação, sem depender de Settings, upload ou SQL.
- Texto abaixo do botão "Entrar" também fixado como "Confianza Technologies"
  (antes usava o `appName` configurável, o que misturava marca do sistema
  com identidade de cada empresa-cliente).

### Alterado
- `frontend/src/components/Settings/Whitelabel.js`: removido o campo de
  upload "Logo do login" da seção "Login / capa" (exclusiva do Master),
  já que essa logo não é mais configurável. A capa de fundo e o link de
  WhatsApp do login continuam configuráveis normalmente.

## [2.3.8] — Nome da empresa ao lado da logo no menu lateral — 2026-09-14

### Adicionado
- O nome da empresa (`appName`) agora aparece **ao lado da logo**, no canto superior
  esquerdo do menu lateral (acima de "Gerência"), quando o menu está expandido
  (`frontend/src/layout/index.js`) — antes só a logo aparecia ali, sem texto.

## [2.3.7] — Correções: versão exibida travada + nome ao lado do logotipo — 2026-09-14

### Corrigido
- **Número de versão exibido no sistema estava travado em "15.0.10"**: vinha de um
  arquivo separado (`backend/src/utils/version.ts`), completamente desconectado do
  versionamento real do projeto (`CHANGELOG.md`) — nunca tinha sido atualizado nas
  etapas anteriores. Corrigido para `2.3.7` (junto com `version`/`versionSystem` nos
  `package.json` do backend/frontend, por consistência). **Esse arquivo precisa ser
  atualizado manualmente a cada nova versão daqui pra frente.**

### Adicionado
- **Campo "Nome da empresa" ao lado do logotipo claro**, dentro de Configurações →
  Opções → White Label → Logotipos — antes o nome só aparecia lá em cima, na seção
  "Identidade", separado do logotipo. Agora aparece junto, ao lado da pré-visualização/
  upload do "Logotipo claro" — mesmo campo (`appName`), só reposicionado para deixar
  claro que nome e logo formam a identidade visual da empresa.

## [2.3.6] — Permissões da identidade da empresa: qualquer Admin, não só Master — 2026-09-14

### Alterado
- **`Whitelabel` dividido em duas seções com permissões diferentes**, a pedido do
  usuário: "Identidade" + "Logotipos" (nome, cores, logomarcas, favicon, ícones) agora
  aparecem para **qualquer Admin** (`profile === "admin"`, inclui Master) — cada empresa
  cuida da própria logomarca. Já "Login / capa" (logo/capa/WhatsApp da tela de login,
  compartilhada por todas as empresas na mesma URL) continua **exclusiva do Master**
  (`super === true`), já que afeta a entrada compartilhada de todos os tenants.
- Testado criando um usuário Admin comum (`super: false`) e confirmando visualmente: vê
  "Identidade"/"Logotipos", não vê "Login / capa", não vê "Cadastro de Empresas" nem as
  abas "Empresas"/"Planos"/"Ajuda" (essas continuam exclusivas do Master), e não vê
  "Painel SaaS" no menu lateral (já era assim antes).

### Limitação conhecida (não corrigida nesta versão)
- A logomarca/nome exibidos no **menu lateral e na tela de login** (`frontend/src/App.js`)
  são lidos de um endpoint público fixo na empresa 1 (`GET /public-settings/:key`), não
  por empresa autenticada — então, hoje, o upload de uma logo por uma empresa diferente
  da 1 fica salvo corretamente (o endpoint de upload já usa a empresa de quem está
  logado), mas **não aparece visualmente** pra essa empresa (continua mostrando a
  logo da empresa 1). Corrigir isso de verdade exige buscar a identidade visual via um
  endpoint autenticado (`GET /settings`, que já é filtrado pela empresa de quem está
  logado) depois do login, em vez do endpoint público fixo. Registrado aqui para decidir
  se vale a pena fazer como próxima etapa.

## [2.3.5] — White Label completo movido para Configurações — 2026-09-14

### Alterado
- A v2.3.4 tinha colocado só um atalho simplificado (nome + 1 logo) em Configurações.
  Agora o **componente `Whitelabel` completo** (identidade, cores clara/escura,
  logotipos claro/escuro/favicon/ícones PWA, e logo/capa/WhatsApp da tela de login) foi
  movido de vez para a aba "Opções" de Configurações — reaproveitando os mesmos
  endpoints (`/settings-whitelabel/logo`, `/global-config/upload`,
  `/global-config/upload/remove`) e o mesmo `ColorModeContext`, sem duplicar lógica.
- **Removida a aba "White Label" do Painel SaaS** (`GlobalConfig`) — o Painel SaaS fica
  reservado para o que faz sentido nele: gestão de empresas/licenças e (próxima etapa)
  cobrança bancária e mensagens de vencimento de fatura para clientes. Código órfão
  removido junto (`resolveImageUrl`, `handleBrandingUpload`, `handleBrandingRemove`,
  estados `uploading`/`removing`/`whiteLabelSettings`, import do `Whitelabel`).

## [2.3.4] — Identidade da empresa movida para Configurações + limpeza do login — 2026-09-14

### Adicionado
- **Editor de identidade da empresa dentro de Configurações** (aba "Opções"): nome e
  logomarca agora são editáveis diretamente ali, sem precisar entrar no Painel SaaS —
  reaproveita o mesmo endpoint de upload (`/settings-whitelabel/logo`) e o mesmo contexto
  de tema (`ColorModeContext`) já usados pelo editor antigo, então o resultado aparece
  imediatamente no menu lateral. A opção equivalente no Painel SaaS ("White Label")
  continua existindo (mesma fonte de dados), mas o caminho natural agora é Configurações.
- **Logomarca da tela de login**: quando não há uma logo específica configurada para o
  login (recurso separado, dentro do Painel SaaS), o backend agora usa como alternativa a
  logomarca geral da empresa (a mesma do menu lateral) em vez do logo genérico padrão —
  então uma única logo enviada em Configurações já aparece nos dois lugares.

### Removido
- Removidas as opções "Criar conta gratuita" e "Esqueceu a senha?" da tela de login, a
  pedido do usuário.

### Confirmado (sem mudança de código)
- A logomarca da empresa **já aparecia** no topo do menu lateral, acima do item
  "Gerência" (`frontend/src/layout/index.js`) — só não estava visível com o menu
  recolhido (comportamento esperado). Confirmado rodando a aplicação.

## [2.3.3] — Correção crítica: coluna "maxUseBotQueues" ausente + atalho de identidade — 2026-09-13

### Corrigido
- **Bug crítico pré-existente**: o modelo `Whatsapp` declarava o campo `maxUseBotQueues`
  (`@Default(3)`) desde a base herdada, mas **nenhuma migration criava essa coluna** no
  banco. Qualquer consulta que lê todos os campos de uma conexão — `ListWhatsAppsService`
  (usado pela tela de **Conexões** e por outras telas que listam WhatsApps), e também o
  boot do servidor (raiz do aviso "Erro no startup do servidor" já documentado) — quebrava
  com `column Whatsapp.maxUseBotQueues does not exist`. Descoberto ao rodar a aplicação de
  verdade e testar a tela de Conexões. Adicionada a migration
  `20260827120000-add-maxUseBotQueues-to-whatsapps.ts` (mesmo padrão de default do
  modelo: inteiro, valor 3). **Quem já tiver o sistema rodando precisa só puxar a
  atualização e rodar `npm run build:backend && npm run db:migrate`** — não afeta dados
  existentes.
- Investigado a pedido do usuário se faltavam as opções de **cadastrar número/gerar QR
  Code (Baileys)**, **editar/excluir conexão** e **editar/excluir empresa** —
  confirmado rodando a aplicação de verdade que **todas já existem e funcionam**:
  - Conexões → "+ Nova Conexão" → "WhatsApp (QR Code)" (Baileys) já lista essa opção,
    com formulário completo e QR Code funcionando (o bug acima podia atrapalhar o
    carregamento da lista antes de existir uma conexão — corrigido agora).
  - Cada conexão na lista já tem botões de editar, excluir e carregar/atualizar QR Code.
  - Configurações → aba "Empresas" (visível para Master) já lista empresas com editar e
    excluir — mesma tela usada pelo Painel SaaS.

### Adicionado
- **Atalho "Identidade da empresa" em Configurações**: a edição de nome e logomarca da
  empresa (usada no menu e na tela de login) só existia dentro do Painel SaaS → aba
  "White Label", sem nenhum link a partir da tela normal de Configurações. Adicionado um
  card no topo da aba "Opções" (visível para Master) com um botão "Editar" que leva
  direto para lá — evita duplicar a lógica de upload já existente (bastante acoplada),
  só resolve a falta de um caminho visível a partir de Configurações.
- A tela de **Login já carrega e exibe a logomarca configurada** (`branding.loginLogo`,
  via `/global-config/public-branding`) — confirmado lendo o código; não precisou de
  nenhuma mudança.

### Lição registrada
- `frontend/src/pages/Settings/index.js` é um **arquivo órfão**: a rota `/settings` na
  verdade usa `frontend/src/pages/SettingsCustom/index.js` (que já tem abas Opções/
  Empresas/Planos/Ajuda). Antes de editar uma tela deste projeto, confirmar em
  `frontend/src/routes/index.js` qual componente a rota realmente usa — mesma lição já
  registrada para CSS solto (v2.1.2), agora vale também para páginas inteiras.

## [2.3.2] — Correção: idioma do navegador sobrepunha português — 2026-09-13

### Corrigido
- O detector de idioma (`i18next-browser-languagedetector`) usava o idioma do
  navegador/sistema operacional (`navigator`) quando não havia nenhuma escolha manual
  salva, sobrepondo o `fallbackLng: "pt"` — um usuário com o navegador em espanhol ou
  inglês via a interface traduzida sem pedir. Removido `"navigator"` da ordem de
  detecção; sem escolha salva, agora cai direto no português. Quem trocar de idioma
  manualmente (`UserLanguageSelector`) continua com a escolha salva e respeitada.

## [2.3.1] — Correção: confirmação de startup do backend não aparecia — 2026-09-13

### Corrigido
- **Backend "parecia travar" ao rodar localmente** (`npm run dev:backend`): a mensagem
  de confirmação `Server started on HOST:PORT` usava o logger (`pino` com transporte
  `pino-pretty`, que roda num worker thread) e podia ficar represada por muito tempo —
  em alguns ambientes só aparecia quando o processo era encerrado, mesmo com o
  servidor já de pé e respondendo normalmente. Reproduzido e confirmado via `curl`: a
  porta já respondia (`/auth/login` funcionando) mesmo sem nenhuma confirmação visível
  no terminal. Trocado para `console.log` (síncrono, sem intermediário) logo que a
  porta abre — agora aparece imediatamente, sem depender de mais nada terminar.
- Reforçado no manual técnico: a primeira subida do backend (`ts-node-dev` compilando
  TypeScript na hora) pode levar 10–20s — aguardar a mensagem de confirmação antes de
  testar login/frontend.
- O log `Erro no startup do servidor` que aparece logo em seguida continua sendo um
  aviso pré-existente e inofensivo (tentativa de reconectar sessões do WhatsApp/filas
  no boot) — não impede login nem uso do sistema.

## [2.3.0] — Etapa 3: papel Master, manual+versão na lateral, sino de notificações — 2026-09-13

### Adicionado
- **Papel "Master"**: terceiro nível de permissão além de Admin/Usuário. Tecnicamente
  representado como `profile: "admin"` + `super: true` (reaproveita o campo `super` que
  já existia no modelo `User` e a middleware `isSuper`, em vez de criar um novo enum de
  perfil e duplicar todas as checagens `profile === "admin"` espalhadas pelo backend).
  - Select de perfil em `UserModal` ganhou a opção "Master", visível/atribuível apenas
    quando quem está logado já é `super` (evita escalonamento de privilégio por um
    Admin comum). Editar um usuário que já é Master também exige ser Master.
  - Backend (`CreateUserService`, `UpdateUserService`, `UserController`) só grava o
    campo `super` enviado pelo front quando `req.user.super === true`; caso contrário
    o valor é descartado silenciosamente.
  - Usuário padrão do seed alterado de `admin@admin.com` para `master@atendeflow.com`
    (mantém `super: true`).
  - Tabela de usuários mostra "Master" (em vez de "admin") quando `user.super` é
    verdadeiro.
- **Status Ativo/Desativado**: `UserStatusIcon` (usado na listagem de usuários) já
  calculava corretamente online/offline a partir do campo `online` do usuário — só o
  texto exibido no tooltip foi ajustado de "Online"/"Offline" para "Ativo"/"Desativado",
  conforme pedido.
- **Manual técnico + versão na barra lateral**: novo item fixado ao final do menu
  lateral (`MainListItems`), abaixo de "Painel SaaS", com um link para o manual técnico
  (`frontend/public/manual/MANUAL_TECNICO.md`, copiado do `docs/` do repositório e
  servido como arquivo estático — funciona em qualquer ambiente sem depender do
  GitHub) e um chip com a versão atual do sistema, usando o hook `useVersion` e o
  endpoint `/version` que já existiam no projeto mas não estavam conectados a nenhuma
  tela (o estado `version` era descartado: `const [, setVersion] = useState(false)`).
  `ListItemLink` ganhou suporte a link externo (`href`, abre em nova aba) além da
  navegação interna via `react-router` que já tinha.
- **Sino de notificações — tickets sem atendimento**: além das mensagens não lidas
  (`withUnreadMessages`), o sino agora também busca tickets com `status: "pending"`
  (clientes aguardando, sem atendente), mesclando as duas listas sem duplicar tickets
  em comum.
- **Apagar notificações do sino**: novo botão (ícone de vassoura) no cabeçalho do
  popover de notificações, visível apenas para `profile === "admin"` ou `user.super`
  (Master), que limpa a lista local de notificações exibidas.
- Foto de perfil do usuário (`AvatarUploader` em `UserModal`) e logomarca/nome da
  empresa (`Settings/Whitelabel.js`) já existiam prontos no projeto herdado — apenas
  confirmados/mantidos, nenhuma mudança de código necessária.

### Validado
- `tsc --noEmit` (backend) sem erros.
- `craco build` (frontend) compilado com sucesso após cada etapa da mudança.

## [2.2.1] — Etapa 3.0: rebranding "Whaticket" → "AtendeFlow" — 2026-09-13

### Corrigido
- Removidos os últimos resquícios do nome do projeto original (`Whaticket`/
  `zappro-legado`) usados como valor padrão de fallback em 12 arquivos (backend,
  frontend e `public/`), como `appName || "Whaticket"` e nomes de arquivo temporário.
  `grep -rni "whaticket"` não retorna mais nenhuma ocorrência em `backend/src`,
  `frontend/src`, `frontend/public` e `api_oficial/src`.
- Validado com build completo do backend (`tsc`) e do frontend (`craco build`).

## [2.2.0] — Correção de vulnerabilidades críticas — 2026-09-13

### Corrigido
- **backend** (7 → 2 críticas): `basic-ftp` via `npm audit fix`; `mysql2` 2.3.3→3.24.4;
  `@google-cloud/dialogflow` 5.9.0→8.1.0 (corrige `protobufjs`); `bull-board` (pacote
  abandonado, dependia de `ejs` vulnerável) substituído pelos pacotes mantidos
  `@bull-board/api` + `@bull-board/express` (ajuste em `app.ts`) — testado em runtime,
  `/admin/queues` responde 401 sem autenticação e 200 com autenticação correta.
- **frontend** (5 → 2 críticas): `shell-quote`, `tar` e `websocket-driver` fixados via
  `overrides` no `package.json` (dependências transitivas de ferramentas de
  desenvolvimento — `react-scripts`/`webpack-dev-server` — não vão para o bundle
  final). Build validado após a correção.
- **api_oficial** (1 → 0 críticas): `bcrypt` 5.1.1→6.0.0 — build e hash/compare de senha
  testados em runtime.
- Todas as correções validadas com build completo (e testes de runtime, quando
  aplicável) antes de serem commitadas.

### Não corrigido (decisão pendente — risco alto demais para aplicar sem consulta)
- **`sequelize` e `sequelize-typescript`** (2 críticas restantes no backend): a correção
  exige subir de Sequelize v5 para v6 — mudança de versão maior no ORM usado por *todo*
  o sistema (dezenas de modelos e centenas de migrações). Requer uma migração dedicada
  seguindo o guia oficial de upgrade, com testes extensivos — não é seguro aplicar às
  cegas. Ver seção 7 do manual técnico.
- **`xlsx`** (backend e frontend) e **`html2pdf.js`/`jspdf`** (frontend, usado na
  exportação de PDF): sem correção automática disponível — exigiriam trocar de
  biblioteca. Baixo risco prático (não expostos a entrada não confiável na maioria dos
  usos), mas registrados para avaliação futura.

## [2.1.2] — Correção: tela de Login usava outro arquivo — 2026-09-13

### Corrigido
- A v2.1.0 redesenhou `frontend/src/pages/Login/style.css`, mas esse arquivo **não é
  importado por lugar nenhum** — descoberto ao rodar o sistema de verdade e tirar
  capturas de tela reais. A tela de Login de verdade usa estilos em
  `frontend/src/pages/Login/index.js` (Material UI `makeStyles`) e um bloco de CSS com
  `!important` em `frontend/public/index.html` (que força os campos e a página a ficarem
  sempre num visual fixo, independente do tema claro/escuro escolhido).
- `style.css` (morto) removido.
- Identidade visual "tech" aplicada nos lugares certos: fundo com halo gradiente,
  cartão em vidro fosco, campos de texto escuros, botão com gradiente de marca — tanto
  no `useStyles` do componente quanto no bloco `!important` do `index.html`.
- Validado rodando a aplicação de verdade (PostgreSQL + Redis + backend + frontend) e
  tirando capturas de tela reais via Playwright, em vez de só ler o código.

### Lição registrada
- Antes de estilizar uma tela deste projeto, **confirmar qual arquivo ela realmente usa**
  (`grep` pelo import) — o projeto tem CSS solto não referenciado em algumas pastas.

## [2.1.0] — Etapa 2.1: Identidade visual "tech" na nova base — 2026-09-13

### Adicionado
- Tema central do Material UI (`frontend/src/App.js`) atualizado com a identidade visual
  "tech" criada na Etapa 1.1: cor de marca padrão trocada para o gradiente
  violeta→ciano (`#6d5efc` → `#22d3ee`), tipografia de títulos em **Space Grotesk** (corpo
  do texto continua em Inter, que já era usada no projeto), botões primários com gradiente
  de marca e brilho (`boxShadow`), cantos mais suaves em botões/painéis. Como é o tema
  central, o efeito se propaga automaticamente pras ~45 telas do sistema — sem precisar
  editar tela por tela.
- Barra superior (`frontend/src/layout/index.js`) ganhou um sutil brilho gradiente no modo
  escuro, no mesmo estilo já usado no modo claro.
- Tela de login (`frontend/src/pages/Login/style.css`) redesenhada por completo: fundo
  escuro com halo gradiente, cartão em vidro fosco (glassmorphism), botão com gradiente de
  marca — substituindo o gradiente verde/amarelo claro do projeto original.
- Fontes Space Grotesk e JetBrains Mono adicionadas ao carregamento de fontes
  (`frontend/public/index.html`), ao lado da Inter que já existia.
- Prévia estática publicada mostrando a nova tela de login e o painel de atendimento lado a
  lado com os tokens de design (cores e tipografia) para referência da equipe.

### Ainda não migrado (fica para builds seguintes conforme necessidade)
- Cores/gradientes escritos "na mão" em componentes específicos (fora do tema central) —
  por exemplo, telas com CSS próprio como a de login — precisam ser ajustados
  individualmente, um a um, à medida que forem sendo revisados.

## [2.0.0] — Etapa 2: Nova base (migração do zappro-legado) — 2026-09-13

### Alterado
- **Substituída a base do AtendeFlow**: `backend/` e `frontend/` das Etapas 1/1.1 (Express +
  Prisma + React simples) foram trocados pelo código do projeto avaliado `zappro-legado`
  (ver [`docs/AVALIACAO_ZAPPRO_LEGADO.md`](docs/AVALIACAO_ZAPPRO_LEGADO.md)) — bem mais
  maduro: multi-empresa (SaaS), multi-sessão de WhatsApp com sessão persistida no banco,
  múltiplos canais (WhatsApp, API Oficial, Facebook, Instagram, webchat), builder de
  fluxo/chatbot, campanhas, Kanban, relatórios e cobrança de clientes.
- Adicionado o microsserviço `api_oficial/` (NestJS + Prisma), responsável pela integração
  com a API Oficial do WhatsApp da Meta.
- `docker-compose.yml` passou a incluir também **Redis** (necessário para as filas Bull).
- `package.json` raiz deixou de ser um workspace npm e passou a ter scripts de conveniência
  para instalar/rodar cada uma das 3 aplicações (agora independentes entre si).
- Manual técnico reescrito (arquitetura, modelo de dados e como rodar) para refletir a nova
  base; a versão anterior do manual permanece consultável no histórico do Git.

### Removido (limpeza de dívida técnica, antes de trazer o código)
- 86 arquivos de rascunho/lixo do projeto original: arquivos `*_old`, `*_backup`,
  `*dontwork*`, cópias (`* copy*`), um `*_snippet*` e arquivos `*_Zone.Identifier`
  (metadado do Windows sem função no projeto).
- Um certificado `.p12` e um arquivo de log que estavam versionados no backup original
  (já haviam sido removidos antes de publicar o `zappro-legado`, e continuam fora aqui).

### Pendente (próximas etapas)
- **Etapa 2.1**: aplicar a identidade visual "tech" criada na Etapa 1.1 sobre as ~45 telas
  do frontend (hoje em Material UI padrão) — trabalho grande, tratado à parte. ✅ Concluída
  (ver versão 2.1.0 abaixo).
- Confirmar os termos de licenciamento do projeto original (sem `LICENSE` no repositório).
- ✅ `npm install` e build validados nesta sessão (backend, frontend e api_oficial) — ver
  "Validação de build" na versão 2.1.0.

## [2.1.1] — Validação de `npm install`/build — 2026-09-13

### Validado
- **`backend`**: `npm install` (1.419 pacotes) e `npm run build` (`tsc`) — compilou sem
  nenhum erro de TypeScript.
- **`frontend`**: `npm install --legacy-peer-deps` (2.599 pacotes) e `npx craco build` —
  compilou com sucesso; confirmado que a nova identidade visual está no build final (cor de
  marca e Space Grotesk no bundle JS do tema, gradiente/glassmorphism do Login no CSS).
- **`api_oficial`**: `npm install` (827 pacotes), `npx prisma generate` e `npm run build`
  (`nest build`) — compilou sem erros.

### Corrigido
- Adicionadas `ajv` e `ajv-keywords` como `devDependencies` do `frontend` — necessárias
  para o build funcionar com as versões atuais de CRA/webpack (o `instalador.sh` já
  instalava essas duas manualmente a cada atualização; agora ficam fixadas no
  `package.json`, então um `npm install` simples já basta).

### Observações
- Todas as três aplicações reportaram vulnerabilidades de dependências desatualizadas no
  `npm audit` (esperado — é um projeto com anos de dependências acumuladas). Recomenda-se
  rodar `npm audit` em cada app antes de ir para produção e avaliar as de severidade alta/crítica.
- Build e instalação validados neste ambiente de sessão (15GB RAM, sem necessidade da swap
  de 6GB que o `instalador.sh` configura para VPS mais modestas).

## [Não versionado] — Runbook de migração de código legado — 2026-09-13

Adicionada ao manual técnico (seção 9) a sequência completa e organizada de comandos usados
para resgatar código-fonte de um backup local, limpar dependências/mídia/backups
redundantes, remover credenciais sensíveis e publicar num repositório GitHub novo —
incluindo os erros mais comuns de autenticação (token vs. senha, tipos de token) e como
resolvê-los. Testado em Ubuntu 24.04.

## [Não versionado] — Avaliação do projeto legado — 2026-09-13

Recuperado o código-fonte de um sistema antigo de multi atendimento (`zappro-legado`),
resgatado de um backup de servidor. Avaliação completa registrada em
[`docs/AVALIACAO_ZAPPRO_LEGADO.md`](docs/AVALIACAO_ZAPPRO_LEGADO.md): é um sistema maduro
(1.638 arquivos, ~290 mil linhas) com multi-empresa, multi-sessão de WhatsApp, builder de
fluxo/chatbot, campanhas, cobrança e API oficial da Meta. Recomendação registrada no
documento: usá-lo como nova base do AtendeFlow em vez de reconstruir tudo do zero.

## [1.1.0] — Etapa 1.1: Redesign da interface — 2026-09-13

### Adicionado
- Novo visual "tech" para todo o frontend: tema escuro com gradiente violeta → ciano, fontes
  Space Grotesk (títulos) + Inter (texto) + JetBrains Mono (dados técnicos), painéis em vidro
  fosco (glassmorphism) e grade sutil de fundo.
- Ícones em SVG próprios (sem dependência externa) para navegação, status e ações.
- Barra de estatísticas no topo da Caixa de entrada (total de conversas, aguardando atendimento,
  sessões WhatsApp conectadas, atendentes online) — visão rápida do estado do atendimento.
- Estados vazios explicativos em toda a aplicação (ex: "Nenhuma conversa ainda", "Nenhuma sessão
  criada") com instruções de próximo passo, em vez de telas em branco.
- Tela de conexão do WhatsApp reformulada em formato de passo a passo (1. nomear sessão,
  2. escanear QR Code, 3. pronto para atender), com instruções diretas na tela.
- Indicadores visuais de status (pílulas coloridas com legenda) para conversas, atendentes e
  sessões do WhatsApp — sem precisar interpretar cores sozinho.
- Cabeçalho (`Topbar`) em cada tela com título e explicação curta do que ela faz.

### Sem mudanças de backend/API nesta versão — apenas camada visual do frontend.

## [1.0.0] — Etapa 1: Estrutura Base — 2026-09-13

### Adicionado
- **Backend** (Node.js + TypeScript + Express + Prisma + PostgreSQL):
  - Autenticação com e-mail/senha e JWT (`/auth/register`, `/auth/login`, `/auth/me`, `/auth/logout`).
    O primeiro usuário cadastrado no sistema vira automaticamente `ADMIN`.
  - Modelo de dados inicial: `User` (atendentes), `Contact`, `Queue` (filas), `Conversation` e `Message`.
  - CRUD básico de usuários, filas e contatos.
  - Módulo de conversas com atribuição de atendente (`/conversations/:id/assign`) e mudança de status
    (`OPEN`, `PENDING`, `CLOSED`).
  - Envio de mensagens de um atendente para o contato (`POST /messages`).
  - **Integração real com WhatsApp via Baileys** (`@whiskeysockets/baileys`):
    - Criação de sessão com pareamento por QR Code.
    - Recebimento de mensagens de texto, criando/atualizando contato e conversa automaticamente.
    - Envio de mensagens de texto para o WhatsApp do contato.
    - Reconexão automática de sessão em caso de queda (exceto logout manual).
  - Comunicação em tempo real com o frontend via Socket.io (`conversation:updated`, `message:new`,
    `whatsapp:qr`, `whatsapp:status`).
- **Frontend** (React + Vite + TypeScript + Tailwind CSS):
  - Telas de login e cadastro.
  - Caixa de entrada (inbox) com lista de conversas e janela de chat em tempo real.
  - Tela de conexão do WhatsApp com exibição do QR Code.
  - Tela de configurações (lista de atendentes e cadastro de filas).
- **Infraestrutura**:
  - `docker-compose.yml` com PostgreSQL para desenvolvimento local.
  - Monorepo com npm workspaces (`backend` + `frontend`) e script único (`npm run dev`) para subir os dois.
  - Manual técnico do sistema (`docs/MANUAL_TECNICO.md`).

### Limitações conhecidas desta versão (a evoluir nas próximas etapas)
- Suporta apenas uma sessão de WhatsApp conectada por vez para envio de mensagens.
- Mensagens de grupo do WhatsApp são ignoradas.
- Mídias (imagem, áudio, vídeo, documento) ainda não são recebidas/enviadas — apenas texto.
- Credenciais da sessão do WhatsApp ficam em arquivos locais (pasta `backend/sessions/`), o que não é
  adequado para múltiplas instâncias/servidores em produção.
- Sem testes automatizados, sem paginação nas listagens e sem relatórios/dashboards.

---

## Próximas etapas sugeridas (ainda não iniciadas)
- Etapa 2: suporte a múltiplas sessões/números de WhatsApp simultâneos, com roteamento por fila.
- Etapa 3: envio/recebimento de mídia (imagem, áudio, documento).
- Etapa 4: relatórios e dashboards de atendimento (tempo de resposta, volume por atendente/fila).
- Etapa 5: outros canais (chat web, Instagram, Telegram).
