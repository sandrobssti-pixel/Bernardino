#!/bin/bash
# Backup diário do AtendeFlow (banco Postgres + arquivos enviados) pro NAS
# local (Synology, via SMB em /mnt/nas-backup). Ver docs/MANUAL_TECNICO.md,
# seção 38.
#
# v2 (nov/2026) — robusto a oscilação de rede/NAS. Motivo: em 11/11/2026 o backup das
# 03:00 morreu em 33 s porque a imagem "alpine" (usada só pra compactar o volume) tinha
# sido apagada pela limpeza do Docker e o "docker run" precisou baixá-la justo numa
# oscilação de rede de ~15 s. O script abortava no 1º erro, sem tentar de novo e sem
# registrar a falha — e ninguém soube por mais de um dia. Agora:
#   - NÃO depende de baixar imagem: usa o alpine local; se não houver, a imagem do próprio
#     Postgres em uso (que o Docker nunca apaga); só baixa em último caso (com tentativas)
#   - cada etapa tenta até TENTATIVAS vezes (padrão 3, com ESPERA s entre elas)
#   - grava em .partial e só renomeia depois de verificar (gzip/tar íntegros + tamanho mínimo)
#   - SEMPRE registra a falha no backup.log ("!!! Backup FALHOU na etapa ...") e termina com erro
#   - retenção por QUANTIDADE (mantém os MANTER mais recentes; nunca apaga abaixo disso), e não
#     por idade — a retenção por idade apagou o histórico quando o NAS ficou 10 dias sem backup
#
# Variáveis opcionais (ambiente): BACKUP_DIR, MANTER, TENTATIVAS, ESPERA, POSTGRES_CONTAINER,
# PUBLIC_VOLUME, ENV_FILE, LOCAL_LOG.

set -uo pipefail

BACKUP_DIR="${BACKUP_DIR:-/mnt/nas-backup}"
DATE=$(date +%Y-%m-%d_%H%M%S)
MANTER="${MANTER:-10}"
TENTATIVAS="${TENTATIVAS:-3}"
ESPERA="${ESPERA:-30}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-6glet7ucc6hill7pbv6kkhm1}"
PUBLIC_VOLUME="${PUBLIC_VOLUME:-atendeflow_atendeflow_public}"
ENV_FILE="${ENV_FILE:-$HOME/atendeflow/.env}"
LOG_FILE="$BACKUP_DIR/backup.log"
LOCAL_LOG="${LOCAL_LOG:-$HOME/backup-atendeflow.log}"
MIN_DB_BYTES="${MIN_DB_BYTES:-1048576}"          # 1 MB: um dump menor que isso é suspeito
MIN_FILES_BYTES="${MIN_FILES_BYTES:-104857600}"  # 100 MB

ETAPA="inicio"
PARCIAIS=()

# Registra no log do NAS e num log local (o do NAS pode falhar justamente quando o NAS oscila).
log() {
  echo "$*" >> "$LOCAL_LOG" 2>/dev/null
  { echo "$*" >> "$LOG_FILE"; } 2>/dev/null || true
  echo "$*"
}

terminar() {
  local rc=$?
  if [ "$rc" -ne 0 ]; then
    local f
    for f in ${PARCIAIS[@]+"${PARCIAIS[@]}"}; do rm -f -- "$f" 2>/dev/null; done
    log "!!! Backup FALHOU na etapa: $ETAPA (codigo $rc) em $(date +%Y-%m-%d_%H%M%S)"
    log ""
  fi
}
trap terminar EXIT

# tentar "descricao" comando args...  -> repete até TENTATIVAS vezes
tentar() {
  local desc="$1" i
  shift
  for i in $(seq 1 "$TENTATIVAS"); do
    if "$@"; then return 0; fi
    log "Aviso: $desc falhou (tentativa $i/$TENTATIVAS)"
    [ "$i" -lt "$TENTATIVAS" ] && sleep "$ESPERA"
  done
  return 1
}

# Se o compartilhamento do NAS cair (ex: reboot da VPS sem remontar o
# fstab), $BACKUP_DIR ainda existe como pasta local vazia — sem essa
# checagem o script "funcionaria" gravando tudo no disco local, dando
# falsa sensação de que o backup no NAS está protegido.
if [ "${SKIP_MOUNT_CHECK:-0}" != "1" ] && ! mountpoint -q "$BACKUP_DIR"; then
  echo "Erro: $BACKUP_DIR não está montado (NAS caiu?) — abortando." >&2
  exit 1
fi
if ! timeout 30 ls "$BACKUP_DIR" >/dev/null 2>&1; then
  echo "Erro: $BACKUP_DIR não responde (NAS travado?) — abortando." >&2
  exit 1
fi

