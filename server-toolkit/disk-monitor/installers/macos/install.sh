#!/bin/bash
# Instalador por terminal do disk-monitor pra macOS.
#
# Funciona nos dois cenários, igual o instalador de Linux:
#   1. Rodado de dentro do checkout do repositório
#      (server-toolkit/disk-monitor/installers/macos/install.sh)
#      -> instala a partir do código-fonte, precisa de Node.js 18+.
#   2. Rodado de dentro do pacote gerado por package-for-new-server.sh
#      (que inclui esse mesmo script) -> instala o executável pronto,
#      SEM precisar de Node.js na máquina de destino.
#
# Uso: sudo ./install.sh [pasta de instalação, padrão /opt/disk-monitor]
#
# ATENÇÃO — HONESTIDADE: este script foi escrito e revisado com cuidado,
# mas nunca foi executado numa máquina macOS de verdade (esta sessão de
# desenvolvimento rodou inteira num container Linux, sem acesso a
# hardware Apple). Teste com atenção antes de confiar em produção, e
# reporte qualquer erro que aparecer.

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode como root (sudo ./install.sh) — precisa criar o serviço (launchd)." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Detecta arquitetura pra escolher o executável certo: Mac com chip Apple
# (M1/M2/M3...) usa arm64; Mac Intel usa x86_64. `uname -m` diz isso.
ARCH="$(uname -m)"
if [ "$ARCH" = "arm64" ]; then
  EXECUTABLE_NAME="disk-monitor-macos-arm64"
else
  EXECUTABLE_NAME="disk-monitor-macos-x64"
fi

# Mesma detecção de origem do install.sh de Linux — funciona rodando de
# dentro do checkout do repositório ou de um pacote gerado por
# package-for-new-server.sh.
SOURCE_DIR=""
CANDIDATE="$SCRIPT_DIR"
for _ in 1 2 3; do
  CANDIDATE="$(cd "$CANDIDATE/.." && pwd)"
  if [ -d "$CANDIDATE/public" ] && { [ -f "$CANDIDATE/$EXECUTABLE_NAME" ] || [ -f "$CANDIDATE/server.js" ]; }; then
    SOURCE_DIR="$CANDIDATE"
    break
  fi
done

if [ -z "$SOURCE_DIR" ]; then
  echo "Não achei os arquivos do disk-monitor perto deste script — rode a partir do pacote baixado/gerado, sem mover só o install.sh sozinho." >&2
  exit 1
fi

INSTALL_DIR="${1:-/opt/disk-monitor}"

echo "=== Instalador do disk-monitor (macOS, $ARCH) ==="
echo "Origem:  $SOURCE_DIR"
echo "Destino: $INSTALL_DIR"
echo ""

HAS_EXECUTABLE=0
if [ -f "$SOURCE_DIR/$EXECUTABLE_NAME" ]; then
  HAS_EXECUTABLE=1
fi

mkdir -p "$INSTALL_DIR"

if [ "$HAS_EXECUTABLE" -eq 1 ]; then
  echo "Executável encontrado ($EXECUTABLE_NAME) — instalando sem precisar de Node.js."
  cp "$SOURCE_DIR/$EXECUTABLE_NAME" "$INSTALL_DIR/disk-monitor-macos"
  chmod +x "$INSTALL_DIR/disk-monitor-macos"

  # O macOS exige assinatura de código pra rodar um executável — em Apple
  # Silicon (arm64) isso é obrigatório mesmo (o kernel mata o processo na
  # hora sem isso); em Intel o Gatekeeper também bloqueia por padrão.
  # Assinatura "ad-hoc" (sem certificado, gratuita, já vem no macOS)
  # resolve os dois casos — nunca precisa de conta de desenvolvedor Apple.
  echo "Assinando o executável (ad-hoc, sem custo — exigido pelo macOS)..."
  xattr -cr "$INSTALL_DIR/disk-monitor-macos" 2>/dev/null || true
  codesign --force --sign - "$INSTALL_DIR/disk-monitor-macos"

  cp -r "$SOURCE_DIR/public" "$INSTALL_DIR/"
  EXEC_PATH="$INSTALL_DIR/disk-monitor-macos"
