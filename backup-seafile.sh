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
# Precisa ler arquivos que o container do Seafile cria como root. Rodando
# como root (cron do root: `sudo crontab -e`) não usa sudo nenhum. Como
# usuário comum, usa sudo — que só funciona com senha em cache ou NOPASSWD,
# NUNCA a partir do cron (sem terminal: "sudo: A terminal is required").
# Como root, $HOME é /root: passar ATENDEFLOW_DEPLOY_DIR=/home/sandro/atendeflow
# (onde está o .env.seafile). Exemplo de linha do cron do root:
#   30 3 * * * ATENDEFLOW_DEPLOY_DIR=/home/sandro/atendeflow /home/sandro/scripts/backup-seafile.sh

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
if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi
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

# Grava em .partial e só renomeia pro nome final depois de verificar a
# integridade: uma execução interrompida (Ctrl+C, reboot, NAS caindo) nunca
# deixa um arquivo truncado com nome de backup válido (já aconteceu).
DB_DUMP_FILE="$BACKUP_DIR/seafile_db_${TIMESTAMP}.sql.gz"
FILES_FILE="$BACKUP_DIR/seafile_files_${TIMESTAMP}.tar.gz"
trap 'rm -f "$DB_DUMP_FILE.partial" "$FILES_FILE.partial"' EXIT

docker exec -e MYSQL_PWD="$SEAFILE_DB_ROOT_PASSWORD" "$DB_CONTAINER" \
  mysqldump -u root --databases ccnet_db seafile_db seahub_db \
  | gzip > "$DB_DUMP_FILE.partial"
gzip -t "$DB_DUMP_FILE.partial"
mv "$DB_DUMP_FILE.partial" "$DB_DUMP_FILE"
echo "Banco salvo em $DB_DUMP_FILE ($(du -h "$DB_DUMP_FILE" | cut -f1))" | tee -a "$LOG_FILE"

$SUDO tar czf "$FILES_FILE.partial" --exclude='./logs' -C "$SEAFILE_DATA_DIR" .
gzip -t "$FILES_FILE.partial"
mv "$FILES_FILE.partial" "$FILES_FILE"
echo "Arquivos salvos em $FILES_FILE ($(du -h "$FILES_FILE" | cut -f1)) — integridade verificada" | tee -a "$LOG_FILE"

find "$BACKUP_DIR" -maxdepth 1 -name "seafile_*" -mtime +$RETENTION_DAYS -delete
echo "Backups com mais de $RETENTION_DAYS dias removidos" | tee -a "$LOG_FILE"

echo "=== Backup Seafile concluído em $TIMESTAMP ===" | tee -a "$LOG_FILE"
