#!/bin/bash
# Gera o pacote pronto pra levar pra um servidor novo: um executável único
# (sem precisar de Node.js instalado lá) + a pasta public/ + o .env de
# exemplo + o systemd unit. Rode isso numa máquina com acesso à internet
# (o `pkg` baixa um Node.js pré-compilado na primeira vez) — pode ser
# aqui mesmo no VPS atual, ou no seu computador.

set -euo pipefail
cd "$(dirname "$0")"

DIST_DIR="../dist"
rm -rf "$DIST_DIR"

npm install
npm run build
# `npm run build` gera o binário direto em "$DIST_DIR/disk-monitor-linux"

cp -r public "$DIST_DIR/"
cp .env.example "$DIST_DIR/.env.example"
cp disk-monitor-standalone.service "$DIST_DIR/"

echo ""
echo "Pacote pronto em: $(cd "$DIST_DIR" && pwd)"
echo "Copie essa pasta inteira pro servidor novo (ex.: scp -r ../dist usuario@novo-servidor:/opt/disk-monitor)"
echo "e siga a seção 'Instalação num servidor NOVO' do README.md."
