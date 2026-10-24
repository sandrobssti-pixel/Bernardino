# Changelog — AtendeFlow

Todas as etapas de desenvolvimento do projeto são registradas aqui, na ordem em que foram entregues.
Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [2.3.208] — Corrige busca de fornecedor no cadastro de Produto — 2026-10-24

### Corrigido
- **Campo "Distribuidor / Fornecedor Principal" no cadastro de Produto
  nunca retornava nenhum resultado ao digitar**, mesmo com fornecedores
  cadastrados (relatado pelo cliente: "quando digita fornecedor não
  aparece os cadastrados"). Causa raiz: a aba Produtos do Financeiro não
  estava passando os dados de acesso ao backend (`finance`) pro
  formulário de edição — o mesmo problema também deixava a seção "Armas
  deste modelo" (número de série) sem conseguir listar/salvar unidades
  corretamente. Um `finance={finance}` faltando numa única linha.

### Técnico
- Migration preparatória (sem uso ainda no código): `SaleItems` ganhou
  cópia dos 13 campos de ICMS/CSOSN/IBPT do Produto, como primeiro passo
  pra possivelmente tornar esses campos editáveis por item de Venda —
  pausado a pedido do cliente pra esclarecer antes se os dados fiscais
  de SAÍDA devem mesmo sair do cadastro de Produto (pedido de manhã) ou
  ficar lá (sugestão de um prompt de contador que o cliente trouxe à
  tarde) — ver docs/MANUAL_TECNICO.md, seção 188.

## [2.3.207] — Venda de arma por número de série (Etapa 2) — baixa só na emissão da nota — 2026-10-24

### Adicionado
- **Item de Venda do tipo Arma agora escolhe a UNIDADE (número de
  série) cadastrada no SKU**, em vez de só a quantidade — pedido do
  cliente: "quando for vender o operador vai visualizar quanto tem em
  estoque e quantas armas tem com número de série liberados naquele
  código de produto". A tela de Venda mostra quantas unidades estão
  disponíveis e lista os números de série pra escolher; SIGMA/SINARM
  vem auto-preenchido da unidade escolhida.
- **A baixa definitiva do estoque disponível só acontece quando a nota
  fiscal daquela venda é REALMENTE autorizada pelo gateway** (Focus
  NFe) — não na confirmação da venda. Entre confirmar a venda e a nota
  ser emitida, a unidade fica "reservada" (ninguém mais pode escolhê-
  la, mas ainda não é baixa definitiva). Cancelar a venda (antes ou
  depois da nota) devolve a unidade pro estoque disponível, igual já
  acontecia pro resto do sistema.
- Bloqueio de corrida: duas vendas não podem reservar a mesma unidade
  (a segunda recebe erro claro "arma não disponível pra venda").
  Excluir uma unidade presa numa venda (reservada ou já vendida) também
  é bloqueado — precisa cancelar a venda primeiro.

### Técnico
- Etapa autorizada em chat direto com o cliente (não por relay cross-
  session, diferente da Etapa 1) — ver docs/MANUAL_TECNICO.md, seção
  186. Munição/insumo continua com os campos manuais de sempre (sem
  sub-cadastro por lote ainda — próxima entrega).

## [2.3.206] — Cadastro de Produto (arma/munição) só com dados de produto + corrige erro ao editar — 2026-10-23

### Corrigido
- **Erro interno ao editar Produto e salvar** continuava acontecendo (ex.:
  SKU 75008418) mesmo depois da v2.3.204 — aquela correção só cobria 4
  campos numéricos específicos de arma (capacidade de cartuchos,
  quantidade/comprimento de cano, energia cinética). O cadastro de
  Produto tem várias outras colunas numéricas (peso, estoque reservado/
  ideal/por lote, pontos de fidelidade/troca, quantidade em estoque) que
  quebravam do mesmo jeito ao ficar em branco. Corrigido de forma
  abrangente: toda coluna numérica de Produto agora trata "" (campo
  vazio) corretamente — como `null` nas que aceitam (peso, estoque
  mínimo, campos de arma) ou como `0` nas que são obrigatórias no banco
  (estoque, estoque reservado/ideal/por lote, pontos).

### Alterado
- **Cadastro de Produto do tipo Arma/Munição voltou a ser só dado de
  produto + especificação técnica**, como pedido pelo cliente (clube de
  tiro): removidos da tela, só pra esse tipo, os campos que não têm
  nenhum uso na emissão real da nota fiscal nem fazem sentido num
  cadastro de arma — Alíquota de imposto (dashboard), Reforma Tributária
  (IVA 2027) inteira, toda a seção "Dados Gerais — Complementares" (GTIN,
  código original, cor/tamanho, categorias, tabelas de preço 2-5,
  estoque reservado/ideal/por lote, comissão, margem de desconto, pontos
  de fidelidade/troca) e 8 campos de "Dados Fiscais" sem equivalente na
  nota real (ICMS ECF, Un. Medida Trib., CFOP Principal/Fora UF, Artigo,
  Cód. Benefício Fiscal, FCP, Desconto Condicional). Confirmado campo a
  campo contra 2 notas fiscais reais do cliente (uma de arma, uma de
  munição): os 13 campos de ICMS/CSOSN/IBPT que a nota de verdade usa
  continuam no cadastro (sem equivalente na tela de Venda hoje); todo o
  resto só aparece pra produto/serviço comum. Produto/serviço comum não
  muda em nada.
- Revisão do próprio cliente sobre o corte acima: "Controle por Lote" e
  "Equipamento" continuam fazendo sentido pra arma/munição — voltaram a
  aparecer (só "Produto Composto"/"Matéria Prima" saem). "Controlar
  estoque"/estoque/estoque mínimo **não foram tocados** — continuam
  exatamente como já funcionavam, porque desligar isso pra arma
  desativaria o bloqueio de venda sem estoque disponível
  (`SaleService.ensureStockAvailable`/`adjustStock`, que dependem de
  `controlStock` ligado pra descontar/checar estoque na Venda).

## [2.3.205] — Cadastro de arma por unidade (número de série) — Etapa 1 — 2026-10-23

### Adicionado
- **Produto-arma passa a ser o MODELO (SKU), não mais 1 arma física por
  linha.** Até aqui, cada arma física entrava como um cadastro de Produto
  inteiro — mesmo SKU repetido em cada uma, cada uma com seu número de
  série. Pedido do cliente: um SKU com 10 armas em estoque precisava de um
  jeito de cadastrar as 10 sem duplicar o produto inteiro a cada uma.
  Agora o Produto representa o modelo (nome, calibre, capacidade etc.), e
  cada arma física entra como uma **unidade** dentro dele — só o número de
  série é obrigatório pra cadastrar uma (registro SIGMA/SINARM, situação e
  observações são opcionais). Tela de editar Produto ganhou uma seção
  "Armas deste modelo" pra listar/adicionar/editar/excluir as unidades,
  com cadastro também **em lote** (colar lista de números de série).
- `stockQuantity` do produto-arma passa a ser recalculado automaticamente
  (contagem de unidades "em estoque") a cada unidade criada/alterada/
  excluída — alimenta o painel e o aviso de estoque baixo que já existiam.
- Histórico mínimo por unidade (evento "entrada" ao cadastrar), já
  preparado pra registrar venda/devolução/baixa numa etapa futura.
- Busca por nome do modelo, SKU ou número de série (endpoint novo,
  `/finance/weapon-units/search`).
- Importação de planilha de armas: linhas com o mesmo SKU (mesmo modelo,
  números de série diferentes) agora criam uma unidade por linha dentro do
  mesmo Produto, em vez de a última linha importada sobrescrever o número
  de série da anterior.
- Produto-arma já cadastrado **fica exatamente como está** — a migration
  só cria a unidade correspondente quando já tiver número de série
  preenchido, sem apagar nem consolidar nenhum produto.

### Fora desta etapa (autorização separada)
Integração com a tela de Venda (vender por número de série) e relatório
por arma/geral ficam pra próximas etapas — não implementadas aqui.

### Técnico
- Novo modelo/tabela `FinanceWeaponUnit`/`FinanceWeaponUnits` +
  `FinanceWeaponUnitEvent`/`FinanceWeaponUnitEvents` (ver
  `backend/src/models/`, `FinanceWeaponUnitService.ts`). Testado contra
  Postgres real nesta sessão: migração rodada com produtos-arma de SKU
  duplicado já existentes (nenhum apagado, cada um virou sua própria
  unidade), idempotência, cadastro em lote com duplicata detectada,
  recálculo de `stockQuantity`, log de evento.
- Uma primeira versão desta mudança, implementada antes da autorização
  chegar a esta sessão, incluía uma migration que **consolidava
  (apagava) produtos duplicados pelo mesmo SKU** e integração completa
  com a Venda — nenhuma das duas estava autorizada (a migration violava
  "nada destrutivo em produção"). Nada disso chegou a ser implantado
  (deploy é manual, via Coolify); foi revertido antes do commit final
  descrito aqui.
- Ver docs/MANUAL_TECNICO.md, seção 184, pra detalhe completo.

## [2.3.204] — Erro interno ao editar arma com campo numérico em branco — 2026-10-23

### Corrigido
- Editar/cadastrar um produto do tipo "Arma" dava erro interno ao salvar
  sempre que um dos campos numéricos (Capacidade de cartuchos,
  Quantidade de canos, Comprimento do cano, Energia cinética da munição)
  ficava em branco — o formulário manda `""` nesse caso, e o Postgres
  rejeita string vazia numa coluna INTEGER/FLOAT (erro de sintaxe, sem
  mensagem amigável nenhuma pro usuário). Esses campos são opcionais no
  banco (só a arma física tem número de série obrigatório), então agora
  `""` é convertido pra `null` antes de salvar — mesmo padrão já usado em
  outros cadastros deste sistema (data de nascimento do usuário, fila
  seguinte da etiqueta) pra campo numérico/opcional vindo vazio do
  formulário. Reportado pelo cliente no cadastro da arma SKU 10034336.

## [2.3.203] — IA não voltava a responder cliente que já tinha sido atendido antes — 2026-10-23

### Corrigido
- Quando um ticket é fechado com avaliação (NPS) pendente, ele fica em
  status "aguardando avaliação" indefinidamente se o cliente nunca
  avalia (o caso mais comum) — e se esse mesmo cliente mandasse uma
  mensagem nova depois (no mesmo dia ou outro dia), a IA nunca
  respondia, porque o ticket reaproveitado ainda tinha a fila e o
  atendente do atendimento anterior gravados nele. Agora, ao chegar uma
  mensagem nova que não é uma nota de avaliação, esse ticket é reaberto
  como atendimento novo de verdade — fila e atendente antigos são
  limpos, status volta pra "pendente" — sem apagar nada: é o mesmo
  ticket, mesmo histórico de mensagens, só os campos de atribuição que
  mudam. A IA volta a fazer o primeiro atendimento normalmente.
- O build do frontend da v2.3.202 quebrava (`'SmartToy' is not exported
  from '@material-ui/icons'`) — ícone que só existe no Material-UI v5,
  este projeto usa v4. Trocado por `AssistantOutlined` (já usado em
  outra tela deste mesmo módulo).

## [2.3.202] — Testar agente + Números sem IA — 2026-10-23

### Adicionado
- **Testar agente**: botão novo na lista de Assistentes de IA abre um chat
  de teste interno — simula a personalidade/instruções do agente sem
  mandar nada pelo WhatsApp e sem gerar ticket/contato nenhum. Usa a
  mesma chave/modelo/provedor configurados no Prompt.
- **Números sem IA**: nova aba na tela Assistente IA pra cadastrar números
  que nunca recebem resposta automática da IA (conexão ou nó do
  Flowbuilder) — o atendimento humano continua normal, só a IA não
  dispara pra esses números.

## [2.3.201] — Assistente IA da conexão não entregava resposta a contato via @lid — 2026-10-23

### Corrigido
- A IA configurada direto na conexão ("Assistente de IA") chamava a OpenAI
  normalmente (cobrando a chamada) mas a resposta nunca chegava no WhatsApp
  quando o contato chegava via identidade `@lid` (camada de privacidade
  nova do WhatsApp) — a resposta era mandada pro `@lid` bruto, que não é
  entregável, em vez do número real resolvido. O fluxo do Flowbuilder via
  Typebot já tinha essa correção; agora os dois caminhos de IA direto na
  conexão (`openai na conexão` e nó "openai" sem fila do Flowbuilder)
  aplicam a mesma correção antes de responder.

## [2.3.200] — Modal de conexões por empresa (admin) ficava sem jeito de fechar — 2026-10-23

### Corrigido
- A tela "Conexões" do Super Admin (clicar numa empresa pra ver as
  conexões dela) e a pré-visualização de "Lista de Botões" do Flowbuilder
  ficaram sem NENHUM jeito de fechar depois da v2.3.192 (que desligou
  fechar por clique fora/Esc em todo modal do sistema) — os dois nunca
  tiveram um botão de fechar próprio, contavam só com clique
  fora/Esc. Agora os dois têm botão de fechar explícito (X no título).

## [2.3.199] — Editar item em Arquivos da IA — 2026-10-23

### Adicionado
- A tela "Arquivos da IA" ganhou "Editar", além de Adicionar/Excluir que já
  existiam — dá pra corrigir nome, descrição ("quando enviar") e trocar o
  arquivo (ou o texto, pra item de texto) de qualquer item, sem precisar
  excluir e recadastrar. Editar o conteúdo (arquivo/texto) de um item que
  veio de uma Mensagem Rápida desvincula ele da sincronização automática —
  vira um item independente a partir daí, pra não correr o risco de uma
  edição futura na mensagem rápida original apagar sua edição manual sem
  avisar. Editar só nome/descrição não desvincula nada.

## [2.3.198] — Mensagens Rápidas espelhadas em Arquivos da IA — 2026-10-23

### Adicionado
- Toda Mensagem Rápida marcada como "geral" (empresa toda) agora é
  espelhada automaticamente em "Arquivos da IA" — texto, imagem ou
  vídeo — e fica disponível pra IA enviar durante o atendimento, sem
  precisar cadastrar tudo de novo manualmente. A sincronização é
  contínua: criar, editar ou trocar o anexo de uma mensagem rápida
  geral atualiza o espelho correspondente automaticamente; deixar de
  ser geral, ou apagar a mensagem rápida, remove o espelho. As
  mensagens rápidas originais continuam intactas e utilizáveis
  manualmente (é uma cópia, não uma mudança de lugar) — importante pra
  quem atende continuar podendo usá-las mesmo se o crédito da IA
  acabar. O campo "Quando a IA deve enviar" de cada item espelhado
  começa com um texto gerado a partir do atalho da mensagem rápida e
  nunca é sobrescrito depois — pode editar à vontade sem perder a
  edição numa sincronização futura. Mensagens rápidas já existentes
  (anteriores a essa versão) foram trazidas de uma vez no deploy.

### Adicionado
- A cópia da API key que o FlowBuilder guarda dentro de cada fluxo (nó
  "openai") agora também é cifrada — mesma proteção da tabela principal
  (v2.3.196), fechando o vazamento por completo. Fluxos já salvos foram
  cifrados automaticamente no deploy; o editor continua mostrando a
  chave normalmente ao abrir pra editar.

## [2.3.196] — API Key do Assistente IA cifrada no banco — 2026-10-23

### Adicionado
- A API key de cada Assistente IA (OpenAI/Gemini/DeepSeek/Groq) agora é
  cifrada no banco de dados (AES-256-GCM), não só escondida do navegador
  (v2.3.195). Chaves já salvas são cifradas automaticamente no deploy.
  Requer a variável de ambiente nova `PROMPT_API_KEY_ENCRYPTION_KEY`
  (gerar com `openssl rand -base64 32`) — sem ela, continua funcionando
  normalmente, só não cifra (avisa no log).

### Corrigido
- A chave de API de cada Assistente IA (OpenAI/Gemini/DeepSeek/Groq)
  voltava em texto puro em toda listagem, criação e edição — inclusive
  no evento em tempo real enviado pra todos os usuários conectados da
  empresa. Agora segue o mesmo padrão já usado no Resend: a chave nunca
  mais volta em texto puro pro navegador depois de salva; editar sem
  mexer no campo mantém a chave atual (só é obrigatório preencher ao
  criar um Assistente IA novo, ou se quiser trocar a chave existente).

## [2.3.194] — Código (SKU) com dropdown de busca ao vivo — 2026-10-22

### Corrigido
- O campo "Código (SKU)" do item da venda agora tem o mesmo dropdown de
  busca ao vivo do campo "Produto/serviço" — digita o código ou nome,
  aparece a lista filtrada, clica pra selecionar e preenche tudo
  automaticamente. Continua aceitando texto livre pra item avulso, sem
  produto vinculado.

## [2.3.193] — Razão social dedicada na nota + tributos automáticos — 2026-10-22

### Adicionado
- Campo novo "Razão social (só na nota fiscal)" em Configuração Fiscal
  — corrige de vez o nome errado saindo no DANFE sem precisar trocar o
  Nome da empresa (que é usado em todo o resto do AtendeFlow). Deixe
  vazio pra manter o comportamento de sempre (usa o Nome da empresa).
- Switch "Detalhar tributos no DANFe automaticamente" — confirmado com o
  suporte da Focus NFe: liga o parâmetro `discrimina_impostos` na conta
  da empresa lá, e a própria Focus passa a calcular e preencher sozinha
  o campo "V. Aprox. Tributos" (Lei da Transparência, 12.741/2012), sem
  precisar configurar nada a mais em cada venda.

### Corrigido
- Nenhum modal/painel do AtendeFlow (venda, cliente, usuário,
  configuração, qualquer tela) fecha mais sozinho ao clicar fora da
  caixa ou apertar Esc — pedido do cliente: operador saía pra outro app
  buscar informação, ao voltar o primeiro clique caía fora do modal e
  fechava tudo, perdendo o que já tinha digitado. Continua fechando
  normal pelos botões "Cancelar"/"Fechar"/"Salvar" de cada tela.

### Corrigido
- No item da venda, digitar o código (SKU) ou nome do produto agora
  busca e preenche os campos (descrição, NCM, unidade, preço, CFOP)
  enquanto digita, não só quando o campo perde o foco — e passou a
  aceitar tanto SKU quanto nome num único campo (antes só o campo
  "Produto/serviço" de cima buscava pelos dois). Se tiver mais de um
  produto parecido, não adivinha — mostra um aviso pra usar o campo de
  cima e escolher da lista.

## [2.3.190] — Auditoria de envio/reenvio de nota por e-mail — 2026-10-22

### Adicionado
- Toda vez que "Enviar por e-mail" é usado numa nota autorizada (envio
  ou reenvio), fica registrado quem pediu, quando, pra qual(is)
  e-mail(s) e se deu certo — novo ícone "Histórico de envios" ao lado do
  e-mail, mostra a lista completa.
- Validação de formato de e-mail antes de tentar enviar (além de exigir
  pelo menos um já existente).

## [2.3.189] — Cancelar nota fiscal cancela a venda e a conta a receber — 2026-10-21

### Adicionado
- Cancelar uma nota fiscal autorizada (cliente desistiu da compra, dentro
  do prazo que a Sefaz permite) agora também cancela a venda
  automaticamente — devolve o estoque e marca a conta a receber ligada
  como "Cancelado" (status novo, com aviso em "Observações" se já tinha
  sido paga). Reembolso automático via API (Pix) ainda **não** está
  implementado — por enquanto fica a anotação clara de que precisa
  reembolsar manualmente (Pix: painel do Asaas/Mercado Pago; cartão:
  solicitar estorno à operadora). Entra quando tivermos a documentação
  oficial do endpoint de reembolso.

## [2.3.188] — Editar venda confirmada pra corrigir erro antes de emitir — 2026-10-21

### Adicionado
- Venda já confirmada agora pode ser editada (itens, cliente, totais)
  pra corrigir um erro achado na pré-visualização, sem precisar cancelar
  tudo e recomeçar — botão "Editar" dentro do detalhe da venda e também
  direto na lista. Continua bloqueado se a venda já tiver nota fiscal
  autorizada/em processamento, ou se a conta a receber já tiver cobrança
  gerada/paga (nesses casos, cancele a venda e refaça). Editar recalcula
  o estoque e o valor da conta a receber automaticamente.

## [2.3.187] — Olhinho pra ver a venda antes de confirmar — 2026-10-21

### Adicionado
- Na lista de Vendas, uma venda em rascunho agora tem o botão de
  "Pré-visualizar itens e valores" (olhinho) ao lado de Editar/Confirmar
  — mostra os itens e o total antes de confirmar (ação que gera conta a
  receber e trava os itens, sem volta). Mesmo modal já usado pras vendas
  confirmadas/canceladas, sem opção de emitir nota (só aparece quando a
  venda já está confirmada).

## [2.3.186] — Pré-visualização de DANFe religada em Homologação — 2026-10-21

### Corrigido
- "Pré-visualizar DANFe" (ver v2.3.185): corrigidos dois problemas no
  código que não batiam com a documentação oficial da Focus NFe — faltava
  o header `Accept: application/pdf`, e `tipo_documento` ia como texto em
  vez de número. Religado o botão, mas **só quando a empresa está em
  Homologação** — em Produção continua bloqueado no backend até um teste
  limpo confirmar que não gera mais nota real por engano.

## [2.3.185] — Desativa pré-visualização insegura + botão de cancelar nota + rodapé interno — 2026-10-21

### Corrigido
- **Crítico**: o botão "Pré-visualizar DANFe" usava um endpoint da
  Focus NFe nunca confirmado contra a documentação oficial — na
  prática, confirmado pelo cliente contra uma nota real em Produção,
  clicar nele gerava uma nota AUTORIZADA de verdade, mesmo sem clicar
  em "Emitir". Desativado imediatamente (bloqueado no backend, não só
  escondido na tela) até confirmar o endpoint correto com a
  documentação da Focus NFe.

### Adicionado
- Botão "Cancelar nota" numa nota autorizada — o backend já sabia
  cancelar (exige justificativa), mas não existia nenhum jeito de
  acionar isso pela tela.
- Rodapé com nome, endereço, telefone e e-mail da empresa nos
  relatórios internos do AtendeFlow (Serviços, Clientes, Fornecedores,
  Produtos, Contas, Termo de Cautela do Serviço Armaria) — nunca na
  nota fiscal em si. Novo campo "E-mail de contato" em Configuração
  Fiscal.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 163.

## [2.3.183] — Revisão antes de enviar nota + data/hora de saída + tributos — 2026-10-21

### Adicionado
- Clicar em "Emitir NF-e/NFC-e/NFS-e" agora abre um resumo de
  confirmação (destinatário, itens, SIGMA/lote/ID, valor total) antes
  de enviar de verdade pra Sefaz — o botão "Pré-visualizar DANFe" (o
  "olhinho", que já existia e gera o PDF sem consumir numeração real)
  continua disponível à parte, pra quem quiser ver o documento
  inteiro antes de confirmar.
- Data/hora de saída (campo obrigatório no layout da NF-e, ficava em
  branco) — agora preenchido automaticamente, mesmo instante da
  emissão.
- Novo campo "Valor ICMS Desonerado (R$)" no cadastro de Produto
  (substituiu um campo antigo "ICMS Desoner. (%)" que nunca tinha
  sido usado em nenhuma nota).
- Novos campos "Alíquota aprox. tributos - IBPT (%)" e "Fonte IBPT" no
  cadastro de Produto — alimentam o aviso de "Total de Tributos
  Federais, Estaduais e Municipais" no rodapé da nota (Lei da
  Transparência), preenchimento manual.
