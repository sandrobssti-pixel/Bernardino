---
name: atendeflow-deploy
description: Use sempre que for vender/instalar o AtendeFlow (o produto principal — CRM multiatendimento com WhatsApp) pra um cliente novo, em servidor/computador novo. É o roteiro-mestre que amarra as outras skills de infraestrutura já existentes (vps-provisioning, coolify-deploy, cloudflare-tunnel-deploy, nas-setup) com o que é específico do AtendeFlow (variáveis de ambiente, migrations, primeiro login, pareamento do WhatsApp). Baseado na implantação real validada (Confiança Technologies, `docs/MANUAL_TECNICO.md` seções 32-41).
---

# Implantar o AtendeFlow pra um cliente novo

Roteiro-mestre — não duplica o que já está nas outras skills, só amarra
a ordem certa e adiciona o que é específico do AtendeFlow. Ler a skill
referenciada em cada etapa pra o passo a passo completo dela.

## 0. Pedido ambíguo → perguntar antes de agir

Mesma regra do `CLAUDE.md` da raiz (e da skill `atendeflow-dev`, seção
0). Em especial, confirmar ANTES de começar:
- Servidor novo (do zero) ou já existe infraestrutura (Coolify já
  instalado, outro app já rodando nele)?
- Esse cliente vai usar WhatsApp não-oficial (Baileys — padrão, é o que
  o `docker-compose.coolify.yml` já sobe) ou também a API Oficial da
  Meta (precisa do `api_oficial/` à parte — ver skill
  `api-oficial-deploy`)?
- Vai ter backup local pro NAS do cliente (skill `nas-setup`) e/ou
  Seafile (skill `seafile-deploy`), ou só o backup básico?
- Domínio(s) públicos que o cliente vai usar (frontend e backend, pode
  ser subdomínios diferentes ou o mesmo domínio com caminhos).

## 1. Servidor pronto (se for novo)

Se a máquina ainda não tem nada: skill `vps-provisioning` até a etapa
"Coolify" (não precisa fazer a etapa de deploy de app genérica dela —
as etapas 3+ abaixo substituem isso especificamente pro AtendeFlow).

**Checkpoint**: Coolify instalado e acessível, recurso Postgres criado
e rodando (ver skill `coolify-deploy`, etapa 2, pros dois lugares onde
conferir host/porta/SSL — já aconteceu de ficarem inconsistentes entre
si).

## 2. Recurso Docker Compose no Coolify

Criar o recurso apontando pro repositório Git do AtendeFlow (branch de
produção) e pro arquivo `docker-compose.coolify.yml` — **não** o
`docker-compose.yml` da raiz (esse é só Postgres+Redis de
desenvolvimento local, não sobe o app).

Preencher as variáveis de ambiente do recurso usando
`.env.coolify.example` (raiz do repositório) como roteiro:

| Grupo | O que preencher |
|---|---|
| `BACKEND_URL`/`FRONTEND_URL` | Domínios públicos definitivos |
| `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASS` | Dados do Postgres do Coolify — usar a "Postgres URL (internal)" como fonte confiável |
| `DB_SSL` | `true` se a URL interna terminar em `?sslmode=require` |
| `JWT_SECRET`/`JWT_REFRESH_SECRET`/`MASTER_KEY`/`REDIS_SECRET_KEY` | Gerados novos (`openssl rand -base64 32`) — nunca reaproveitar de outro cliente |
| `ADMIN_USERNAME`/`ADMIN_PASSWORD` | Login inicial do admin — senha forte |
| `REACT_APP_BACKEND_URL` | Mesmo domínio de `BACKEND_URL` — é variável de **build**, muda só com rebuild do frontend |
| `CLOUDFLARE_TUNNEL_TOKEN` | Da etapa 4 abaixo |
| Variáveis opcionais (mail, API Oficial, Facebook App) | Deixar em branco se o cliente não usar agora — dá pra preencher depois |

**Checkpoint**: `docker compose ps` (dentro do recurso) mostra `backend`,
`frontend`, `redis` e `cloudflared` todos `Up`. Se `redis` ficar preso
reiniciando ou o backend não conseguir autenticar nele, ver a lição de
colisão de nome de serviço na skill `coolify-deploy` (etapa 4) — é
exatamente esse o incidente real que já aconteceu aqui.

## 3. Migrations do banco

A primeira subida do `backend` já roda `npx sequelize-cli db:migrate`
sozinha (está no entrypoint do `Dockerfile` do backend) — banco novo do
Coolify começa vazio e sobe todas as tabelas automaticamente, não
precisa rodar nada manual.

