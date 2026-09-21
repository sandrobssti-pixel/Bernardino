# Changelog — AtendeFlow

Todas as etapas de desenvolvimento do projeto são registradas aqui, na ordem em que foram entregues.
Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [2.3.81] — Bug real: mensagem de grupo aparecia no sino Mensagens/Alertas — 2026-09-21

### Corrigido
- Mensagem de grupo estava aparecendo nas abas "Mensagens" e "Alertas"
  do sino de notificações (`NotificationsPopOver`), tanto na carga
  inicial (hooks `useTickets` sem excluir `isGroup`) quanto em tempo
  real via socket (condição só bloqueava grupo quando a configuração
  `showGroupNotification` estivesse desligada, em vez de ser uma regra
  fixa).
- Corrigido nos dois pontos: grupo agora é excluído incondicionalmente
  dessa lista, sem depender de nenhuma configuração — nem existente
  nem novo grupo aparece em Mensagens/Alertas, e mensagem de grupo
  também não toca mais som por esse caminho.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 64.

## [2.3.80] — Mais 3 pontos corrigidos: grupo ainda vazava pra Aguardando/Atendendo — 2026-09-21

### Corrigido
- Mesmo depois da v2.3.79, o cliente testou de novo (conexão com
  "Tratar grupos como ticket" confirmadamente desabilitada) e o ticket
  de grupo continuou caindo em "Atendendo", pedindo pra selecionar uma
  fila. Achado o caminho real: um handler de mensagem separado (o
  usado de fato pela conexão testada) tinha a mesma lógica de reabrir
  ticket fechado como `"pending"` sem checar `isGroup`.
- Corrigido esse ponto e mais dois preventivamente, na mesma
  categoria: o fallback de conflito de criação simultânea de ticket
  (`FindOrCreateTicketService`) e a regra de transferência sem
  atendente definido (`UpdateTicketService`, usada por transferência
  manual e por fluxos de chatbot/flowbuilder).
- Com isso, todo ponto do backend que reabre ou transfere um ticket já
  existente agora respeita `ticket.isGroup` — grupo só usa mensagens,
  respostas e disparo em massa, sempre na aba Grupos, sem nenhuma
  troca de status, pra qualquer usuário habilitado a responder grupos.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 63.

## [2.3.79] — Bug real: ticket de grupo voltava pra "Aguardando" ao responder — 2026-09-21

### Corrigido
- Ticket de grupo fechado, ao receber uma mensagem nova de qualquer
  participante, virava status `"pending"` (aba Aguardando) em vez de
  voltar pra aba Grupos — misturando grupos com o atendimento normal.
  Causa: 4 pontos no backend (3 no `wbotMessageListener.ts` + 1 no
  `FindOrCreateTicketService.ts`) forçavam `status: "pending"` ao
  reabrir um ticket fechado/recente, sem checar `ticket.isGroup`.
- Corrigido: nos 4 pontos, o status de reabertura agora respeita
  `ticket.isGroup` — grupo sempre volta como `"group"`, nunca como
  `"pending"`.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 62.

## [2.3.78] — Bug real: editar tag no ticket apagava a tag-coluna do Kanban — 2026-09-21

### Corrigido
- Confirmado em produção que a correção da v2.3.77 resolveu de vez o
  bug de "Importar de grupos → Participantes" (cliente testou o envio
  pro Grupo Administração inteiro e a mensagem chegou certa).
- Novo bug real encontrado: as tags-coluna do Kanban ("Fornecedor",
  "Inadimplente") voltaram a sumir do campo Tags da Nova Campanha,
  mesmo depois da correção das seções 54/55. Causa: o widget de tags
  do cabeçalho do ticket (`TagsContainer`) só conhece tags normais
  (`kanban=0`), e `SyncTagsService` fazia um replace total do
  `ContactTag` do contato a cada edição — apagando também a
  associação da tag-coluna do Kanban, que o widget nem sabe que
  existe.
- Corrigido escopando o replace só às tags normais: agora só apaga e
  recria `ContactTag` para tags `kanban=0`, nunca mexendo nas
  associações de tags-coluna do Kanban.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 61.

## [2.3.77] — Corrigida causa raiz: número errado ao importar participantes de grupo por @lid — 2026-09-21

### Corrigido
- Causa raiz do bug da v2.3.76 identificada: em grupos com modo de
  privacidade do WhatsApp (`addressingMode: "lid"`), o participante
  vem endereçado por `@lid` — um identificador sem nenhuma relação
  numérica com o telefone real. `ImportGroupContactsService.ts`
  tentava "adivinhar" o número batendo esse LID contra a coluna `lid`
  já salva nos `Contacts` do banco, o que podia casar com um contato
  completamente sem relação com o grupo (confirmado em produção: 1
  contato errado numa tentativa, 4 números diferentes dos membros
  reais numa segunda).
- Corrigido usando o campo `phoneNumber` que o próprio Baileys já
  expõe no objeto do participante (`GroupParticipant`/`Contact` do
  Baileys) quando disponível, em vez de qualquer tentativa de
  adivinhação via banco de dados. Quando o WhatsApp não expõe esse
  número pra essa conexão, o participante fica "sem número
  identificável" em vez de ser resolvido errado.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 60.

## [2.3.76] — Investigação: "Importar de grupos → Participantes" trouxe contato errado — 2026-09-21

### Investigando
- Cliente testou "Importar de grupos" → "Participantes dos grupos" no
  "Grupo Administração" (7 membros reais) e a lista criada ficou com 1
  único contato ("Joao Paulo", um fornecedor sem nenhuma relação com o
  grupo). A hipótese inicial (mismatch na resolução de participantes
  endereçados por `@lid` contra `Contact.lid`) foi descartada por SQL —
  a coluna `lid` do contato errado está vazia, então esse caminho de
  código não poderia ter casado com ele.
- Sem uma segunda hipótese confiável, em vez de tentar mais uma
  correção especulativa (arriscado demais num bug que manda mensagem
  pro destinatário errado), `ImportGroupContactsService.ts` ganhou
  logs de diagnóstico (participantes crus devolvidos pelo
  `groupMetadata()` de cada grupo + como cada um foi resolvido) pra
  identificar a causa raiz real no próximo teste, sem mudar nenhum
  comportamento.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 59.

## [2.3.75] — Bug grave: campanha ignorava a lista/grupo e mandava pra tag — 2026-09-21

### Corrigido
- Bug real e grave relatado pelo cliente: criou uma campanha de teste
  pra um grupo, e a mensagem foi entregue a um contato de uma tag
  ("Fornecedor") sem nenhuma relação com o grupo. Causa:
  `CampaignController.store` sempre dava prioridade ao campo Tag
  quando ele vinha preenchido (`if (typeof data.tagListId ===
  'number')`), ignorando por completo a Lista de Contato/grupo
  escolhida — e o formulário não limpava um campo ao escolher o outro,
  então um valor de tag esquecido de uma tentativa anterior bastava
  pra desviar a campanha inteira pro destinatário errado.
- Corrigido nos dois lados: no formulário (`CampaignModal`), escolher
  Lista de Contato agora limpa a Tag e vice-versa (mutuamente
  exclusivos); no backend, a Lista de Contato passa a ter prioridade
  sempre que os dois vierem preenchidos, em vez da Tag.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 58.

## [2.3.74] — Lista de Contatos vira o único lugar de onde toda lista nasce — 2026-09-21

### Adicionado
- Botão "Adicionar nova lista" (Lista de Contatos) virou um menu com 4
  opções: **Lista vazia** (como já era), **Anexar arquivo** (agora já
  pede o nome e abre a importação em seguida, num fluxo só), **Importar
  de grupos** (novo) e **Contato avulso** (novo, movido de dentro da
  campanha pra cá).
- **Importar de grupos**: escolhe a conexão, escolhe 1+ grupos (ou
  "selecionar todos"), e escolhe o que importar — os **participantes**
  de dentro dos grupos (cada membro vira um contato individual, sem
  duplicar quem está em mais de um grupo selecionado) ou os **próprios
  grupos** como destinatário (cada grupo escolhido vira 1 item "grupo"
  na lista). Tudo cai numa lista só, nomeada pelo usuário.
- **Contato avulso**: cria uma lista com um único número, sem precisar
  de arquivo nem grupo.

### Removido
- O seletor "Grupo ou contato avulso" que existia dentro do formulário
  de Nova Campanha (`CampaignRecipientPicker`) — essa escolha agora só
  existe em Lista de Contatos; a campanha volta a só escolher entre
  listas já prontas no campo "Lista de Contato". Componente e os
  endpoints exclusivos dele (`/contact-lists/quick-list`,
  `/contact-list-items/group`) removidos por não terem mais nenhum uso.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 57.

## [2.3.73] — Botão "Sincronizar grupos" na tela de Conexões — 2026-09-21

### Adicionado
- Novo botão "Sincronizar grupos" em cada conexão da tela de Conexões
  (visível só pra conexão Baileys/wuzAPI com "Permitir grupos"
  habilitado e status CONNECTED) — busca todos os grupos que a conexão
  participa direto do WhatsApp (`groupFetchAllParticipating`) e garante
  o contato + atendimento de cada um. Antes, a aba "Grupos" dentro de
  Atendimento só mostrava grupo depois de trocar mensagem por ali —
  agora não precisa esperar isso.

### Corrigido
- Também identificado (não corrigido automaticamente, precisa ação do
  usuário): a conexão do cliente estava com **"Permitir grupos"
  desabilitado**, fazendo o sistema descartar toda mensagem de grupo
  recebida antes mesmo de gerar contato/atendimento — causa raiz de a
  aba Grupos aparecer sempre vazia. Habilitar esse campo na edição da
  conexão é pré-requisito pra qualquer coisa relacionada a grupo
  funcionar (atendimento e sincronização).

