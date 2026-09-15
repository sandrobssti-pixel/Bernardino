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

# Backup diário do AtendeFlow — dump do banco (Postgres) + arquivos
# enviados (backend/public: currículos do RH, mídia do WhatsApp, fotos de
# perfil, etc.) — enviados pro Google Drive combinado com o cliente.
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

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
ENV_FILE="$BACKEND_DIR/.env"

# Pasta combinada com o cliente:
# https://drive.google.com/drive/folders/17fYidSzfl_co2wONMs_XwI1-uCFL5cUQ
RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive}"
DRIVE_FOLDER_ID="${DRIVE_FOLDER_ID:-17fYidSzfl_co2wONMs_XwI1-uCFL5cUQ}"

require_cmd rclone
require_cmd pg_dump
require_cmd tar

if [ ! -f "$ENV_FILE" ]; then
  echo "[ERRO] Arquivo .env nao encontrado em $ENV_FILE"
  exit 1
fi

# Lê só as variáveis DB_* do .env (sem dar "source" no arquivo inteiro,
# pra não executar nada além do necessário).
read_env_var() {
  grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d '=' -f2-
}

DB_NAME="$(read_env_var DB_NAME)"
DB_USER="$(read_env_var DB_USER)"
DB_HOST="$(read_env_var DB_HOST)"
DB_PORT="$(read_env_var DB_PORT)"
DB_PASS="$(read_env_var DB_PASS)"

TIMESTAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

log "Iniciando backup do AtendeFlow ($TIMESTAMP)"

log "Gerando dump do banco '$DB_NAME'..."
DUMP_FILE="$WORK_DIR/atendeflow_db_${TIMESTAMP}.sql.gz"
PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  | gzip > "$DUMP_FILE"
log "Dump gerado: $(du -h "$DUMP_FILE" | cut -f1)"

UPLOADS_FILE=""
if [ -d "$BACKEND_DIR/public" ]; then
  log "Compactando arquivos enviados (backend/public)..."
  UPLOADS_FILE="$WORK_DIR/atendeflow_uploads_${TIMESTAMP}.tar.gz"
  tar -czf "$UPLOADS_FILE" -C "$BACKEND_DIR" public
  log "Arquivos compactados: $(du -h "$UPLOADS_FILE" | cut -f1)"
else
  log "Pasta $BACKEND_DIR/public nao existe, pulando essa parte."
fi

log "Enviando pro Google Drive (remote '$RCLONE_REMOTE', pasta $DRIVE_FOLDER_ID)..."
rclone copy "$DUMP_FILE" "${RCLONE_REMOTE}:" --drive-root-folder-id "$DRIVE_FOLDER_ID"
if [ -n "$UPLOADS_FILE" ]; then
  rclone copy "$UPLOADS_FILE" "${RCLONE_REMOTE}:" --drive-root-folder-id "$DRIVE_FOLDER_ID"
fi

log "Backup concluido com sucesso."

# Nota: os arquivos ficam só no diretório temporário (apagado no final,
# ver `trap` acima) — cada execução soma um novo arquivo de banco e um de
# uploads na pasta do Drive, sem apagar os anteriores. Se quiser manter só
# os últimos N dias lá, isso precisa ser limpo manualmente ou com um
# `rclone delete` adicional filtrando por data — não implementado aqui de
# propósito, pra nunca apagar um backup sem confirmação explícita.
