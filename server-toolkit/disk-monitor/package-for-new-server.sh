#!/bin/bash
# Gera os pacotes prontos pra levar pra um servidor novo — Linux e
# Windows — cada um com um executável único (sem precisar de Node.js
# instalado lá) + a pasta public/ + o .env de exemplo + os arquivos de
# instalação. Rode isso numa máquina com acesso à internet (o `pkg`
# baixa um Node.js pré-compilado na primeira vez) — pode ser aqui mesmo
# no VPS atual, ou no seu computador.

set -euo pipefail
cd "$(dirname "$0")"

DIST_DIR="../dist"
rm -rf "$DIST_DIR"

npm install
npm run build
# `npm run build` gera os binários em "$DIST_DIR/linux/disk-monitor-linux"
# e "$DIST_DIR/windows/disk-monitor.exe".

# --- pacote Linux ---
cp -r public "$DIST_DIR/linux/"
cp .env.example "$DIST_DIR/linux/.env.example"
cp -r installers/linux "$DIST_DIR/linux/installers"
cp disk-monitor-standalone.service "$DIST_DIR/linux/disk-monitor.service"

# --- pacote Windows ---
cp -r public "$DIST_DIR/windows/"
cp .env.example "$DIST_DIR/windows/.env.example"
cp -r installers/windows "$DIST_DIR/windows/installers"

echo ""
echo "Pacotes prontos em: $(cd "$DIST_DIR" && pwd)"
echo ""
echo "Linux   -> copie $DIST_DIR/linux/   pro servidor novo e rode:"
echo "           sudo ./installers/install.sh"
echo "Windows -> copie $DIST_DIR/windows/ pro servidor novo e rode (como"
echo "           Administrador): installers\\install.ps1"
echo "           (ou compile installers\\disk-monitor.iss com o Inno Setup"
echo "           pra gerar um instalador gráfico .exe — ver installers/windows/README.md)"