Detalhes em `docs/MANUAL_TECNICO.md`, seção 56.

## [2.3.72] — Tag do Kanban agora marca o contato (não só o ticket) — 2026-09-21

### Corrigido
- Depois do fix da v2.3.71, a tag do Kanban ainda não aparecia na
  campanha — investigação no banco mostrou que a tag tinha **0
  contatos** associados, mesmo com vários tickets na coluna. Causa:
  arrastar um ticket no Kanban só grava a tag no **ticket**
  (`TicketTag`); a campanha por tag segmenta pelo **contato**
  (`ContactTag`) — são relações diferentes no banco. Corrigido:
  `TicketTagController.store` agora também garante o vínculo
  tag↔contato (`ContactTag`) sempre que uma tag é aplicada a um ticket
  pelo Kanban.
- **Atenção**: isso só vale pra movimentações novas no board — tickets
  que já estavam numa coluna do Kanban antes desse fix continuam sem o
  vínculo de contato. Rodar a query de correção retroativa (ver seção
  55 do manual) resolve os que já existem, sem precisar re-arrastar
  cada um manualmente.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 55.

## [2.3.71] — Tags do Kanban agora aparecem na campanha — 2026-09-21

### Corrigido
- Campanha "por tag": a busca de tags disponíveis só trazia tags
  "normais" (`kanban=0`), então uma tag usada como coluna do Kanban
  (ex.: "Filiados inadimplentes") nunca aparecia na lista, mesmo já
  tendo contatos — indo contra o próprio propósito do Kanban (usar as
  colunas pra segmentar disparo de campanha). Corrigido: agora busca
  as duas categorias (`kanban=0` e `kanban=1`) e junta o resultado.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 54.

## [2.3.70] — Bug grave: número BR de 12 dígitos era aceito antes do certo — 2026-09-21

### Corrigido
- Bug real e grave, confirmado direto no banco: numa lista importada com
  96 contatos, 89 ficaram marcados como "válidos" com número de celular
  **sem o 9º dígito** (12 dígitos) — a campanha "entregava" pra esses
  números, mas a mensagem não chegava de verdade. Causa: em
  `CheckNumber.ts`, a checagem contra o WhatsApp sempre testava primeiro
  o resultado da `libphonenumber-js`, que — passada sem o `+` — não
  reconhece esse formato e devolve o **mesmo número de 12 dígitos sem
  corrigir**, fazendo esse candidato errado ser aceito pelo WhatsApp
  (que tolera a forma incompleta) antes mesmo de tentar a forma certa
  (13 dígitos). Corrigido: agora só usa a `libphonenumber-js` pra
  números de fora do Brasil; para BR, a forma completa (com o 9) é
  sempre testada primeiro, sem exceção.
- Novo botão **"Revalidar números"** na tela de contatos de uma lista —
  reconfere no WhatsApp o número de todos os contatos já importados,
  corrigindo quem ficou salvo errado, sem precisar reimportar a
  planilha do zero.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 53.

## [2.3.69] — Corrigido id de grupo com hífen (campanha não entregava) — 2026-09-21

### Corrigido
- Bug real relatado pelo cliente: grupo aparecia certinho no seletor
  "Grupo ou contato avulso" da campanha, mas a mensagem de teste nunca
  chegava. Causa: grupos do WhatsApp criados há mais tempo usam id no
  formato `NNNNNNNNNN-NNNNNNNNNN@g.us` (dois números separados por
  hífen) — o código novo (`ListWhatsappGroupsService`,
  `AddGroupService`) reaproveitava uma função pensada pra número de
  telefone de pessoa, que removia **todo** caractere não numérico,
  inclusive o hífen, juntando os dois números num id de grupo
  inexistente. Corrigido pra preservar o hífen (só remove o sufixo
  `@g.us`), igual o fluxo antigo que já funcionava
  (`wbotMessageListener.ts`, `verifyContact`).
- **Atenção**: grupos já adicionados numa lista antes desse fix ficaram
  com o id errado salvo — é preciso excluir e adicionar o grupo de novo
  pelo seletor da campanha depois de atualizar o sistema.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 52.

## [2.3.68] — Item "Grupos" na barra lateral — 2026-09-21

### Adicionado
- Novo item "Grupos" na barra lateral do sistema, logo abaixo de
  "CRM / Kanban" — visível só pra quem tem a permissão "Permitir
  grupos" habilitada (mesma flag `allowGroup` já usada na aba "Grupos"
  dentro do Atendimento). Clicar nele abre a tela de Atendimento já na
  aba de Grupos, sem precisar entrar em Atendimento e trocar de aba
  manualmente.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 51.

## [2.3.67] — Grupos do WhatsApp agora aparecem no Kanban — 2026-09-21

### Corrigido
- Atendimentos de grupo do WhatsApp (status interno `group`, usado
  quando a conexão não trata grupo como atendimento comum) não
  apareciam no quadro Kanban — só apareciam na aba "Grupos" da tela de
  Atendimento. Causa: a consulta do Kanban só trazia tickets com status
  `pending`/`open` (ou já classificados numa coluna antes). Corrigido
  incluindo `group` nessa mesma condição — agora o grupo aparece na
  lane padrão do Kanban e pode ser arrastado pra qualquer coluna/tag,
  igual um atendimento normal.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 50.

## [2.3.66] — Ajuste visual da edição total + grupos do WhatsApp direto da conexão — 2026-09-21

### Corrigido
- Banner "Habilitar edição total" (dentro da campanha): o texto de aviso
  estava sobrepondo/cortando o botão em telas menores. Layout agora
  quebra linha (texto acima, botão abaixo) em vez de se sobrepor.
- Backend (`CampaignService/UpdateService.ts`) bloqueava salvar edições
  em campanha `EM_ANDAMENTO` ou `FINALIZADA` mesmo com "edição total"
  habilitada no formulário (erro "Só é permitido alterar campanha
  Inativa e Programada") — o botão liberava os campos na tela, mas o
  salvar falhava. Agora aceita salvar em qualquer status (Inativa,
  Programada, Em andamento, Finalizada, Cancelada).
- Seletor de grupo na campanha ("Grupo ou contato avulso"): só listava
  grupos que já tinham trocado alguma mensagem com a conexão (via
  tabela de Contacts). Agora busca a lista completa de grupos direto do
  WhatsApp conectado (Baileys `groupFetchAllParticipating`), então todo
  grupo que o número já participa aparece pra escolha, mesmo sem
  histórico de mensagem por aqui.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 49.

## [2.3.65] — Após importar arquivo, abre direto a tela de contatos da lista — 2026-09-21

### Adicionado
- Em "Lista de Contatos" → "Adicionar nova lista" → "Anexar arquivo": ao
  terminar a importação da planilha, o sistema agora navega
  automaticamente para a tela de contatos daquela lista (mesma tela do
  botão "Ver Contatos"), já mostrando todos os números importados, para
  o usuário conferir, adicionar manualmente ou excluir algum contato sem
  precisar procurar a lista de novo na tela anterior.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 48.

## [2.3.64] — Bolinha de envio real, edição total da campanha, relatório em Excel — 2026-09-21

### Adicionado
- Listagem de campanhas: a bolinha da coluna "Confirmação" agora mostra
  o **status real de envio** (verde = pelo menos um disparo confirmado
  entregue, vermelha = tentou enviar mas nenhum confirmou, cinza = ainda
  não rodou) — antes mostrava a configuração de "mensagem de
  confirmação" (habilitada/desabilitada), o que confundia com o status
  de entrega.
- Botão "Habilitar edição total" no formulário de campanha: quando uma
  campanha já enviada/agendada normalmente bloqueia os campos, esse
  botão libera todos pra correção manual de um erro de digitação, sem
  precisar cancelar e recriar a campanha do zero.
- Relatório de campanha: exportação trocada de CSV (só pendentes) para
  **Excel com duas abas** ("Enviados" e "Não enviados"), cada uma com
  nome/número/e-mail dos contatos correspondentes.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 47.

## [2.3.63] — Corrigido bug real de campanha não entregue (número sem o 9º dígito) — 2026-09-21

### Corrigido
- Campanha "entregue" no sistema, mas a mensagem não chegava de verdade
  no aparelho do cliente — cliente relatou "teve alguns que chegaram [e
  outros não]". Causa: ao checar se um número tem WhatsApp, o sistema
  tentava primeiro a forma **sem o 9º dígito** do celular (ex.:
  `557188789015`), e o WhatsApp às vezes "aceita" essa forma incompleta
  por tolerância do próprio servidor — mas a entrega real depende do
  formato certo. Corrigido testando **sempre a forma completa (com o
  9) primeiro**, só caindo pra incompleta como último recurso.

### Melhorado
- Reconhecimento de números de **outros países** (`libphonenumber-js`,
  dados oficiais de numeração de qualquer DDI) — antes o sistema só
  validava por quantidade de dígitos (12-14), o que podia aceitar
  número mal formado ou tratar errado um número estrangeiro digitado
  sem o "+". Números com `+` na frente agora são validados
  corretamente pelo país real; sem "+", continua assumindo Brasil por
  padrão (comportamento já existente, mantido).

Detalhes em `docs/MANUAL_TECNICO.md`, seção 46.

## [2.3.62] — Bolinha de status na coluna Confirmação da listagem de campanhas — 2026-09-20

