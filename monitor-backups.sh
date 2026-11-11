#!/bin/bash
# Monitor dos backups (AtendeFlow, Seafile e Confianza) com aviso por WhatsApp e e-mail.
#
# SOMENTE LEITURA: só lê arquivos e estado e envia avisos. Não apaga nem altera backups.
#
# O que verifica (cada item que falhar vira uma linha no aviso):
#   - NAS montado, respondendo e com espaço livre
#   - backup mais recente de cada tipo: idade (<= MAX_AGE_HOURS) e tamanho mínimo
#   - backup.log: a última linha precisa ser "concluído" (backup que começou e não terminou)
#   - arquivos .partial antigos (backup interrompido)
#   - Confianza: checksum .sha256 confere
#   - containers essenciais rodando e sem "unhealthy"; disco do sistema abaixo do limite
#
# Aviso sem repetição: o mesmo problema só é reenviado depois de REPEAT_HOURS, e quando
# tudo volta ao normal é enviada uma mensagem "RECUPERADO".
#
# Configuração (limites, e-mail, WhatsApp): /etc/confianza-alertas.conf (modelo em
# docs/monitoramento-backups.md; o instalador cria o arquivo).
#
# Uso:
#   ./monitor-backups.sh           verifica e avisa se houver problema
#   ./monitor-backups.sh --dry     verifica e MOSTRA o aviso, sem enviar nem gravar estado
#   ./monitor-backups.sh --teste   envia uma mensagem de teste por todos os canais
#
# Saída: 0 = tudo ok | 1 = problema encontrado | 2 = problema e nenhum aviso foi entregue

set -u
export LC_ALL=C

CONF="${CONFIANZA_ALERTAS_CONF:-/etc/confianza-alertas.conf}"
# shellcheck source=/dev/null
[ -r "$CONF" ] && . "$CONF"

: "${NAS_BACKUP_DIR:=/mnt/nas-backup}"
: "${NAS_SEAFILE_DIR:=/mnt/nas-seafile}"
: "${NAS_CONFIANZA_DIR:=/mnt/nas-confianza}"
: "${MAX_AGE_HOURS:=26}"
: "${MIN_ATENDEFLOW_DB_MB:=50}"
: "${MIN_ATENDEFLOW_FILES_GB:=10}"
: "${MIN_SEAFILE_DB_KB:=500}"
: "${MIN_SEAFILE_FILES_GB:=8}"
: "${MIN_CONFIANZA_MB:=1}"
: "${MIN_FREE_GB:=20}"
: "${PARTIAL_MAX_AGE_HOURS:=3}"
: "${ROOT_MAX_PCT:=90}"
# Sem ":" de proposito: CONTAINERS="" no arquivo de configuracao DESLIGA essa checagem.
: "${CONTAINERS=confianza-seafile confianza-seafile-db atendeflow-backend-1}"
: "${EXTRA_UNITS=}"
: "${REPEAT_HOURS:=24}"
: "${STATE_DIR:=/var/lib/confianza-alertas}"
: "${SERVER_NAME:=$(hostname)}"
: "${EMAIL_TO:=}"
: "${EMAIL_FROM:=}"
: "${WHATSAPP_API_URL:=}"
: "${WHATSAPP_TOKEN:=}"
: "${WHATSAPP_NUMBERS:=}"
# 1 = nao cria contato/ticket no AtendeFlow (conexao Baileys). Use 0 se a conexao for da API Oficial,
# que rejeita o parametro noRegister.
: "${WHATSAPP_NO_REGISTER:=1}"

MODO_DRY=0
MODO_TESTE=0
for arg in "$@"; do
  case "$arg" in
    --dry) MODO_DRY=1 ;;
    --teste) MODO_TESTE=1 ;;
    -h|--help) sed -n '2,29p' "$0"; exit 0 ;;
    *) echo "Argumento desconhecido: $arg (use --dry, --teste ou --help)" >&2; exit 64 ;;
  esac
done

PROBLEMAS=()
problema() { PROBLEMAS+=("$*"); }
registrar() { logger -t confianza-monitor -- "$*" 2>/dev/null; echo "$*"; }

humano() { numfmt --to=iec --suffix=B "$1" 2>/dev/null || echo "${1}B"; }

