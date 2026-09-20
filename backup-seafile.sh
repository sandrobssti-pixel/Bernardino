#!/bin/bash
# Backup diário do Seafile (banco MySQL + biblioteca de arquivos) pro NAS.
#
# Segue o mesmo padrão do backup-atendeflow.sh: dumps/tars com timestamp,
# retenção de 30 dias, log em $BACKUP_DIR/backup.log.
#
# Dados do Seafile ficam em disco local (/srv/seafile-data, partição
# dedicada) — este script copia pro NAS (/mnt/nas-seafile, share que
# sobrou livre depois que decidimos usar disco local em vez do NAS via
# SMB pro armazenamento principal) como a "cópia 2" do 3-2-1.
#
# Precisa rodar como usuário no grupo docker + sudo sem senha (usado só
# pra ler os arquivos que o container do Seafile cria como root).

set -euo pipefail

DEPLOY_DIR="${ATENDEFLOW_DEPLOY_DIR:-$HOME/atendeflow}"
ENV_FILE="$DEPLOY_DIR/.env.seafile"
SEAFILE_DATA_DIR="/srv/seafile-data/seafile"
DB_CONTAINER="${SEAFILE_DB_CONTAINER:-confianza-seafile-db}"
BACKUP_DIR="/mnt/nas-seafile"
RETENTION_DAYS=30

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Erro: comando '$1' não encontrado." >&2; exit 1; }
}
require_cmd docker
require_cmd tar
require_cmd gzip

[ -f "$ENV_FILE" ] || { echo "Erro: $ENV_FILE não encontrado." >&2; exit 1; }
# mountpoint (não só "existe a pasta"), senão um NAS caído faria o script
# "funcionar" gravando no disco local, sem proteção real nenhuma.
mountpoint -q "$BACKUP_DIR" || { echo "Erro: $BACKUP_DIR não está montado (NAS caiu?) — abortando." >&2; exit 1; }

# shellcheck disable=SC1090
source "$ENV_FILE"
: "${SEAFILE_DB_ROOT_PASSWORD:?SEAFILE_DB_ROOT_PASSWORD não definido em $ENV_FILE}"

TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
LOG_FILE="$BACKUP_DIR/backup.log"

echo "=== Backup Seafile iniciado em $TIMESTAMP ===" | tee -a "$LOG_FILE"

DB_DUMP_FILE="$BACKUP_DIR/seafile_db_${TIMESTAMP}.sql.gz"
docker exec -e MYSQL_PWD="$SEAFILE_DB_ROOT_PASSWORD" "$DB_CONTAINER" \
  mysqldump -u root --databases ccnet_db seafile_db seahub_db \
  | gzip > "$DB_DUMP_FILE"
echo "Banco salvo em $DB_DUMP_FILE ($(du -h "$DB_DUMP_FILE" | cut -f1))" | tee -a "$LOG_FILE"

FILES_FILE="$BACKUP_DIR/seafile_files_${TIMESTAMP}.tar.gz"
sudo tar czf "$FILES_FILE" --exclude='./logs' -C "$SEAFILE_DATA_DIR" .
sudo chown "$(id -u):$(id -g)" "$FILES_FILE"
echo "Arquivos salvos em $FILES_FILE ($(du -h "$FILES_FILE" | cut -f1))" | tee -a "$LOG_FILE"

find "$BACKUP_DIR" -maxdepth 1 -name "seafile_*" -mtime +$RETENTION_DAYS -delete
echo "Backups com mais de $RETENTION_DAYS dias removidos" | tee -a "$LOG_FILE"

echo "=== Backup Seafile concluído em $TIMESTAMP ===" | tee -a "$LOG_FILE"
