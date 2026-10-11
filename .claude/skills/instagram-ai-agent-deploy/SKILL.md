---
name: instagram-ai-agent-deploy
description: Use sempre que for implantar o Agente de IA do Instagram Direct (painel + webhook da Meta + IA via Anthropic/OpenAI, opcionalmente escalando pra humano via WhatsApp/Evolution API) pra um cliente novo. Diferente de tudo que roda em Docker/Coolify neste projeto — este é um deploy **Vercel** (serverless) independente, com banco Redis. Roteiro genérico, condensado a partir do manual técnico completo (`instagram-ai-agent/MANUAL_TECNICO.md`, branch `claude/instagram-ai-agent-ivcyk4` deste repositório) — ver esse arquivo pra detalhe passo a passo exaustivo; esta skill tem as etapas, checkpoints e as pegadinhas reais já batidas, condensadas pra não reler o manual inteiro a cada cliente novo.
---

# Implantar o Agente de IA do Instagram pra um cliente novo

**Diferente de todas as outras skills de infraestrutura deste
repositório**: não é Docker/Coolify — é um app **Vercel** (serverless),
com banco **Redis** (Vercel Storage) e integrações externas (Meta Graph
API, Anthropic/OpenAI, opcionalmente Evolution API). Não roda no
VPS/servidor do cliente — roda na nuvem da Vercel.

**O código hoje só existe na branch `claude/instagram-ai-agent-ivcyk4`**
deste repositório, pasta `instagram-ai-agent/`, não na branch
padrão/produção. Pra um cliente novo, normalmente é a mesma base de
código reaproveitada (ela já é genérica, tudo via variável de ambiente)
— trazer o código dessa branch pro servidor do cliente e criar um
**projeto Vercel novo e independente** por cliente (nunca reaproveitar
projeto/variáveis de outro cliente).

O manual completo (`instagram-ai-agent/MANUAL_TECNICO.md`, nessa mesma
branch) tem o passo a passo exaustivo com telas da Meta/Vercel, tabela
de solução de problemas completa, e referência técnica de toda a
estrutura do código — ler ele pra qualquer dúvida fora do que está
condensado aqui.

## 0. Pedido ambíguo → perguntar antes de agir

Mesma regra do `CLAUDE.md` da raiz. Em especial, confirmar ANTES de
começar:
- O cliente já tem conta **profissional** do Instagram (Empresa ou
  Criador) — conta pessoal não funciona, é bloqueante desde o início.
- Vai usar escalação pra WhatsApp (precisa de uma Evolution API já
  rodando — ver se o cliente já tem uma, ou se precisa subir)?
- IA: Anthropic ou OpenAI (muda qual variável de chave usar)?
- Fuso horário do cliente (`TIMEZONE`, padrão `America/Asuncion` no
  template original — quase sempre precisa trocar por cliente).

## 1. Pré-requisitos (conferir antes de começar)

| Item | Onde |
|---|---|
| Conta profissional do Instagram | App do Instagram → Configurações → Tipo de conta |
| Conta de desenvolvedor Meta | developers.facebook.com |
| Conta Vercel (plano Hobby/gratuito atende) | vercel.com |
| Conta Anthropic (ou OpenAI) com crédito | console.anthropic.com |
| Node.js 20+ e Vercel CLI no servidor | `node -v`, `vercel --version`; instalar com `sudo npm install -g vercel && vercel login` |

## 2. Trazer o código pro servidor

```bash
cd ~/<pasta-do-projeto> && git fetch origin claude/instagram-ai-agent-ivcyk4 && git merge --ff-only FETCH_HEAD
```

(Ou, pra um cliente completamente separado, copiar só a pasta
`instagram-ai-agent/` pra um repositório/pasta própria desse cliente —
decidir isso na etapa 0 se ainda não estiver claro.)

## 3. App na Meta + token do Instagram

1. developers.facebook.com → **Meus apps → Criar app** → caso de uso
   "Gerenciar mensagens e conteúdo no Instagram".
2. **Instagram → Configuração da API com login do Instagram** → anotar a
   **Chave secreta do app** (`IG_APP_SECRET`).
3. Permissões necessárias: `instagram_business_basic`,
   `instagram_business_manage_messages`,
   `instagram_business_manage_comments`.
4. **Gerar tokens de acesso → Adicionar conta** → autoriza a conta do
   cliente → **Gerar token**: começa com `IGAA`, ~180-200 caracteres
   (`IG_ACCESS_TOKEN`). **Nunca colar esse token em chat/e-mail/arquivo
   do repositório.**
5. Token vale **60 dias**, renova sozinho (ver manutenção, etapa 9).
6. **Enquanto o app não for publicado** (etapa 7): a Meta só entrega
   mensagem de contas com papel de **Testador** no app — cadastrar em
   **Funções → Adicionar pessoas → Testador do Instagram**, e a pessoa
   precisa aceitar o convite no próprio Instagram.

