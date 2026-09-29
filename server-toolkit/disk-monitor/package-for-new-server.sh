#!/bin/bash
# Gera os pacotes prontos pra levar pra um servidor/computador novo —
# Linux, Windows e macOS — cada um com um executável único (sem precisar
# de Node.js instalado lá) + a pasta public/ + o .env de exemplo + os
# arquivos de instalação. Rode isso numa máquina com acesso à internet (o
# `pkg` baixa um Node.js pré-compilado na primeira vez) — pode ser aqui
# mesmo no VPS atual, ou no seu computador. Funciona rodando de um Linux
# só: o `pkg` cross-compila os três sistemas sem precisar de Windows nem
# de um Mac.

set -euo pipefail
cd "$(dirname "$0")"

DIST_DIR="../dist"
rm -rf "$DIST_DIR"

npm install
npm run build
# `npm run build` gera os binários em "$DIST_DIR/linux/disk-monitor-linux",
# "$DIST_DIR/windows/disk-monitor.exe" e
# "$DIST_DIR/macos/disk-monitor-macos-{x64,arm64}".

# --- pacote Linux ---
cp -r public "$DIST_DIR/linux/"
cp .env.example "$DIST_DIR/linux/.env.example"
cp -r installers/linux "$DIST_DIR/linux/installers"
cp disk-monitor-standalone.service "$DIST_DIR/linux/disk-monitor.service"

# --- pacote Windows ---
cp -r public "$DIST_DIR/windows/"
cp .env.example "$DIST_DIR/windows/.env.example"
cp -r installers/windows "$DIST_DIR/windows/installers"

# --- pacote macOS ---
cp -r public "$DIST_DIR/macos/"
cp .env.example "$DIST_DIR/macos/.env.example"
cp -r installers/macos "$DIST_DIR/macos/installers"

echo ""
echo "Pacotes prontos em: $(cd "$DIST_DIR" && pwd)"
echo ""
echo "Linux   -> copie $DIST_DIR/linux/   pro servidor novo e rode:"
echo "           sudo ./installers/install.sh"
echo "Windows -> copie $DIST_DIR/windows/ pro servidor novo e rode (como"
echo "           Administrador): installers\\install.ps1"
echo "           (ou compile installers\\disk-monitor.iss com o Inno Setup"
echo "           pra gerar um instalador gráfico .exe — ver installers/windows/README.md)"
echo "macOS   -> copie $DIST_DIR/macos/   pro Mac novo e rode:"
echo "           sudo ./installers/install.sh"
echo "           (detecta sozinho Intel/Apple Silicon e assina o executável"
echo "           automaticamente — ver installers/macos/README.md)"