### Adicionado
- Troca o texto "Habilitada/Desabilitada" por uma bolinha colorida
  (verde/vermelha) com tooltip na coluna "Confirmação" da listagem de
  campanhas — mais rápido de bater o olho numa lista grande.

## [2.3.61] — Corrigido fuso horário do container do backend — 2026-09-20

### Corrigido
- Horário agendado de campanha salvava ~3h adiantado (data certa, hora
  errada) — o container do backend roda em UTC por padrão (Docker), e o
  `scheduledAt` chega do frontend como uma string sem fuso explícito
  ("2026-09-20 19:20:00"), que o Node interpretava como UTC em vez de
  horário de Brasília. Corrigido definindo `TZ=America/Sao_Paulo` no
  `docker-compose.coolify.yml` (mesma zona já usada manualmente em vários
  pontos do código — `BirthdayJob.ts`, `queues.ts`, `logger.ts` — via
  `.tz('America/Sao_Paulo')`, mas que essa tela nova não tinha) e
  instalando o pacote `tzdata` no Dockerfile (a imagem "slim" não traz
  os dados de fuso por padrão, o que faria o `TZ` ser ignorado
  silenciosamente).
- Campanhas já agendadas antes dessa correção continuam com o horário
  errado gravado — precisam ser reabertas e reagendadas manualmente pra
  pegar o horário certo.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 45.

## [2.3.60] — Campanha para grupo do WhatsApp ou contato individual — 2026-09-20

### Adicionado
- Botão "Grupo ou contato avulso" na tela de campanha: escolhe um grupo
  do WhatsApp (dentre os que a conexão já trocou mensagem) ou digita um
  número individual, sem precisar montar uma lista de contatos antes.
  Por baixo dos panos reaproveita o mesmo motor de disparo já existente
  (lista de contatos + item de lista), criando/reaproveitando
  automaticamente uma lista "Envios avulsos (grupos e contatos
  individuais)" por empresa — sem nenhuma mudança na fila de envio.
- Endpoints novos: `GET /contact-lists/quick-list` (pega ou cria essa
  lista guarda-chuva) e `POST /contact-list-items/group` (adiciona um
  grupo como item de lista, sem tentar validar o ID do grupo como se
  fosse número de telefone de pessoa).

### Corrigido
- `ListContactsService` (usado pra listar contatos) só filtrava
  `isGroup=false`; `isGroup=true` (necessário pra listar só os grupos no
  novo seletor) era ignorado silenciosamente e devolvia todo mundo.
  Também faltava `whatsappId` nos atributos retornados, quebrando o
  filtro por conexão.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 44.

## [2.3.59] — Importar Arquivo na Lista de Contatos, com campos extras — 2026-09-20

### Adicionado
- Botão "Importar Arquivo" direto na tela de Listas de Contatos
  (`ContactLists`), sem precisar entrar em "Ver Contatos" primeiro
  (esse fluxo já existia lá, agora também no nível de cima).
- Colunas da planilha que não são nome/número/e-mail (CPF, vigência,
  mês, status, etc.) agora ficam guardadas em `ContactListItem.extraData`
  e visíveis por um botão "Ver dados da planilha" na listagem de
  contatos — só uso interno, nunca entra na campanha (que continua
  usando só o número de WhatsApp normalizado).
- Reimportar a mesma planilha (ex.: lista de inadimplentes atualizada
  todo mês) agora atualiza nome/e-mail/dados extras dos contatos que já
  existiam na lista, em vez de só contar como duplicado.

### Corrigido
- Detecção do nome na planilha importada dependia de um cabeçalho
  reconhecido ("nome"/"name"/"contato") — planilhas com outro nome de
  coluna (ex.: "atirador", "cliente", "sócio") importavam sem nome
  nenhum. Agora cai pra primeira coluna da planilha quando nenhum alias
  bate.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 43.

## [2.3.58] — Sino do Painel Vigia continuava com alerta de atendimento fechado — 2026-09-20

### Corrigido
- Cliente relatou que, mesmo fechando o atendimento corretamente, o
  alerta dele continuava aparecendo no sino do Painel Vigia — o mesmo
  bug já corrigido na v2.3.47 (seção 31), agora numa camada nova de
  front-end (`SupervisorAlertsBell`) que só buscava a lista uma vez ao
  carregar a página e depois só empilhava alertas recebidos ao vivo,
  sem nunca reconsultar o backend (que já filtra atendimentos fechados)
  nem remover um alerta quando o ticket dele fechava. Corrigido
  reconsultando a lista toda vez que o sino é aberto, e removendo o
  alerta na hora via socket quando o ticket relacionado é fechado.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 42.

## [2.3.57] — Corrigido PROXY_PORT: imagem/áudio/vídeo chegavam sem abrir — 2026-09-20

### Corrigido
- Imagem, áudio e vídeo (recebidos e enviados) apareciam na conversa
  sem visualização nem opção de baixar (`net::ERR_SSL_PROTOCOL_ERROR` /
  erro de CORS no navegador, apontando pra
  `api.confiancatechnologies.com:8080`). Causa: a variável
  `PROXY_PORT=8080` era concatenada em toda URL de mídia
  (`BACKEND_URL:PROXY_PORT/public/...`), resquício de quando o backend
  era acessado direto por IP:8080 — desde a migração pro Cloudflare
  Tunnel (v2.3.53) o domínio público serve tudo por HTTPS/443 sem essa
  porta exposta. Corrigido zerando `PROXY_PORT` no
  `docker-compose.coolify.yml`; como a URL é montada dinamicamente a
  cada leitura da mensagem, mensagens antigas e novas foram corrigidas
  ao mesmo tempo, sem precisar de migração no banco.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 41.

## [2.3.56] — Seafile: solução de arquivos tipo Google Drive para as empresas — 2026-09-20

### Adicionado
- Seafile (Community Edition) rodando na VPS em stack Docker separado
  (`docker-compose.seafile.yml`), com os dados em disco local dedicado
  (`/srv/seafile-data`, partição de ~220GB) em vez de rede — mais rápido
  e confiável. Acesso público em
  `https://arquivos.confiancatechnologies.com`, via o mesmo túnel
  Cloudflare do AtendeFlow.
- Backup diário automático do Seafile (banco MySQL + biblioteca de
  arquivos) pro NAS, com retenção de 30 dias (`backup-seafile.sh`,
  agendado no cron).
- `backup-atendeflow.sh` trazido pro repositório (antes só existia na
  VPS, fora do controle de versão).

### Corrigido
- Os scripts de backup (`backup-atendeflow.sh`, `backup-seafile.sh`) só
  checavam se a pasta de destino existia, não se o compartilhamento do
  NAS estava de fato montado — um NAS desmontado (aconteceu de verdade
  nesta etapa, após um reboot) faria o backup ser gravado silenciosamente
  no disco local da VPS, sem proteção real. Trocado por `mountpoint -q`.
- `/etc/fstab` dos compartilhamentos `atendeflow-backup` e
  `seafile-data` sem `x-systemd.automount`/`nofail`, causando o problema
  acima; corrigido alinhando com o `confianza-backup`.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 40.

## [2.3.55] — Corrigido host do Redis no docker-compose.coolify.yml — 2026-09-20

### Corrigido
- WhatsApp (Baileys) parou de enviar/receber mensagens: o `backend`
  apontava pro Redis usando o alias genérico `redis://redis:6379`, que
  na rede externa `coolify` (compartilhada com o próprio Coolify) às
  vezes colidia com o Redis **interno do Coolify** (que exige senha),
  causando `NOAUTH Authentication required`. Isso quebrava a leitura/
  escrita das credenciais do Baileys no Redis, derrubando a sessão do
  WhatsApp para `DISCONNECTED` sem se reconectar sozinha. Corrigido
  apontando `REDIS_URI`/`REDIS_HOST`/`IO_REDIS_URI` pro nome único do
  container (`atendeflow-redis-prod`) em vez do alias genérico do
  serviço do compose.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 39.

## [2.3.54] — Backup local no NAS + correção do backup-para-drive.sh — 2026-09-19

### Adicionado
- Backup local diário (banco + arquivos) num NAS Synology na rede local,
  via SMB, com retenção de 30 dias (`~/scripts/backup-atendeflow.sh`,
  agendado no cron).

### Corrigido
- `backup-para-drive.sh` (backup para o Google Drive do cliente) fazia
  backup do banco Postgres **antigo/pré-migração** (`localhost:5432`),
  rodando "com sucesso" todas as noites sem nunca conter os dados reais
  de produção desde a migração pro Coolify. Corrigido para ler o `.env`
  do diretório de deploy real e usar `docker exec` no container do
  Postgres, igual ao backup local.

### Removido
- Backup para o Google Drive desativado do cron (o cliente não vai
  continuar pagando a assinatura do Google só por causa disso); o script
  corrigido continua no repositório, pronto pra reativar se surgir um
  local externo gratuito ou o cliente optar por manter o Google Drive.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 38.

## [2.3.53] — Migração dos dados de produção e troca do domínio definitivo — 2026-09-19

### Adicionado
- Dados reais de produção migrados do servidor antigo pro novo VPS
  (Coolify) via `pg_dump`/`psql`, e o domínio definitivo
  `atendeflow.confiancatechnologies.com` / `api.confiancatechnologies.com`
  passaram a apontar pro túnel Cloudflare do servidor novo.

### Corrigido
- `DROP DATABASE` falhava por conexões persistentes do backend (que
  não tinha sido parado de fato) — corrigido bloqueando novas conexões
  (`datallowconn = false`) antes de derrubar as existentes.