## 4. Chave da IA

console.anthropic.com → **API Keys → Create Key**. Copiar na hora — a
chave completa (`sk-ant-...`, ~108 caracteres) só aparece **uma vez**.
Conferir crédito em **Billing**. (Alternativa OpenAI: usar
`OPENAI_API_KEY` no lugar de `ANTHROPIC_API_KEY`.)

## 5. Projeto Vercel

```bash
cd ~/<pasta>/instagram-ai-agent
vercel project add <nome-do-projeto-do-cliente>
vercel link --yes --project <nome-do-projeto-do-cliente>
```

**A saída TEM que mostrar `Linked ... /instagram-ai-agent`.**

### Pegadinha real já batida: ligar a pasta ao projeto Vercel errado

Se a pasta ficar ligada a um projeto Vercel **de outro cliente/app** por
engano, todo deploy seguinte vai pro lugar errado (sintomas:
`vercel --prod` tenta publicar num projeto com outro nome, ou erro `No
Next.js version detected`). **Nunca prosseguir se o nome do projeto
ligado não for exatamente o esperado** — corrigir com:

```bash
rm -rf .vercel .env.local
# repetir vercel project add / vercel link
```

### Banco (Redis)

1. vercel.com → projeto → aba **Storage → Create Database** → **Redis**
   (ou **Upstash for Redis**), plano Free.
2. **Connect Project** → o projeto certo, ambiente **Production** →
   Connect. A Vercel grava a variável do banco sozinha
   (`REDIS_URL` ou `KV_REST_API_URL`/`_TOKEN`) — **nunca copiar/colar
   esse endereço em lugar nenhum**, ele contém a senha do banco.
3. `vercel env ls` confirma a variável criada.

### Variáveis de ambiente

| Variável | Tipo | Obrigatória |
|---|---|---|
| `IG_ACCESS_TOKEN` | Secret | sim |
| `VERIFY_TOKEN` | Config | sim (texto inventado, sem espaço, ex. `<Cliente>AgenteIA`) |
| `ANTHROPIC_API_KEY` (ou `OPENAI_API_KEY`) | Secret | sim |
| `DASHBOARD_PASSWORD` | Secret | sim (senha do painel, mín. 6 caracteres, forte) |
| `IG_APP_SECRET` | Secret | recomendada |
| `CRON_SECRET` | Secret | recomendada (texto aleatório longo) |
| `EVOLUTION_API_KEY` | Secret | se usar escalação pra WhatsApp |
| `IG_USER_ID` | Config | opcional, trava o agente numa conta específica |
| `TIMEZONE` | Config | opcional, padrão `America/Asuncion` |
| `AGENT_ENABLED` | Config | opcional, `false` desliga tudo sem desinstalar |

```bash
vercel env add <NOME_DA_VARIAVEL> production
```

Cada segredo gerado **novo** por cliente — nunca reaproveitar chave/
senha de outro cliente.

```bash
vercel --prod
```

**Pegadinha real já batida**: o deploy que está no ar só enxerga as
variáveis que existiam quando ele foi criado — **toda vez que
criar/alterar uma variável, rodar `vercel --prod` de novo** (ou
Deployments → ⋯ → Redeploy pelo site).

**Checkpoint**: a URL pública (ex. `https://<projeto>.vercel.app`)
aparece no campo `Aliased` da saída do `vercel --prod`.

## 6. Conferir a instalação (antes de mexer na Meta)

```bash
curl -s "https://<url-do-projeto>/api/webhook"
```

Esperado: JSON com `hasAccessToken`, `hasVerifyToken`, `hasDatabase`,
`hasDashboardPassword` todos `true` (`hasPrompt:false` é normal — as
instruções ficam no painel, não em variável).

```bash
curl -s "https://<url-do-projeto>/api/webhook?hub.mode=subscribe&hub.verify_token=<VERIFY_TOKEN>&hub.challenge=teste123"; echo
```

Tem que responder exatamente `teste123`. Se responder `Forbidden`:
`VERIFY_TOKEN` errado/vazio, ou faltou `vercel --prod` depois de
cadastrar.

## 7. Webhook na Meta

developers.facebook.com → app → **Instagram → Configuração da API com
login do Instagram → Configurar webhooks**:

| Campo | Valor |
|---|---|
| URL de retorno | `https://<url-do-projeto>/api/webhook` |
| Verificar token | o mesmo `VERIFY_TOKEN` exato |

**Verificar e salvar** só funciona depois que a etapa 6 responder
`teste123`. Em **Campos do webhook**, assinar `messages` e `comments`
(opcional `live_comments`).

