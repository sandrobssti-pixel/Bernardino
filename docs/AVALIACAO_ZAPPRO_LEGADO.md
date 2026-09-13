# Avaliação do projeto antigo (zappro-legado)

**Repositório analisado:** [`sandrobssti-pixel/zappro-legado`](https://github.com/sandrobssti-pixel/zappro-legado)
**Data da avaliação:** 2026-09-13
**Contexto:** código-fonte recuperado de um backup de servidor (zip de ~5GB, reduzido a
~77MB depois de remover mídia de clientes, backups redundantes e dependências).

---

## 1. Resumo executivo

O `zappro-legado` é um **sistema de multi atendimento via WhatsApp completo e maduro em
produção** — não um protótipo. É, na prática, um fork/evolução comercial do projeto
open-source [Whaticket](https://github.com/canove/whaticket), com dezenas de módulos
adicionados por cima (builder de fluxos, campanhas, cobrança, IA, API oficial da Meta,
multi-empresa/SaaS).

**Comparado à Etapa 1/1.1 do AtendeFlow** (que construímos do zero nesta sessão — auth,
CRUD básico, WhatsApp via Baileys, ~50 arquivos), o `zappro-legado` tem **1.638 arquivos e
~290 mil linhas**, com recursos que levariam meses para reconstruir do zero.

**Recomendação:** em vez de continuar reescrevendo funcionalidade por funcionalidade no
AtendeFlow atual, faz mais sentido **adotar o `zappro-legado` como nova base** e evoluir a
partir dele — fazendo uma limpeza de dívida técnica primeiro (seção 5) e trazendo a
identidade visual nova que criamos (seção 6) por cima.

---

## 2. Arquitetura e stack

O projeto é dividido em **3 aplicações separadas**:

| App | Papel | Stack |
| --- | --- | --- |
| `backend/` | API principal, WhatsApp (Baileys), regras de negócio | Node.js + TypeScript + Express + **Sequelize** (PostgreSQL/MySQL) + Redis + Bull (filas) + Socket.io |
| `frontend/` | Interface web do atendimento | React 17 + Material UI (v4 e v5 misturados) + i18next (4 idiomas) |
| `api_oficial/` | Microsserviço isolado para a **API Oficial do WhatsApp (Meta)** | NestJS + Prisma + RabbitMQ + Redis |

Pontos técnicos relevantes:

- **Multi-tenant real**: toda tabela principal tem `companyId` — várias empresas isoladas
  numa instância só, com planos, assinaturas e faturas por empresa.
- **Multi-sessão de WhatsApp de verdade**: usa a lib `baileys` (mais atual que a nossa,
  v7.0.0-rc14) com reconexão automática por empresa, ao contrário do AtendeFlow atual que
  suporta só 1 sessão ativa para envio.
- **Multicanal**: WhatsApp (Baileys), API Oficial (Meta), Facebook, Instagram, Webchat —
  tudo unificado na mesma caixa de entrada (`channel` na tabela de conversas).
- **Filas assíncronas** (Bull + Redis) para processamento de mensagens em segundo plano —
  evita travar a API principal em picos de volume.
- **Modo cluster** (`server-cluster.ts`): usa todos os núcleos de CPU da máquina.
- **IA integrada**: OpenAI, Google Gemini, Dialogflow, transcrição de áudio (Microsoft
  Cognitive Services) — usado no chatbot e para sugerir respostas ao atendente.
- **Cobrança/pagamento**: Mercado Pago, Gerencianet/Efí, Asaas — cobrança recorrente de
  clientes da própria plataforma (é um SaaS vendável).
- **Softphone (VoIP)**: integração com `jssip` — chamadas de voz pelo navegador, além do
  WhatsApp.

---

## 3. Inventário de funcionalidades (o que já existe pronto)

| Categoria | Recursos |
| --- | --- |
| Atendimento | Caixa de entrada, Kanban de tickets, notas internas, tags, transferência de fila/atendente, respostas rápidas, histórico de mensagens, edição/exclusão de mensagem |
| Automação | **Builder de fluxo visual** (chatbot com nós de condição, pergunta, IA, webhook, tag, ticket, menu, integração com Typebot/N8N/Dialogflow) |
| Campanhas | Disparo em massa agendado, campanhas por frase-gatilho, relatório de campanha |
| Contatos | Listas de contato, importação (CSV/telefone), carteira de contatos por atendente |
| Agendamento | Mensagens agendadas, horário de atendimento por fila/feriados, aniversário automático |
| Relatórios | Dashboard com gráficos (tickets por canal/fila/atendente/período), exportação |
| Gestão SaaS | Empresas, planos, assinaturas, faturas, parceiros/afiliados |
| Configuração | Configuração global, personalização (whitelabel: logo, cores, nome), múltiplos idiomas |
| Outros | To-do list interno, central de ajuda em vídeo, avisos/anúncios, notificação push, chat interno entre atendentes, métricas do servidor |

---

## 4. Riscos e dívida técnica encontrados

Nada bloqueante, mas vale saber antes de adotar como base:

- **Sem arquivo de licença** (`LICENSE`) no repositório — se ele deriva de um projeto
  open-source (aparenta ser do Whaticket, que é licenciado), vale confirmar os termos antes
  de usar comercialmente, especialmente se for revender como SaaS.
- **Arquivos de rascunho/quebrados versionados**, por exemplo:
  `wbotMessageListener-dontwork.ts`, `FindOrCreateTicketService_backup.ts`,
  `index-old-backup.js`, `Mustache_old.ts`, `express.d.ts_old` — não atrapalham a
  compilação, mas são ruído a limpar.
- **79 arquivos `*_Zone.Identifier`** — lixo do Windows (metadado de download), sem
  nenhum efeito funcional, mas polui o repositório.
- **Duas versões do Material UI ao mesmo tempo** (`@material-ui/*` v4 e `@mui/*` v5) no
  frontend — indica uma migração de versão que ficou incompleta.
- **`package-lock.json` de ~200MB cada** (backend/frontend) — normal para um projeto deste
  tamanho, mas confirma que a instalação de dependências vai ser pesada.
- ⚠️ Já removemos e sinalizamos antes: havia um **certificado `.p12`** versionado no
  histórico local (removido antes do push) — se ele ainda estiver ativo em produção,
  recomendo revogar/trocar essa credencial.

---

## 5. Recomendação de caminho

1. **Curto prazo (decisão sua):** confirmar se seguimos com a migração de base — trocar o
   AtendeFlow atual (Etapa 1.1) pelo `zappro-legado` como novo ponto de partida.
2. **Se sim**, a sequência sugerida seria:
   - Trazer `backend/`, `frontend/` e `api_oficial/` para o repositório do AtendeFlow.
   - Fazer uma limpeza inicial: remover os arquivos `*_Zone.Identifier`, os arquivos
     `*_old`/`*_backup`/`*dontwork*`, e revisar o certificado exposto.
   - Configurar `.env` do zero (nenhuma credencial de produção deve vir junto).
   - Aplicar a identidade visual "tech" (v1.1.0) que já criamos por cima das telas do
     `frontend/`, já que o visual atual dele é o padrão Material UI genérico.
3. **Se não** (preferir manter o AtendeFlow enxuto e ir trazendo módulo por módulo): me diga
   qual funcionalidade específica trazer primeiro (ex: builder de fluxo, multi-sessão de
   WhatsApp, campanhas) que eu porto isoladamente.

---

## 6. Comparação rápida com o AtendeFlow atual (v1.1.0)

| | AtendeFlow (atual) | zappro-legado |
| --- | --- | --- |
| Sessões WhatsApp simultâneas | 1 (envio) | Múltiplas, por empresa |
| Multi-empresa (SaaS) | Não | Sim |
| Canais | Só WhatsApp | WhatsApp, API Oficial, Facebook, Instagram, Webchat |
| Chatbot/automação | Não | Builder de fluxo visual completo |
| Campanhas em massa | Não | Sim |
| Relatórios/Dashboard | Não | Sim, com gráficos |
| Cobrança de clientes (SaaS) | Não | Sim (Mercado Pago, Efí, Asaas) |
| Interface | Nova, "tech", só 3 telas | Material UI padrão, ~45 telas |
| Maturidade do código | Recém-criado | Anos de produção, mais dívida técnica |