- Troca de `FRONTEND_URL`/`BACKEND_URL` no `.env` não tinha efeito com
  `docker compose restart` — precisa de `up -d --force-recreate` pra
  recarregar as variáveis de ambiente.
- Registro de DNS manual usando o Connector ID do túnel em vez do
  Tunnel ID causava `Error 1033`; corrigido deixando o Cloudflare criar
  o registro automaticamente pelo botão "Adicionar rota".

Detalhes em `docs/MANUAL_TECNICO.md`, seção 37.

## [2.3.52] — Containers entram na rede "coolify" — 2026-09-19

### Corrigido
- O backend ficava travado tentando conectar no Postgres (sem nunca dar
  erro visível) porque o `docker compose` rodado direto por SSH cria uma
  rede própria, diferente da rede `coolify` onde o container do Postgres
  gerenciado pelo Coolify realmente vive. Agora todos os serviços do
  `docker-compose.coolify.yml` (`backend`, `frontend`, `redis`,
  `cloudflared`) se conectam na rede `coolify` (externa, já existente),
  e conseguem resolver o host do banco pelo nome.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 36.

## [2.3.51] — Deploy via SSH direto + remove portas publicadas — 2026-09-19

### Alterado
- O recurso "Docker Compose" do Coolify (colar YAML direto, sem
  repositório Git) não consegue buildar `backend`/`frontend` — não tem
  como fornecer o código-fonte pro `build: context:`. O deploy passou a
  ser feito via `git clone` + `docker compose ... up -d --build` direto
  por SSH no VPS. O Postgres continua gerenciado pelo Coolify
  normalmente.
- Removidas as seções `ports:` de `backend` e `frontend` no
  `docker-compose.coolify.yml` — o Cloudflare Tunnel já alcança os
  containers pela rede interna do Docker, não precisa publicar porta no
  host (e isso estava conflitando com outra porta já em uso no VPS).

Detalhes em `docs/MANUAL_TECNICO.md`, seção 35.

## [2.3.50] — Suporte a SSL na conexão com o Postgres — 2026-09-19

### Adicionado
- `DB_SSL`/`DB_SSL_REJECT_UNAUTHORIZED` em `backend/src/config/database.ts`
  — necessário porque o Postgres gerenciado pelo Coolify exige conexão
  criptografada mesmo internamente. Sem isso a conexão falhava.

### Corrigido
- A porta interna correta do Postgres do Coolify é `5432` (confirmado na
  "Postgres URL (internal)"), não `5433` como usado antes nesta mesma
  migração — o campo "Port mappings" da tela do Coolify mostra outra
  porta (mapeamento externo), que não é a mesma coisa.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 34.

## [2.3.49] — Cloudflare Tunnel no docker-compose.coolify.yml — 2026-09-19

### Adicionado
- Serviço `cloudflared` no `docker-compose.coolify.yml` — deixa o
  AtendeFlow acessível pela internet via Cloudflare Tunnel, sem precisar
  de IP público nem porta aberta no VPS (mesmo esquema do servidor
  atual). Nova variável `CLOUDFLARE_TUNNEL_TOKEN` no
  `.env.coolify.example`.

Detalhes e passo a passo do lado do Cloudflare em
`docs/MANUAL_TECNICO.md`, seção 33.

## [2.3.48] — Deploy via Coolify (Dockerfiles + docker-compose) — 2026-09-19

### Adicionado
- `backend/Dockerfile` e `frontend/Dockerfile`, prontos pra build no
  Coolify (ou qualquer orquestrador Docker).
- `docker-compose.coolify.yml` — sobe backend + frontend + redis,
  conectando no Postgres que o Coolify já tenha configurado (não sobe
  banco próprio).
- `.env.coolify.example` — roteiro de todas as variáveis de ambiente
  necessárias pra configurar no Coolify.

Detalhes e passo a passo em `docs/MANUAL_TECNICO.md`, seção 32.

## [2.3.47] — Sino para de mostrar alerta de atendimento fechado — 2026-09-18

### Corrigido
- O sino do Painel Vigia continuava mostrando alertas de risco/atraso de
  atendimentos que já tinham sido fechados. Agora só aparecem alertas de
  atendimentos ainda em aberto (aguardando/atendendo) e avisos sem
  atendimento associado. A notificação não é apagada do banco, só some do
  sino quando o atendimento é encerrado.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 31.

## [2.3.46] — Corrige build quebrado do frontend — 2026-09-17

### Corrigido
- `npm run build` do frontend falhava com `'onElementsRemove' is not
  exported from 'react-flow-renderer'`, travando o `instalador.sh` antes
  de reiniciar os processos. Era um import não usado em
  `FlowBuilderConfig/index.js` — removido, sem relação com as mudanças do
  Painel Vigia. Build de produção testado localmente com sucesso.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 30.

## [2.3.45] — Card automático "Atendimento fora do expediente ADM" — 2026-09-17

### Adicionado
- Novo card fixo e automático na faixa "Regras de SLA" do Painel:
  "Atendimento fora do expediente ADM" — não precisa cadastrar nenhuma
  Regra de SLA pra isso, é calculado direto do módulo Horário de
  Atendimento. Clicável, igual aos outros cards da faixa (leva direto ao
  atendimento fora do expediente mais urgente).

### Alterado
- Removido o card "Fora do expediente" da fileira principal de KPIs (o
  número foi pra dentro do novo card automático, pra não duplicar).

### Observação
- Uma Regra de SLA manual com o mesmo nome, cadastrada antes dessa
  automação existir, continua no banco e aparece como card separado (sem
  relação real com horário) — recomendado apagá-la pelo Painel.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 29.

## [2.3.44] — Clicar na Regra de SLA vai direto ao atendimento — 2026-09-17

### Adicionado
- Clicar no card de uma Regra de SLA no Painel agora rola a tela e destaca
  (por alguns segundos) o atendimento mais urgente daquela regra — sem
  precisar procurar manualmente entre as colunas de atendentes.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 28.

## [2.3.43] — SLA não zera mais de "aguardando" pra "atendendo" — 2026-09-17

### Corrigido
- A contagem de minutos do Painel Vigia (cards, gráficos e alertas do
  sino) zerava quando um atendimento saía de "aguardando" e um atendente
  aceitava ("atendendo") — o cálculo usava o horário em que o atendente
  foi atribuído, não o horário em que o cliente chegou na fila. Agora a
  contagem é contínua desde a chegada, através das duas fases.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 27.

## [2.3.42] — Card e gráfico ao vivo por Regra de SLA — 2026-09-17

### Adicionado
- Cada Regra de SLA cadastrada (CRUD do Painel Vigia) ganha o próprio card
  ao vivo no Painel, com contagem de atendimentos no prazo/risco/atraso
  específica daquela regra — aparece com zero assim que a regra é criada,
  confirmando visualmente que já está sendo monitorada.
- Novo gráfico "Por regra de SLA" (barras empilhadas), no mesmo padrão dos
  gráficos que já existiam ("Distribuição por status" e "Por fila").

Detalhes em `docs/MANUAL_TECNICO.md`, seção 26.

## [2.3.41] — Card "Fora do expediente" reposicionado + backup automático — 2026-09-17

### Alterado
- Card "Fora do expediente" no Painel agora fica ao lado do "Fora do
  prazo" (antes ficava por último, depois de "Tempo médio em aberto").
- `instalador.sh` (script de atualização rodado no servidor do cliente)
  passou a chamar o `backup-para-drive.sh` automaticamente no final de
  cada atualização — não depende mais de rodar o backup manualmente depois
  de atualizar o código.

Confirmado também que o AtendeFlow não depende de nenhuma conexão com o
Claude/Anthropic em tempo de execução — o assistente é usado só durante o
desenvolvimento do código-fonte.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 25.

## [2.3.40] — Backup do código-fonte completo — 2026-09-17

### Adicionado
- `backup-para-drive.sh` passou a enviar também todo o código-fonte do
  projeto (backend/frontend/api_oficial, sem `node_modules`/`dist`/
  `build`/`.git`/segredos) pro mesmo Google Drive já combinado com o
  cliente, numa subpasta própria (`codigo-fonte/`) — backup independente
  do GitHub.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 24.

## [2.3.39] — Painel Vigia lê o Horário de Atendimento — 2026-09-17

### Adicionado
- Novo card "Fora do expediente" no Painel — lido direto do módulo Horário
  de Atendimento já existente (por empresa, fila ou conexão), sem precisar
  configurar nada de novo. Antes disso, a única forma de tentar expressar
  "horário de expediente" era via Regras de SLA, que não serve pra isso
  (é minutos de resposta, não horário semanal).

Detalhes em `docs/MANUAL_TECNICO.md`, seção 23.

## [2.3.38] — Alerta geral repetitivo + transferir pelo Painel — 2026-09-17

### Alterado
- Alerta de "fora do prazo" agora repete a cada 5 minutos (antes disparava
  só uma vez) e avisa todos os atendentes conectados, não só o responsável
  pelo ticket. "Risco de atraso" continua avisando uma vez, só pro
  responsável + supervisores.
- Novo botão "Transferir para outro atendente" em cada atendimento do
  Painel, ao lado do de mandar mensagem — reaproveita o modal de
  transferência já existente no sistema.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 22.

## [2.3.37] — Painel Vigia monitora "aguardando" também — 2026-09-17

### Corrigido
- O Painel Vigia só considerava atendimentos já "em atendimento" (aceitos
  por um atendente) pros cards, gráficos e alertas de SLA — clientes
  "aguardando" na fila, sem atendente ainda, ficavam de fora. Agora as duas
  situações são monitoradas; o texto do alerta diz qual das duas é.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 21.