- Impressão em Serviços (e Clientes/Fornecedores/Produtos/Contas)
  ganhou o nome da empresa ao lado da logomarca, igual já tinha no
  Termo de Cautela do Serviço Armaria.

### Corrigido
- Excluir uma tentativa de nota fiscal que falhou (nunca gerou chave
  de acesso) em Produção dava a mesma mensagem de "não pode excluir"
  de uma nota real autorizada — agora só bloqueia exclusão de notas
  que realmente têm existência legal (autorizada, processando ou
  cancelada).
- Os campos SIGMA/lote/ID de munição no rodapé da nota mudaram de
  rótulo ("LOTE: X / ID: Y / SIGMA: Z") pra bater com o formato real
  usado antes no sistema antigo.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 161.

## [2.3.182] — Logomarca persiste ao navegar + impressão em Serviços — 2026-10-21

### Corrigido
- A logomarca anexada em Serviço Armaria sumia ao sair da tela e
  voltar — ficava só num estado local da página, nunca sincronizava
  de volta com a sessão do usuário. Corrigido: agora atualiza a sessão
  de verdade (sem precisar relogar), então a logo se mantém navegando
  entre telas.

### Adicionado
- A impressão em Serviços (e em qualquer outro cadastro que usa a
  mesma lista — Clientes, Fornecedores, Produtos, Contas), tanto na
  lista inteira quanto num registro individual, agora inclui a
  logomarca da empresa no cabeçalho, igual já acontecia no Termo de
  Cautela do Serviço Armaria.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 160.

## [2.3.181] — Lista de Serviços ordenada por código — 2026-10-21

### Alterado
- A lista de Serviços agora ordena por código (001, 002, 003...) em
  vez de por nome — pedido do cliente, pra bater com a numeração da
  planilha original.

## [2.3.180] — Importação de Serviços aceita a planilha real do cliente — 2026-10-21