else
  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js não encontrado. Instale o Node.js 18+ (ex.: https://nodejs.org ou 'brew install node') antes de continuar," >&2
    echo "ou use o executável pronto (server-toolkit/dist/macos/) em vez do código-fonte." >&2
    exit 1
  fi
  echo "Instalando a partir do código-fonte (Node.js $(node --version) encontrado)."
  cp -r "$SOURCE_DIR"/. "$INSTALL_DIR/"
  rm -rf "$INSTALL_DIR/node_modules" "$INSTALL_DIR/installers" "$INSTALL_DIR/package-lock.json"

  # Mesma correção do install.sh de Linux pro "file:../shared/auth" — sem
  # copiar server-toolkit/shared/ pro mesmo nível relativo, o npm install
  # falha depois que os arquivos saem de dentro do repositório.
  SHARED_SOURCE_DIR="$(cd "$SOURCE_DIR/../shared" && pwd)"
  SHARED_DEST_DIR="$(cd "$INSTALL_DIR/.." && pwd)/shared"
  mkdir -p "$SHARED_DEST_DIR"
  cp -r "$SHARED_SOURCE_DIR"/. "$SHARED_DEST_DIR/"

  (cd "$INSTALL_DIR" && npm install --omit=dev --no-audit --no-fund)
  EXEC_PATH="/usr/bin/env node $INSTALL_DIR/server.js"
fi

mkdir -p "$INSTALL_DIR/data"

if [ ! -f "$INSTALL_DIR/.env" ]; then
  echo ""
  echo "--- Configuração inicial ---"
  read -rp "Usuário administrador inicial [admin]: " ADMIN_USER
  ADMIN_USER="${ADMIN_USER:-admin}"
  read -rsp "Senha do administrador inicial: " ADMIN_PASSWORD
  echo ""
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

# macOS não usa systemd — o equivalente é launchd, configurado por um
# arquivo .plist. LaunchDaemon (não LaunchAgent) porque precisa rodar
# sempre, mesmo sem ninguém logado na tela.
PLIST_PATH="/Library/LaunchDaemons/com.confiancatechnologies.disk-monitor.plist"
LOG_DIR="/var/log/disk-monitor"
mkdir -p "$LOG_DIR"

if [ "$HAS_EXECUTABLE" -eq 1 ]; then
  PROGRAM_ARGS="    <string>$INSTALL_DIR/disk-monitor-macos</string>"
else
  PROGRAM_ARGS="    <string>$(command -v node)</string>
    <string>$INSTALL_DIR/server.js</string>"
fi

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.confiancatechnologies.disk-monitor</string>
  <key>ProgramArguments</key>
  <array>
$PROGRAM_ARGS
  </array>
  <key>WorkingDirectory</key>
  <string>$INSTALL_DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
$(grep -v '^#' "$INSTALL_DIR/.env" | grep '=' | sed -E 's/^([^=]+)=(.*)$/    <key>\1<\/key>\n    <string>\2<\/string>/')
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/disk-monitor.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/disk-monitor.error.log</string>
</dict>
</plist>
EOF

chown root:wheel "$PLIST_PATH"
chmod 644 "$PLIST_PATH"

# Descarrega uma versão anterior antes de carregar de novo (idempotente —
# não falha se ainda não existia).
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load -w "$PLIST_PATH"

echo ""
echo "=== Instalado! ==="
echo "Painel em: http://$(ipconfig getifaddr en0 2>/dev/null || echo SEU_IP):8091"
echo "(lembre: nunca exponha essa porta direto na internet — use túnel SSH ou um proxy com allowlist)"
echo ""
echo "Ver logs:    tail -f $LOG_DIR/disk-monitor.log"
echo "Ver status:  sudo launchctl list | grep disk-monitor"
echo "Reiniciar:   sudo launchctl unload $PLIST_PATH && sudo launchctl load -w $PLIST_PATH"