## 8. Painel: configuração inicial

Abrir `https://<url-do-projeto>` → login com `DASHBOARD_PASSWORD`.

Configurar (tudo vale na hora, sem novo deploy): instruções da IA
(negócio, serviços, cidades, preços, horários, o que NÃO responder),
boas-vindas, regras de comentário, base de produtos, escalação pra
WhatsApp (número com DDI + URL da Evolution API + instância), modelo
principal/reserva.

**Testar sem enviar nada**: botões "Testar comentário", "Simular nos
últimos 5 posts", "Simulador do Direct" — todos dry-run.

**Rodar a Auditoria técnica** (Configurações → Auditoria) — confere 11
itens reais (variáveis, banco, token válido, webhook assinado, IA
respondendo, segurança) e corrige sozinha o que dá (ex.: renova token se
faltar <15 dias, assina campo de webhook que faltar).

**Checkpoint**: auditoria sem `falha` (itens `atenção` são aceitáveis,
mas revisar antes de considerar pronto).

## 9. Publicar o app (liberar pra todos os clientes, não só testadores)

Enquanto o app Meta estiver em modo de desenvolvimento, só perfis
**Testador** recebem resposta. Pra atender qualquer pessoa:

1. **Configurações do app → Básico**: URL de Política de Privacidade
   (`<url-do-projeto>/privacidade`) e URL de exclusão de dados
   (`<url-do-projeto>/exclusao-de-dados`) — essas páginas já vêm prontas
   no código (PT/ES). Ícone 1024×1024, categoria, e-mail de contato.
2. **Análise do app (App Review)**: solicitar Acesso avançado pra
   `instagram_business_manage_messages` e
   `instagram_business_manage_comments`, com vídeo curto mostrando o
   agente respondendo uma DM e um comentário.
3. Depois de aprovado (prazo é da Meta, normalmente alguns dias): mudar
   o app pra **Ao vivo/Publicado**.

## 10. Manutenção (vale pra qualquer cliente implantado)

- **Token (60 dias)**: renova sozinho toda segunda via cron da Vercel
  (precisa de `CRON_SECRET`). Se vencer de vez (agente parado >60 dias),
  gerar token novo na Meta e repetir `vercel env add` +
  `vercel --prod`.
- **Atualizar código**: `git fetch`/`merge --ff-only` igual etapa 2,
  depois `vercel --prod` de novo.
- **Trocar uma variável**: `vercel env rm <nome> production --yes` →
  `vercel env add <nome> production` → `vercel --prod`.
- **Backup**: dados ficam no Redis (backup/export pelo painel do
  Redis Cloud/Upstash); leads exportáveis a qualquer momento em
  Leads → Exportar CSV, pelo próprio painel do agente.

## 11. Pegadinhas reais mais comuns (resumo — tabela completa no manual)

| Sintoma | Causa | Correção |
|---|---|---|
| Pasta ligada a projeto Vercel errado | `vercel link` sem conferir a saída | `rm -rf .vercel .env.local`, repetir |
| Status com algum `false`/`null` | Variável vazia/ausente, ou sem `vercel --prod` depois | Conferir `vercel env ls`, recadastrar, `vercel --prod` |
| Verificação do webhook responde `Forbidden` | `VERIFY_TOKEN` errado ou sem deploy novo | Recadastrar como Config, `vercel --prod` |
| IA não responde, log mostra `401 invalid x-api-key` | Chave da IA errada (ex.: colou token do Instagram no lugar) | Recadastrar a chave certa, `vercel --prod` |
| "Falta configurar: banco de dados" | Redis não conectado ao projeto, ou sem deploy novo | Reconectar em Storage, `vercel --prod` |
| Aviso de escalação não chega no WhatsApp | Evolution incompleta/chave errada/instância desconectada | Auditoria item 10, botão "Enviar teste no WhatsApp" |

## 12. Checklist final

- [ ] `vercel link` confirmou o projeto certo do cliente (não outro).
- [ ] Todas as variáveis obrigatórias cadastradas + `vercel --prod`
      rodado depois da última mudança.
- [ ] Webhook verificado na Meta (`teste123` passou antes de salvar lá).
- [ ] Auditoria técnica sem `falha`.
- [ ] Teste de ponta a ponta real com um perfil testador (DM, comentário
      com palavra-chave, escalação pra humano).
- [ ] Segredos gerados novos pra esse cliente.
- [ ] (Se for atender qualquer pessoa, não só testadores) App Review
      solicitado e aprovado, app publicado.

## 13. Commit

Normalmente essa skill não gera commit neste repositório (é configuração
na Meta/Vercel/painel do agente). Se o código do agente em si mudar,
seguir as instruções de commit do `CLAUDE.md` da raiz na branch onde o
`instagram-ai-agent/` vive.
