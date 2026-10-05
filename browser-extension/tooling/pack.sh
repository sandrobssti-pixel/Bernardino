#!/bin/bash
# Empacota a extensão Chrome/Edge (browser-extension/chrome/) num .crx
# assinado + gera o update.xml que o Chrome consulta periodicamente pra
# saber se tem versão nova — é isso que viabiliza atualização automática
# numa distribuição privada (fora da Chrome Web Store), via política
# ExtensionInstallForcelist.
#
# Uso: ./pack.sh
# (lê a versão direto de browser-extension/chrome/manifest.json — bump
# a versão lá antes de rodar de novo pra cada release)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$SCRIPT_DIR/../chrome"
KEY_FILE="$SCRIPT_DIR/signing-key.pem"
DIST_DIR="$SCRIPT_DIR/dist"

# Pra onde o .crx/update.xml vão ser publicados (frontend/public/extension/,
# servido pelo mesmo domínio público do AtendeFlow) — trocar aqui se um dia
# hospedar em outro lugar.
DOWNLOAD_BASE_URL="https://atendeflow.confiancatechnologies.com/extension"

mkdir -p "$DIST_DIR"

if [ ! -f "$KEY_FILE" ]; then
  echo "Nenhuma chave de assinatura encontrada — gerando uma nova em $KEY_FILE"
  echo ""
  echo "IMPORTANTE: faça backup desse arquivo (fora do git, nunca comitar) assim"
  echo "que ele for criado. Perdê-lo significa que a próxima atualização vai gerar"
  echo "um ID de extensão DIFERENTE, e o Chrome vai tratar como uma extensão nova —"
  echo "quebra a atualização automática em todas as máquinas já configuradas, cada"
  echo "uma precisaria reinstalar na mão."
  echo ""
  openssl genrsa -out "$KEY_FILE" 2048 2>/dev/null
  chmod 600 "$KEY_FILE"
fi

VERSION="$(node -e "console.log(require('$EXT_DIR/manifest.json').version)")"
ZIP_FILE="$DIST_DIR/atendeflow-$VERSION.zip"
CRX_FILE="$DIST_DIR/atendeflow.crx"

rm -f "$ZIP_FILE"
(cd "$EXT_DIR" && zip -r -X "$ZIP_FILE" . -x ".*" >/dev/null)

"$SCRIPT_DIR/node_modules/.bin/crx3-new" "$KEY_FILE" < "$ZIP_FILE" > "$CRX_FILE"
rm -f "$ZIP_FILE"

EXT_ID="$("$SCRIPT_DIR/node_modules/.bin/crx3-info" < "$CRX_FILE" | awk '/^id/ {print $2}')"

cat > "$DIST_DIR/update.xml" <<EOF
<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='$EXT_ID'>
    <updatecheck codebase='$DOWNLOAD_BASE_URL/atendeflow.crx' version='$VERSION' />
  </app>
</gupdate>
EOF

echo ""
echo "=== Pronto ==="
echo "ID da extensão: $EXT_ID"
echo "Versão empacotada: $VERSION"
echo "Arquivos gerados em: $DIST_DIR/ (atendeflow.crx, update.xml)"
echo ""
echo "Próximo passo: copia os dois pra frontend/public/extension/ e faz o deploy"
echo "do frontend (o arquivo de política abaixo já aponta pro ID certo — só muda"
echo "se a chave de assinatura mudar)."
echo ""
echo "Política ExtensionInstallForcelist (usada por install-policy-linux.sh):"
echo "  $EXT_ID;$DOWNLOAD_BASE_URL/update.xml"
