#!/bin/bash
# Faz os serviços do servidor subirem sozinhos depois de reiniciar.
#
#   sudo bash ~/atendeflow/server-toolkit/autostart/instalar-autostart.sh
#
# O que faz (pode rodar de novo quantas vezes quiser — é idempotente):
#  1. Habilita o Docker (e o containerd) no boot.
#  2. Cria o serviço "confianza-stack": no boot espera a rede, o Docker e os
#     discos (/srv/seafile-data e NAS) e roda "docker compose up -d" do
#     AtendeFlow e do Seafile com --no-recreate — liga container parado
#     (inclusive parado à mão) sem nunca recriar os que já existem.
#  3. Habilita o cloudflared, o pm2 (site) e o disk-monitor, se existirem.
#  4. Confere o /etc/fstab e avisa se falta "nofail"/"x-systemd.automount"
#     (sem isso o boot pode travar ou o Seafile subir sem os arquivos).
# Não reinicia nada agora: só deixa pronto para o próximo boot.

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode com sudo: sudo bash $0" >&2
  exit 1
fi

USUARIO="${SUDO_USER:-sandro}"
HOME_USUARIO="$(getent passwd "$USUARIO" | cut -d: -f6)"
PASTA="${ATENDEFLOW_DIR:-$HOME_USUARIO/atendeflow}"
SCRIPT_SUBIR="/usr/local/bin/confianza-subir-servicos"

ok()    { echo "  ✅ $*"; }
aviso() { echo "  ⚠️  $*"; }
passo() { echo; echo "▶ $*"; }

[ -f "$PASTA/docker-compose.coolify.yml" ] || { echo "Não achei $PASTA/docker-compose.coolify.yml (defina ATENDEFLOW_DIR)." >&2; exit 1; }

passo "1. Docker no boot"
systemctl enable docker >/dev/null 2>&1 && ok "docker habilitado" || aviso "não consegui habilitar o docker"
systemctl enable containerd >/dev/null 2>&1 && ok "containerd habilitado" || true

passo "2. Serviço confianza-stack (AtendeFlow + Seafile)"
cat > "$SCRIPT_SUBIR" <<SCRIPT
#!/bin/bash
# Gerado por instalar-autostart.sh — sobe as stacks Docker no boot.
PASTA="$PASTA"
log() { echo "[confianza-stack] \$*"; }

# Espera o Docker responder (até 2 min).
for i in \$(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 2; done

# Espera os discos do Seafile/NAS (até 2 min cada; segue mesmo se faltar).
esperar_montagem() {
  local ponto="\$1"
  grep -qs " \$ponto " /etc/fstab || return 0
  for i in \$(seq 1 60); do
    ls "\$ponto" >/dev/null 2>&1   # dispara o automount, se houver
    mountpoint -q "\$ponto" && { log "\$ponto montado"; return 0; }
    sleep 2
  done
  log "AVISO: \$ponto não montou"
  return 1
}
esperar_montagem /mnt/nas-backup
esperar_montagem /mnt/nas-seafile
SEAFILE_DISCO_OK=0
esperar_montagem /srv/seafile-data && SEAFILE_DISCO_OK=1

cd "\$PASTA" || exit 1

if [ -f .env ]; then
  log "subindo AtendeFlow"
  # --no-recreate: só liga o que estiver parado; nunca recria container que
  # já existe. Se faltar container, cria (e constrói a imagem, se preciso).
  docker compose -f docker-compose.coolify.yml --env-file .env up -d --no-recreate || log "ERRO ao subir AtendeFlow"
fi

if [ -f docker-compose.seafile.yml ] && [ -f .env.seafile ]; then
  if [ "\$SEAFILE_DISCO_OK" = "1" ] || ! grep -qs " /srv/seafile-data " /etc/fstab; then
    log "subindo Seafile"
    docker compose -p seafile -f docker-compose.seafile.yml --env-file .env.seafile up -d --no-recreate || log "ERRO ao subir Seafile"
  else
    log "Seafile NÃO subiu: /srv/seafile-data não está montado (evita subir sem os arquivos)"
  fi
fi
exit 0
SCRIPT
chmod 755 "$SCRIPT_SUBIR"

cat > /etc/systemd/system/confianza-stack.service <<UNIT
[Unit]
Description=Confianza - sobe AtendeFlow e Seafile (docker compose) no boot
Requires=docker.service
After=docker.service network-online.target remote-fs.target local-fs.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=$SCRIPT_SUBIR
TimeoutStartSec=600

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable confianza-stack.service >/dev/null 2>&1 && ok "confianza-stack habilitado (roda a cada boot)"

passo "3. Outros serviços"
for servico in cloudflared disk-monitor disk-monitor-standalone; do
  if systemctl list-unit-files "${servico}.service" --no-legend 2>/dev/null | grep -q "$servico"; then
    systemctl enable "$servico" >/dev/null 2>&1 && ok "$servico habilitado"
  fi
done

if command -v pm2 >/dev/null 2>&1 || sudo -u "$USUARIO" bash -lc 'command -v pm2' >/dev/null 2>&1; then
  if sudo -u "$USUARIO" bash -lc 'pm2 jlist 2>/dev/null' | grep -q '"name"'; then
    PM2_BIN="$(sudo -u "$USUARIO" bash -lc 'command -v pm2')"
    PM2_PATH="$(dirname "$(sudo -u "$USUARIO" bash -lc 'command -v node')")"
    env PATH="$PATH:$PM2_PATH" "$PM2_BIN" startup systemd -u "$USUARIO" --hp "$HOME_USUARIO" >/dev/null 2>&1 \
      && ok "pm2 registrado no boot (pm2-$USUARIO)" || aviso "não consegui registrar o pm2 no boot"
    sudo -u "$USUARIO" bash -lc 'pm2 save' >/dev/null 2>&1 && ok "lista de processos do pm2 salva"
  else
    ok "pm2 instalado, mas sem processos — nada a fazer"
  fi
fi

passo "4. Conferindo /etc/fstab (discos que precisam montar no boot)"
if grep -Eq '^[^#].*\s(cifs|nfs|smb)' /etc/fstab; then
  while read -r linha; do
    ponto="$(echo "$linha" | awk '{print $2}')"
    if echo "$linha" | grep -q 'nofail' && echo "$linha" | grep -q 'x-systemd.automount'; then
      ok "$ponto: ok (nofail + automount)"
    else
      aviso "$ponto: falta 'nofail,x-systemd.automount' nas opções — se o NAS estiver fora, o boot pode travar"
    fi
  done < <(grep -E '^[^#].*\s(cifs|nfs|smb)' /etc/fstab)
else
  ok "nenhum compartilhamento de rede no fstab"
fi

echo
echo "Pronto. No próximo reinício tudo sobe sozinho."
echo "Para testar sem reiniciar:  sudo systemctl start confianza-stack && journalctl -u confianza-stack -n 30 --no-pager"
echo "Depois de reiniciar, confira: bash $PASTA/server-toolkit/autostart/verificar-servicos.sh"
