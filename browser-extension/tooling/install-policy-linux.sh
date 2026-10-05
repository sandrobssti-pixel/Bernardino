#!/bin/bash
# Configura a instalação forçada + atualização automática da extensão
# AtendeFlow numa máquina Linux (Chrome, Chromium e/ou Edge) — sem
# passar pela Chrome Web Store. Depois de rodado, o navegador instala a
# extensão sozinho na próxima vez que abrir, e rechecha o update.xml
# periodicamente pra pegar versões novas.
#
# Uso: sudo ./install-policy-linux.sh

set -euo pipefail

EXTENSION_ID="biabcelhpaaiahmnonffmpmdbpdaplgl"
UPDATE_URL="https://atendeflow.confiancatechnologies.com/extension/update.xml"

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode como root (sudo ./install-policy-linux.sh) — precisa escrever em /etc." >&2
  exit 1
fi

POLICY_JSON=$(cat <<EOF
{
  "ExtensionInstallForcelist": [
    "$EXTENSION_ID;$UPDATE_URL"
  ]
}
EOF
)

installed_any=0

# Google Chrome
if [ -d /etc/opt/chrome ] || command -v google-chrome >/dev/null 2>&1; then
  mkdir -p /etc/opt/chrome/policies/managed
  echo "$POLICY_JSON" > /etc/opt/chrome/policies/managed/atendeflow.json
  echo "Política aplicada pro Google Chrome (/etc/opt/chrome/policies/managed/atendeflow.json)"
  installed_any=1
fi

# Chromium (pacote da distro)
if command -v chromium >/dev/null 2>&1 || command -v chromium-browser >/dev/null 2>&1; then
  mkdir -p /etc/chromium/policies/managed
  echo "$POLICY_JSON" > /etc/chromium/policies/managed/atendeflow.json
  echo "Política aplicada pro Chromium (/etc/chromium/policies/managed/atendeflow.json)"
  installed_any=1
fi

# Microsoft Edge
if [ -d /etc/opt/microsoft/msedge ] || command -v microsoft-edge >/dev/null 2>&1; then
  mkdir -p /etc/opt/microsoft/msedge/policies/managed
  echo "$POLICY_JSON" > /etc/opt/microsoft/msedge/policies/managed/atendeflow.json
  echo "Política aplicada pro Microsoft Edge (/etc/opt/microsoft/msedge/policies/managed/atendeflow.json)"
  installed_any=1
fi

if [ "$installed_any" -eq 0 ]; then
  echo "Nenhum Chrome/Chromium/Edge detectado nesta máquina — nada foi configurado." >&2
  echo "Se o navegador estiver instalado só via snap/flatpak, as pastas de política" >&2
  echo "são diferentes e esse script não cobre isso ainda — avise se for o caso." >&2
  exit 1
fi

echo ""
echo "Pronto. Feche e abra o navegador de novo — a extensão AtendeFlow deve"
echo "aparecer instalada sozinha em alguns segundos (o Chrome consulta a"
echo "política e baixa a extensão automaticamente)."
