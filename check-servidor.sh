#!/bin/bash
# Verificação de saúde do servidor (SOMENTE LEITURA) — rede, containers,
# NAS, backups (AtendeFlow, Seafile, Drive), Seafile e disk-monitor.
#
# Pensado pra rodar depois de mudança de rede/local do servidor: mostra o
# que ficou apontando pro ambiente antigo (ex.: IP do NAS no fstab).
# Não altera nada, não apaga nada, não dispara backup.
#
# Uso: ./check-servidor.sh
# Variáveis opcionais: SEAFILE_URL, NAS_BACKUP_DIR, NAS_SEAFILE_DIR,
# RCLONE_REMOTE, MAX_BACKUP_AGE_HOURS

SEAFILE_URL="${SEAFILE_URL:-https://arquivos.confiancatechnologies.com}"
NAS_BACKUP_DIR="${NAS_BACKUP_DIR:-/mnt/nas-backup}"
NAS_SEAFILE_DIR="${NAS_SEAFILE_DIR:-/mnt/nas-seafile}"
SEAFILE_DATA_DIR="${SEAFILE_DATA_DIR:-/srv/seafile-data}"
RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive}"
MAX_BACKUP_AGE_HOURS="${MAX_BACKUP_AGE_HOURS:-30}"

OK=0; WARN=0; FAIL=0
ok()   { echo "  [OK]    $*"; OK=$((OK + 1)); }
warn() { echo "  [AVISO] $*"; WARN=$((WARN + 1)); }
fail() { echo "  [FALHA] $*"; FAIL=$((FAIL + 1)); }
section() { echo; echo "== $* =="; }
have() { command -v "$1" >/dev/null 2>&1; }

# Idade (em horas) do arquivo mais recente que casa com o padrão.
latest_age_hours() {
  local dir="$1" pattern="$2" f
  f=$(ls -t "$dir"/$pattern 2>/dev/null | head -1)
  [ -n "$f" ] || return 1
  echo $(( ( $(date +%s) - $(stat -c %Y "$f") ) / 3600 ))
}

check_backup_age() {
  local label="$1" dir="$2" pattern="$3" age
  if age=$(latest_age_hours "$dir" "$pattern"); then
    if [ "$age" -le "$MAX_BACKUP_AGE_HOURS" ]; then
      ok "$label: último backup há ${age}h"
    else
      fail "$label: último backup há ${age}h (limite ${MAX_BACKUP_AGE_HOURS}h)"
    fi
  else
    fail "$label: nenhum arquivo '$pattern' em $dir"
  fi
}

section "Rede"
echo "  IPs: $(hostname -I 2>/dev/null)"
ip route 2>/dev/null | grep '^default' | sed 's/^/  rota: /'
ping -c1 -W3 1.1.1.1 >/dev/null 2>&1 && ok "Internet por IP (1.1.1.1)" || fail "Sem saída pra internet por IP"
getent hosts google.com >/dev/null 2>&1 && ok "DNS resolvendo" || fail "DNS não resolve (checar /etc/netplan)"
echo "  Fuso: $(timedatectl show -p Timezone --value 2>/dev/null || cat /etc/timezone 2>/dev/null) — hora: $(date)"
if have tailscale; then
  tailscale status >/dev/null 2>&1 && ok "Tailscale conectado" || warn "Tailscale instalado mas não conectado"
fi

section "Docker / containers"
if have docker; then
  if docker info >/dev/null 2>&1; then
    ok "Docker respondendo"
    docker ps --format '  {{.Names}}\t{{.Status}}'
    for c in confianza-seafile confianza-seafile-db confianza-seafile-memcached; do
      [ "$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null)" = "true" ] \
        && ok "container $c rodando" || fail "container $c NÃO está rodando"
    done
    unhealthy=$(docker ps --filter health=unhealthy --format '{{.Names}}')
    [ -z "$unhealthy" ] || fail "containers unhealthy: $unhealthy"
    restarting=$(docker ps --filter status=restarting --format '{{.Names}}')
    [ -z "$restarting" ] || fail "containers reiniciando em loop: $restarting"
  else
    fail "Docker instalado mas sem permissão/daemon parado (usuário no grupo docker?)"
  fi
else
  fail "docker não encontrado"
fi

section "Túnel Cloudflare"
if have systemctl; then
  systemctl is-active --quiet cloudflared 2>/dev/null \
    && ok "serviço cloudflared ativo" \
    || warn "serviço cloudflared não está ativo (pode rodar como container — ver lista acima)"
fi

