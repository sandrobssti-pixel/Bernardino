#!/bin/bash
# Atualiza uma instalação já existente do disk-monitor no macOS — um único
# comando, sem pedir usuário/senha de novo e sem mexer em data/.env.
#
# Diferença pro install.sh: aquele serve pra instalar do zero (cria o
# serviço launchd, pede admin inicial); este só troca o código de uma
# instalação que já está rodando.
#
# Uso: sudo ./update.sh [pasta de instalação, padrão /opt/disk-monitor]

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode como root (sudo ./update.sh) — precisa reiniciar o serviço (launchd)." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ARCH="$(uname -m)"
if [ "$ARCH" = "arm64" ]; then
  EXECUTABLE_NAME="disk-monitor-macos-arm64"
else
  EXECUTABLE_NAME="disk-monitor-macos-x64"
fi

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
  echo "Não achei os arquivos do disk-monitor perto deste script." >&2
  exit 1
fi

INSTALL_DIR="${1:-/opt/disk-monitor}"
PLIST_PATH="/Library/LaunchDaemons/com.confiancatechnologies.disk-monitor.plist"

if [ ! -f "$INSTALL_DIR/.env" ]; then
  echo "Não achei uma instalação em $INSTALL_DIR (sem .env)." >&2
  echo "Essa pasta ainda não foi instalada — use o install.sh, não o update.sh." >&2
  exit 1
fi

VERSION_FILE="$INSTALL_DIR/lib/version.js"
OLD_VERSION="$( [ -f "$VERSION_FILE" ] && grep -E -o '"[0-9]+\.[0-9]+\.[0-9]+"' "$VERSION_FILE" | tr -d '"' || echo "?" )"

echo "=== Atualizador do disk-monitor (macOS, $ARCH) ==="
echo "Origem:  $SOURCE_DIR"
echo "Destino: $INSTALL_DIR"
echo "Versão instalada agora: $OLD_VERSION"
echo ""

if [ -f "$SOURCE_DIR/$EXECUTABLE_NAME" ]; then
  echo "Executável encontrado — atualizando sem precisar de Node.js."
  cp "$SOURCE_DIR/$EXECUTABLE_NAME" "$INSTALL_DIR/disk-monitor-macos"
  chmod +x "$INSTALL_DIR/disk-monitor-macos"
  xattr -cr "$INSTALL_DIR/disk-monitor-macos" 2>/dev/null || true
  codesign --force --sign - "$INSTALL_DIR/disk-monitor-macos"
  rm -rf "$INSTALL_DIR/public"
  cp -r "$SOURCE_DIR/public" "$INSTALL_DIR/"
else
  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js não encontrado. Instale o Node.js 18+ antes de continuar." >&2
    exit 1
  fi
  echo "Atualizando a partir do código-fonte (Node.js $(node --version) encontrado)."
  cp -r "$SOURCE_DIR"/. "$INSTALL_DIR/"
  rm -rf "$INSTALL_DIR/installers" "$INSTALL_DIR/package-lock.json"

  SHARED_SOURCE_DIR="$(cd "$SOURCE_DIR/../shared" && pwd)"
  SHARED_DEST_DIR="$(cd "$INSTALL_DIR/.." && pwd)/shared"
  mkdir -p "$SHARED_DEST_DIR"
  cp -r "$SHARED_SOURCE_DIR"/. "$SHARED_DEST_DIR/"

  echo "Reinstalando dependências..."
  (cd "$INSTALL_DIR" && npm install --omit=dev --no-audit --no-fund)
fi

echo ""
echo "Reiniciando o serviço..."
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load -w "$PLIST_PATH"

sleep 1
NEW_VERSION="$( [ -f "$VERSION_FILE" ] && grep -E -o '"[0-9]+\.[0-9]+\.[0-9]+"' "$VERSION_FILE" | tr -d '"' || echo "?" )"

echo ""
echo "=== Atualizado: v$OLD_VERSION -> v$NEW_VERSION ==="
sudo launchctl list | grep disk-monitor || echo "(aviso: não achei o serviço rodando — confira os logs em /var/log/disk-monitor/)"