## [2.3.36] — Painel Vigia unificado no "Painel" existente — 2026-09-17

### Alterado
- Removida a tela separada "Painel Vigia" (`/painel-vigia`) — o cliente já
  tinha uma tela chamada só "Painel" (`/moments`) e pediu pra unificar tudo
  num lugar só, pra não ter dois menus parecidos.
- Cards de totais, os dois gráficos e o botão de mandar mensagem ao vivo pro
  atendente agora vivem dentro do "Painel" já existente; o CRUD de Regras de
  SLA abre num diálogo a partir de um ícone de engrenagem na barra de
  ferramentas. Nenhuma rota/endpoint do backend mudou.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 20.

## [2.3.35] — Painel Vigia (monitoramento de SLA em tempo real) — 2026-09-17

### Adicionado
- Novo módulo "Painel Vigia" (add-on por plano/usuário, mesmo padrão do
  Financeiro/RH): monitoramento em tempo real de atendimentos com risco de
  atraso (15 min, configurável) ou fora do prazo (20 min, configurável).
- Regras de SLA com CRUD completo (criar/editar/excluir), por fila ou padrão
  da empresa.
- Tela "Ao vivo": cards de totais, gráficos (donut de status + barras por
  fila) e tabela com atendente (online/offline), cliente, fila, tempo
  decorrido e status, com botão pra mandar mensagem ao vivo pro atendente.
- Alertas automáticos (a cada minuto) quando um atendimento cruza o limiar
  de risco/atraso, entregues em tempo real e num sino novo, separado do sino
  de tickets — visível pra todo mundo, com opção de apagar restrita a quem
  tem acesso ao módulo.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 19.

## [2.3.34] — Botão de fechar atendimento com rótulo dinâmico — 2026-09-17

### Alterado
- O único botão de fechar atendimento agora mostra "Cadastrar Contato"
  enquanto o cliente não tem o cadastro completo, e "Resolver" depois de
  completo — mesma ação nos dois casos, só o texto muda pra deixar claro o
  que vai acontecer.

### Corrigido
- `ShowTicketFromUUIDService` não carregava `document`/`address`/`contact2`
  do contato ao abrir a tela de atendimento, então o frontend nunca sabia se
  o cadastro estava completo pro ticket aberto no momento.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 18.

## [2.3.33] — Correção: atendimento fechado sumia do Kanban — 2026-09-17

### Corrigido
- `GET /ticket/kanban` sempre excluía tickets fechados do board, mesmo com
  uma tag de Kanban aplicada — o filtro de status era incondicional. Agora um
  ticket fechado com tag de Kanban continua aparecendo na lane correspondente
  (essencial pra segmentação/campanhas por tag, ex.: "Inadimplentes").

Detalhes em `docs/MANUAL_TECNICO.md`, seção 17.

## [2.3.32] — Cadastro obrigatório unificado no "Editar contato" — 2026-09-17

### Alterado
- O cadastro obrigatório de cliente novo (v2.3.30) deixou de abrir um popup
  próprio (`MandatoryContactRegistrationModal`, removido) e passou a usar o
  modal já existente de "Editar contato" — agora com os campos CPF/documento,
  endereço e contato 2 sempre disponíveis, e com um seletor extra de "Coluna
  do Kanban" quando aberto a partir do fechamento de um atendimento.

### Removido
- Item de menu redundante "Fechar sem mensagem de despedida" em
  `TicketOptionsMenu` — não tinha a trava de cadastro obrigatório e deixava o
  atendente preso no mesmo erro sem um jeito de resolver. Agora só existe um
  caminho pra fechar um atendimento: o botão "Resolver".

Detalhes em `docs/MANUAL_TECNICO.md`, seção 16.

## [2.3.31] — Seletor de idiomas com bandeiras — 2026-09-17

### Adicionado
- Bandeira ao lado de cada idioma no seletor (ícone de globo, barra
  superior): 🇧🇷 Português (Brasil), 🇵🇾 Espanhol (Paraguai), 🇪🇸 Espanhol
  (Espanha), 🇺🇸 Inglês (Estados Unidos).
- Novo pacote de idioma `es-ES` (Espanhol da Espanha) — mesmo texto do
  `es` (Paraguai) por enquanto, isolado num arquivo próprio
  (`translate/languages/esES.js`) pra poder divergir no futuro sem
  afetar a variante do Paraguai.

### Removido
- Turco (`tr`) saiu da lista de idiomas oferecida (arquivo continua no
  repositório, só não é mais importado no bundle ativo).

Detalhes em `docs/MANUAL_TECNICO.md`, seção 15.

## [2.3.30] — Cadastro obrigatório de cliente novo + Kanban automático — 2026-09-17

### Adicionado
- **Cadastro obrigatório antes de fechar o atendimento**, só para clientes
  novos ou que trocaram de número (contato com cadastro incompleto): nome
  completo, e-mail, CPF/Identidade, endereço completo e um segundo
  contato — mais a escolha da coluna do Kanban (tag) pra onde esse
  atendimento vai. Depois de completado uma vez, o cliente nunca mais é
  interrompido nos próximos atendimentos.
- 3 campos novos no cadastro de contato: `document`, `address`,
  `contact2` (migração
  `20260916120000-add-mandatory-registration-fields-to-contacts.ts`).
- Modal `MandatoryContactRegistrationModal`: abre automaticamente quando
  o backend recusa o fechamento (sem botão de cancelar — é mandatório de
  verdade); ao salvar, atualiza o contato, aplica a tag do Kanban
  escolhida no atendimento e fecha automaticamente.

### Corrigido
- Bug pré-existente no `UpdateTicketService`: o `catch` final capturava
  qualquer erro (inclusive `AppError`s intencionais) e substituía por um
  genérico `ERR_UPDATE_TICKET` (404), escondendo a causa real — corrigido
  repassando `AppError`s como estão.

Detalhes completos em `docs/MANUAL_TECNICO.md`, seção 14.

## [2.3.29] — Corrigido logout ao clicar em Configurações — 2026-09-15

### Corrigido
- **Causa raiz encontrada e corrigida**: `backend/.env.example` sempre trouxe
  `COOKIE_DOMAIN=localhost` como padrão para o cookie de refresh token —
  válido em desenvolvimento, mas **inválido em qualquer domínio de
  produção real**. Um cookie com `Domain` incompatível com o host da
  requisição é **rejeitado silenciosamente pelo navegador** (sem erro
  visível), então o cookie de sessão nunca era salvo de verdade. Na
  primeira renovação de token durante o uso normal (mais provável ao
  entrar em Configurações, que dispara várias chamadas de uma vez), o
  backend não encontrava o cookie, respondia sessão expirada, e o
  frontend deslogava o usuário — em qualquer instância que tivesse
  copiado esse `.env.example` sem editar essa linha.
- `.env.example` corrigido (`COOKIE_DOMAIN` agora vem em branco por
  padrão, com comentário explicando quando de fato preencher).
- Validação defensiva adicionada no backend
  (`helpers/SendRefreshToken.ts`): se `COOKIE_DOMAIN` não bater com o
  host da requisição, a configuração é ignorada (com aviso no log) em
  vez de gerar um cookie que o navegador vai recusar de qualquer forma —
  protege contra o mesmo erro se a variável for configurada errada de
  novo no futuro.
- Detalhes completos do diagnóstico em `docs/MANUAL_TECNICO.md`, seção 13.

## [2.3.28] — Acesso remoto (Cloudflare Tunnel) + backup estendido — 2026-09-15

### Adicionado
- **Acesso remoto ao AtendeFlow** via Cloudflare Tunnel, em
  `https://atendeflow.confiancatechnologies.com` (frontend) e
  `https://api.confiancatechnologies.com` (backend) — o servidor do
  cliente está numa rede local sem IP público próprio, então em vez de
  port forwarding no roteador foi usado Cloudflare Tunnel (mesma
  tecnologia que o cliente já usa pra outro serviço dele). Detalhes
  completos, incluindo os domínios em uso e o que NÃO mexer (túnel de
  outro serviço do cliente), em `docs/MANUAL_TECNICO.md`, seção 12.
- `cloudflared` e `pm2` registrados como serviços systemd — sobem
  sozinhos depois de um reboot do servidor, sem intervenção manual.
- Backup diário (`backup-para-drive.sh`) agora também gera um terceiro
  arquivo com a configuração crítica do servidor (`.env` do
  backend/frontend, config do túnel Cloudflare, crontab) — motivado por
  um incidente real durante essa etapa (ver seção 12.4 do manual):
  registros de DNS de outro serviço do cliente foram apagados por engano
  e precisaram ser recuperados manualmente a partir de um export feito
  minutos antes.

## [2.3.27] — Backup diário automático pro Google Drive — 2026-09-15

### Adicionado
- Script `backup-para-drive.sh` (raiz do projeto): gera um dump compactado
  do banco (Postgres) + um `.tar.gz` de `backend/public/` (currículos do
  RH, mídia do WhatsApp, fotos de perfil) e envia os dois pro Google Drive
  combinado com o cliente, via `rclone`. Pensado pra rodar todo fim do dia
  via `crontab`. Não apaga backups antigos — cada execução soma um par de
  arquivos novo. Passo a passo completo de configuração (instalar/
  autorizar o rclone, agendar no cron) em `docs/MANUAL_TECNICO.md`, seção
  11.

## [2.3.26] — Painel RH e página pública com cara de dashboard — 2026-09-14