### Corrigido
- O cliente mandou a planilha real dos 37 serviços do Despachante
  Bélico ("Nome", "Tipo", "SKU", "Valor do Serviço", "Forma de
  Pagamento", "Descrição do Serviço") e "Descrição do Serviço" não
  estava sendo reconhecida na importação (só "Descrição" sozinho
  batia). Corrigido — a importação agora aceita esses nomes de coluna
  exatos, sem precisar reformatar a planilha. "SKU" também passou a
  virar o código do serviço em vez de ser descartado.
- O modelo baixável ("Baixar modelo") passou a usar os mesmos nomes de
  coluna da planilha real do cliente, pra ficar 1:1 compatível.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 158.

## [2.3.179] — Importação de Serviços via planilha + excluir individual — 2026-10-21

### Adicionado
- O cadastro de Serviços ganhou "Baixar modelo"/"Importar planilha"
  (código, nome, valor, condições de pagamento, descrição) — mesmo
  padrão já usado em Produtos/Clientes do Financeiro. Duplicata (mesmo
  nome) atualiza o registro já existente em vez de criar um segundo.
- Botão de excluir individual (por linha) em todos os cadastros que
  usam a lista genérica (Clientes, Fornecedores, Produtos, Serviços,
  Contas a Pagar/Receber) — antes só existia exclusão em massa via
  checkbox, agora dá pra excluir um registro direto sem selecionar
  nada primeiro. Continua admin-only, mesma regra de antes.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 157.

## [2.3.178] — Novo módulo Serviço Armaria (manutenção de arma) — 2026-10-20

### Adicionado
- Novo módulo **Serviço Armaria** (add-on separado, o Master libera por
  plano conforme a contratação de cada cliente — não vem junto do
  Despachante Bélico): registra o recebimento de UMA arma específica
  do cliente pra manutenção/conserto, com todos os campos do "Termo
  de Cautela, Recebimento e Depósito de Arma de Fogo" no padrão da
  Polícia Federal (dados do proprietário, especificação técnica da
  arma, documentação — CRAF/SIGMA/SINARM, Guia de Tráfego, Porte/
  Posse —, serviço solicitado/realizado e estado de conservação).
- Fotos "antes" e "depois" do serviço (várias por estágio).
- Busca de cliente já cadastrado em Contatos/Financeiro, mesmo atalho
  já existente no Despachante Bélico.
- Botão "Imprimir Termo de Cautela" — gera o termo completo pronto pra
  assinatura, incluindo a logomarca da própria empresa (cada
  empresa-cliente sobe a sua, em "Anexar logomarca" na tela do
  módulo — nunca fixo no sistema).

Detalhes em `docs/MANUAL_TECNICO.md`, seção 156.

## [2.3.177] — Busca de cliente existente no Despachante Bélico + renomeia Serviços — 2026-10-20

### Adicionado
- Ao cadastrar um cliente novo no Despachante Bélico, um campo "Já é
  cliente? Buscar em Contatos/Financeiro" acha a pessoa em qualquer um
  dos dois cadastros já existentes e preenche nome/CPF/telefone/
  endereço automaticamente (continuam editáveis depois de preenchidos)
  — evita a mesma pessoa cadastrada 3 vezes em áreas diferentes.

### Alterado
- O módulo "Serviços" (catálogo simples, sem fiscal) foi renomeado
  pra "Serviços Adms." no menu — prepara o nome pra abrir espaço pro
  novo módulo "Serviço Armaria" (gestão de serviço técnico de armas),
  que vai ter nome e propósito diferentes.

## [2.3.176] — Corrige backend em crash loop + Serviço preenche Contas a Receber — 2026-10-20

### Corrigido
- O model `Service` (novo no v2.3.175) não estava registrado na lista
  de models do Sequelize — o backend quebrava assim que tentava montar
  as associações ("Error: Service has not been defined"), derrubando
  o sistema inteiro em produção. Corrigido.

### Adicionado
- Em Contas a Receber, um novo campo "Buscar serviço" puxa do
  catálogo de Serviços e preenche Descrição e Valor automaticamente —
  mesmo atalho que já existia no Despachante Bélico.

## [2.3.175] — Cadastro de Serviço (catálogo independente de Produtos) — 2026-10-20

### Adicionado
- Novo módulo "Serviços", sempre disponível (não é add-on separado,
  sem controle de plano) — catálogo simples com código, nome, valor,
  condições de pagamento, descrição e foto. Sem nenhum campo fiscal/
  tributário e sem SKU, de propósito: é só um cadastro de referência,
  não gera nota fiscal.
- O "Tipo de serviço" na ficha do Despachante Bélico agora busca nesse
  catálogo novo em vez do cadastro de Produtos do Financeiro — o
  Despachante Bélico ganha seu próprio banco de serviços,
  independente de o cliente ter ou não o módulo Financeiro.
- Os 37 serviços já cadastrados como Produto (tipo "Serviço") foram
  migrados automaticamente pro catálogo novo na primeira atualização —
  nada se perde, os processos já criados continuam com o vínculo
  antigo intacto.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 153.

## [2.3.174] — Resend: chave protegida, domínio verificado e envio de teste — 2026-10-20

### Adicionado
- A API key da Resend nunca mais volta pro navegador em texto puro — o
  campo mostra "✓ Chave cadastrada. Deixe vazio para manter." quando já
  tem uma salva, com ícone de olho pra mostrar/esconder o que você
  digitar. Salvar a tela sem mexer nesse campo não apaga a chave já
  configurada.
- Instruções diretas na tela (criar conta na Resend, gerar API Key,
  verificar domínio do remetente) e aviso explícito: não dá pra usar
  @gmail.com nem outro domínio que você não controla como remetente —
  só domínio próprio verificado na Resend.
- Novo bloco "Enviar para um destinatário" — manda um e-mail de teste
  (sem depender de nenhuma nota fiscal) pra confirmar que a chave/
  domínio estão certos antes de usar isso numa nota de verdade.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 152.

## [2.3.173] — Envio de nota por e-mail via Resend + botão de baixar sempre disponível — 2026-10-20

### Adicionado
- Configuração Fiscal ganhou uma seção "Envio de nota por e-mail
  (Resend)": liga/desliga, API key, e-mail e nome do remetente. Com
  Resend habilitado, "Enviar por e-mail" passa a ser mandado pelo próprio
  AtendeFlow (baixa o DANFE e anexa) em vez de depender do relay da
  Focus NFe.
- Emitir uma nota que já volta autorizada na hora já abre o diálogo de
  enviar por e-mail em seguida, em vez de precisar achar o ícone depois.
- Lista de Vendas ganhou um ícone "Baixar nota (PDF)" direto na linha
  (vendas confirmadas e canceladas, quando já têm nota autorizada) —
  antes só dava pra baixar entrando no detalhe da venda.

⚠️ A integração com a Resend segue a documentação pública da API, mas
nunca foi testada contra uma conta/chave real nesta sessão — testar um
envio de verdade antes de confiar em produção.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 151.

## [2.3.172] — Digitar SKU ou nome do item já preenche os campos — 2026-10-20

### Adicionado
- Em "Nova venda", digitar o SKU ou o nome do produto DIRETO no campo
  "Código (SKU)" ou "Descrição" de um item (sem passar pelo
  "Produto/serviço" de cima) — se bater exato com um produto cadastrado,
  preenche Descrição/NCM/Unidade/Valor/CFOP sozinho, igual já acontecia
  escolhendo pelo autocomplete. Só dispara quando o item ainda não tem
  produto vinculado — item avulso/texto livre continua funcionando igual
  antes.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 150.

## [2.3.171] — Endereço completo do destinatário na Venda — 2026-10-20

### Adicionado
- "Nova venda" ganhou um bloco "Endereço completo (destinatário)" logo
  abaixo do campo Cliente — CEP, Rua, Número, Complemento, Bairro,
  Cidade, UF. Ao escolher o Cliente, esses campos já vêm preenchidos
  sozinhos com o endereço do cadastro dele; CEP também autopreenche
  (ViaCEP). Continuam editáveis — é um snapshot gravado na própria venda
  (igual os dados de cada item), não o cadastro do Cliente em si, pra
  uma nota já emitida não mudar se o cadastro mudar depois.
- Esse endereço agora alimenta de verdade o payload da Focus NFe
  (`logradouro_destinatario` etc.) — antes vinha só do cadastro do
  Cliente no momento de emitir; vendas antigas continuam funcionando
  normalmente (cai pro cadastro do Cliente quando o snapshot da venda
  está vazio).

Detalhes em `docs/MANUAL_TECNICO.md`, seção 149.

## [2.3.170] — Removido o aviso de "Nova versão disponível" — 2026-10-19

### Removido
- O toast "Nova versão disponível / Atualizar agora" (service worker) foi
  removido — pedido do cliente: o botão recarregava a página inteira e
  derrubava o operador de volta pra tela inicial no meio de um
  atendimento, obrigando a procurar o ticket de novo. O app continua
  atualizando sozinho em segundo plano; a aba só passa a usar a versão
  nova na próxima vez que recarregar por conta própria (login, F5
  manual), nunca forçado.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 148.

## [2.3.169] — Autopreenchimento de endereço por CEP — 2026-10-19

### Adicionado
- Em qualquer cadastro com CEP (Cliente, Fornecedor, Configuração
  Fiscal — endereço do emitente, Venda — local de entrega), digitar o
  CEP e sair do campo já preenche Rua, Bairro, Cidade e Estado sozinho
  (ViaCEP, serviço público gratuito, sem chave de API). Nunca trava o
  formulário se o CEP não for encontrado ou a API estiver fora do ar —
  continua dando pra digitar o endereço na mão como sempre.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 147.

## [2.3.168] — Fornecedor/Produção + Dados Gerais do Produto, Finalidade da Emissão e Transporte da Venda — 2026-10-19

### Adicionado
- Produto ganhou duas seções novas: "Fornecedor / Produção" (Distribuidor/
  Fornecedor Principal — agora puxando do cadastro real de Fornecedores,
  Prazo de Produção, Código Desenho, Escala de Produção, CNPJ do
  Fabricante) e "Dados Gerais — Complementares" (Cód. Barras/GTIN, Cód.
  Fornecedor, Código Original, Cód. Produto Similar, Cor/Tamanho/Sabor,
  Peso, Categoria, Subcategoria, Embalagem, Família, Local no Estoque,
  Tabelas de preço 2 a 5, Estoque Reservado/Ideal/Por Lote, Controle por
  Lote, Produto Composto, Matéria Prima, Equipamento, Venda por KG,
  Comissão, Margem de Desconto, Pontos/Pontos Troca).
- `FinanceRecordModal` (genérico, usado por clientes/fornecedores/
  produtos/contas) ganhou `field.embeddedKey` — resolve a associação
  pré-carregada quando o nome do campo (ex. `mainSupplierId`) não bate
  com o singular automático do recurso (`suppliers` → `supplier`).
- Venda ganhou "Finalidade da Emissão" (Normal/Complementar/Ajuste/
  Devolução/NF Crédito/NF Débito) e "Dados de Transporte" completo
  (Volumes, Transportadora, Veículo, Local de Entrega, Frete por Conta) —
  já mandados pro payload da Focus NFe quando preenchidos.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 146.

## [2.3.167] — Dados Fiscais do Produto + foto + auto-preenchimento da Venda — 2026-10-19

### Adicionado
- Nova seção "Dados Fiscais" no cadastro de Produto: Isento de ICMS,
  ICMS por Substituição Tributária, Origem, Tipo Tributação ICMS
  (Contribuinte/Não Contribuinte — CSOSN completo), Modalidade de
  determinação da BC do ICMS/ICMS-ST, ICMS (%), ICMS ECF, ICMS Desoner.,
  ICMS ST (%), IVA-ST, Un. Medida Trib., CFOP Principal/Fora UF, Artigo,
  Cód. Benefício Fiscal, FCP e Desconto Condicional na NFe/NFCe —
  confirmados contra 4 notas fiscais reais do cliente (venda a
  consumidor final + compras de fornecedores CBC/Pavei/Inbramun).
- Esses valores agora alimentam de verdade o ICMS/CSOSN/Origem por item
  no payload mandado pra Focus NFe — o CSOSN usado troca sozinho
  conforme o destinatário for Contribuinte ou não (mesmo indicador já
  adicionado na v2.3.166).
- Foto no cadastro de Produto (upload, igual já existia no Despachante
  Bélico) — aparece na lista e no formulário.
- "Nova venda": ao escolher o Cliente, os campos "Indicador IE" e "Tipo
  Consumidor" já vêm pré-preenchidos pelo tipo de documento (CPF = Não
  Contribuinte/Final, CNPJ = Contribuinte/Normal) — continuam editáveis.
  O CFOP do item também passa a vir do Produto (interno ou fora da BA,
  conforme o Tipo de operação da venda).
- IPI e PIS/COFINS ficaram de fora dessa entrega a pedido do cliente
  (não são destacados pelo regime Simples Nacional dele).

Detalhes em `docs/MANUAL_TECNICO.md`, seção 145.

## [2.3.166] — Campos fiscais da Venda (indicadores NF-e/NFC-e) — 2026-10-19

### Adicionado
- Pedido do contador do cliente, "obrigatório pra não ter problema com o
  fisco": nova seção "Dados fiscais da nota" em Nova/Editar venda — Tipo de
  operação (Interna/Interestadual/Exterior), Natureza da operação (texto
  livre, antes vinha sempre fixo "Venda"), Presença do consumidor (0/1/2/
  3/5/9, códigos oficiais Sefaz), Tipo de intermediador (Sem operação/Site
  próprio/Marketplace), Tipo consumidor (Normal/Final), Destinatário: Tipo
  (Cliente/Fornecedor — classificação informativa, não muda de qual
  cadastro o destinatário vem), Indicador IE (Contribuinte/Não contribuinte/
  Contribuinte Isento) e Forma de pagamento (À vista/Cartão Crédito/Cartão
  Débito/Dinheiro/Importado do XML/PIX/Sem pagamento).
- SIGMA/SINARM, Lote de munição e ID de embalagem — campos novos por ITEM
  da venda, aparecem só quando o item é Arma ou Munição.
- Esses valores agora vão de verdade no payload mandado pra Focus NFe
  (NF-e/NFC-e) — ⚠️ os códigos oficiais da Sefaz usados têm confiança alta,
  mas o NOME exato de cada campo no JSON da Focus (e principalmente o
  mapeamento de forma de pagamento) não foi validado contra uma nota de
  Homologação de verdade ainda — ver aviso detalhado em
  `FocusNFeService.ts`. Testar em Homologação antes de confiar em Produção.
