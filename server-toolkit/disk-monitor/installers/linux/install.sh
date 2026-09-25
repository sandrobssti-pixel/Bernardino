#!/bin/bash
# Instalador por terminal do disk-monitor pra Linux.
#
# Funciona nos dois cenários:
#   1. Rodado de dentro do checkout do repositório (server-toolkit/disk-monitor/installers/linux/install.sh)
#      -> instala a partir do código-fonte, precisa de Node.js 18+.
#   2. Rodado de dentro do pacote gerado por package-for-new-server.sh
#      (que inclui esse mesmo script) -> instala o executável pronto,
#      SEM precisar de Node.js na máquina de destino.
#
# Uso: sudo ./install.sh [pasta de instalação, padrão /opt/disk-monitor]

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode como root (sudo ./install.sh) — precisa criar o serviço systemd." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Acha a pasta com os arquivos de verdade (public/ + disk-monitor-linux OU
# server.js) subindo a partir de onde este script está — funciona tanto
# rodando de dentro do checkout do repositório
# (server-toolkit/disk-monitor/installers/linux/install.sh, 2 níveis
# acima) quanto de dentro do pacote gerado por package-for-new-server.sh
# (installers/install.sh, 1 nível acima) sem depender de uma
# profundidade fixa de pastas.
SOURCE_DIR=""
CANDIDATE="$SCRIPT_DIR"
for _ in 1 2 3; do
  CANDIDATE="$(cd "$CANDIDATE/.." && pwd)"
  if [ -d "$CANDIDATE/public" ] && { [ -f "$CANDIDATE/disk-monitor-linux" ] || [ -f "$CANDIDATE/server.js" ]; }; then
    SOURCE_DIR="$CANDIDATE"
    break
  fi
done

if [ -z "$SOURCE_DIR" ]; then
  echo "Não achei os arquivos do disk-monitor perto deste script — rode a partir do pacote baixado/gerado, sem mover só o install.sh sozinho." >&2
  exit 1
fi

INSTALL_DIR="${1:-/opt/disk-monitor}"

echo "=== Instalador do disk-monitor (Linux) ==="
echo "Origem:  $SOURCE_DIR"
echo "Destino: $INSTALL_DIR"
echo ""

HAS_EXECUTABLE=0
if [ -f "$SOURCE_DIR/disk-monitor-linux" ]; then
  HAS_EXECUTABLE=1
fi

mkdir -p "$INSTALL_DIR"

if [ "$HAS_EXECUTABLE" -eq 1 ]; then
  echo "Executável encontrado — instalando sem precisar de Node.js."
  cp "$SOURCE_DIR/disk-monitor-linux" "$INSTALL_DIR/"
  chmod +x "$INSTALL_DIR/disk-monitor-linux"
  cp -r "$SOURCE_DIR/public" "$INSTALL_DIR/"
  EXEC_LINE="ExecStart=$INSTALL_DIR/disk-monitor-linux"
else
  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js não encontrado. Instale o Node.js 18+ antes de continuar," >&2
    echo "ou use o executável pronto (server-toolkit/dist/linux/) em vez do código-fonte." >&2
    exit 1
  fi
  echo "Instalando a partir do código-fonte (Node.js $(node --version) encontrado)."
  cp -r "$SOURCE_DIR"/. "$INSTALL_DIR/"
  rm -rf "$INSTALL_DIR/node_modules" "$INSTALL_DIR/installers" "$INSTALL_DIR/package-lock.json"

  # O package.json do disk-monitor depende de "toolkit-auth" por caminho
  # relativo ("file:../shared/auth") — sem copiar server-toolkit/shared/
  # pro mesmo nível relativo aqui, o npm install falha depois que os
  # arquivos saem de dentro do repositório (bug real, encontrado testando
  # este instalador).
  SHARED_SOURCE_DIR="$(cd "$SOURCE_DIR/../shared" && pwd)"
  SHARED_DEST_DIR="$(cd "$INSTALL_DIR/.." && pwd)/shared"
  mkdir -p "$SHARED_DEST_DIR"
  cp -r "$SHARED_SOURCE_DIR"/. "$SHARED_DEST_DIR/"

  (cd "$INSTALL_DIR" && npm install --omit=dev --no-audit --no-fund)
  EXEC_LINE="ExecStart=/usr/bin/env node $INSTALL_DIR/server.js"
fi

mkdir -p "$INSTALL_DIR/data"

if [ ! -f "$INSTALL_DIR/.env" ]; then
  echo ""
  echo "--- Configuração inicial ---"
  if [ -n "${DISK_MONITOR_GUI_ADMIN_USER:-}" ]; then
    # Chamado pelo install-gui.sh — usuário/senha já vieram das caixas de
    # diálogo, não pergunta de novo no terminal.
    ADMIN_USER="$DISK_MONITOR_GUI_ADMIN_USER"
    ADMIN_PASSWORD="$DISK_MONITOR_GUI_ADMIN_PASSWORD"
  else
    read -rp "Usuário administrador inicial [admin]: " ADMIN_USER
    ADMIN_USER="${ADMIN_USER:-admin}"
    read -rsp "Senha do administrador inicial: " ADMIN_PASSWORD
    echo ""
  fi
  SESSION_SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"

  cat > "$INSTALL_DIR/.env" <<EOF
PORT=8091
SESSION_SECRET=$SESSION_SECRET
DASHBOARD_USER=$ADMIN_USER
DASHBOARD_PASSWORD=$ADMIN_PASSWORD
EOF
  echo ".env criado em $INSTALL_DIR/.env"
else
  echo ".env já existe em $INSTALL_DIR — mantendo como está."
fi

SERVICE_FILE="/etc/systemd/system/disk-monitor.service"
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=disk-monitor - monitor de disco e limpeza automatica (server-toolkit)
After=network.target docker.service

[Service]
User=root
Group=root
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
$EXEC_LINE
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now disk-monitor

echo ""
echo "=== Instalado! ==="
echo "Painel em: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo SEU_IP):8091"
echo "(lembre: nunca exponha essa porta direto na internet — use túnel SSH ou Nginx com allowlist)"
echo ""
echo "Ver logs:    journalctl -u disk-monitor -f"
echo "Ver status:  systemctl status disk-monitor"
