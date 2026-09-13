#!/usr/bin/env bash
set -Eeuo pipefail

trap 'echo "[ERRO] Falha na linha $LINENO. Abortando."' ERR

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[ERRO] Comando obrigatorio nao encontrado: $1"
    exit 1
  fi
}

PROJECT_ROOT="$(pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

if [ ! -d "$PROJECT_ROOT" ] || [ ! -d "$BACKEND_DIR" ] || [ ! -d "$FRONTEND_DIR" ]; then
  echo "[ERRO] Estrutura invalida na pasta atual. Esperado:"
  echo "  $PROJECT_ROOT"
  echo "  $BACKEND_DIR"
  echo "  $FRONTEND_DIR"
  echo "Execute o script dentro da pasta da instancia."
  exit 1
fi

require_cmd npm
require_cmd npx
require_cmd pm2

if [ "${EUID:-$(id -u)}" -eq 0 ]; then
  SUDO=""
else
  require_cmd sudo
  SUDO="sudo"
fi

setup_swap() {
  local target_swap_bytes=$((6144 * 1024 * 1024))
  local swap_active=0
  local current_swap_bytes=0

  if swapon --show --noheadings --raw 2>/dev/null | awk '{print $1}' | grep -qx "/swapfile"; then
    swap_active=1
  fi

  if [ -f /swapfile ]; then
    if [ -n "$SUDO" ]; then
      current_swap_bytes=$($SUDO stat -c %s /swapfile)
    else
      current_swap_bytes=$(stat -c %s /swapfile)
    fi
  fi

  if [ "$current_swap_bytes" -eq "$target_swap_bytes" ]; then
    log "Swapfile com 6GB ja existe."
    if [ "$swap_active" -eq 0 ]; then
      log "Ativando /swapfile existente."
      $SUDO chmod 600 /swapfile
      $SUDO mkswap /swapfile
      $SUDO swapon /swapfile
    else
      log "Swap /swapfile ja esta ativa."
    fi
  else
    if [ "$current_swap_bytes" -gt 0 ]; then
      log "Swapfile existente com tamanho diferente de 6GB (${current_swap_bytes} bytes). Recriando."
    else
      log "Swapfile nao encontrado. Criando 6GB."
    fi

    if [ "$swap_active" -eq 1 ]; then
      $SUDO swapoff /swapfile
    fi

    $SUDO rm -f /swapfile
    $SUDO dd if=/dev/zero of=/swapfile bs=1M count=6144 status=progress
    $SUDO chmod 600 /swapfile
    $SUDO mkswap /swapfile
    $SUDO swapon /swapfile
  fi

  if ! grep -qE '^/swapfile[[:space:]]+none[[:space:]]+swap[[:space:]]+sw[[:space:]]+0[[:space:]]+0$' /etc/fstab; then
    log "Adicionando entrada de swap no /etc/fstab."
    if [ -n "$SUDO" ]; then
      echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
    else
      echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi
  else
    log "Entrada de /swapfile ja existe no /etc/fstab."
  fi
}

log "Iniciando atualizacao."
log "Raiz detectada: $PROJECT_ROOT"

log "Etapa backend: $BACKEND_DIR"
cd "$BACKEND_DIR"
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
npm run build

log "Etapa frontend: $FRONTEND_DIR"
cd "$FRONTEND_DIR"
rm -rf node_modules package-lock.json
npm cache clean --force
npm install --legacy-peer-deps
npm install -D ajv@^8.17.1 ajv-keywords@^5.1.0 --legacy-peer-deps

setup_swap

export NODE_OPTIONS="--max-old-space-size=4096"
export GENERATE_SOURCEMAP=false

npx craco build

pm2 restart all

log "Atualizacao finalizada com sucesso."