- "Status NF" ganhou um terceiro estado visual, amarelo ("Precisa
  corrigir") — marcado manualmente numa nota com erro, pra distinguir das
  notas com erro ainda não revisadas. "Processando" (gateway ainda
  respondendo) passou de amarelo pra azul, já que o amarelo agora tem
  esse significado específico.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 144.

## [2.3.165] — Despachante Bélico: ficha de cliente (Fase 2B — frontend) — 2026-10-19

### Adicionado
- Tela nova "Despachante Bélico" (menu lateral, ícone de escudo) — lista
  de clientes com busca por nome/CPF/WhatsApp e botão "Novo cliente".
- Ficha de cadastro do cliente com os campos pedidos: Nº da OS (exibição
  automática, não é um campo digitado), foto (upload), nome completo,
  CPF, identidade (RG), profissão, endereço completo, telefone, WhatsApp
  e observação.
- Campo "Tipo de serviço" (repetível, pode pedir vários de uma vez) puxa
  direto do cadastro real de Financeiro → Produtos → Serviços — ao
  escolher um serviço já cadastrado, valor e nome vêm preenchidos
  sozinhos; ainda dá pra cadastrar serviços novos pela tela de Produtos
  normalmente. Cada serviço escolhido tem um campo "Forma de pagamento"
  (Pix/Cartão/Boleto/Espécie) e vira um processo novo na esteira do
  Despachante Bélico ao salvar.
- Botão "Imprimir / PDF" na ficha (mesma técnica `window.print()` já
  usada no resto do Financeiro).
- Novos campos no cadastro do cliente (`phone`, `rg`, `profession`,
  `address`, `photoUrl`) e do processo (`value`, `paymentMethod`,
  `productId` com vínculo ao Produto escolhido).

Detalhes em `docs/MANUAL_TECNICO.md`, seção 143.

## [2.3.164] — Filtro de Tipo de verdade na busca de item da Venda — 2026-10-19

### Adicionado
- Em "Nova venda", cada item agora tem um seletor de Tipo (Produto,
  Serviço, Arma, Munição/Insumo, Acessórios, Caça & Pesca, Todos) que
  REALMENTE restringe a busca — antes só mostrava o Tipo no texto do
  resultado (v2.3.163), mas buscava em cima de tudo misturado. Escolher
  "Serviço" ali busca só entre os produtos cadastrados como Serviço.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 142 (atualizada).

## [2.3.163] — Cadastro de Produto por categoria + distinção Produto/Serviço na Venda — 2026-10-19

### Corrigido
- "Acessório" tinha o S plural faltando no seletor de Tipo (sidebar já
  dizia "Acessórios").
- Abrir "Novo(a) Produto" a partir de uma categoria específica do menu
  (ex. "Armas nacionais") agora já abre com Tipo (e Procedência, quando
  for o caso) pré-selecionados pro contexto — antes sempre abria em
  "Produto", obrigando reescolher toda vez. O campo continua um seletor
  completo: dá pra trocar pra outro Tipo sem fechar o modal (ex. cadastrar
  a munição logo depois da arma).
- Em "Nova venda", o campo "Produto/serviço" buscava tudo junto (arma,
  munição, serviço...) sem nenhuma pista visual de qual é qual — agora a
  lista de resultados mostra o Tipo ao lado do nome.

Testado com um teste automatizado (React Testing Library) que a troca de
Tipo dentro do mesmo formulário aberto esconde/mostra os campos certos
na hora — confirmado que o mecanismo já funciona corretamente. Detalhes
em `docs/MANUAL_TECNICO.md`, seção 142.

## [2.3.162] — Despachante Bélico: rotas HTTP, permissão por plano (Fase 2A) — 2026-10-19

### Adicionado
- Rotas HTTP completas pro Despachante Bélico — cadastro de Cliente
  (CRUD + salvar/ler senha do gov.br, sempre auditado), Processo (CRUD +
  mover de etapa na esteira) e Agendamento (psicoteste/laudo de tiro).
- Permissão por plano (`Plan.useWeaponDispatch`) + liberação por usuário
  dentro da empresa (`User.weaponDispatchAccess`), mesmo padrão já usado
  em RH/Painel Vigia — toggle já disponível em `PlansManager.js` (tela do
  Master).

A tela (esteira estilo Kanban) ainda não existe — por isso o módulo ainda
não aparece no menu lateral; é a próxima entrega. Detalhes em
`docs/MANUAL_TECNICO.md`, seção 141.

## [2.3.161] — Catálogo oficial de serviços do Despachante Bélico + painel de Serviço mais limpo — 2026-10-19

### Adicionado
- Catálogo de "Tipo de processo" do Despachante Bélico reescrito com a
  lista oficial completa de serviços (CAC/Exército-SisGCorp, Posse-Porte/
  Polícia Federal-Sinarm, e uma trilha NOVA — Policial/Militar via
  SIGMA/SisGCorp) — 37 tipos de processo organizados pelas mesmas etapas
  que o Exército/PF usam.
- Planilha com os 37 serviços pronta pra importar em Financeiro →
  Produtos (Tipo = Serviço, preço R$ 0 pra preencher).

### Corrigido
- Cadastro de Produto (Financeiro) escondia os campos de arma quando o
  Tipo era Serviço, mas ainda mostrava "NCM" e "Controlar estoque" — dois
  campos que só fazem sentido pra mercadoria física, não pra um serviço
  como "Renovação de CRAF" ou "Filiação". Agora esses dois também somem
  quando Tipo = Serviço.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 140.

## [2.3.160] — Confirmação automática de cobrança já paga na criação + WhatsApp no cliente — 2026-10-19

### Corrigido
- Cobrança gerada (Pix/boleto) que o gateway já devolve como PAGA na própria
  criação (aconteceu na prática testando o Asaas em sandbox) não marcava a
  Conta a Receber como recebida — só o webhook (que só chega numa cobrança
  paga DEPOIS) fazia essa transição. Agora o mesmo critério de "é um status
  pago?" é aplicado também no momento da criação da cobrança.

### Adicionado
- Campo **WhatsApp** no cadastro de Cliente (Financeiro), separado do
  Telefone — número usado pra disparo de cobrança/lembrete automático.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 139.

## [2.3.159] — Despachante Bélico: modelagem do banco (Fase 1) — 2026-10-19

### Adicionado
- Novo módulo add-on (`Plan.useWeaponDispatch`, mesmo padrão de
  `useFiscal`/`usePayment`/`useFlowbuilder`) pra gestão de processo
  CAC/Sigma (Exército) e Posse/Porte/Sinarm (Polícia Federal) — substitui
  a base hoje mantida manualmente no Notion do cliente.
- Modelos novos: `WeaponDispatchClient` (cliente, com senha do gov.br
  SEMPRE criptografada — nunca em texto puro, diferente do Notion antes —
  e nunca exposta em consulta normal), `WeaponDispatchProcess` (1 cliente
  pode ter N processos ao longo do tempo — CR, Autorização de Compra, GT,
  renovação... cada um na própria esteira), `WeaponDispatchStatusHistory`
  (auditoria de toda troca de etapa), `WeaponDispatchAppointment`
  (agendamento de psicoteste/laudo de tiro, vinculado de verdade ao
  processo — a planilha solta do Notion não tinha esse vínculo) e
  `WeaponDispatchGovPasswordAccessLog` (toda LEITURA da senha decifrada do
  gov.br fica registrada: quem acessou, quando, por quê).
- Catálogo fixo das duas esteiras (CAC/Exército x Civil/Polícia Federal),
  derivado do pedido original e enriquecido com os ~20 tipos de processo
  reais já em uso no Notion do cliente (renovação, transferência, mudança
  de endereço etc.).

Esta etapa é só a modelagem do banco (models + migrations + services
básicos de CRUD/transição de etapa) — rotas HTTP, tela (esteira estilo
Kanban) e o robô de consulta de protocolo ainda não existem, ficam pra
próximas etapas. Detalhes em `docs/MANUAL_TECNICO.md`, seção 138.

## [2.3.158] — Mercado Pago e Asaas 100% independentes na Configuração de Pagamento — 2026-10-19

### Alterado
- O botão "Ativo" de cada gateway deixou de ser um seletor único que
  marcava qual dos dois gera a próxima cobrança (marcar um desmarcava o
  outro). Agora `mercadoPagoEnabled`/`asaasEnabled` ligam/desligam cada
  painel de forma independente — os dois podem ficar ativos ao mesmo
  tempo. Quando só um está ligado, gerar Pix/boleto numa Conta a Receber
  usa esse direto; com os dois ligados, um seletor de gateway aparece no
  modal de edição da Conta a Receber pra escolher qual usar naquela
  cobrança (campo `provider`, novo parâmetro aceito pelas rotas
  `/finance/receivables/:id/pix` e `/boleto`).
- O botão "Produção" (sandbox x produção), que também era um campo único
  valendo pros dois gateways, virou dois independentes
  (`mercadoPagoProductionEnabled`/`asaasProductionEnabled`) — ligar
  Produção no Mercado Pago não afeta mais o Asaas, e vice-versa.
- "Expiração do Pix (minutos)" — que só faz sentido pro Mercado Pago —
  saiu do topo compartilhado da tela e foi pra dentro do painel do
  Mercado Pago.
- Campos antigos `provider` e `productionEnabled` ficam na tabela sem uso
  novo (mesmo padrão de coluna descontinuada já usado no projeto).

Detalhes em `docs/MANUAL_TECNICO.md`, seção 137.

## [2.3.157] — Selo de marca (Mercado Pago/Asaas) nos painéis — 2026-10-19

### Adicionado
- Cada painel da Configuração de Pagamento ganhou um selo com o nome do
  gateway na cor característica da marca (Mercado Pago: branco com borda/
  texto azul; Asaas: azul sólido com texto branco), no lugar do título em
  texto simples — pedido do cliente, que mandou os logos oficiais, mas
  este ambiente não consegue acessar arquivo de imagem colado direto na
  conversa (sem acesso de rede nem persistência em disco pra isso,
  confirmado tentando localizar o arquivo antes de desistir). Fica
  registrado como pendência caso o cliente consiga enviar os arquivos de
  logo por outro caminho (upload de verdade) no futuro.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 136.

## [2.3.156] — Texto de cada gateway separado por painel — 2026-10-19

### Corrigido
- O parágrafo de introdução da Configuração de Pagamento citava Mercado
  Pago e Asaas juntos num texto só, no topo da tela — mesmo já com os
  painéis separados visualmente (v2.3.155). Cliente pediu pra separar
  também o texto: agora cada coluna tem a própria frase de contexto
  ("Credenciais do Mercado Pago — gera Pix/boleto por esse gateway" /
  mesma coisa pro Asaas), e o texto do topo ficou só com a explicação
  geral (Pagamento x Fiscal são contratos separados).

Detalhes em `docs/MANUAL_TECNICO.md`, seção 136.

## [2.3.155] — Configuração de Pagamento: Mercado Pago e Asaas lado a lado — 2026-10-19

### Corrigido
- Tela Configuração de Pagamento reorganizada: Mercado Pago e Asaas agora
  ficam em duas colunas lado a lado (era um embaixo do outro, ocupando a
  largura toda cada um) — pedido do cliente. Texto digitado nos campos de
  credencial/URL de webhook agora centralizado (estava alinhado à
  esquerda, padrão do Material-UI, e parecia desalinhado ao lado dos
  títulos/rótulos centralizados dos cartões).

## [2.3.154] — Asaas (Fase 2) + permissão de plano pro módulo de Pagamento — 2026-10-19

### Adicionado
- **Asaas** como segundo gateway de cobrança, ao lado do Mercado Pago (Fase
  1, v2.3.153) — mesmo recurso (Pix/boleto em Contas a Receber), um
  seletor novo em Configuração de Pagamento decide qual dos dois gera a
  próxima cobrança. Diferente do Mercado Pago, o Asaas exige cadastro de
  cliente no sistema deles antes de cobrar — feito automaticamente (busca
  por CPF/CNPJ, cria se não existir).
- **Permissão por plano pro módulo de Pagamento** (`Plan.usePayment`,
  mesmo padrão do módulo Fiscal): o Master decide, por contrato, se o
  cliente paga por esse serviço — sem isso habilitado, a aba Configuração
  de Pagamento e os botões "Gerar Pix"/"Gerar boleto" ficam bloqueados
  (backend e frontend), mesmo com o Financeiro básico ativo.

⚠️ Mesma ressalva do Mercado Pago (v2.3.153): adapter do Asaas implementado
a partir da documentação pública, ainda sem teste ponta a ponta contra uma
chave real.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 135.

## [2.3.153] — Cobrança Pix/boleto via Mercado Pago em Contas a Receber (Fase 1) — 2026-10-19

### Adicionado
- Nova tela **Configuração de Pagamento** (Financeiro → Configuração de
  Pagamento) pra cadastrar as credenciais do Mercado Pago (Homologação/
  Produção, mesmo padrão já usado em Configuração Fiscal), a URL de webhook
  pronta pra colar no painel deles, e o segredo de assinatura do webhook.
- Editando uma Conta a Receber, botões **"Gerar Pix"** e **"Gerar boleto"**
  — chamam o Mercado Pago e mostram o QR Code/código copia-e-cola (Pix) ou
  o link do boleto direto no formulário.
- Webhook novo (`/webhook/mercadopago/:companyId`, uma URL por empresa)
  marca a conta como recebida automaticamente quando o Mercado Pago avisa
  que o pagamento foi aprovado — valida a assinatura do webhook (header
  `x-signature`) e NUNCA confia no corpo da notificação sozinho: sempre
  rebusca o status de verdade na API deles antes de mudar qualquer coisa.
- Fase 2 (próximo passo, mesma estrutura): Asaas como segundo gateway.

⚠️ Mesma ressalva já registrada pra Focus NFe (seção 6.2): esta integração
foi implementada a partir da documentação pública do Mercado Pago, mas
**ainda não foi testada ponta a ponta** contra uma chave de teste real
(sem saída de rede pra `api.mercadopago.com` neste ambiente de
desenvolvimento) — testar com uma cobrança de teste de verdade antes de
confiar em produção.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 134.

## [2.3.152] — Taurus também pelo código do modelo (sem nome nem prefixo de SKU) — 2026-10-18

### Corrigido
- Mesmo problema da v2.3.150, mais fundo: depois do fix do prefixo "TAU",
  a planilha real do cliente ainda mostrava só 13 de 36 armas com
  procedência ("eram pra ser 25"). Causa: a maioria das Taurus dessa
  planilha usa só o **código do modelo** no nome (G2C, G3, G3C, GX2,
  GX4SC, TH380, TX22, RT66, RT889, 59S) — sem a palavra "TAURUS" escrita
  e com SKU numérico próprio da planilha legada (não "TAU..."). Confirmado
  com o cliente (reverte, só pra essa lista fechada de modelos já vistos
  na planilha real, a decisão original de não reconhecer por código de
  modelo): esses 10 códigos agora também contam como marca Taurus/
  procedência nacional, como último sinal (só depois de tentar nome e
  prefixo do SKU, só pra tipo arma). Com isso, as 36 armas da planilha
  real do cliente ficam todas com procedência (33 nacional + 3 importada,
  confirmado simulando a planilha de novo). Reimportar a mesma planilha
  atualiza os produtos existentes.
- ⚠️ Atenção registrada: "G3" sozinho colide com o fuzil G3 da Heckler &
  Koch (arma importada) — aceito porque o catálogo desse cliente é loja
  de tiro esportivo civil, sem fuzil militar; se isso mudar, precisa
  revisar essa lista.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 133.

## [2.3.151] — Imprimir/gerar PDF de um registro no formulário de editar — 2026-10-18

### Adicionado
- Tela de editar Cliente, Fornecedor, Produto, Conta a Pagar e Conta a
  Receber ganhou o botão "Imprimir / PDF" dentro do próprio formulário
  (mesma técnica `window.print()` + `@media print` já usada na impressão em
  lista) — imprime só aquele registro, com todos os campos do cadastro.
  Mesma permissão **"Imprimir / Exportar listas"** da v2.3.147 (Admin/Master
  sempre libera); só aparece editando um registro já existente (num cadastro
  novo ainda não tem nada salvo pra imprimir).

Detalhes em `docs/MANUAL_TECNICO.md`, seção 132.

## [2.3.150] — Taurus também detectada pelo prefixo do SKU; erros de linha visíveis na importação — 2026-10-18

### Corrigido
- Importação do "Relatório de Produtos" (planilha de loja de armas):
  produtos cujo nome não cita a palavra "TAURUS" (ex. "PISTOLA G2C...",
  "PISTOLA GX4...") mas cujo código/SKU começa com o prefixo "TAU" (usado
  por uma distribuidora que revende produtos Taurus pra loja) agora também
  são reconhecidos como marca Taurus/procedência nacional. Reimportar a
  mesma planilha atualiza os produtos existentes (por SKU) com a marca e
  procedência detectadas agora.
- `FinanceRecordList.js` (Clientes/Fornecedores/Produtos/Contas a Pagar/
  Contas a Receber) agora mostra na tela os avisos de linha inválida que a
  importação já coletava (`summary.errors`) — antes só aparecia o resumo de
  criados/atualizados/inválidos, sem detalhar o motivo de cada linha
  ignorada.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 131.

## [2.3.149] — Importação de armas em massa não exige mais número de série — 2026-10-18

### Corrigido
- Causa real por trás de "Armas nacionais continua vazio" mesmo depois da
  correção anterior (v2.3.148): o cadastro de arma exige número de série
  único (regra confirmada com o cliente lá na implantação do módulo,
  Estatuto do Desarmamento) — mas a planilha de estoque da loja anterior é
  um catálogo por MODELO (uma linha por SKU, com quantidade em estoque), sem
  coluna de número de série nenhuma. Toda linha de arma dessa planilha
  específica estava sendo rejeitada na importação (nunca chegava a ser
  criada). Confirmado com o cliente: agora a importação **desse relatório
  específico** aceita arma sem número de série — fica pendente, pra
  completar manualmente depois, unidade por unidade. O cadastro manual pela
  tela (e a planilha-modelo oficial, que tem coluna própria pra isso)
  continuam exigindo o número de série normalmente — nada mudou aí.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 130.

## [2.3.148] — Importação de armas não preenchia a procedência (nacional/importada) — 2026-10-18

### Corrigido
- O importador de "Relatório de Produtos" (planilha de loja de armas,
  `parseGunStoreReport`) detectava o tipo certo (arma/munição) a partir da
  coluna "Categoria", mas nunca preenchia a `origin` (procedência) — a
  planilha não tem essa coluna. Resultado: produto importado como "arma"
  nunca aparecia nos filtros "Armas nacionais"/"Armas importadas" (que
  dependem desse campo), mesmo com o tipo certo. Agora a procedência é
  deduzida a partir da MARCA já detectada no nome do produto (mesma lista já
  usada pra extrair marca): Taurus/CBC/Imbel/Imbramun/Rossi/Braztech/Boito →
  nacional; Glock/Beretta/Sig Sauer/Colt/Smith & Wesson/Walther/Mossberg/
  Winchester/Remington/Savage/Ruger/Heckler & Koch/FN/CZ → importada. Produto
  cujo nome não cita nenhuma marca reconhecida continua sem procedência
  (preenche manual, como já acontecia). Reimportar a mesma planilha já
  corrige os produtos existentes (atualiza por SKU).

Detalhes em `docs/MANUAL_TECNICO.md`, seção 129.

## [2.3.147] — Imprimir / Exportar PDF e Excel (Clientes, Fornecedores, Produtos, Contas a Pagar e Contas a Receber) — 2026-10-17

### Adicionado
- Botões "Imprimir / Exportar PDF" e "Exportar Excel" nas 5 listas do
  Financeiro — mesma técnica já usada no Painel Financeiro (`window.print()`
  + `@media print` pro PDF/impressora instalada na máquina; `XLSX.writeFile`
  direto no navegador pro Excel, sem passar pelo servidor). Com algo marcado
  na seleção em massa, imprime/exporta só isso; sem nada marcado, busca
  TODAS as páginas que batem no filtro/busca atual (não só as 20 visíveis).
- Permissão nova e separada em Usuários → Permissões: **"Imprimir / Exportar
  listas"** (desligada por padrão, Admin/Master sempre libera) — diferente de
  "Importar planilha" de propósito, já que são ações diferentes (uma só lê
  dado já carregado na tela, a outra grava).

Detalhes em `docs/MANUAL_TECNICO.md`, seção 128.

## [2.3.146] — Ícone de excluir individual removido (Clientes/Fornecedores/Produtos/Contas) — 2026-10-17

### Removido
- Mesmo ajuste da seção 125 (Vendas), agora em `FinanceRecordList.js` —
  componente compartilhado por Clientes, Fornecedores, Produtos, Contas a
  Pagar e Contas a Receber. Removido o ícone de lixeira por linha na coluna
  "Ação" dessas 5 listas; "Excluir selecionados" (checkbox + botão no topo)
  já cobre excluir um registro individual também. Fluxo de confirmação do
  excluir individual antigo removido do componente (código morto).

## [2.3.145] — Baixar PDF/XML em massa (Vendas) — 2026-10-17

### Adicionado
- Tela de Vendas ganhou um seletor "Baixar como" (PDF/XML) e botão "Baixar
  selecionadas", disponível pra todo mundo (não é admin-only) — reaproveita
  o mesmo checkbox de seleção já usado pra exclusão em massa. Pode combinar
  com o filtro "Período" já existente (filtra, marca "selecionar tudo da
  página", baixa tudo de uma vez) ou marcar nota a nota. Cada arquivo abre
  numa aba separada (sem zipar tudo); vendas sem nota autorizada no formato
  escolhido são ignoradas com aviso.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 125.

## [2.3.144] — Ícone de excluir individual removido da coluna Ação (Vendas) — 2026-10-17

### Removido
- O ícone de lixeira por linha na coluna "Ação" da lista de Vendas (rascunho,
  venda de teste confirmada/cancelada) foi removido — a seleção em massa
  (seção 123/124) já cobre excluir uma venda individual (basta marcar só
  aquela linha). O fluxo de confirmação do excluir individual antigo também
  foi removido do componente (código morto).

## [2.3.143] — Exclusão em massa também libera vendas com nota de Produção (admin) — 2026-10-17

### Adicionado
- A seleção em massa de Vendas (seção 123) ganhou uma confirmação extra,
  admin-only: **"Também excluir vendas com nota de Produção"** — aparece só
  quando a seleção inclui alguma venda nessa situação. Sem marcar, essas
  continuam protegidas (comportamento de sempre). Marcando, o backend aceita
  excluir mesmo assim — o XML/PDF autorizado pela Sefaz continua existindo
  normalmente na Focus (nunca ficou guardado no nosso servidor, só a URL),
  apagar o registro local não afeta o documento fiscal de verdade.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 124.

## [2.3.142] — Seleção em massa pra excluir (admin); filtro de Produtos mais limpo por categoria — 2026-10-17

### Adicionado
- Listas de Clientes, Fornecedores, Produtos, Contas a Pagar, Contas a Receber
  (`FinanceRecordList.js`) e Vendas (`SaleList.js`) ganharam checkbox "marcar
  tudo da página" + botão "Excluir selecionados" — **admin-only, sem exceção**
  (diferente da permissão de importação, essa não tem toggle por usuário). Reusa
  a exclusão individual já existente registro a registro (mesmas regras de
  negócio — ex.: venda com nota fiscal de Produção continua recusada).

### Corrigido
- O dropdown "Tipo" acima da lista de Produtos só aparece agora quando a tela
  abre sem categoria definida ("Todos os produtos"); chegando por um link de
  categoria específica do menu lateral (Armas nacionais, Munições/Insumos
  etc.), o seletor some — já está dentro do painel daquela categoria, não faz
  sentido oferecer trocar pra outra ali.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 123.

## [2.3.141] — Permissão "Importar planilha" por usuário — 2026-10-17

### Adicionado
- Novo toggle em Usuários → Permissões: **"Importar planilha"** (desligado por
  padrão). Admin/Master sempre pode importar; usuário comum só vê e consegue
  usar os botões "Importar planilha" (Clientes, Fornecedores, Produtos no
  Financeiro, e Vendas) se essa permissão for ligada explicitamente no
  cadastro dele. Travado também no backend (não só escondido na tela) — bater
  direto na API de importação sem a permissão retorna 403.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 122.

## [2.3.140] — Filtro de período em Vendas; remoção da opção de baixa no estoque — 2026-10-17

### Adicionado
- Tela de Vendas ganhou filtro "Período" (Todo o período/Hoje/Esta semana/Este
  mês/Personalizado — com campos De/Até quando "Personalizado"), filtrando por
  `saleDate` no backend (`SaleService.list`, novos parâmetros `startDate`/
  `endDate`).

### Removido
- Removida a caixinha "Dar baixa no estoque" da importação de planilha
  (adicionada na v2.3.139) — foi usada uma única vez pras notas 492/493 e o
  cliente pediu pra tirar, pra não ficar como opção permanente arriscando
  baixa duplicada numa importação futura. `SaleImportService.importSales`
  voltou a nunca mexer em estoque, sem opção nenhuma.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 121.

## [2.3.139] — Importação de vendas com opção de dar baixa no estoque — 2026-10-17

### Adicionado
- Tela de Vendas ganhou uma caixinha "Dar baixa no estoque" ao lado do botão
  "Importar planilha" (desmarcada por padrão, sempre volta a desmarcada depois
  de cada importação). A importação de notas via planilha (`SaleImportService`,
  v2.3.116) sempre registrou vendas já faturadas SEM mexer em estoque, de
  propósito — isso continua sendo o padrão. Mas pra nota emitida recém direto
  no painel da Focus (fora do AtendeFlow), cujo estoque ainda não foi baixado em
  lugar nenhum, agora dá pra marcar a caixinha e baixar a quantidade vendida do
  estoque dos produtos encontrados por SKU, no mesmo passo da importação.
  Reimportar a mesma planilha continua idempotente (não duplica venda nem baixa
  estoque duas vezes).

Detalhes em `docs/MANUAL_TECNICO.md`, seção 120.

## [2.3.138] — Painel Financeiro sem navegação duplicada — 2026-10-17

### Corrigido
- Removida a lista vertical de abas (Painel Financeiro, Contas a Pagar, Contas a
  Receber, Clientes, Fornecedores, Produtos, Vendas, Configuração Fiscal) que
  ficava à esquerda do conteúdo, dentro da própria tela — ficou redundante depois
  da navegação ter sido movida pro menu lateral principal (seção 117). O conteúdo
  agora ocupa a largura inteira da tela.

## [2.3.137] — Emojis nos itens do submenu Financeiro — 2026-10-17

### Adicionado
- Cada item do submenu lateral "Financeiro" (seção 117) ganhou um emoji antes do
  texto, pra ficar mais rápido de reconhecer visualmente: 📊 Painel Financeiro, 💸
  Contas a Pagar, 💰 Contas a Receber, 🛒 Vendas, 👥 Clientes, 📦 Produtos (e suas
  categorias — 🔫 Armas nacionais, 🌎 Armas importadas, 🧰 Munições/Insumos, 🎒
  Acessórios, 🎣 Caça & Pesca, 🔧 Serviços), 🚚 Fornecedores, 🧾 Configuração Fiscal.

## [2.3.136] — Navegação de Produtos movida pro menu lateral — 2026-10-17

### Adicionado
- O filtro "Tipo" da lista de Produtos (select ao lado da busca, adicionado nas
  versões 2.3.133-135) não abria em produção para o cliente — causa não totalmente
  isolada (servidor/CDN confirmados servindo o bundle certo via `curl`, incluindo as
  strings das opções novas). Em vez de seguir investigando um componente que já
  causou problema, a navegação por categoria foi movida pro menu lateral principal:
  "Financeiro" agora é um item expansível (mesmo padrão já usado em "Campanhas"),
  com sub-itens — Painel Financeiro, Contas a Pagar, Contas a Receber, Vendas,
  Clientes, Produtos, Fornecedores, Configuração Fiscal — e "Produtos" expande de
  novo mostrando as categorias (Todos, Armas nacionais, Armas importadas,
  Munições/Insumos, Acessórios, Caça & Pesca, Serviços). Cada sub-item linka pra
  `/financeiro?tab=...&type=...`; a página Financeiro lê esses parâmetros da URL pra
  abrir na aba/filtro certo.
- O dropdown "Tipo" acima da tabela de Produtos continua existindo (não foi
  removido, só deixou de ser o único caminho) — se o bug de renderização nele for
  identificado depois, não precisa reverter nada feito aqui.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 117.

## [2.3.135] — Tipos de produto novos: Acessório e Caça & Pesca — 2026-10-17

### Adicionado
- Dois tipos novos de produto (`accessory`/"Acessório", `hunting_fishing`/"Caça &
  Pesca"), disponíveis no cadastro (`Tipo`) e no filtro da lista de Produtos —
  fecha a lista de categorias pedida pelo cliente junto com a seção 114/115
  (Produto, Armas nacionais/importadas, Munições/Insumos, Acessórios, Caça & Pesca).

## [2.3.134] — Filtro de Produtos separa Armas nacionais/importadas — 2026-10-17

### Adicionado
- Filtro "Tipo" da lista de Produtos ganhou "Armas nacionais" e "Armas importadas"
  no lugar de um "Arma" único — cruza `type="weapon"` com `origin` (Procedência,
  campo que já existia no cadastro), sem precisar de um segundo select nem de
  mudar o `type` gravado no banco.

## [2.3.133] — Filtro por tipo na lista de Produtos (armas x munição x geral) — 2026-10-17

### Adicionado
- Lista de Produtos ganhou filtro "Tipo" (Todos/Produto/Serviço/Arma/Munição-Insumo).
  O dado já vinha segmentado desde a importação (campo `type` do `FinanceProduct`,
  detectado automaticamente pelo importador de relatório de loja de armas), mas não
  tinha como visualizar só um tipo de cada vez — pedido do cliente ao importar uma
  planilha de armas separada, pra não ficar tudo misturado numa lista só.

## [2.3.132] — Lista de Vendas sem paginação na tela — 2026-10-17

### Corrigido
- `SaleService.list` já paginava no backend (20 por página, `count`/`hasMore`) desde
  sempre, mas a tela de Vendas nunca mandava `pageNumber` nem mostrava nenhum
  controle de página — com mais de 20 vendas (ex. depois de importar o histórico),
  o resto ficava inacessível. Mesmo padrão já corrigido antes no módulo Financeiro
  genérico (v2.3.108) — agora replicado aqui.

## [2.3.131] — Botões de PDF/XML da nota autorizada — 2026-10-17

### Adicionado
- Nota fiscal autorizada ganhou botões "Ver / imprimir DANFe (PDF)" e "Baixar XML" na
  coluna Ação, ao lado dos já existentes (e-mail, carta de correção).

### Corrigido
- `pdfUrl`/`xmlUrl` eram salvos como CAMINHO relativo (jeito que a Focus devolve), não
  URL completa — sem prefixar com o host certo, os botões novos dariam 404. Resolvido
  na hora de SERVIR o documento pro frontend (não ao salvar), usando o `environment`
  já gravado em cada nota — conserta também documentos autorizados antes dessa
  correção, sem precisar de migração.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 112.

## [2.3.130] — Rótulo do campo CNPJ/CPF da contabilidade quebrava a borda do campo — 2026-10-17

### Corrigido
- O rótulo "CNPJ/CPF do escritório de contabilidade" (Configuração Fiscal) era longo
  demais pra largura do campo e quebrava em duas linhas, estourando a borda do MUI
  (ficava com aparência "descentralizada"). Encurtado pra "CNPJ/CPF da contabilidade".

## [2.3.129] — Botões de emissão escondidos atrás de clique extra na tela de olho — 2026-10-17

### Corrigido
- O fix da v2.3.127 escondeu os botões de emissão (Emitir NF-e/NFC-e/NFS-e, Pré-visualizar
  DANFe) atrás de um botão extra "Ver / emitir nota fiscal" quando a venda era aberta pelo
  ícone de olho — criava um clique a mais pra chegar nas opções, e duplicava o texto do
  ícone de recibo. Os botões agora aparecem direto nos dois casos; só o HISTÓRICO de
  tentativas/erros antigos é que fica recolhido atrás de um botão "Ver histórico", que era
  o que realmente confundia ao abrir a tela sem avisar.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 110.

## [2.3.128] — Escritório de contabilidade sincronizado com a Focus NFe — 2026-10-17

### Adicionado
- Configuração Fiscal ganhou 3 campos novos (CNPJ/CPF do escritório de contabilidade,
  ID da empresa na Focus, token de conta/master da Focus): ao salvar, o AtendeFlow
  sincroniza automaticamente o escritório de contabilidade direto na API "Empresas"
  da Focus NFe, sem precisar entrar no painel deles. Resolve a rejeição Sefaz 487
  ("Escritório de Contabilidade não cadastrado") de forma permanente — campo exigido
  por alguns estados (ex. BA) e que não vai no payload da nota, é cadastro de empresa
  na própria Focus.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 109.

## [2.3.127] — Ícone de olho não dependurava mais a busca de notas fiscais ao só visualizar a venda — 2026-10-17

### Corrigido
- O ícone de olho ("Ver itens") e o de recibo ("Emitir nota fiscal") na lista de Vendas
  chamavam a mesma função e caíam direto na seção de notas fiscais (buscando o
  histórico de tentativas, inclusive erros antigos) mesmo quando o usuário só queria
  ver os itens da venda. Agora o olho abre só os itens, com um botão "Ver / emitir
  nota fiscal" pra quem quiser expandir; o recibo já abre direto na seção de emissão,
  como antes.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 108.

## [2.3.126] — Grupo do PIS/COFINS faltando no item da nota — 2026-10-17

### Corrigido
- O item da NF-e não enviava nenhum campo de PIS/COFINS — a Sefaz rejeitava com
  "NF-e sem grupo do PIS" (745) assim que os erros anteriores (endereço, NCM) foram
  corrigidos. Adicionado o grupo com CST "99" (Outras Operações) e valores zerados,
  correto pro regime Simples Nacional (mesmo regime já assumido no ICMS — PIS/COFINS
  são recolhidos via DAS, não destacados nota a nota).

Detalhes em `docs/MANUAL_TECNICO.md`, seção 107.

## [2.3.125] — Endereço do destinatário nunca chegava na nota fiscal (attributes limitado) — 2026-10-17

### Corrigido
- O `include` do cliente em `SaleService.ts` (usado pela emissão/pré-visualização de
  nota fiscal) tinha uma lista de `attributes` que não trazia NENHUM campo de endereço
  nem telefone do cliente — só id/nome/documento/tipo/e-mail. Não importava o quão
  completo o cadastro do cliente estivesse: o Sequelize nem buscava essas colunas do
  banco, então a nota sempre ia sem endereço do destinatário, mesmo pra clientes com
  cadastro 100% preenchido. Confirmado comparando um cadastro completo (endereço,
  bairro, cidade, UF todos preenchidos) com o erro "sem a identificação do
  destinatário" que a Sefaz continuava devolvendo.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 106.

## [2.3.124] — Campo NCM do item enviado com nome errado (ncm em vez de codigo_ncm) — 2026-10-17

### Corrigido
- O payload de item da NF-e/NFC-e enviava o NCM no campo `ncm`, mas a Focus NFe espera
  `codigo_ncm` — a Sefaz nunca recebia o valor de verdade, daí o erro continuar mesmo
  depois do fix da v2.3.123 (`normalizeNcm` funcionava certo, só ia pro campo errado).
  Achado testando uma emissão real já com o fix anterior aplicado — o erro mudou de
  "não pode ser vazio" + "não é do tamanho correto" simultâneos pro mesmo campo, sinal
  de que a Focus nem reconhecia a chave enviada.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 105.

## [2.3.123] — modalidade_frete faltando + NCM mal formatado no payload da NF-e — 2026-10-17

### Corrigido
- `modalidade_frete` (campo obrigatório da NF-e) nunca era enviado no payload pra Focus
  NFe — bug de código, não dado de cadastro faltando. Fixado como "9" (sem frete/sem
  transportadora), o padrão certo pra venda de balcão.
- NCM com conteúdo mas formato inválido (diferente de 8 dígitos) passava direto pelo
  fallback antigo (`item.ncm || "00000000"` só cobre valor vazio) e ia pro payload do
  jeito errado. Agora valida o formato, não só a presença.

Achados pela resposta bruta da Focus NFe (botão "ver resposta completa", v2.3.122) numa
tentativa real de emissão — o mesmo payload é usado tanto na emissão quanto na
pré-visualização de DANFe, então a correção vale pros dois fluxos.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 104.

## [2.3.122] — Inscrição Estadual do emitente com pontuação quebrava o XML + resposta bruta da Focus NFe agora fica salva — 2026-10-17

### Corrigido
- A Inscrição Estadual do emitente ia pro XML da nota com pontuação (ex.: "182.174.539"
  em vez de "182174539") — a Sefaz espera só dígitos nesse campo. Provável causa real do
  erro de schema continuar mesmo com o endereço do emitente já preenchido certo.

### Adicionado
- Toda nota com erro de emissão agora guarda a resposta completa (JSON bruto) da Focus
  NFe, acessível por um botão novo na tela de detalhe da venda — antes só a mensagem
  resumida ficava salva, dificultando diagnosticar quando ela vinha sem detalhe.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 103.

## [2.3.121] — Cabeçalho/rodapé personalizado (logo + endereço) na impressão do Painel Financeiro — 2026-10-17

### Adicionado
- "Imprimir / Exportar PDF" do Painel Financeiro agora sai com cabeçalho personalizado:
  logomarca da empresa (a mesma cadastrada em Configurações → Whitelabel) no canto
  superior direito, nome e endereço da empresa à esquerda, e rodapé com a data de
  geração. Endereço vem do mesmo cadastro já usado na nota fiscal (Configuração
  Fiscal → Endereço do emitente) — não precisa cadastrar de novo.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 102.

## [2.3.120] — Pré-visualização de DANFe escondia o erro real + mensagem de schema sem detalhe — 2026-10-17

### Corrigido
- "Pré-visualizar DANFe" mostrava só "An error occurred!" quando falhava, sem detalhe
  nenhum — o erro verdadeiro vinha escondido porque a chamada pede o PDF como binário
  (blob), e isso também mascarava a mensagem de erro em JSON. Agora lê o erro de
  verdade mesmo numa resposta binária.
- A mensagem de erro de emissão (Focus NFe) mostrava sempre o texto genérico ("Erro na
  validação do Schema XML, verifique o detalhamento dos erros") sem o detalhamento que
  ela mesma promete — o gateway manda os dois juntos, mas o código só lia o genérico.
  Agora mostra os dois, apontando o campo específico que está falhando.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 101.

## [2.3.119] — Endereço do emitente na nota fiscal + corrige inutilização de numeração — 2026-10-17

### Corrigido
- Primeiro teste real de NF-e deu "Erro na validação do Schema XML" — causa provável:
  o endereço da PRÓPRIA empresa (emitente) nunca era enviado pro gateway, nem existia
  campo pra isso em lugar nenhum do sistema. Novo bloco "Endereço do emitente" na tela
  de Configuração Fiscal (logradouro, número, complemento, bairro, CEP, município, UF,
  telefone) — enviado junto na emissão de NF-e/NFC-e.
- Tela de "Inutilizar numeração de NF-e" mostrava "sucesso" mesmo quando o gateway
  recusava o pedido, e a lista de inutilizações já feitas nunca aparecia preenchida.
  Agora confere a resposta real do gateway (mostra o erro quando falha) e guarda as
  inutilizações confirmadas no próprio banco, em vez de depender de uma consulta à
  Focus NFe que não estava devolvendo nada.

### Pendente
- Logo da empresa na nota fiscal: sem confirmação de que a Focus NFe aceita isso por
  API — provavelmente é configuração direta no painel do gateway, não código. A
  decidir com o cliente antes de implementar algo que pode não aparecer na nota real.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 100.

## [2.3.118] — Reforma Tributária 2027 (preparação) + excluir vendas/notas de teste — 2026-10-16

### Adicionado — Reforma Tributária 2027 (IVA/CBS/IBS)
- Estrutura completa pré-configurada pra transição tributária de janeiro de 2027,
  conforme especificação técnica detalhada do cliente — **sem nenhum efeito no
  faturamento atual** enquanto a chave global "Ativar Regras de Faturamento IVA
  (Reforma Tributária 2027)" (Configuração Fiscal) estiver desligada (padrão).
- Cadastro de Cliente: perfil do destinatário (B2C/B2B/B2G) e isenção de órgão
  público — campos desabilitados até a chave ser ativada.
- Cadastro de Produto: CST e alíquotas estimadas de CBS/IBS, indicador de
  redução de 60% pra curso/treinamento — idem, desabilitados até a chave ser
  ativada.
- Motor de cálculo (`Iva2027Service.ts`) pronto e testado isoladamente, aplicado
  automaticamente a cada venda (snapshot nos itens) a partir do momento em que a
  chave for ativada — sem precisar de deploy novo nesse dia.
- Tela de fechamento de venda mostra, só de visualização técnica (acinzentado
  até a chave ser ativada), o Subtotal Líquido e a previsão de CBS/IBS por fora.
- Preparação estrutural (3 colunas, sem nenhuma integração ainda) pra quando a
  API do Asaas liberar o split automático do imposto no pagamento online.

### Adicionado — Excluir vendas e notas de teste (Homologação)
- Agora é possível excluir de verdade (não só cancelar) uma nota fiscal ou uma
  venda confirmada/cancelada, desde que nenhuma delas tenha sido emitida em
  modo **Produção** (nota fiscal real) — pensado pra limpar o teste feito em
  Homologação antes/depois de passar pra Produção.
- Exclusão da venda nunca altera o estoque atual, mesmo que a venda tenha
  descontado estoque ao ser confirmada durante o teste.
- Uma venda de Produção (ou com qualquer nota de Produção emitida) nunca pode
  ser excluída — só cancelada, como já era.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 99.

## [2.3.117] — Dashboard de lucro: compra × imposto × venda × lucro — 2026-10-16

### Adicionado
- Cadastro de Produto ganhou o campo "Alíquota de imposto (%)" — junto com "Preço de
  custo" já existente, é a base do cálculo de lucro automático em toda venda.
- Painel Financeiro ganhou a seção "Compra × imposto × venda × lucro": cartões de
  totais (comprado/custo, impostos, vendido/bruto, lucro líquido com margem %),
  gráfico mensal (barra empilhada custo+imposto+lucro, soma = valor vendido, com
  tooltip ao passar o mouse) e tabela "Produtos por margem de lucro" com botão
  "Baixar Excel".
- Detalhe de uma venda (módulo fiscal) agora mostra Valor bruto, Impostos e Valor
  líquido (após impostos) — calculado a partir do custo/alíquota gravados no
  momento da venda.
- Esse painel só aparece quando a Focus NFe estiver em modo **Produção** — venda de
  teste em Homologação e o histórico importado da migração de ERP não entram nessa
  conta de lucro (decisão confirmada com o cliente).
- Impressão/exportar PDF reaproveita o botão já existente do Painel Financeiro
  (window.print()); Excel usa o mesmo padrão já usado em Relatórios (`xlsx`).

Detalhes em `docs/MANUAL_TECNICO.md`, seção 98.

## [2.3.116] — Importação de vendas históricas (migração de ERP) — 2026-10-16

### Adicionado
- Tela de Vendas (módulo fiscal) ganhou botão "Importar planilha" — lê o
  "Relatório de Notas" (Consulta de Notas Fiscais - Analítico) exportado do
  sistema anterior do cliente e registra cada nota como uma venda já
  confirmada, com seus itens e uma conta a receber já marcada como "recebida".
- Cobre as 3 situações encontradas no relatório real do cliente: Aprovada
  (venda confirmada + nota autorizada), Cancelada (venda cancelada, sem conta
  a receber) e "NF-e Rejeitado" (venda confirmada — a mercadoria foi vendida
  de verdade — mas o documento fiscal fica marcado como erro, já que a nota
  em si nunca foi validada pela Sefaz).
- **Nunca** chama o gateway de emissão (Focus NFe) — essas notas já existem
  de verdade no sistema anterior, a importação só registra o que já
  aconteceu. **Nunca** desconta estoque — confirmado com o cliente que só
  venda lançada a partir de agora movimenta estoque.
- Reimportar a mesma planilha não duplica (idempotente por número da nota).
- Validado com o relatório real do cliente antes de liberar: 486 notas
  extraídas de 5.535 linhas, todas com cliente e itens.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 97.

## [2.3.115] — Erro interno sempre que abria a Configuração Fiscal — 2026-10-16

### Corrigido
- `FocusNFeService.listInvalidations` (consulta de inutilizações de numeração, v2.3.106)
  era a única das sete funções novas da Focus NFe sem tratamento de erro — qualquer
  falha nessa chamada derrubava a tela de Configuração Fiscal inteira com "Internal
  server error", já que ela busca essa lista toda vez que abre. Agora falha
  silenciosamente (lista vazia) como as outras seis funções já faziam.

## [2.3.114] — Módulo de estoque: bloqueia venda sem disponibilidade, desconta/devolve no confirmar/cancelar, painel de saúde — 2026-10-16

### Adicionado
- Confirmar uma venda agora **bloqueia** se algum item (com produto vinculado que
  controla estoque) pedir mais do que o estoque disponível — mensagem mostra qual
  produto e quanto falta.
- Estoque é descontado automaticamente ao confirmar a venda, e devolvido automaticamente
  ao cancelar uma venda confirmada.
- Novo campo "Estoque mínimo (aviso)" no cadastro de Produto — define o nível que
  dispara o aviso de estoque baixo (0 = sem aviso configurado).
- Painel Financeiro ganhou uma seção "Situação do estoque" — lista produtos zerados e
  produtos abaixo do mínimo configurado.
- Só vale pra produto com "Controlar estoque" ligado — item avulso (sem produto
  cadastrado) ou produto que não controla estoque nunca entram nessa conta.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 95.

## [2.3.113] — Mensagem de erro da nota fiscal não cortava mais em 40 caracteres — 2026-10-16

### Corrigido
- Primeiro teste real contra a Focus NFe (homologação) deu erro de validação de XML —
  mas a tela cortava a mensagem em 40 caracteres ("Erro na validação do Schema XML,
  verifiq...") com o resto só num tooltip de hover, impossível de ler/copiar num
  print. Mensagem de erro agora aparece inteira, direto na tela.

## [2.3.112] — Removido o seletor "Ambiente ativo" da Configuração Fiscal — 2026-10-16

### Corrigido
- Cliente pediu pra só ter os campos Homologação e Produção na tela — o seletor
  separado "Ambiente ativo" saiu. Qual das duas credenciais é usada ao emitir agora
  passou a ser decidido direto pelos dois botões liga/desliga: Produção habilitada
  tem prioridade (é a opção "de verdade"); senão usa Homologação, se estiver
  habilitada.

## [2.3.111] — "Tipo de documento padrão" só NF-e/NFC-e — 2026-10-16

### Corrigido
- Cliente confirmou que só trabalha com NF-e e NFC-e — "Tipo de documento padrão" (em
  Configuração Fiscal) mostrava NFS-e como terceira opção também. Removida da lista;
  a emissão manual de NFS-e continua disponível (detalhe da venda), só deixou de ser
  opção de emissão automática.

## [2.3.110] — Ajuste visual: alinhamento da Configuração Fiscal — 2026-10-16

### Corrigido
- Cliente testou a tela nova (v2.3.109) e reportou "painel desorganizado": o grid de
  campos tinha linhas de tamanhos diferentes se misturando (ex.: "Série NF-e" ficava
  colado ao lado do cartão "Produção" em vez de ficar agrupado com as outras séries).
  Reorganizado pra cada "grupo" de campos sempre fechar a própria linha (soma 12) antes
  do próximo começar — "Tipo de documento padrão" e "CFOP padrão" viraram largura
  cheia, Homologação/Produção sempre começam linha nova, Séries NF-e/NFC-e/NFS-e
  sempre ficam juntas.

## [2.3.109] — Homologação/Produção separadas, CFOP e Município com busca — 2026-10-16

### Adicionado
- **Configuração Fiscal — Homologação e Produção viraram credenciais separadas**, igual
  ao próprio painel da Focus NFe: cada ambiente tem seu próprio token e um botão
  liga/desliga independente, em vez de um token único alternando por um seletor de
  ambiente. O seletor "Ambiente ativo" só deixa escolher um ambiente que esteja
  habilitado.
- **CFOP com busca** — digita o código ou parte da descrição e filtra, em vez de
  precisar saber/procurar de cabeça. Tabela completa (~600 códigos, fonte oficial
  pública). Vale pro "CFOP padrão" da Configuração Fiscal e pro CFOP de cada item
  numa venda.
- **Código IBGE do município automático** — escolhe o Estado, depois o Município
  (busca com filtro, ~5.570 municípios do Brasil inteiro, fonte pública do IBGE), o
  código IBGE preenche sozinho. Campo de texto livre saiu de cena.

### Corrigido
- Confirmado com o cliente (vendo o próprio painel da Focus NFe) que o certificado
  digital já fica anexado **na conta do gateway**, não precisa de upload nenhum no
  AtendeFlow — dúvida antiga da Fase 3 finalmente resolvida.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 92.

## [2.3.108] — Paginação na lista de Produtos/Clientes/Fornecedores/Contas — 2026-10-16

### Corrigido
- As telas de cadastro do Financeiro (Produtos, Clientes, Fornecedores, Contas a Pagar/
  Receber) são paginadas no servidor (20 por página) desde sempre, mas a tela nunca
  mostrava um jeito de ir pra próxima página — com mais de 20 registros cadastrados, o
  resto ficava inacessível por ali (só dava pra achar pela busca). Batido na prática com
  206 clientes e 60 produtos reais cadastrados. `FinanceRecordList` ganhou um
  `TablePagination` no rodapé da tabela; busca ou troca de filtro sempre volta pra
  página 1.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 91.

## [2.3.107] — Importação de Clientes: ajustes pro Relatório de Clientes real do ERP antigo — 2026-10-16

### Corrigido
- O importador genérico de Clientes não reconhecia 3 colunas do Relatório de Clientes real
  do ERP antigo do cliente ("Nome / Razão Social", "Telefone 1", "Compl.") — o texto
  normalizado delas não batia exatamente com nenhum apelido já cadastrado (mesma pegadinha
  de "igualdade exata, não substring" já documentada pro importador de Produtos). Testado
  contra o arquivo real: 205/205 clientes reconhecidos depois do ajuste (eram 0/205 antes).

### Adicionado
- Colunas da planilha sem campo correspondente no cadastro de Cliente/Fornecedor (código do
  sistema antigo, data de nascimento, RG/IE, telefones extras, nome para contato) agora são
  guardadas automaticamente em Observações, em vez de descartadas — evitando linha repetida
  quando a planilha já tinha o mesmo valor em duas colunas (ex.: Nome Fantasia igual ao nome,
  Telefone 2/3 iguais ao Telefone 1).

Detalhes em `docs/MANUAL_TECNICO.md`, seção 90.

## [2.3.106] — Focus NFe: carta de correção, envio por e-mail, pré-visualização de DANFe, inutilização de numeração — 2026-10-16

### Adicionado
- Cinco funções novas no adaptador da Focus NFe, confirmadas contra os endpoints reais
  (curls copiados da documentação oficial pelo cliente): Carta de Correção, Enviar nota
  por e-mail, Pré-visualização de DANFe (antes de emitir de verdade), e Inutilizar
  Numeração + Consultar Inutilizações (pra quando um número de nota "quebra").
- `FiscalGatewayAdapter` ganhou esses métodos como **opcionais** — nem todo gateway
  futuro vai ter equivalente pra cada um (ex.: carta de correção só existe no modelo de
  NF-e); quem chama trata a ausência como recurso não suportado por aquele gateway.
- Tela de detalhe da venda: botões "Enviar por e-mail" e "Carta de correção" por nota
  emitida, e "Pré-visualizar DANFe" antes de confirmar a emissão de verdade.
- Configuração Fiscal: nova seção "Inutilizar numeração de NF-e" (formulário +
  histórico de inutilizações já registradas).

### Nota
- Essas funções (e o restante do adaptador da Focus NFe) ainda **não foram testadas
  contra uma chamada real** — só o método/URL dos endpoints foi confirmado pelo
  cliente; o formato exato do corpo de cada requisição segue sem validação até ter um
  token de homologação de verdade.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 89.

## [2.3.105] — Fiscal: gateway escolhível + emissão automática na venda; código do produto nas vendas — 2026-10-16

### Adicionado
- Módulo Fiscal deixou de estar travado na Focus NFe: criado um dispatcher
  (`FiscalGatewayService`) que escolhe o gateway pelo campo `gatewayProvider` da
  Configuração Fiscal — hoje só "Focus NFe" está de fato implementado, mas adicionar um
  gateway novo no futuro é só criar um arquivo com as mesmas três funções
  (`emit`/`getStatus`/`cancel`) e registrar, sem tocar em nenhum outro lugar do sistema.
  Tela de Configuração Fiscal ganhou um seletor de gateway (lista vem do backend,
  `GET /fiscal/gateways`, não é mais hardcoded no frontend).
- Novo campo "Tipo de documento padrão" na Configuração Fiscal (`nfe`/`nfce`/`nfse`/
  nenhum) — se definido, a venda já sai com a nota fiscal emitida (PDF/XML) assim que o
  operador confirma, sem precisar ir na tela de detalhe apertar "Emitir". Em branco
  (padrão), nada muda — continua 100% manual como antes.
- Campo "Código (SKU)" nos itens da tela de Vendas (Nova Venda e detalhe da venda) —
  pedido do cliente pra aparecer o código do produto como consta no cadastro. Preenchido
  automaticamente ao escolher o produto, mas editável (item avulso sem produto
  cadastrado pode ter um código digitado à mão).

### Corrigido
- A nota fiscal emitida usava o **id interno do banco** como "código do produto"
  (`codigo_produto` no payload da Focus NFe) — não tinha nenhum significado fora do
  AtendeFlow. Agora usa o SKU real do produto.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 88.

## [2.3.104] — Ajuste visual: rótulo dos campos de busca estava quebrando linha — 2026-10-16

### Corrigido
- Os campos "Cliente" e "Produto/serviço" (busca com filtro, v2.3.103) tinham rótulo longo
  demais ("Cliente (nome, CPF/CNPJ ou e-mail — vazio = consumidor não identificado)") e
  quebravam linha dentro do campo compacto, ficando descentralizados. Trocado por rótulo
  curto ("Cliente"/"Produto/serviço") + texto de apoio como placeholder (dentro do campo,
  não quebra linha) — `FinanceAsyncAutocomplete` ganhou a prop `placeholder`.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 87.

## [2.3.103] — Busca com filtro em Produto/Cliente/Fornecedor (Vendas e Contas) — 2026-10-16

### Adicionado
- Campo "Produto/serviço" e "Cliente" na tela de Vendas, e "Fornecedor"/"Cliente" em
  Contas a Pagar/Receber, agora são um campo de busca (autocomplete) — digita o nome,
  SKU (produto) ou CPF/CNPJ/e-mail (cliente/fornecedor) e filtra, em vez de rolar uma
  lista inteira catando um por um.
- Busca feita no servidor (com atraso de digitação) em vez de só filtrar uma lista já
  carregada — o cadastro de Produtos/Clientes/Fornecedores é paginado (20 por página),
  então carregar tudo de uma vez de propósito não escalaria pra um catálogo maior
  (ex.: os 65 produtos recém-importados).
- Componente novo reaproveitável (`FinanceAsyncAutocomplete`) usado nos dois lugares —
  qualquer campo novo do Financeiro que precise de busca num outro cadastro usa o mesmo.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 87.

## [2.3.102] — Planilha-modelo pra download (Produtos e Clientes) — 2026-10-16

### Adicionado
- Botão "Baixar modelo" nas abas Produtos e Clientes do Financeiro — baixa um `.xlsx` com
  as colunas certas (mesmas que a importação reconhece) já com uma linha de exemplo
  preenchida, pra facilitar montar a planilha de importação do zero.
- Os títulos de coluna do modelo foram escolhidos pra normalizar exatamente igual a um
  alias já reconhecido pelo importador — preencher o modelo baixado e reimportar funciona
  de ponta a ponta, sem precisar adivinhar nome de coluna.

### Corrigido (causa raiz do bug de importação das últimas versões)
- Achada a causa real de por que v2.3.97-101 pareciam não ter efeito em produção: o
  servidor usava `git show origin/<branch>:<arquivo>` pra copiar cada arquivo sem rodar
  `git fetch` antes — a referência local do branch remoto ficou travada no commit da
  v2.3.96 desde a primeira tentativa de `git pull`, então toda cópia de arquivo nas
  rodadas seguintes trazia a versão antiga, mesmo com os commits certos já no GitHub.
  Não é bug de código — é do roteiro de deploy. Documentado em `docs/MANUAL_TECNICO.md`.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 86.

## [2.3.101] — Log de diagnóstico da v2.3.100 não aparecia (Pino sem efeito neste ambiente) — 2026-10-15

### Corrigido (diagnóstico)
- A v2.3.100 usou `logger.info` (Pino + `pino-pretty`) pro log de diagnóstico, mas ele nunca
  apareceu nos logs do container mesmo depois de várias tentativas confirmadas pelo cliente
  — diferente do `console.log`/`console.warn` usados em outras partes do sistema (`[WBOT]...`
  etc.), que aparecem normalmente. Trocado pra `console.log` simples, e adicionados dois logs
  a mais (início e fim de `importProducts`) pra confirmar, na pior hipótese, se a função
  sequer está sendo chamada.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 85.

## [2.3.100] — Diagnóstico: por que a importação de produtos não reconheceu o relatório em produção — 2026-10-15

### Corrigido (diagnóstico)
- Cliente testou a importação do `RELATORIO_DE_PRODUTOS_GERAIS_DE_ARMAS.xlsx`
  em produção e recebeu "0 criado(s), 165 inválido(s)" — caiu no
  importador genérico, mesmo o arquivo tendo sido validado localmente
  (60 produtos reconhecidos corretamente, mesma versão de código).
- Causa ainda não identificada. Adicionado log temporário em
  `parseGunStoreReport`: se não achar o cabeçalho "Cód. Produto", agora
  registra a versão da lib `xlsx` em uso e o conteúdo real das primeiras
  15 linhas da coluna A — próxima tentativa do cliente vai revelar a causa
  exata (acento/espaço/encoding diferente, versão de lib diferente, etc.)
  em vez de precisar adivinhar.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 85.

## [2.3.99] — Vincula Contato do Atendimento a Cliente do Financeiro — 2026-10-15

### Adicionado
- No cadastro de um Contato já existente (Atendimento), quem tem acesso ao
  módulo Financeiro agora vê um botão "Cadastrar como cliente (Financeiro)"
  — cria (ou reaproveita, se já existir) o Cliente correspondente no
  Financeiro, copiando nome/telefone/e-mail do Contato, sem precisar
  recadastrar tudo de novo.
- Depois de vinculado, o Contato mostra um indicador "Cliente financeiro
  vinculado" no lugar do botão.
- Direção da sincronia (decidida com o cliente): nome/telefone sempre vêm
  do Contato — editar isso no Financeiro não volta pro Contato. CPF/CNPJ,
  endereço e os demais campos fiscais só existem e só são editáveis no
  cadastro de Cliente do Financeiro.
- Quem trabalha só no Financeiro continua podendo cadastrar um Cliente do
  zero por lá, sem precisar de um Contato prévio — nada mudou nesse fluxo.
- Visibilidade do botão segue a mesma permissão já existente do módulo
  (`Plan.useFinancial` + `User.financialAccess`) — quem não tem acesso ao
  Financeiro não vê a opção.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 84.

## [2.3.98] — Importação reconhece o Relatório de Produtos do ERP da loja de armas — 2026-10-15

### Adicionado
- A importação de Produtos agora detecta automaticamente o formato fixo do
  "Relatório de Produtos" exportado pelo sistema atual da loja (cabeçalho
  "Cód. Produto", células mescladas, cabeçalho repetido a cada página) —
  antes só reconhecia planilha simples com cabeçalho na primeira linha.
- Categoria do relatório (Pistola, Revólver, Carabina, Espingarda, Rifle,
  Munição, Espoleta, Cartela, Pólvora...) mapeia automaticamente pro Tipo
  do produto (Arma/Munição) e, quando aplicável, pro Tipo da arma.
- Marca e calibre são reconhecidos a partir da descrição do produto quando
  aparecem explícitos no texto (ex.: "MUN CBC 9MM...", "PISTOLA GLOCK
  G25..."). Best-effort: quando não aparecem no texto (comum em modelos
  Taurus, cuja descrição geralmente não repete a marca), o campo fica em
  branco pra preencher manual — não tenta adivinhar.
- Planilha de teste real da Confiança Technologies: 60 produtos, 36 armas e
  24 munições/insumos reconhecidos, marca identificada em 35 e calibre em
  43 deles.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 83.

## [2.3.97] — Corrige migration de armas/munições que travava em produção — 2026-10-15

### Corrigido
- A migration da v2.3.95 (`20261015120000-add-weapon-fields-to-finance-products`)
  usava `addColumn` em sequência sem transação. Uma tentativa anterior que falhou
  no meio deixava colunas já criadas no banco, mas a migration inteira ficava
  marcada como "não executada" — rodar `db:migrate` de novo batia em "column
  already exists" na primeira coluna e travava pra sempre, nunca completando
  (reproduzido em produção).
- Reescrita pra ser idempotente (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`,
  `CREATE UNIQUE INDEX IF NOT EXISTS`) — rodar de novo sempre completa, pulando
  o que já existe e criando só o que falta.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 82.

## [2.3.96] — Módulo Financeiro: importação de produtos/clientes/fornecedores via Excel — 2026-10-15

### Adicionado
- Botão "Importar planilha" nas abas Produtos, Clientes e Fornecedores do
  Financeiro — sobe um `.xlsx`/`.xls`/`.csv` e o backend detecta
  automaticamente qual coluna da planilha corresponde a cada campo do
  sistema (nome, calibre, preço, CPF/CNPJ etc.), por nome de cabeçalho —
  não é preciso mapear coluna por coluna na tela.
- Linha cujo SKU (produto) ou CPF/CNPJ (cliente/fornecedor) já existe na
  empresa **atualiza o registro existente** em vez de duplicar; sem esse
  identificador, cai pro nome. Resumo ao final (criados/atualizados/
  inválidos) via toast.
- Endpoints novos: `POST /finance/products/import`,
  `/finance/customers/import`, `/finance/suppliers/import`
  (`FinanceImportService.ts`/`FinanceImportController.ts`).

### Observação
- Planilha enviada é removida do servidor depois de processada — não fica
  acessível por URL (pode conter dado comercial sensível).
- Produtos do tipo Arma/Munição reconhecem as mesmas colunas regulatórias
  adicionadas na v2.3.95 (marca, calibre, número de série etc.).

Detalhes em `docs/MANUAL_TECNICO.md`, seção 6.2 (Fase 6) e seção 81.

## [2.3.95] — Módulo Financeiro: cadastro de armas/munições/insumos (clube de tiro, loja de armas, armaria) — 2026-10-15

### Adicionado
- `FinanceProduct` ganhou dois novos tipos, "Arma" e "Munição / Insumo", e um
  conjunto de campos regulatórios que só aparecem no formulário quando o
  Tipo escolhido é um desses dois — marca/fabricante, modelo, calibre
  nominal, número de série (obrigatório e único por empresa pra arma),
  capacidade de cartuchos, regime de funcionamento, quantidade/comprimento
  do cano, tipo de alma, energia cinética da munição (Joules), classificação
  de uso (permitido/restrito), nº de registro SIGMA/SINARM, procedência,
  situação da arma, lote de fabricação e código de barras/embalagem
  (munição/insumo). Referência regulatória: Decreto 11.615/2023, Decreto
  12.345/2024, Estatuto do Desarmamento (Lei 10.826/2003).
- `FinanceRecordModal` (componente genérico de formulário do Financeiro)
  ganhou suporte a campo condicional (`visibleWhen`) e obrigatoriedade
  condicional (`requiredWhen`) — capacidade nova, reaproveitável por
  qualquer cadastro futuro do módulo.

### Observação
- Marcas Taurus, CBC, Glock e Imbramun citadas pelo cliente como exemplo —
  o campo de marca é texto livre, não uma lista fixa.
- A classificação de uso (permitido/restrito) é preenchida manualmente; não
  há cálculo automático de conformidade com os decretos citados — isso
  continua sendo responsabilidade do cliente/especialista legal.
- Próximas partes deste mesmo pedido (ainda não implementadas): importação
  de produtos/clientes/fornecedores via Excel, e contas bancárias.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 6.2 (Fase 6) e seção 80.

## [2.3.94] — Link de arquivo sempre funciona, mesmo com caractere fora do padrão no nome — 2026-10-15

### Corrigido
- A correção da v2.3.93 só evitava o problema em uploads novos feitos
  pelo chat. Documentos que chegam com nome já "fora do padrão" por
  outro caminho (ex.: nota fiscal baixada e assinada digitalmente no
  gov.br, cujo nome de arquivo pode conter sequências de caractere
  atípicas) continuavam dando "Cannot GET" ao visualizar/baixar.
- Correção mais ampla, no local onde o link é montado
  (`Message.mediaUrl`, usado por todo o sistema): o nome do arquivo
  agora é sempre codificado corretamente (`encodeURIComponent`) antes
  de virar link — não importa a origem do nome ou quais caracteres
  incomuns ele tenha, o link sempre funciona.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 79.

## [2.3.93] — Corrige nome de arquivo com caractere especial (º, ç, ã...) — 2026-10-14

### Corrigido
- Upload de arquivo com caractere especial no nome (ex.: "NF_Nº_481...")
  gerava um nome de arquivo com bytes errados no disco — o navegador
  manda o nome em UTF-8, mas o Node decodifica como Latin-1 por padrão.
  Resultado: a URL salva no banco não batia mais com o arquivo real,
  dando "Cannot GET" tanto ao visualizar quanto ao baixar.
- Corrigido pra reinterpretar o nome corretamente antes de salvar.
  **Atenção**: isso previne o problema em uploads novos — arquivos já
  salvos com o nome corrompido antes dessa correção continuam com o
  nome errado no disco (não há como recuperar isso por código, o byte
  errado já foi gravado).

Detalhes em `docs/MANUAL_TECNICO.md`, seção 78.

## [2.3.92] — Visualização real de Word/Excel/PowerPoint/OpenDocument na caixa do chat — 2026-10-14

### Adicionado
- A caixa de "Visualizar" de um documento (Word, Excel, PowerPoint,
  OpenDocument — `.doc/.docx/.xls/.xlsx/.ppt/.pptx/.odt/.ods/.odp/.rtf`)
  agora mostra o conteúdo real, convertido pra PDF **no próprio servidor**
  (LibreOffice headless) — sem mandar o arquivo pra nenhum serviço
  externo (Google Docs Viewer, Microsoft Office Viewer), por decisão do
  cliente sobre privacidade de documentos sensíveis.
- Resultado fica em cache no servidor — a conversão só roda uma vez por
  arquivo, reaberturas seguintes são instantâneas.
- `.xml` passa a abrir com conteúdo direto (navegador renderiza
  nativamente, igual já acontecia com `.txt`/PDF).
- Se a conversão falhar (arquivo corrompido, timeout), a caixa mostra
  aviso específico + botão de baixar o arquivo original — nunca trava
  nem derruba o chat.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 77.

## [2.3.91] — Corrige caminho errado do arquivo ao reencaminhar mídia — 2026-10-14

### Corrigido
- Reencaminhar qualquer mídia (foto, documento, etc.) sempre falhava
  com "Erro ao enviar mensagem do WhatsApp..." (ou, após a correção
  anterior, "arquivo original não está mais disponível no servidor")
  — mesmo pra mídia enviada na hora, nunca apagada. Causa raiz: o
  `forwardMessage` montava o caminho da pasta pública errado
  (`/backend/public`, uma pasta que nunca existiu no container) em vez
  do caminho real (`/app/public`). Corrigido pra usar o mesmo padrão
  de `upload.ts`.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 76.

## [2.3.90] — "Visualizar" documento abre caixa, não salva/abre direto — 2026-10-13

### Corrigido
- Clicar no olho de "Visualizar" num documento recebido levava direto
  pra nova aba — e pra Word/Excel isso significava o navegador sair
  baixando o arquivo sozinho, sem o operador decidir antes.
- Agora abre uma caixa (modal) dentro do sistema: PDF e `.txt` mostram
  o conteúdo de verdade (navegador renderiza nativamente, sem serviço
  externo tipo Google Docs Viewer); Word/Excel/outros mostram
  "Visualização não disponível" + nome do arquivo, com botão de Baixar
  só quando o operador decidir clicar. Os botões "Abrir" (nova aba) e
  "Baixar" (link direto) no card continuam como estavam.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 75.

## [2.3.89] — Botão de visualizar (nova aba) em todo tipo de documento — 2026-10-13

### Corrigido
- O botão/card clicável de "visualizar" um documento recebido só
  aparecia para PDF — anexos de Word, planilha ou texto não tinham
  esse botão, nem o card inteiro era clicável (só o ícone "Abrir" ao
  lado funcionava pra esses tipos).
- Agora todo documento (txt, Word, Excel, PDF, etc.) tem o botão de
  "olho" (Visualizar) e o card inteiro é clicável, abrindo em nova aba
  do navegador — mesmo comportamento que já existia só para PDF.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 74.

## [2.3.88] — Documento/PDF recebido abre em nova aba, não mais em preview embutido — 2026-10-13

### Corrigido
- Ao clicar num documento (PDF) recebido numa conversa, o sistema abria
  um modal com o arquivo num iframe dentro da própria tela do
  AtendeFlow. Isso causava confusão — o usuário esperava um
  comportamento de "abrir arquivo" normal (nova aba do navegador), não
  um visualizador embutido no sistema.
- Agora o clique no card do documento, e no botão "Visualizar PDF",
  abrem o arquivo em uma aba nova do navegador — igual ao botão "Abrir"
  (ícone de nova janela) que já existia ao lado. O modal de preview
  embutido (iframe) foi removido, assim como o estado que só ele usava.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 72.

## [2.3.87] — Indicador de carregamento ao enviar resposta rápida com anexo — 2026-10-10

### Corrigido
- Resposta rápida com arquivo anexado (imagem/vídeo) parecia travada ao
  enviar: o clique dispara um download do arquivo do servidor pro
  navegador (antes de reanexar e enviar a mensagem), e esse passo não
  tinha nenhum indicador visual — pra anexos maiores (ex.: vídeo de
  ~8MB), a demora de rede dava a impressão de erro/travamento sem
  nenhum feedback na tela.
- Agora o botão de enviar mostra um spinner durante todo o processo
  (desde o download do anexo até o envio da mensagem), igual ao padrão
  já usado no envio de áudio gravado.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 71.

## [2.3.86] — Upload de capa/logo do login não persistia no banco — 2026-10-05

### Corrigido
- Painel Master → Configurações → "Login / capa": o upload da imagem de
  fundo (capa do login) mostrava sucesso na hora, mas sumia depois de um
  F5. Causa: o endpoint de upload (`POST /global-config/upload`) só
  grava o arquivo em disco e devolve a URL — quem de fato persiste a
  associação no banco é o `PUT /global-config` (usado pelo Painel SaaS),
  e essa chamada nunca acontecia nessa tela — só atualizava estado local
  em memória do React, que se perde ao recarregar a página.
- Mesmo bug, mesma causa, no campo "Link do WhatsApp do login": nunca
  teve nenhum gatilho de salvamento, nem botão nem `onBlur`.
- Corrigido fazendo upload e a troca de foco do campo de WhatsApp
  chamarem `PUT /global-config` imediatamente (mesmo padrão já usado
  pelos outros uploads de logo/favicon/ícones nesta mesma tela, que já
  persistiam direto sem precisar de botão "Salvar" separado).

Detalhes em `docs/MANUAL_TECNICO.md`, seção 70.

## [2.3.85] — Remove o gate de token do `/public-settings` (causa raiz do 403 crônico na logo/nome da tela de login) — 2026-10-05

### Corrigido
- A tela de login/signup vinha dando 403 recorrente ao buscar a logo e o
  nome do sistema antes do usuário logar (`GET /public-settings/...`),
  mesmo depois de trocar o valor hardcoded `"wtV"` pela variável de
  ambiente em três arquivos do frontend numa etapa anterior — o 403
  persistia porque o `token=wtV` hardcoded de verdade estava num quarto
  lugar nunca tocado: um `<script>` inline em `frontend/public/index.html`
  (splash screen, roda antes do bundle React carregar), que não passa
  pelas variáveis `REACT_APP_*` injetadas no build.
- Causa raiz maior: esse "token" (`ENV_TOKEN`) nunca protegeu nada de
  verdade — é um valor único e global (não por usuário, não por empresa)
  que já ia embutido em texto plano no bundle JS público baixado por
  qualquer um na tela de login. Em vez de continuar caçando o próximo
  lugar hardcoded, a rota `GET /public-settings/:settingKey` (logo,
  nome do app — dados já pensados pra serem públicos, usados antes de
  autenticar) agora é pública de verdade, sem checagem de token.

### Removido
- Middleware `envTokenAuth` (`backend/src/middleware/envTokenAuth.ts`) e
  seu uso em `settingRoutes.ts` (import solto em `authRoutes.ts` também
  removido, nunca chegou a ser aplicado em nenhuma rota lá).
- Variável `ENV_TOKEN`/`REACT_APP_ENV_TOKEN` de `docker-compose.coolify.yml`,
  `.env.coolify.example`, `backend/.env.example`, `frontend/Dockerfile`
  (incluindo o bloco de debug temporário deixado da investigação
  anterior) e dos quatro pontos do frontend que mandavam
  `?token=...` (`useSettings`, `Login`, `Signup`, `public/index.html`).

Detalhes em `docs/MANUAL_TECNICO.md`, seção 69.

## [2.3.84] — Falso alarme no aviso de número de outro país — 2026-09-21

### Corrigido
- O aviso de "número de fora do Brasil" (v2.3.83) disparava pra número
  BR legítimo no formato antigo (12 dígitos, sem o 9º dígito do
  celular) — o sistema já trata esse formato como BR válido em outro
  lugar (`CheckNumber.ts`), mas o filtro do aviso só reconhecia o
  formato completo de 13 dígitos.
- Corrigido nos dois pontos (`FindService.ts` no backend,
  `isBrazilNumber` no `CampaignModal`): agora aceita 12 OU 13 dígitos
  como BR.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 67.

## [2.3.83] — Tag de campanha desacoplada do Kanban + aviso de país — 2026-09-21

### Corrigido / Adicionado
- Segunda campanha errada seguida ("Renovação Filiação 2026"), dessa
  vez pra um contato do Paraguai marcado por engano/teste na tag-coluna
  do Kanban "Filiados Inadimplentes". A pedido do cliente, revertida a
  ligação entre tag do Kanban e o módulo Campanhas (feita nas seções
  54/55): Nova Campanha volta a mostrar só tag normal (`kanban=0`);
  backend rejeita `tagListId` de coluna do Kanban mesmo fora do
  formulário padrão (`ERR_CAMPAIGN_TAG_IS_KANBAN_COLUMN`).
- Tela de confirmação de campanha (v2.3.82) ganhou um aviso quando a
  lista/tag escolhida mistura número de fora do Brasil (formato BR:
  "55" + 11 dígitos), pra pegar justamente esse tipo de contaminação
  antes de confirmar o envio.

Detalhes em `docs/MANUAL_TECNICO.md`, seção 66.

## [2.3.82] — Confirmação obrigatória antes de enviar campanha — 2026-09-21

### Corrigido / Adicionado
- Campanha "Renovação 2026" mandou mensagem pra "Tereza Cristina Py",
  contato sem nenhuma relação com a lista pretendida. Investigado: a
  campanha foi criada com a tag "Atendimento Pendente" selecionada
  (tag genérica, id=7), não com a lista de arquivo de 96 registros —
  o código da correção de mútua exclusão Lista/Tag (v2.3.75) foi
  revisado e está funcionando corretamente; o cenário mais provável é
  a tag ter ficado selecionada sem o cliente perceber.
- Como o erro é silencioso (nada avisa o público final antes de
  enviar), adicionada uma tela de confirmação obrigatória antes de
  criar/salvar qualquer campanha, mostrando exatamente o destinatário
  ("Lista de Contato "X" (Y contatos)" ou "Tag "X"") antes de
  confirmar. `GET /contact-lists/list` agora também devolve a
  quantidade de contatos de cada lista para alimentar esse resumo.
- Backfill retroativo aplicado de novo na tag "Filiados Inadimplentes"
  (tinha voltado a 0 contatos — mesmo bug da seção 61, dessa vez por
  falta de deploy da v2.3.78 no momento em que aconteceu).

Detalhes em `docs/MANUAL_TECNICO.md`, seção 65.

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
