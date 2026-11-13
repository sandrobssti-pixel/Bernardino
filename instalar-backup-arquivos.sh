#!/bin/bash
# Instala o backup diario dos arquivos de trabalho (backup-arquivos.sh) no servidor.
#
#   sudo ./instalar-backup-arquivos.sh
#
# Pre-requisito: o compartilhamento do NAS ja estar montado em /mnt/nas-arquivos
# (ver docs/backup-arquivos.md). Roda como o USUARIO que invocou o sudo (os arquivos sao dele),
# todos os dias as 04:30 (depois dos backups das 02:37, 03:00 e 03:30). Pode repetir sem problema.

set -eu

[ "$(id -u)" -eq 0 ] || { echo "Rode como root: sudo $0" >&2; exit 1; }
USUARIO="${SUDO_USER:-}"
[ -n "$USUARIO" ] && [ "$USUARIO" != "root" ] || { echo "Rode com sudo a partir do seu usuario (nao como root direto)." >&2; exit 1; }

ORIGEM="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$ORIGEM/backup-arquivos.sh"
[ -f "$SCRIPT" ] || { echo "Nao achei $SCRIPT" >&2; exit 1; }

DEST="${DEST:-/mnt/nas-arquivos}"
mountpoint -q "$DEST" || { echo "$DEST nao esta montado. Monte o compartilhamento antes (docs/backup-arquivos.md)." >&2; exit 1; }

install -m 755 "$SCRIPT" /usr/local/bin/confianza-backup-arquivos
echo "Instalado: /usr/local/bin/confianza-backup-arquivos"

cat > /etc/systemd/system/confianza-backup-arquivos.service <<UNIT
[Unit]
Description=Confianza - backup dos arquivos de trabalho para o NAS
After=network-online.target remote-fs.target
Wants=network-online.target

[Service]
Type=oneshot
User=$USUARIO
Environment=DEST=$DEST
ExecStart=/usr/local/bin/confianza-backup-arquivos
Nice=10
IOSchedulingClass=idle
UNIT

cat > /etc/systemd/system/confianza-backup-arquivos.timer <<'UNIT'
[Unit]
Description=Roda o backup dos arquivos de trabalho todo dia

[Timer]
OnCalendar=*-*-* 04:30:00
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable --now confianza-backup-arquivos.timer
echo
systemctl list-timers confianza-backup-arquivos.timer --no-pager || true
cat <<'FIM'

Proximos passos:
  1. Primeira copia (demora; roda em segundo plano):
       sudo systemctl start --no-block confianza-backup-arquivos.service
       tail -f ~/backup-arquivos.log          # Ctrl+C para sair; termina com "concluido"
  2. Ligar a checagem no monitor: em /etc/confianza-alertas.conf acrescente
       NAS_ARQUIVOS_DIR="/mnt/nas-arquivos"
     e atualize o monitor:  sudo ./instalar-monitor-backups.sh
FIM