# ---------------------------------------------------------------------------
# Verificações
# ---------------------------------------------------------------------------

# Diretório do NAS montado, respondendo e com espaço. Retorna 1 se não der pra seguir.
checar_diretorio() {
  local rotulo="$1" dir="$2" livre
  if [ "${SKIP_MOUNT_CHECK:-0}" != "1" ] && ! mountpoint -q "$dir" 2>/dev/null; then
    problema "$rotulo: $dir NAO esta montado (NAS fora do ar ou IP mudou?)"
    return 1
  fi
  if ! timeout 20 ls "$dir" >/dev/null 2>&1; then
    problema "$rotulo: $dir nao responde (NAS travado?)"
    return 1
  fi
  livre=$(timeout 20 df -BG --output=avail "$dir" 2>/dev/null | tail -1 | tr -dc '0-9')
  if [ -n "$livre" ] && [ "$livre" -lt "$MIN_FREE_GB" ]; then
    problema "$rotulo: so ${livre}GB livres em $dir (minimo ${MIN_FREE_GB}GB)"
  fi
  return 0
}

# Arquivo mais recente que casa com o padrão: idade e tamanho mínimo.
# Imprime o nome do arquivo em NEWEST_FILE (vazio se não houver).
NEWEST_FILE=""
checar_mais_recente() {
  local rotulo="$1" dir="$2" padrao="$3" min_bytes="$4" f mtime tamanho idade
  NEWEST_FILE=""
  # shellcheck disable=SC2086  # $padrao precisa expandir como glob dentro do diretório
  f=$(cd "$dir" 2>/dev/null && timeout 30 ls -t $padrao 2>/dev/null | head -1)
  if [ -z "$f" ]; then
    problema "$rotulo: nenhum arquivo '$padrao' em $dir"
    return 1
  fi
  NEWEST_FILE="$f"
  mtime=$(stat -c %Y "$dir/$f" 2>/dev/null || echo 0)
  tamanho=$(stat -c %s "$dir/$f" 2>/dev/null || echo 0)
  idade=$(( ($(date +%s) - mtime) / 3600 ))
  if [ "$idade" -gt "$MAX_AGE_HOURS" ]; then
    problema "$rotulo: ultimo backup ($f) tem ${idade}h (limite ${MAX_AGE_HOURS}h)"
  fi
  if [ "$tamanho" -lt "$min_bytes" ]; then
    problema "$rotulo: $f tem so $(humano "$tamanho") (minimo $(humano "$min_bytes")) - provavelmente cortado"
  fi
  return 0
}

# A última linha de início/fim do backup.log precisa ser de término.
checar_log() {
  local rotulo="$1" log="$2" ultima
  [ -r "$log" ] || { problema "$rotulo: $log nao encontrado"; return; }
  ultima=$(timeout 20 grep -E 'iniciado|conclu' "$log" 2>/dev/null | tail -1)
  case "$ultima" in
    *conclu*) ;;
    "") problema "$rotulo: $log sem registro de inicio/fim" ;;
    *) problema "$rotulo: o ultimo backup comecou e nao terminou ($ultima)" ;;
  esac
}

checar_parciais() {
  local rotulo="$1" dir="$2" lista
  lista=$(timeout 30 find "$dir" -maxdepth 1 -name '*.partial' -mmin +$((PARTIAL_MAX_AGE_HOURS * 60)) 2>/dev/null | head -5)
  if [ -n "$lista" ]; then
    problema "$rotulo: backup(s) interrompido(s) (.partial): $(echo "$lista" | xargs -n1 basename | paste -sd, -)"
  fi
}

verificar_atendeflow() {
  checar_diretorio "AtendeFlow (NAS)" "$NAS_BACKUP_DIR" || return
  checar_mais_recente "AtendeFlow banco" "$NAS_BACKUP_DIR" 'db_*.sql.gz' $((MIN_ATENDEFLOW_DB_MB * 1048576))
  checar_mais_recente "AtendeFlow arquivos" "$NAS_BACKUP_DIR" 'files_*.tar.gz' $((MIN_ATENDEFLOW_FILES_GB * 1073741824))
  checar_log "AtendeFlow" "$NAS_BACKUP_DIR/backup.log"
  checar_parciais "AtendeFlow" "$NAS_BACKUP_DIR"
}

