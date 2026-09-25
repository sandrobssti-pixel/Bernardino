#!/bin/bash
# Atualiza uma instalação já existente do disk-monitor no Linux — um único
# comando, sem pedir usuário/senha de novo e sem mexer em data/.env.
#
# Diferença pro install.sh: aquele serve pra instalar do zero (cria
# serviço, pede admin inicial); este só troca o código de uma instalação
# que já está rodando. Se a pasta de instalação não existir ainda, ou não
# tiver um .env, use o install.sh em vez deste.
#
# Uso: sudo ./update.sh [pasta de instalação, padrão /opt/disk-monitor]

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode como root (sudo ./update.sh) — precisa reiniciar o serviço." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Mesma detecção de origem do install.sh — funciona rodando de dentro do
# checkout do repositório ou de um pacote gerado por package-for-new-server.sh.
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
  echo "Não achei os arquivos do disk-monitor perto deste script." >&2
  exit 1
fi

INSTALL_DIR="${1:-/opt/disk-monitor}"

if [ ! -f "$INSTALL_DIR/.env" ]; then
  echo "Não achei uma instalação em $INSTALL_DIR (sem .env)." >&2
  echo "Essa pasta ainda não foi instalada — use o install.sh, não o update.sh." >&2
  exit 1
fi

VERSION_FILE="$INSTALL_DIR/lib/version.js"
OLD_VERSION="$( [ -f "$VERSION_FILE" ] && grep -oP '(?<=version: ")[^"]+' "$VERSION_FILE" || echo "?" )"

echo "=== Atualizador do disk-monitor (Linux) ==="
echo "Origem:  $SOURCE_DIR"
echo "Destino: $INSTALL_DIR"
echo "Versão instalada agora: $OLD_VERSION"
echo ""

if [ -f "$SOURCE_DIR/disk-monitor-linux" ]; then
  echo "Executável encontrado — atualizando sem precisar de Node.js."
  cp "$SOURCE_DIR/disk-monitor-linux" "$INSTALL_DIR/"
  chmod +x "$INSTALL_DIR/disk-monitor-linux"
  rm -rf "$INSTALL_DIR/public"
  cp -r "$SOURCE_DIR/public" "$INSTALL_DIR/"
else
  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js não encontrado. Instale o Node.js 18+ antes de continuar." >&2
    exit 1
  fi
  echo "Atualizando a partir do código-fonte (Node.js $(node --version) encontrado)."
  # Copia tudo por cima, exceto o que é dado da instalação (nunca sobrescreve
  # config/usuários/segredo de sessão nem histórico já registrado).
  cp -r "$SOURCE_DIR"/. "$INSTALL_DIR/"
  rm -rf "$INSTALL_DIR/installers" "$INSTALL_DIR/package-lock.json"

  # Mesma correção do install.sh pro "file:../shared/auth" — o shared/
  # também precisa ficar atualizado como irmão do diretório de instalação.
  SHARED_SOURCE_DIR="$(cd "$SOURCE_DIR/../shared" && pwd)"
  SHARED_DEST_DIR="$(cd "$INSTALL_DIR/.." && pwd)/shared"
  mkdir -p "$SHARED_DEST_DIR"
  cp -r "$SHARED_SOURCE_DIR"/. "$SHARED_DEST_DIR/"

  echo "Reinstalando dependências..."
  (cd "$INSTALL_DIR" && npm install --omit=dev --no-audit --no-fund)
fi

echo ""
echo "Reiniciando o serviço..."
systemctl restart disk-monitor

sleep 1
NEW_VERSION="$( [ -f "$VERSION_FILE" ] && grep -oP '(?<=version: ")[^"]+' "$VERSION_FILE" || echo "?" )"

echo ""
echo "=== Atualizado: v$OLD_VERSION -> v$NEW_VERSION ==="
systemctl status disk-monitor --no-pager -l | head -n 8
