#!/usr/bin/env bash
set -Eeuo pipefail

trap 'echo "[ERRO] Falha na linha $LINENO. Abortando o backup."' ERR

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[ERRO] Comando obrigatorio nao encontrado: $1"
    echo "  -> rclone: curl https://rclone.org/install.sh | sudo bash"
    exit 1
  fi
}

# Backup diário do AtendeFlow — dump do banco (Postgres, via container
# Docker) + arquivos enviados (volume Docker atendeflow_atendeflow_public:
# currículos do RH, mídia do WhatsApp, fotos de perfil, etc.) +
# configuração crítica do servidor (.env e docker-compose.coolify.yml do
# deploy, config do túnel Cloudflare, crontab) + código-fonte completo
# (backend/frontend/api_oficial, sem node_modules/dist/build) — enviados
# pro Google Drive combinado com o cliente. O código-fonte vai numa
# subpasta própria ("codigo-fonte") dentro da mesma pasta do Drive — é um
# backup independente do GitHub, útil se algum dia faltar acesso à conta/
# repositório.
#
# A parte de configuração foi adicionada depois de um incidente real
# (v2.3.28, ver docs/MANUAL_TECNICO.md): sem um backup da configuração de
# deploy (DNS/túnel/variáveis de ambiente), recuperar um servidor do zero
# depois de um problema significa refazer manualmente tudo que foi
# combinado com o cliente (nomes de domínio, IDs de túnel etc.) — o dump
# do banco sozinho não é suficiente pra uma recuperação completa.
#
# Configuração necessária UMA VEZ no servidor, antes de agendar isso no
# cron (ver docs/MANUAL_TECNICO.md, seção "Backup em nuvem"):
#   1. Instalar o rclone:   curl https://rclone.org/install.sh | sudo bash
#   2. Configurar o remote: rclone config
#        - "n" (new remote) -> nome: gdrive -> tipo: drive (Google Drive)
#        - deixar client_id/client_secret em branco (usa o padrão do rclone)
#        - escopo: "drive" (acesso completo) ou "drive.file" (só arquivos
#          criados pelo rclone — mais restrito, recomendado)
#        - seguir o link de login que aparece no terminal (ou usar
#          `rclone authorize "drive"` numa máquina com navegador, se o
#          servidor não tiver interface gráfica, e colar o token de volta)
#        - confirmar "y" pra salvar
#   3. Testar: rclone lsd gdrive:  (deve listar as pastas do Google Drive)
#
# Se o nome do remote ou a pasta de destino forem diferentes do padrão,
# rode com as variáveis de ambiente, ex.:
#   RCLONE_REMOTE=meudrive DRIVE_FOLDER_ID=xxxx ./backup-para-drive.sh
#
# IMPORTANTE (v2.3.54): desde a migração pro deploy via Docker
# Compose + Coolify (docs/MANUAL_TECNICO.md, seções 32-37), o backend não
# roda mais direto neste clone (~/Bernardino) nem lê seu .env — quem sobe
# em produção é um segundo clone (por padrão ~/atendeflow, configurável
# via ATENDEFLOW_DEPLOY_DIR) via docker-compose.coolify.yml, com o
# Postgres também rodando num container do Coolify, não em localhost:5432.
# Um bug real: até essa correção, este script continuava lendo
# backend/.env (DB_HOST=localhost, senha antiga) e fazendo backup do banco
# LOCAL/pré-migração, congelado no momento da migração — o backup enviado
# pro Google Drive do cliente vinha "funcionando" todo dia sem nunca conter
# os dados reais pós-migração. Corrigido lendo o .env do diretório de
# deploy e usando `docker exec` no container do Postgres (mesmo mecanismo
# do backup local pro NAS, ver ~/scripts/backup-atendeflow.sh).

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="${ATENDEFLOW_DEPLOY_DIR:-$HOME/atendeflow}"
ENV_FILE="$DEPLOY_DIR/.env"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-6glet7ucc6hill7pbv6kkhm1}"
PUBLIC_VOLUME="${PUBLIC_VOLUME:-atendeflow_atendeflow_public}"

# Pasta combinada com o cliente:
# https://drive.google.com/drive/folders/17fYidSzfl_co2wONMs_XwI1-uCFL5cUQ
RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive}"
DRIVE_FOLDER_ID="${DRIVE_FOLDER_ID:-17fYidSzfl_co2wONMs_XwI1-uCFL5cUQ}"

require_cmd rclone
require_cmd docker
require_cmd tar

if [ ! -f "$ENV_FILE" ]; then
  echo "[ERRO] Arquivo .env nao encontrado em $ENV_FILE (ajuste ATENDEFLOW_DEPLOY_DIR se o deploy estiver em outra pasta)"
  exit 1
fi

# Lê só as variáveis DB_* do .env (sem dar "source" no arquivo inteiro,
# pra não executar nada além do necessário).
read_env_var() {
  grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d '=' -f2-
}

DB_NAME="$(read_env_var DB_NAME)"
DB_USER="$(read_env_var DB_USER)"
DB_PASS="$(read_env_var DB_PASS)"

TIMESTAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

log "Iniciando backup do AtendeFlow ($TIMESTAMP)"