verificar_seafile() {
  checar_diretorio "Seafile (NAS)" "$NAS_SEAFILE_DIR" || return
  checar_mais_recente "Seafile banco" "$NAS_SEAFILE_DIR" 'seafile_db_*.sql.gz' $((MIN_SEAFILE_DB_KB * 1024))
  checar_mais_recente "Seafile arquivos" "$NAS_SEAFILE_DIR" 'seafile_files_*.tar.gz' $((MIN_SEAFILE_FILES_GB * 1073741824))
  checar_log "Seafile" "$NAS_SEAFILE_DIR/backup.log"
  checar_parciais "Seafile" "$NAS_SEAFILE_DIR"
}

verificar_confianza() {
  checar_diretorio "Confianza (NAS)" "$NAS_CONFIANZA_DIR" || return
  checar_mais_recente "Confianza" "$NAS_CONFIANZA_DIR" 'confianza-*.tar.gz.enc' $((MIN_CONFIANZA_MB * 1048576)) || return
  if [ -r "$NAS_CONFIANZA_DIR/$NEWEST_FILE.sha256" ]; then
    (cd "$NAS_CONFIANZA_DIR" && timeout 60 sha256sum -c "$NEWEST_FILE.sha256" >/dev/null 2>&1) \
      || problema "Confianza: checksum de $NEWEST_FILE NAO confere"
  else
    problema "Confianza: falta o arquivo $NEWEST_FILE.sha256"
  fi
}

verificar_servidor() {
  local c estado uso u
  if command -v docker >/dev/null 2>&1; then
    for c in $CONTAINERS; do
      estado=$(timeout 20 docker inspect -f '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}-{{end}}' "$c" 2>/dev/null)
      case "$estado" in
        "") problema "container $c nao existe" ;;
        running\|unhealthy) problema "container $c esta UNHEALTHY" ;;
        running\|*) ;;
        *) problema "container $c nao esta rodando (${estado%%|*})" ;;
      esac
    done
  fi
  uso=$(df -P / 2>/dev/null | awk 'NR==2{gsub("%","",$5); print $5}')
  if [ -n "$uso" ] && [ "$uso" -ge "$ROOT_MAX_PCT" ]; then
    problema "disco do sistema (/) com ${uso}% de uso (limite ${ROOT_MAX_PCT}%)"
  fi
  for u in $EXTRA_UNITS; do
    systemctl is-active --quiet "$u" 2>/dev/null || problema "servico $u nao esta ativo"
  done
}

# ---------------------------------------------------------------------------
# Envio
# ---------------------------------------------------------------------------

enviar_whatsapp() {
  local msg="$1" n json codigo ok=1
  if [ -z "$WHATSAPP_API_URL" ] || [ -z "$WHATSAPP_TOKEN" ] || [ -z "$WHATSAPP_NUMBERS" ]; then
    registrar "WhatsApp nao configurado (WHATSAPP_API_URL/WHATSAPP_TOKEN/WHATSAPP_NUMBERS)"
    return 1
  fi
  command -v python3 >/dev/null 2>&1 || { registrar "WhatsApp: python3 nao encontrado"; return 1; }
  for n in $WHATSAPP_NUMBERS; do
    json=$(python3 -c 'import json,sys; d={"number": sys.argv[1], "body": sys.argv[2]}
if sys.argv[3] == "1": d["noRegister"] = True
print(json.dumps(d))' "$n" "$msg" "$WHATSAPP_NO_REGISTER")
    codigo=$(curl -sS -m 30 -o /dev/null -w '%{http_code}' -X POST "$WHATSAPP_API_URL" \
      -H "Authorization: Bearer $WHATSAPP_TOKEN" -H "Content-Type: application/json" -d "$json" 2>/dev/null)
    case "$codigo" in
      2??) registrar "WhatsApp enviado para $n (HTTP $codigo)"; ok=0 ;;
      *) registrar "WhatsApp FALHOU para $n (HTTP ${codigo:-sem resposta})" ;;
    esac
  done
  return $ok
}