**Checkpoint**: log do container `backend` mostra as migrations
aplicadas sem erro (procurar por linhas `== <nome-da-migration>:
migrating`/`migrated`).

## 4. Cloudflare Tunnel

Skill `cloudflare-tunnel-deploy` completa — resumo específico do
AtendeFlow: duas rotas (Public Hostname) no mesmo túnel, uma pro
`frontend` (porta 3000) e outra pro `backend` (porta 8080), usando os
nomes de serviço do compose como URL interna
(`http://frontend:3000`, `http://backend:8080`).

**Cuidado em migração de servidor** (trocar um AtendeFlow já em
produção por um novo): usar subdomínio temporário primeiro (ex.:
`app-novo.dominio.com`), validar com o cliente, só depois repontar o
domínio definitivo — ver a mesma skill, seção 5.

**Checkpoint**: `https://<dominio-frontend>` abre a tela de login do
AtendeFlow, com HTTPS válido.

## 5. Primeiro acesso e conexão de WhatsApp

1. Login com `ADMIN_USERNAME`/`ADMIN_PASSWORD` (variáveis da etapa 2).
2. **Conexões → Adicionar WhatsApp**: criar a conexão, escanear o QR
   code com o número do cliente. A sessão (credenciais Baileys) é salva
   direto no Postgres — não precisa de volume/disco pra isso.
3. Conferir fila(s), usuário(s) adicionais e mensagem de
   saudação/despedida conforme o cliente pedir — fora do escopo desta
   skill (configuração de negócio, não de infraestrutura).

**Checkpoint**: conexão aparece **Conectado** no painel, e uma mensagem
de teste enviada/recebida aparece no atendimento.

## 6. Backup

Copiar e adaptar `backup-atendeflow.sh` (raiz do repositório) pro
cliente novo — mesmo script, só muda o `ENV_FILE`/caminho de deploy se
não for `~/atendeflow`. Esse script já lê o `.env` certo, faz
`pg_dump` via `docker exec` no container do Postgres do Coolify, e
compacta o volume Docker `atendeflow_atendeflow_public` (não um caminho
de disco direto — ver skill `vps-disk-expansion` pra entender por quê
isso importa se algum dia mover o Docker de disco).

Destino do backup: pasta local no servidor (simples, mas não sobrevive
a perda total da máquina) ou NAS do cliente (recomendado — skill
`nas-setup` primeiro, depois apontar `BACKUP_DIR` pro ponto de montagem
certo).

**Checkpoint**: rodar o script manualmente, conferir dump do banco e
tar dos arquivos aparecendo no destino com tamanho não-zero. Agendar no
cron só depois disso confirmado.

## 7. (Opcional) API Oficial da Meta

Se o cliente for usar a API Oficial além do WhatsApp não-oficial: skill
`api-oficial-deploy` completa (é um deploy separado, VPS própria com
PM2+Nginx+Certbot, não entra no mesmo recurso Coolify do AtendeFlow).
Depois de implantado, preencher no AtendeFlow:
`USE_WHATSAPP_OFICIAL=true`, `URL_API_OFICIAL`, `TOKEN_API_OFICIAL` (e
reiniciar o recurso Coolify do AtendeFlow pra pegar as variáveis
novas).

## 8. (Opcional) Seafile

Se o cliente quiser a solução de arquivos tipo "Google Drive": skill
`seafile-deploy` completa — stack independente, não interfere no
AtendeFlow.

## 9. Checklist final

- [ ] Todos os 4 serviços do compose (`backend`, `frontend`, `redis`,
      `cloudflared`) `Up`, sem reinício em loop.
- [ ] Nenhum `container_name` genérico colidindo com outro stack na
      mesma rede Coolify (ver skill `coolify-deploy`).
- [ ] Segredos (`JWT_*`, `MASTER_KEY`, `REDIS_SECRET_KEY`, senha do
      admin) gerados novos pra esse cliente.
- [ ] Login funciona, conexão de WhatsApp pareada e enviando/recebendo
      mensagem de teste.
- [ ] Backup rodado manualmente com sucesso e agendado no cron.
- [ ] Domínios públicos com HTTPS válido via Cloudflare Tunnel.
- [ ] (Se aplicável) API Oficial e/ou Seafile implantados e conectados.

## 10. Commit

Normalmente essa skill não gera commit (é implantação no servidor do
cliente). Pra mudanças no código do AtendeFlow em si, usar a skill
`atendeflow-dev` e as instruções de commit do `CLAUDE.md` da raiz.