log "Gerando dump do banco '$DB_NAME' (container $POSTGRES_CONTAINER)..."
DUMP_FILE="$WORK_DIR/atendeflow_db_${TIMESTAMP}.sql.gz"
docker exec -e PGPASSWORD="$DB_PASS" "$POSTGRES_CONTAINER" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl \
  | gzip > "$DUMP_FILE"
log "Dump gerado: $(du -h "$DUMP_FILE" | cut -f1)"

log "Compactando arquivos enviados (volume Docker $PUBLIC_VOLUME)..."
UPLOADS_FILE="$WORK_DIR/atendeflow_uploads_${TIMESTAMP}.tar.gz"
docker run --rm -v "$PUBLIC_VOLUME":/data -v "$WORK_DIR":/backup alpine \
  tar czf "/backup/$(basename "$UPLOADS_FILE")" -C /data .
log "Arquivos compactados: $(du -h "$UPLOADS_FILE" | cut -f1)"

log "Reunindo configuração crítica do servidor (.env, compose, túnel, crontab)..."
CONFIG_STAGE_DIR="$WORK_DIR/config"
mkdir -p "$CONFIG_STAGE_DIR"

[ -f "$DEPLOY_DIR/.env" ] && cp "$DEPLOY_DIR/.env" "$CONFIG_STAGE_DIR/atendeflow.env"
[ -f "$DEPLOY_DIR/docker-compose.coolify.yml" ] && cp "$DEPLOY_DIR/docker-compose.coolify.yml" "$CONFIG_STAGE_DIR/docker-compose.coolify.yml"

# Config do Cloudflare Tunnel — pode estar em /etc/cloudflared (rodando
# como serviço systemd) e/ou em ~/.cloudflared (config original do
# usuário). Copia os dois se existirem; nenhum dos dois é obrigatório
# (nem todo cliente usa túnel).
if [ -d /etc/cloudflared ]; then
  mkdir -p "$CONFIG_STAGE_DIR/cloudflared-etc"
  sudo -n cp -r /etc/cloudflared/. "$CONFIG_STAGE_DIR/cloudflared-etc/" 2>/dev/null \
    || cp -r /etc/cloudflared/. "$CONFIG_STAGE_DIR/cloudflared-etc/" 2>/dev/null \
    || log "Aviso: não foi possível copiar /etc/cloudflared (sem permissão) — pulando."
fi
if [ -d "$HOME/.cloudflared" ]; then
  mkdir -p "$CONFIG_STAGE_DIR/cloudflared-home"
  cp -r "$HOME/.cloudflared/." "$CONFIG_STAGE_DIR/cloudflared-home/" 2>/dev/null || true
fi

crontab -l > "$CONFIG_STAGE_DIR/crontab.txt" 2>/dev/null || echo "(sem crontab configurado)" > "$CONFIG_STAGE_DIR/crontab.txt"

CONFIG_FILE="$WORK_DIR/atendeflow_config_${TIMESTAMP}.tar.gz"
tar -czf "$CONFIG_FILE" -C "$WORK_DIR" config
log "Configuração compactada: $(du -h "$CONFIG_FILE" | cut -f1)"

# Código-fonte completo (backend + frontend + api_oficial) — backup extra
# independente do GitHub, pra recuperação mesmo sem acesso à conta/repo.
# Exclui tudo que é gerado (node_modules/dist/build), dados de cliente já
# cobertos pelo backup de "uploads" acima (backend/public) e segredos
# (.env já vão no backup de config acima — não precisa duplicar aqui).
log "Compactando código-fonte completo..."
CODE_FILE="$WORK_DIR/atendeflow_codigo_fonte_${TIMESTAMP}.tar.gz"
tar -czf "$CODE_FILE" -C "$PROJECT_ROOT" \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='build' \
  --exclude='.git' \
  --exclude='./backend/public' \
  --exclude='*.env' \
  --exclude='*.env.local' \
  --exclude='*.log' \
  .
log "Código-fonte compactado: $(du -h "$CODE_FILE" | cut -f1)"

log "Enviando pro Google Drive (remote '$RCLONE_REMOTE', pasta $DRIVE_FOLDER_ID)..."
rclone copy "$DUMP_FILE" "${RCLONE_REMOTE}:" --drive-root-folder-id "$DRIVE_FOLDER_ID"
if [ -n "$UPLOADS_FILE" ]; then
  rclone copy "$UPLOADS_FILE" "${RCLONE_REMOTE}:" --drive-root-folder-id "$DRIVE_FOLDER_ID"
fi
rclone copy "$CONFIG_FILE" "${RCLONE_REMOTE}:" --drive-root-folder-id "$DRIVE_FOLDER_ID"
rclone copy "$CODE_FILE" "${RCLONE_REMOTE}:codigo-fonte/" --drive-root-folder-id "$DRIVE_FOLDER_ID"

log "Backup concluido com sucesso."

# Nota: os arquivos ficam só no diretório temporário (apagado no final,
# ver `trap` acima) — cada execução soma um novo arquivo de banco e um de
# uploads na pasta do Drive, sem apagar os anteriores. Se quiser manter só
# os últimos N dias lá, isso precisa ser limpo manualmente ou com um
# `rclone delete` adicional filtrando por data — não implementado aqui de
# propósito, pra nunca apagar um backup sem confirmação explícita.