section "NAS (montagens)"
echo "  fstab (linhas de NAS/CIFS/NFS — conferir se o IP é o do ambiente atual):"
grep -E 'cifs|nfs|nas' /etc/fstab 2>/dev/null | grep -v '^#' | sed 's/^/    /'
for d in "$NAS_BACKUP_DIR" "$NAS_SEAFILE_DIR"; do
  if mountpoint -q "$d" 2>/dev/null; then
    ok "$d montado"
    # Montagem "travada" (NAS inacessível) pendura o ls — timeout evita travar aqui.
    timeout 8 ls "$d" >/dev/null 2>&1 && ok "$d legível" || fail "$d montado mas não responde (NAS inacessível?)"
    timeout 8 df -h "$d" 2>/dev/null | tail -1 | sed 's/^/    /'
  else
    fail "$d NÃO está montado — os backups abortam enquanto isso"
  fi
done
nas_ip=$(grep -E 'cifs|nfs' /etc/fstab 2>/dev/null | grep -v '^#' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | sort -u | head -1)
if [ -n "$nas_ip" ]; then
  ping -c1 -W3 "$nas_ip" >/dev/null 2>&1 && ok "NAS $nas_ip responde ao ping" || fail "NAS $nas_ip (do fstab) NÃO responde — IP antigo?"
fi

section "Disco"
for d in / "$SEAFILE_DATA_DIR"; do
  [ -d "$d" ] && df -h "$d" | tail -1 | awk '{print "  " $6 ": " $3 " usados de " $2 " (" $5 ")"}'
done
use=$(df --output=pcent / | tail -1 | tr -dc 0-9)
[ "${use:-0}" -ge 90 ] && fail "disco / com ${use}% de uso" || ok "disco / com ${use}% de uso"
[ -d "$SEAFILE_DATA_DIR/seafile" ] && ok "dados do Seafile presentes em $SEAFILE_DATA_DIR" || fail "$SEAFILE_DATA_DIR/seafile não existe (partição não montada?)"

section "Backups"
check_backup_age "AtendeFlow banco (NAS)" "$NAS_BACKUP_DIR" "db_*.sql.gz"
check_backup_age "AtendeFlow arquivos (NAS)" "$NAS_BACKUP_DIR" "files_*.tar.gz"
check_backup_age "Seafile banco (NAS)" "$NAS_SEAFILE_DIR" "seafile_db_*.sql.gz"
check_backup_age "Seafile arquivos (NAS)" "$NAS_SEAFILE_DIR" "seafile_files_*.tar.gz"
for l in "$NAS_BACKUP_DIR/backup.log" "$NAS_SEAFILE_DIR/backup.log"; do
  [ -f "$l" ] && { echo "  últimas linhas de $l:"; tail -3 "$l" | sed 's/^/    /'; }
done
echo "  crontab:"
crontab -l 2>/dev/null | grep -iE 'backup' | sed 's/^/    /'
crontab -l 2>/dev/null | grep -q 'backup-atendeflow' && ok "cron do backup AtendeFlow" || warn "sem cron de backup-atendeflow"
crontab -l 2>/dev/null | grep -q 'backup-seafile' && ok "cron do backup Seafile" || warn "sem cron de backup-seafile"
crontab -l 2>/dev/null | grep -q 'backup-para-drive' && ok "cron do backup pro Drive" || warn "sem cron de backup-para-drive"
if have rclone; then
  timeout 30 rclone lsd "$RCLONE_REMOTE:" >/dev/null 2>&1 \
    && ok "rclone ($RCLONE_REMOTE:) acessa o Google Drive" \
    || fail "rclone ($RCLONE_REMOTE:) falhou — token expirado ou sem internet"
else
  warn "rclone não instalado (backup pro Drive indisponível)"
fi

section "Seafile (acesso público)"
if have curl; then
  code=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$SEAFILE_URL/api2/ping/" 2>/dev/null)
  case "$code" in
    200) ok "$SEAFILE_URL respondeu 200 (túnel + Seafile OK)" ;;
    000) fail "$SEAFILE_URL sem resposta (túnel/DNS/internet)" ;;
    *)   fail "$SEAFILE_URL respondeu HTTP $code" ;;
  esac
fi
have docker && docker logs --tail 5 confianza-seafile 2>&1 | sed 's/^/  log: /'

section "Disk-monitor"
if have systemctl; then
  for s in disk-monitor disk-monitor-standalone; do
    systemctl list-unit-files "$s.service" 2>/dev/null | grep -q "$s" \
      && { systemctl is-active --quiet "$s" && ok "serviço $s ativo" || warn "serviço $s instalado mas inativo"; }
  done
fi
for envf in "$HOME"/Bernardino/server-toolkit/disk-monitor/.env /opt/disk-monitor/.env; do
  [ -f "$envf" ] && { grep -E '^DSM_HOST=' "$envf" | sed "s|^|  $envf: |"; }
done

echo
echo "Resumo: $OK ok, $WARN aviso(s), $FAIL falha(s)"
[ "$FAIL" -eq 0 ]