enviar_email() {
  local assunto="$1" msg="$2" de="${EMAIL_FROM:-$EMAIL_TO}"
  if [ -z "$EMAIL_TO" ]; then
    registrar "E-mail nao configurado (EMAIL_TO)"
    return 1
  fi
  if command -v msmtp >/dev/null 2>&1; then
    if printf 'From: %s\nTo: %s\nSubject: %s\nMIME-Version: 1.0\nContent-Type: text/plain; charset=UTF-8\n\n%s\n' \
        "$de" "$EMAIL_TO" "$assunto" "$msg" | msmtp -t >/dev/null 2>&1; then
      registrar "E-mail enviado para $EMAIL_TO"; return 0
    fi
    registrar "E-mail FALHOU (msmtp)"; return 1
  elif command -v mail >/dev/null 2>&1; then
    if printf '%s\n' "$msg" | mail -s "$assunto" "$EMAIL_TO"; then
      registrar "E-mail enviado para $EMAIL_TO"; return 0
    fi
    registrar "E-mail FALHOU (mail)"; return 1
  fi
  registrar "E-mail: nem msmtp nem mail instalados"
  return 1
}

# Envia por todos os canais; sucesso se ao menos um entregou.
notificar() {
  local assunto="$1" msg="$2" ok=1
  if [ "$MODO_DRY" = "1" ]; then
    echo "----- (--dry) assunto: $assunto"; echo "$msg"; echo "-----"
    return 0
  fi
  enviar_whatsapp "$msg" && ok=0
  enviar_email "$assunto" "$msg" && ok=0
  return $ok
}

# ---------------------------------------------------------------------------
# Principal
# ---------------------------------------------------------------------------

AGORA=$(date '+%d/%m/%Y %H:%M')

if [ "$MODO_TESTE" = "1" ]; then
  if notificar "[$SERVER_NAME] TESTE do monitor de backups" "[$SERVER_NAME] TESTE do monitor de backups ($AGORA). Se voce recebeu esta mensagem, o aviso esta funcionando."; then
    exit 0
  fi
  exit 2
fi

verificar_atendeflow
verificar_seafile
verificar_confianza
verificar_servidor

mkdir -p "$STATE_DIR" 2>/dev/null || STATE_DIR="/tmp/confianza-alertas"
mkdir -p "$STATE_DIR" 2>/dev/null
ARQ_HASH="$STATE_DIR/ultimo_hash"
ARQ_QUANDO="$STATE_DIR/ultimo_envio"
hash_anterior=$(cat "$ARQ_HASH" 2>/dev/null || true)
quando_anterior=$(cat "$ARQ_QUANDO" 2>/dev/null || echo 0)

if [ "${#PROBLEMAS[@]}" -eq 0 ]; then
  registrar "Backups em dia: nenhum problema encontrado"
  if [ -n "$hash_anterior" ] && [ "$MODO_DRY" != "1" ]; then
    notificar "[$SERVER_NAME] Backups RECUPERADOS" "[$SERVER_NAME] RECUPERADO ($AGORA): os backups voltaram ao normal." || true
    rm -f "$ARQ_HASH" "$ARQ_QUANDO"
  fi
  exit 0
fi

hash_atual=$(printf '%s\n' "${PROBLEMAS[@]}" | sort | sha256sum | cut -c1-16)
mensagem="[$SERVER_NAME] ALERTA de backup ($AGORA)"$'\n'$(printf -- '- %s\n' "${PROBLEMAS[@]}")
mensagem="${mensagem:0:1500}"
registrar "Problemas encontrados: ${#PROBLEMAS[@]}"
printf -- '  - %s\n' "${PROBLEMAS[@]}"

passou=$(( $(date +%s) - quando_anterior ))
if [ "$MODO_DRY" != "1" ] && [ "$hash_atual" = "$hash_anterior" ] && [ "$passou" -lt $((REPEAT_HOURS * 3600)) ]; then
  registrar "Mesmo problema ja avisado ha $((passou / 3600))h; nao repito (repete a cada ${REPEAT_HOURS}h)"
  exit 1
fi

if notificar "[$SERVER_NAME] ALERTA: backup com problema" "$mensagem"; then
  if [ "$MODO_DRY" != "1" ]; then
    echo "$hash_atual" > "$ARQ_HASH"
    date +%s > "$ARQ_QUANDO"
  fi
  exit 1
fi
registrar "ERRO: o aviso nao foi entregue por nenhum canal"
exit 2