DB_NAME=$(grep -E '^DB_NAME=' "$ENV_FILE" | cut -d '=' -f2-)
DB_USER=$(grep -E '^DB_USER=' "$ENV_FILE" | cut -d '=' -f2-)
DB_PASS=$(grep -E '^DB_PASS=' "$ENV_FILE" | cut -d '=' -f2-)
if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
  echo "Erro: DB_NAME/DB_USER não encontrados em $ENV_FILE" >&2
  exit 1
fi

log "=== Backup iniciado em $DATE ==="

# 1. Backup do banco de dados
ETAPA="banco"
DB_FINAL="$BACKUP_DIR/db_${DATE}.sql.gz"
DB_TMP="$DB_FINAL.partial"
PARCIAIS+=("$DB_TMP")

dump_banco() {
  rm -f "$DB_TMP"
  docker exec -e PGPASSWORD="$DB_PASS" "$POSTGRES_CONTAINER" \
    pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl | gzip > "$DB_TMP" || return 1
  gzip -t "$DB_TMP" || return 1
  [ "$(stat -c %s "$DB_TMP")" -ge "$MIN_DB_BYTES" ]
}

tentar "dump do banco" dump_banco || exit 1
mv "$DB_TMP" "$DB_FINAL" || exit 1
log "Banco salvo em $DB_FINAL ($(du -h "$DB_FINAL" | cut -f1)) — integridade verificada"

# 2. Backup dos arquivos do sistema (volume atendeflow_atendeflow_public)
ETAPA="imagem para compactar"

# Imagem que tenha tar e gzip, SEM depender de internet.
IMG=""
testar_imagem() {
  docker run --rm --entrypoint sh "$1" -c 'command -v tar >/dev/null && command -v gzip >/dev/null' >/dev/null 2>&1
}
escolher_imagem() {
  local pg
  if docker image inspect alpine:latest >/dev/null 2>&1 && testar_imagem alpine:latest; then
    IMG="alpine:latest"; return 0
  fi
  pg=$(docker inspect -f '{{.Image}}' "$POSTGRES_CONTAINER" 2>/dev/null)
  if [ -n "$pg" ] && testar_imagem "$pg"; then
    IMG="$pg"
    log "Aviso: imagem alpine ausente; usando a imagem do Postgres em uso (sem baixar nada)"
    return 0
  fi
  if tentar "baixar a imagem alpine" docker pull -q alpine:latest && testar_imagem alpine:latest; then
    IMG="alpine:latest"; return 0
  fi
  return 1
}
escolher_imagem || exit 1

ETAPA="arquivos"
FILES_NAME="files_${DATE}.tar.gz"
FILES_FINAL="$BACKUP_DIR/$FILES_NAME"
FILES_TMP="$FILES_FINAL.partial"
PARCIAIS+=("$FILES_TMP")

compactar_arquivos() {
  local rc
  rm -f "$FILES_TMP"
  docker run --rm --entrypoint tar \
    -v "$PUBLIC_VOLUME":/data:ro -v "$BACKUP_DIR":/backup "$IMG" \
    czf "/backup/$FILES_NAME.partial" -C /data .
  rc=$?
  # tar sai com 1 quando um arquivo muda durante a leitura (mídia do WhatsApp chegando): tolerado,
  # desde que o arquivo passe na verificação abaixo. Qualquer outro código é falha.
  [ "$rc" -eq 0 ] || [ "$rc" -eq 1 ] || return 1
  # Verifica a estrutura inteira (gzip + tar): pega arquivo cortado pelo caminho.
  tar tzf "$FILES_TMP" >/dev/null 2>&1 || return 1
  [ "$(stat -c %s "$FILES_TMP")" -ge "$MIN_FILES_BYTES" ]
}

tentar "compactar os arquivos" compactar_arquivos || exit 1
mv "$FILES_TMP" "$FILES_FINAL" || exit 1
log "Arquivos salvos em $FILES_FINAL ($(du -h "$FILES_FINAL" | cut -f1)) — integridade verificada"

# 3. Retenção por QUANTIDADE: mantém os MANTER mais recentes de cada tipo (nunca apaga abaixo disso)
ETAPA="retencao"
manter_n() {
  local padrao="$1" n="$2" f
  # shellcheck disable=SC2086  # $padrao precisa expandir como glob
  ls -1t "$BACKUP_DIR"/$padrao 2>/dev/null | tail -n +"$((n + 1))" | while read -r f; do
    rm -f -- "$f"
  done
}
manter_n 'db_*.sql.gz' "$MANTER"
manter_n 'files_*.tar.gz' "$MANTER"
find "$BACKUP_DIR" -maxdepth 1 -name '*.partial' -mmin +1440 -delete 2>/dev/null
log "Mantidos os $MANTER backups mais recentes de cada tipo"

ETAPA="fim"
log "=== Backup concluído em $(date +%Y-%m-%d_%H%M%S) ==="
log ""
exit 0
