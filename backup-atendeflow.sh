#!/bin/bash
# Backup diário do AtendeFlow (banco Postgres + arquivos enviados) pro NAS
# local (Synology, via SMB em /mnt/nas-backup). Ver docs/MANUAL_TECNICO.md,
# seção 38.

set -euo pipefail

BACKUP_DIR="/mnt/nas-backup"
DATE=$(date +%Y-%m-%d_%H%M%S)
RETENTION_DAYS=30
POSTGRES_CONTAINER="6glet7ucc6hill7pbv6kkhm1"
ENV_FILE="$HOME/atendeflow/.env"
DB_NAME=$(grep -E '^DB_NAME=' "$ENV_FILE" | cut -d '=' -f2-)
DB_USER=$(grep -E '^DB_USER=' "$ENV_FILE" | cut -d '=' -f2-)
DB_PASS=$(grep -E '^DB_PASS=' "$ENV_FILE" | cut -d '=' -f2-)
LOG_FILE="$BACKUP_DIR/backup.log"

# Se o compartilhamento do NAS cair (ex: reboot da VPS sem remontar o
# fstab), $BACKUP_DIR ainda existe como pasta local vazia — sem essa
# checagem o script "funcionaria" gravando tudo no disco local, dando
# falsa sensação de que o backup no NAS está protegido.
mountpoint -q "$BACKUP_DIR" || { echo "Erro: $BACKUP_DIR não está montado (NAS caiu?) — abortando." >&2; exit 1; }

echo "=== Backup iniciado em $DATE ===" >> "$LOG_FILE"

# 1. Backup do banco de dados
DB_BACKUP_FILE="$BACKUP_DIR/db_${DATE}.sql.gz"
docker exec -e PGPASSWORD="$DB_PASS" "$POSTGRES_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl | gzip > "$DB_BACKUP_FILE"
echo "Banco salvo em $DB_BACKUP_FILE ($(du -h "$DB_BACKUP_FILE" | cut -f1))" >> "$LOG_FILE"

# 2. Backup dos arquivos do sistema (volume atendeflow_atendeflow_public)
FILES_BACKUP_FILE="files_${DATE}.tar.gz"
docker run --rm -v atendeflow_atendeflow_public:/data -v "$BACKUP_DIR":/backup alpine \
  tar czf "/backup/$FILES_BACKUP_FILE" -C /data .
echo "Arquivos salvos em $BACKUP_DIR/$FILES_BACKUP_FILE ($(du -h "$BACKUP_DIR/$FILES_BACKUP_FILE" | cut -f1))" >> "$LOG_FILE"

# 3. Remove backups com mais de RETENTION_DAYS dias
find "$BACKUP_DIR" -maxdepth 1 -name "db_*.sql.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -maxdepth 1 -name "files_*.tar.gz" -mtime +$RETENTION_DAYS -delete
echo "Backups com mais de $RETENTION_DAYS dias removidos" >> "$LOG_FILE"

echo "=== Backup concluído em $(date +%Y-%m-%d_%H%M%S) ===" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
