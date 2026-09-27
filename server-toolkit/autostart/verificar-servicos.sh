#!/bin/bash
# Mostra se tudo subiu depois de reiniciar o servidor.
#   bash ~/atendeflow/server-toolkit/autostart/verificar-servicos.sh

SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
verde() { echo "  ✅ $*"; }
vermelho() { echo "  ❌ $*"; }

echo "▶ Serviços do sistema"
for s in docker confianza-stack cloudflared disk-monitor "pm2-${SUDO_USER:-$USER}"; do
  if systemctl list-unit-files "$s.service" --no-legend 2>/dev/null | grep -q "$s"; then
    estado="$(systemctl is-active "$s" 2>/dev/null)"; habil="$(systemctl is-enabled "$s" 2>/dev/null)"
    [ "$estado" = "active" ] && verde "$s: $estado ($habil)" || vermelho "$s: $estado ($habil)"
  fi
done

echo; echo "▶ Discos"
for p in /srv/seafile-data /mnt/nas-backup /mnt/nas-seafile; do
  grep -qs " $p " /etc/fstab || continue
  ls "$p" >/dev/null 2>&1
  mountpoint -q "$p" && verde "$p montado" || vermelho "$p NÃO montado"
done

echo; echo "▶ Containers"
$SUDO docker ps -a --format '{{.Names}}\t{{.Status}}' | sort | while IFS=$'\t' read -r nome status; do
  case "$status" in Up*) verde "$nome — $status" ;; *) vermelho "$nome — $status" ;; esac
done

echo; echo "▶ Sites"
for url in https://atendeflow.confiancatechnologies.com https://api.confiancatechnologies.com https://instagram-ai-agent-omega.vercel.app/api/webhook; do
  codigo="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url")"
  case "$codigo" in 2*|3*|401|404) verde "$url ($codigo)" ;; *) vermelho "$url ($codigo)" ;; esac
done