### Adicionado
- **Aba "Painel RH"** (primeira aba de `/rh`): cards de resumo (vagas abertas,
  total de candidaturas, total de vagas, efetivados) + gráfico de candidaturas
  por status (cor por identidade, mesma paleta dos Chips já usados no módulo)
  e gráfico de candidaturas por vaga (barras horizontais, magnitude) — mesmo
  padrão visual do Painel Financeiro. Novo endpoint `GET /hr/reports/summary`.
- **Página pública de vagas** ganhou um cabeçalho "hero" (gradiente, ícone,
  nome da empresa e contagem de vagas abertas) em vez do título simples —
  os endpoints públicos agora retornam o nome da empresa junto da vaga.

## [2.3.25] — Módulo de RH/recrutamento (Fase 5) — 2026-09-14

### Adicionado
- **Módulo de RH/recrutamento completo**: cadastro de vagas, página pública de
  vagas (sem login) com candidatura por anexo de currículo (PDF/Word), painel
  de triagem interno (status, observações, avaliação) e efetivação do
  candidato como usuário de verdade da empresa (com senha provisória gerada
  automaticamente). Add-on independente do Financeiro/Fiscal — o Master
  libera por plano (`Plan.useHR`, Configurações → Planos) e o Admin de cada
  empresa libera por funcionário (`User.hrAccess`).
- Backend: modelos `JobPosting`/`JobApplication`, serviços
  `HRService/JobPostingService.ts`/`JobApplicationService.ts`, upload de
  currículo dedicado pra rota pública (`config/resumeUpload.ts`, sem
  depender de `req.user`), rotas em `hrRoutes.ts` (`/job-postings`,
  `/job-applications`, `/job-applications/:id/hire`, `/hr/access`,
  `/public/job-postings/:companyId[...]`).
- Frontend: página admin `pages/RH` (abas Vagas/Candidaturas), página pública
  `pages/PublicJobBoard` (`/vagas/:companyId[/:jobId]`), hook `useHR`
  (usa a instância `openApi` — sem sessão — nas chamadas públicas), item de
  menu "RH", toggle de plano em `PlansManager`.
- ⚠️ Bug de corrida corrigido antes do commit: navegar da listagem pro
  detalhe da vaga pública (mesmo componente, parâmetro de rota opcional)
  causava `Cannot read properties of null` no primeiro render após a
  navegação — ver detalhes em `docs/MANUAL_TECNICO.md`, seção 6.2 (Fase 5).

### Observação
- Fase 4 (módulo contábil) foi **adiada a pedido do cliente**, que vai
  definir o escopo dela numa fase final separada — o roadmap seguiu direto
  pra Fase 5.

## [2.3.24] — Corrigido campo "Valor (R$)" quebrando o Painel Financeiro — 2026-09-14

### Corrigido
- **Causa raiz encontrada e corrigida**: os campos de valor monetário
  (Contas a Pagar/Receber, Produtos) aceitavam texto livre em vez de só
  números. Digitar no formato brasileiro comum ("150,00", com vírgula)
  causava dois problemas: o valor aparecia como "R$ 0,00" na lista mesmo
  depois de salvo, e o Painel Financeiro parava de funcionar inteiro com
  Internal Server Error assim que existisse um registro salvo nesse
  formato (o `SUM()` do relatório quebrava com um único valor mal
  formatado).
- Campos de valor agora são numéricos (`type="number"`) no formulário —
  não é mais possível digitar vírgula por engano.
- O cálculo dos relatórios agora ignora valores mal formatados (conta como
  zero) em vez de quebrar a consulta inteira — registros antigos com valor
  incorreto continuam aparecendo normalmente na lista e podem ser
  corrigidos editando e salvando de novo.

### Documentado
- Registrado em `docs/MANUAL_TECNICO.md` um incidente de deploy encontrado
  durante o suporte desta versão: o `.sequelizerc` aponta as migrações pra
  pasta compilada (`dist/`), então um build de backend incompleto pode
  fazer `db:migrate` reportar "tudo atualizado" mesmo com tabelas
  inteiras faltando no banco. Documentado o diagnóstico e a correção
  (rebuild completo do zero) para referência futura.

## [2.3.23] — Módulo fiscal agora é um add-on de plano separado — 2026-09-14

### Adicionado
- **`Plan.useFiscal`**: novo flag de plano, separado do Financeiro
  (`useFinancial`) — o Master decide, plano por plano, se ele inclui o
  módulo fiscal (Vendas + emissão de NF-e/NFC-e/NFS-e), com um toggle
  próprio no editor de planos ("Fiscal — NF-e/NFC-e/NFS-e (add-on)").
  Sempre exige o Financeiro também ativo no mesmo plano.
- **`GET /fiscal/access`**: novo endpoint (mesmo padrão do
  `/finance/access`) — o frontend usa pra decidir se mostra as abas Vendas
  e Configuração Fiscal, em vez de deixá-las visíveis e só bloqueadas no
  backend.

### Corrigido
- O módulo fiscal (lançado na v2.3.22) reaproveitava o gate de acesso do
  Financeiro sem nenhum controle próprio — o Master não tinha como
  vender/liberar o fiscal separado do Financeiro. Corrigido com o flag de
  plano dedicado acima.

## [2.3.22] — Fase 3 do roadmap iniciada: módulo fiscal (NF-e/NFC-e/NFS-e) — 2026-09-14

### Adicionado
- **Vendas** (nova aba no Financeiro): cadastro de venda com itens
  discriminados (produto/serviço, quantidade, NCM, CFOP, valor unitário) —
  necessário porque nota fiscal exige itens, e Contas a Receber (Fase 2) é
  só um valor total. Confirmar uma venda gera automaticamente a conta a
  receber correspondente e trava os itens (não editáveis depois).
- **Configuração Fiscal** (nova aba no Financeiro): regime tributário
  (MEI/Simples/Presumido/Real), inscrição estadual/municipal, CNAE, código
  do município, e credenciais do gateway de emissão — configurado pelo
  Admin de cada empresa-cliente (o token é da própria empresa, emite em
  nome do CNPJ dela).
- **Emissão de NF-e/NFC-e/NFS-e** via gateway Focus NFe, direto de uma
  venda confirmada. Histórico completo de tentativas de emissão (número,
  chave de acesso, status, erros do gateway) fica salvo por venda.
- Migrações para as 4 novas tabelas (`FiscalConfigs`, `Sales`, `SaleItems`,
  `FiscalDocuments`) — **rodar `npm run db:migrate` no deploy desta
  versão**.

### ⚠️ Atenção antes de emitir a primeira nota em produção
O adapter do gateway (Focus NFe) foi implementado a partir da documentação
pública, mas não foi validado contra uma chave de sandbox real nesta
sessão de desenvolvimento (sem acesso a credenciais). O fluxo completo
funciona e a comunicação HTTP com o gateway foi confirmada, mas os nomes
exatos de alguns campos do payload podem precisar de ajuste fino na
primeira emissão de teste real — ver detalhes e o que ajustar em
`docs/MANUAL_TECNICO.md`, seção 6.2 (Fase 3).

## [2.3.21] — Corrigido "não aparece o plano" em Minha assinatura — 2026-09-14

### Corrigido
- **Causa raiz encontrada e corrigida**: em "Minha assinatura", os dados do
  plano contratado (nome, usuários, conexões, filas, valor) só eram exibidos
  DENTRO de cada linha da tabela de faturas — e faturas só são criadas pelo
  sistema quando faltam menos de 20 dias para o vencimento da empresa.
  Resultado: qualquer empresa nova, ou fora dessa janela de 20 dias, tinha
  zero faturas e a tela ficava completamente vazia, como se não tivesse
  plano nenhum — mesmo tendo um plano válido contratado.
