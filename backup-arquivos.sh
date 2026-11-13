#!/bin/bash
# Backup dos arquivos de trabalho do servidor (fora do AtendeFlow/Seafile/Confianza) pro NAS.
#
# Por que existe: ~/Sandro (projetos, material de clientes) e as pastas "outputs" só existiam no
# disco do servidor, sem nenhuma cópia. Este script copia essas pastas pro NAS (espelhado).
#
# Regras de segurança (de propósito):
#   - NUNCA apaga nada no destino (sem --delete): se um arquivo for apagado por engano na origem,
#     a cópia no NAS continua lá. O custo é que o destino só cresce; limpe à mão quando quiser.
#   - só roda se o destino for mesmo o NAS montado (senão gravaria no disco local e daria falsa
#     sensação de proteção) e se ele responder;
#   - uma execução por vez (flock);
#   - SEMPRE registra o resultado ("concluído" ou "!!! ... FALHOU") no log do NAS e num log local,
#     que o monitor-backups.sh confere (NAS_ARQUIVOS_DIR).
#
# Config opcional em /etc/confianza-arquivos.conf (bash): DEST, FONTES, EXCLUIR. Exemplo:
#   FONTES=( "$HOME/Sandro:Sandro" "$HOME/Projetos:Projetos" )     # "origem:pasta-no-destino"
#
# Variáveis de ambiente: DEST (padrão /mnt/nas-arquivos), LOCAL_LOG, CONFIANZA_ARQUIVOS_CONF.

set -uo pipefail

CONF="${CONFIANZA_ARQUIVOS_CONF:-/etc/confianza-arquivos.conf}"

DEST="${DEST:-/mnt/nas-arquivos}"
LOCAL_LOG="${LOCAL_LOG:-$HOME/backup-arquivos.log}"
# "origem:pasta-no-destino" (a origem pode ter espaços; vale o ÚLTIMO ":" da string)
FONTES=(
  "$HOME/Sandro:Sandro"
  "$HOME/2026-10-12/c/outputs:cactus-outputs"
  "$HOME/2026-10-21/referenced-chatgpt-conversation-this-is-an/outputs:site-crm-outputs"
)
# Dependências recriáveis e caches: não vale gastar espaço no NAS com elas.
EXCLUIR=( "node_modules/" ".cache/" "__pycache__/" ".wrangler/" )

# shellcheck source=/dev/null
[ -r "$CONF" ] && . "$CONF"

LOG_NAS="$DEST/backup-arquivos.log"
ETAPA="inicio"

log() {
  echo "$*" >> "$LOCAL_LOG" 2>/dev/null
  { echo "$*" >> "$LOG_NAS"; } 2>/dev/null || true
  echo "$*"
}

terminar() {
  local rc=$?
  if [ "$rc" -ne 0 ]; then
    log "!!! Backup de arquivos FALHOU na etapa: $ETAPA (codigo $rc) em $(date +%Y-%m-%d_%H%M%S)"
    log ""
  fi
}
trap terminar EXIT

LOCK="${XDG_RUNTIME_DIR:-/tmp}/backup-arquivos.lock"
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "Ja existe um backup de arquivos em execucao; saindo." >&2
  trap - EXIT
  exit 0
fi

ETAPA="verificar destino"
if [ "${SKIP_MOUNT_CHECK:-0}" != "1" ] && ! mountpoint -q "$DEST"; then
  echo "Erro: $DEST nao esta montado (NAS caiu?) - abortando." >&2
  exit 1
fi
if ! timeout 30 ls "$DEST" >/dev/null 2>&1; then
  echo "Erro: $DEST nao responde (NAS travado?) - abortando." >&2
  exit 1
fi

log "=== Backup de arquivos iniciado em $(date +%Y-%m-%d_%H%M%S) ==="

OPCOES=( -rt --partial --no-perms --no-owner --no-group --modify-window=2 --info=stats1 )
for e in "${EXCLUIR[@]}"; do OPCOES+=( --exclude="$e" ); done

FALHAS=0
for item in "${FONTES[@]}"; do
  origem="${item%:*}"
  nome="${item##*:}"
  ETAPA="copiar $nome"
  if [ ! -d "$origem" ]; then
    log "FALHA: origem nao existe: $origem"
    FALHAS=$((FALHAS + 1))
    continue
  fi
  mkdir -p "$DEST/$nome" || { log "FALHA: nao consegui criar $DEST/$nome"; FALHAS=$((FALHAS + 1)); continue; }
  saida=$(rsync "${OPCOES[@]}" "$origem/" "$DEST/$nome/" 2>&1)
  rc=$?
  echo "$saida" | grep -E 'Number of regular files transferred|Total transferred file size' | sed "s|^|[$nome] |" >> "$LOCAL_LOG" 2>/dev/null
  # 24 = arquivo sumiu durante a copia (normal em pasta em uso)
  if [ "$rc" -eq 0 ] || [ "$rc" -eq 24 ]; then
    log "OK: $nome <- $origem"
  else
    log "FALHA: rsync de $nome terminou com codigo $rc"
    echo "$saida" | tail -5 | sed 's/^/    /' | while IFS= read -r l; do log "$l"; done
    FALHAS=$((FALHAS + 1))
  fi
done

ETAPA="fim"
if [ "$FALHAS" -gt 0 ]; then
  exit 1
fi
log "=== Backup de arquivos concluído em $(date +%Y-%m-%d_%H%M%S) ==="
log ""
exit 0