- Corrigido adicionando um cartão "Plano atual" que aparece sempre que a
  empresa tem um plano vinculado, independente de já existir fatura emitida.
  A lista de faturas agora também mostra uma mensagem clara ("Nenhuma fatura
  emitida ainda...") em vez de ficar em branco.
- Corrigido um crash no backend (`PlanController`) que acontecia ao consultar
  o plano de uma empresa sem plano vinculado (erro 500 em vez da mensagem
  esperada).
- Removida uma chamada de rede redundante e frágil que buscava o plano numa
  segunda requisição — os dados já vinham na primeira.
- Corrigido um erro relacionado no menu lateral (acontecia em toda tela, não
  só na assinatura, para empresas sem plano vinculado — silencioso mas
  gerava erro no console).

## [2.3.20] — Fase 2 do Financeiro concluída (frontend) — 2026-09-14

### Adicionado — Fase 2 do módulo Financeiro (frontend)
- **Abas "Contas a Pagar" e "Contas a Receber"** na navegação lateral do
  Financeiro: listagem com filtro por status (Pendente/Pago(a)/Vencido —
  calculado no frontend a partir do vencimento), busca, cadastro/edição em
  modal e exclusão — mesmo padrão visual da Fase 1 (Clientes/Fornecedores/
  Produtos).
- **Seletor de fornecedor/cliente** nos formulários de conta a pagar/receber:
  novo tipo de campo "asyncSelect" no `FinanceRecordModal`, que busca a lista
  (fornecedores ou clientes já cadastrados) assim que o modal abre.
- **Painel Financeiro** (nova aba): 7 cartões de resumo, gráfico de fluxo de
  caixa (Receitas x Despesas, últimos 6 meses) e gráfico de despesas por
  categoria — construídos com `recharts` seguindo a skill de `dataviz` do
  projeto (paleta categórica validada, cor fixa por identidade, rótulo direto
  em toda barra, sem eixo duplo).
- **Exportação/impressão dos relatórios**: botão "Imprimir / Exportar PDF" no
  Painel Financeiro (`window.print()` + CSS `@media print` dedicado — só a
  área do painel vai pro papel, o resto da tela fica de fora).

### Corrigido
- Campo tipo `date` e validação genérica no `FinanceRecordModal`: o schema de
  validação era fixo em exigir um campo `name`, o que bloqueava silenciosamente
  o cadastro de contas (que usam `description`, não `name`).
- **Bug de troca de aba (já existia desde a Fase 1, não percebido até agora)**:
  trocar de aba dentro do Financeiro não recarregava os dados — a lista
  continuava mostrando os registros da aba anterior, porque o fetch (memoizado
  via `useCallback`) não tinha o recurso de dados nas suas dependências.
  Corrigido com `resource` nas deps do fetch e `key={financeTab}` em cada lista,
  forçando estado limpo a cada troca.
- Rótulo direto cortado na barra de maior valor do gráfico de despesas por
  categoria (faltava folga no domínio do eixo).
- Cartão de resumo "vencido" não deveria ficar em vermelho quando o valor é
  zero (nada vencido, nada a destacar).

## [2.3.19] — Fase 2 do Financeiro (backend) + permissão "Módulo Financeiro" respeitando o plano — 2026-09-14

### Adicionado — Fase 2 do módulo Financeiro (backend)
- **Contas a pagar** (`FinanceExpense`): descrição, categoria, tipo de custo
  (fixo/variável), valor, vencimento, data de pagamento, status
  (pendente/pago), fornecedor (opcional) e observações. CRUD completo em
  `/finance/expenses`.
- **Contas a receber** (`FinanceReceivable`): descrição, valor, vencimento,
  data de recebimento, status (pendente/recebido), cliente (opcional) e
  observações. CRUD completo em `/finance/receivables`.
- **Relatórios** (`/finance/reports/summary`, `/cashflow`, `/expenses-by-category`):
  cartões de resumo (pendências, vencidos, pago/recebido no mês, saldo
  previsto), série de fluxo de caixa dos últimos N meses e despesas agrupadas
  por categoria.
- Migrações `20260914150000-create-finance-expenses` e
  `20260914150100-create-finance-receivables` — **rodar `npm run db:migrate`
  no deploy desta versão**.
- Frontend (tabs "Contas a Pagar"/"Contas a Receber", painel com gráficos e
  exportação em PDF) fica para a próxima entrega — ver seção 6.2 do
  `docs/MANUAL_TECNICO.md`.

### Corrigido
- **Permissão "Módulo Financeiro" aparecia mesmo fora do plano contratado**:
  o Admin de uma empresa com um plano que **não** inclui o add-on Financeiro
  (ex.: um plano mais básico) via, na aba Permissões do cadastro de usuário,
  a opção de habilitar o módulo mesmo assim — o acesso real já era bloqueado
  no backend, mas a opção ficava visivelmente "aberta" na UI, dando a
  impressão de que dava pra ligar algo que a empresa não contratou. Corrigido
  ocultando o toggle quando o plano da empresa não inclui o módulo
  (`GET /finance/access` → `planHasModule`).
- Corrigido erro de tipagem/SQL no `FinanceReportService`: `SUM()` sobre a
  coluna `value` (salva como `varchar` de propósito, pra evitar imprecisão de
  ponto flutuante) quebrava no Postgres (`42883: function sum(character
  varying) does not exist`) — corrigido com `CAST(... AS NUMERIC)` explícito
  em todas as agregações.

## [2.3.18] — Corrigida a causa raiz da logo/nome "desconfigurando" no F5 — 2026-09-14

### Corrigido — bug crítico, arquitetural
- **Causa raiz encontrada e corrigida**: a logo/nome exibidos no menu lateral
  (canto superior esquerdo) vinham de `frontend/src/App.js`, que buscava o
  branding pela rota **pública** `/public-settings/:key` — hardcoded na
  empresa 1 no backend (`GetPublicSettingService`). Isso funcionava certo
  só pra quem estava logado na empresa 1; qualquer Admin de **outra**
  empresa configurava a própria logo/nome (que salvava certo no banco, na
  empresa dele), via corretamente a mudança na hora (só na memória), mas ao
  dar F5 a tela recarregava o branding da empresa 1 (ou o padrão) por cima —
  parecia que "desconfigurava". Esse era um problema **já documentado como
  limitação conhecida** desde etapas anteriores desta sessão, nunca
  corrigido de fato até agora.
- Corrigido: `App.js` agora busca o branding pela rota **autenticada**
  `/settings` (já corretamente escopada por `companyId`) sempre que há uma
  sessão logada, com fallback pra rota pública só quando não há login (ex.:
  tela de login/signup) ou se a chamada autenticada falhar.
- Como a SPA não recarrega a página ao fazer login (é só uma troca de rota),
  o efeito de branding do `App.js` — que roda uma vez só, no primeiro
  carregamento da aba — não seria re-executado depois de um login sem F5.
  Resolvido com um evento (`frontend/src/utils/brandingEvents.js`) disparado
  pelo `useAuth.js` logo após o login, que o `App.js` escuta pra rebuscar o
  branding imediatamente — sem precisar de um F5 pra ver a logo certa
  pela primeira vez.
- Testado ponta a ponta com uma segunda empresa (não a 1): configurar
  nome/logo, aparece certo na hora, continua certo depois de deslogar e
  logar de novo, e continua certo depois de um F5.

### Adicionado
- Botão **"Salvar"** explícito na seção Identidade da empresa
  (Configurações → Opções), além do salvamento automático (debounce +
  onBlur + upload imediato) — dá uma confirmação visual/manual de que
  ficou salvo, com toast de sucesso sempre que clicado.

### Alterado
- Módulo Financeiro (Clientes/Fornecedores/Produtos, e Painel SaaS pro
  Master): navegação mudou de abas horizontais no topo pra abas
  **verticais/laterais** à esquerda, com o conteúdo ao lado.

## [2.3.17] — Tela de "Minha assinatura" travava em empresa sem plano — 2026-09-14

### Corrigido
- Empresas cadastradas **antes** da correção da v2.3.15 (que passou a
  exigir plano no cadastro) podem já estar sem `planId` vinculado no banco.
  Nesse caso, Configurações → Assinatura ficava com a tela em branco/
  carregando pra sempre — o componente só marcava o carregamento como
  concluído depois de buscar o plano, e sem `planId` essa busca nunca
  acontecia. Corrigido: agora o carregamento é marcado como concluído
  independente de a empresa ter plano ou não, e sem plano aparece um aviso
  claro ("Nenhum plano vinculado") com o botão de suporte, em vez de tela
  em branco. `frontend/src/components/Settings/SubscriptionPanel.js`.
- **Se algum cliente relatar essa tela em branco**: a causa é a empresa dele
  estar sem plano no banco. Verificar com
  `SELECT id, name, email, "planId" FROM "Companies" WHERE email = '<email da empresa>';`
  e, se `planId` vier `NULL`, vincular um plano existente com
  `UPDATE "Companies" SET "planId" = <id do plano> WHERE id = <id da empresa>;`.

## [2.3.16] — Alerta de vencimento da assinatura no Dashboard — 2026-09-14

### Adicionado
- Banner de vencimento da assinatura no topo do **Dashboard**, visível pro
  Admin de cada empresa: aviso amarelo quando faltam até 7 dias pro
  vencimento, vermelho quando já venceu — com botão "Ver assinatura" que
  leva direto pra Configurações → Assinatura. Novo componente
  `frontend/src/components/SubscriptionDueBanner/index.js`.

### Observação — infraestrutura de cobrança já existente
- Investigando o pedido de "notificar por e-mail e WhatsApp quando a
  empresa estiver perto do vencimento", encontrei que **isso já existe e
  está funcionando** desde antes desta sessão: `backend/src/queues.ts`
  (`handleBillingNotifications`) roda todo dia às 9h15 e, se habilitado em
  Painel SaaS → Configurações, envia e-mail (pro `Company.email` — o e-mail
  único da empresa, compartilhado por todos os usuários dela, exatamente
  como descrito) e WhatsApp (criando inclusive um ticket de verdade no CRM)
  quando falta o número configurado de dias (`billingDueDaysBefore`,
  padrão 3) pro vencimento da fatura em aberto. Deduplicação por dia via
  `Setting`, então não manda duas vezes no mesmo dia. **Vem desabilitado
  por padrão** — o Master precisa ligar os dois toggles em Painel SaaS →
  Configurações → seção de cobrança.
- O que era novo, e foi adicionado agora: o alerta **dentro do sistema**
  (Dashboard). Ainda não adicionado ao sino de notificações (risco de
  mexer numa peça grande/tempo-real do sistema por um ganho incremental
  pequeno, já que o Dashboard cobre o pedido "sair no dashboard").

## [2.3.15] — Master com acesso completo ao sistema + plano obrigatório na empresa — 2026-09-14

### Alterado
- **Master agora tem acesso a todas as funcionalidades do sistema**, no
  próprio ambiente dele (companyId 1) — sem depender do plano da própria
  empresa dele ter cada recurso habilitado. Isso nunca dá acesso aos dados
  de uma empresa-cliente real: tudo continua isolado por `companyId`, então
  o Master só está testando/usando o próprio ambiente, "mascarado" das
  configurações reais de quem comprou o sistema.
  - `frontend/src/layout/MainListItems.js`: menu (Kanban, Campanhas, IA,
    Integrações, Agendamentos, Chat Interno, API Externa) não depende mais
    do plano da empresa do Master.
  - `backend/src/services/FinanceService/EnsureFinancialAccess.ts`: Master
    tem acesso ao módulo Financeiro (Fase 1) sem precisar que o próprio
    plano tenha o add-on habilitado.
  - `frontend/src/components/Settings/Options.js` e `Whitelabel.js`: seção
    "Identidade da empresa" voltou a aparecer pro Master (volta atrás da
    restrição da v2.3.10 — o motivo daquela restrição, "Master não deveria
    configurar identidade", segue válido pra empresas-clientes reais, mas
    não impede o Master de configurar a identidade do próprio ambiente
    dele).
  - `frontend/src/pages/Financeiro/index.js`: Master agora vê uma aba
    "Painel SaaS" (cobrança de todas as empresas-clientes, exclusivo dele)
    junto com Clientes/Fornecedores/Produtos (dados só da própria empresa
    dele) — antes só via o Painel SaaS, sem alcançar o módulo operacional.

### Corrigido
- **Empresa podia ficar sem plano vinculado**: o campo "Plano" no cadastro
  de empresa (Configurações → Empresas) tinha `required` só visual (o
  `Select` do MUI não bloqueia o envio sozinho) — dava pra cadastrar uma
  empresa sem plano nenhum. Agora bloqueado em duas camadas: o front avisa
  e não envia sem selecionar um plano, e o backend
  (`CreateCompanyService`) recusa criar a empresa sem `planId` mesmo que
  a chamada venha direto da API.

### Adicionado
- Cadastro de clientes/fornecedores do módulo Financeiro ganhou a opção
  **RUC** (Registro Único de Contribuyentes, documento fiscal do Paraguai)
  ao lado de CPF/CNPJ.

## [2.3.14] — "Minha assinatura" movida pra Configurações + correção de salvamento — 2026-09-14

### Corrigido
- **Nome/logo da empresa "desconfigurava" depois de F5**: em Configurações →
  Identidade da empresa, o campo "Nome do sistema"/"Nome da empresa" só
  salvava no evento `onBlur` (sair do campo). Digitar e apertar F5 (ou trocar
  de aba) antes do campo perder o foco fazia a alteração nunca chegar a ser
  enviada pro backend — parecia que "não salvava". Agora o nome também salva
  automaticamente ~900ms depois de parar de digitar (debounce), além de ao
  sair do campo, então não depende mais do usuário clicar em outro lugar
  antes de recarregar a página. (O upload de logo em si já salvava
  imediatamente ao escolher o arquivo — não precisava desse ajuste.)

### Alterado
- **"Minha assinatura" saiu do módulo Financeiro e foi para Configurações**:
  não fazia sentido a fatura/plano do AtendeFlow ficar misturada com os
  cadastros operacionais da própria empresa (clientes/fornecedores/produtos).
  Agora é uma aba própria, "Assinatura", em Configurações (ao lado de
  "Opções") — mostra o plano contratado, usuários/conexões/filas, valor e
  vencimento, com a marca **Confianza Technologies** (fornecedora do sistema,
  quem emite a cobrança) no topo do painel.
- Módulo Financeiro (`/financeiro`) agora é só sobre a operação da própria
  empresa: abas Clientes/Fornecedores/Produtos. Empresas sem o módulo
  contratado veem uma tela explicando que é um add-on separado.
- Adicionados ao painel de assinatura: botão **"Renovar plano"** (reaproveita
  o fluxo de pagamento já existente, usando a fatura mais recente) e botão
  **"Suporte"** com o WhatsApp da Confianza Technologies (+595 986 283927,
  ícone do WhatsApp).
- O link do menu lateral exibido quando a assinatura da empresa vence
  (`isSubscriptionExpired`) agora aponta pra Configurações → Assinatura em
  vez de Financeiro. Como Configurações é bloqueada pro perfil "user", esse
  link só aparece pro Admin; um funcionário comum vê um aviso simples pra
  procurar o administrador, em vez de um link que resultaria em acesso
  negado.
- Novo componente `frontend/src/components/Settings/SubscriptionPanel.js`
  (extraído do antigo `pages/Financeiro/index.js`, mesma lógica/UI, sem
  mudança funcional além do cabeçalho novo com logo/botões).

## [2.3.13] — Módulo Financeiro, Fase 1: cadastros de clientes/fornecedores/produtos — 2026-09-14

### Adicionado
- **Módulo Financeiro completo — add-on pago** (Fase 1 do roadmap, ver
  `docs/MANUAL_TECNICO.md`, seção 6.2): cadastro de clientes, fornecedores e
  produtos/serviços, cada um com listagem (busca + paginação), criação, edição
  e exclusão. Aparece como novas abas ("Clientes", "Fornecedores", "Produtos")
  dentro do item de menu "Financeiro", ao lado de "Minha assinatura".
- **Permissionamento em duas camadas**, exatamente como definido:
  - **Master libera por plano**: nova opção "Financeiro (add-on)" na tela
    Configurações → Planos (`Plan.useFinancial`), desligada por padrão em
    planos existentes e novos — o Master decide em qual(is) plano(s) o
    módulo entra.
  - **Admin da empresa libera por usuário**: nova permissão "Módulo
    Financeiro" na aba Permissões do cadastro de usuário
    (`User.financialAccess`) — só tem efeito se o plano da empresa incluir o
    módulo. Admin da empresa sempre tem acesso quando o módulo está ativo,
    independente desse campo; o Master nunca tem acesso (não opera empresa
    nenhuma — mesma regra de v2.3.10/2.3.11).
- Backend: modelos `FinanceCustomer`, `FinanceSupplier`, `FinanceProduct`
  (todos escopados por `companyId`), endpoints REST em `/finance/customers`,
  `/finance/suppliers`, `/finance/products` e `/finance/access` (status de
  acesso, usado pelo frontend pra decidir o que mostrar).
- Testado ponta a ponta (login, criar/listar/editar/excluir nas três
  telas, toggle de plano no Master, toggle de usuário no Admin) antes do
  commit.

### Observação
- Isso é só a Fase 1 (cadastros) do roadmap do módulo Financeiro. Fases
  seguintes (custos/relatórios, fiscal/NF-e, contábil, RH) continuam
  documentadas em `docs/MANUAL_TECNICO.md`, seção 6.2, e dependem de
  decisões de arquitetura (gateway de NF-e, integração contábil) antes de
  começar.

## [2.3.12] — Painel SaaS movido para dentro do módulo Financeiro — 2026-09-14

### Alterado
- O item de menu separado "Painel SaaS" foi removido. O Master agora acessa as
  mesmas telas (Dashboard, Financeiro do sistema, Meios de pagamento,
  Configurações, WuzAPI) pelo item **"Financeiro"** do menu — para o Master,
  essa tela mostra o Painel SaaS; para Admin/usuário de uma empresa, continua
  mostrando a fatura/assinatura da própria empresa (comportamento inalterado).
  Isso prepara o terreno para o módulo Financeiro completo que está sendo
  planejado (cadastro de clientes/fornecedores/produtos, custos, relatórios,
  módulo fiscal/NFe, contábil e de RH — ver `docs/MANUAL_TECNICO.md`, seção
  "Roadmap — módulo Financeiro completo").
- `frontend/src/pages/Financeiro/index.js`: passou a renderizar `<GlobalConfig />`
  quando `user.super` é verdadeiro, antes do JSX de fatura da empresa.
- Rota `/global-config` continua existindo (compatibilidade), mas não tem mais
  link direto no menu.

## [2.3.11] — Painel SaaS (cobranças) 100% exclusivo do Master — 2026-09-14

### Corrigido
- **Falha de permissão no backend**: `GlobalConfigController.ts` liberava o Painel
  SaaS (Dashboard, Financeiro, cobranças, upload de branding do login etc.) não só
  para o Master (`super`), mas também para **qualquer Admin da empresa de id 1**
  (`profile === "admin" && companyId === 1`) — resquício de uma versão anterior do
  sistema, sem o conceito de Master. Como o Master é sempre a própria empresa 1,
  se essa empresa fosse liberada para uma empresa-cliente real (em vez de ficar
  reservada só pro Master), o Admin dela teria acesso indevido ao módulo de
  cobrança do sistema inteiro (`dashboardSummary`, `financialSummary`,
  `financialInvoices`, `financialCompanies`, `update`/`index` das configs globais,
  upload/remoção de logo do login, testes de e-mail/WhatsApp de cobrança).
- Todas as checagens de permissão do arquivo (6 no total, incluindo o helper
  `hasGlobalConfigPermission`) agora exigem só `isSuper` — Painel SaaS é
  exclusivo do Master, que é quem emite as cobranças mensais/anuais das
  empresas-clientes (conforme o plano escolhido, mensal ou anual).

## [2.3.10] — Master não vê identidade de empresa (só libera acessos) — 2026-09-14

### Alterado
- Esclarecimento de papel: o **Master** é quem libera/administra as licenças das
  empresas que compram o AtendeFlow (cadastra empresa, admin e plano em
  Configurações → Empresas / Painel SaaS) — ele não opera nenhuma empresa-cliente.
  Quem configura nome, logomarca e cores da empresa é sempre o **Admin daquela
  empresa** que adquiriu o sistema.
- `frontend/src/components/Settings/Options.js` e
  `frontend/src/components/Settings/Whitelabel.js`: a seção "Identidade da empresa
  (White Label)" deixou de aparecer para o Master (mesmo tendo `profile: "admin"`)
  — agora exige `profile === "admin" && !super`. O Master continua vendo apenas a
  seção "Login / capa" (compartilhada por todas as empresas, usada na tela de
  login) e as abas de gestão de Empresas/Planos.
- `Whitelabel.js` ganhou a prop `loginOnly`, usada quando o componente é
  renderizado só para a seção Login/Capa (sem duplicar a checagem de identidade).

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
