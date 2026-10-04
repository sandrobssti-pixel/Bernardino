#!/bin/bash
# Cria o atalho de "ícone no desktop" + entrada no menu de aplicativos
# pro modo aplicativo (Electron) do disk-monitor — chamado pelo
# install.sh e pelo update.sh, sempre com o INSTALL_DIR já pronto
# (dependências instaladas, electron-main.js no lugar). NUNCA falha o
# instalador/atualizador inteiro se algo aqui der errado (ex.: servidor
# sem ambiente gráfico, ou instalado direto como root sem sudo) — só
# avisa no terminal e segue, sem `exit` com código de erro.
#
# Uso: create-desktop-icon.sh <INSTALL_DIR>

INSTALL_DIR="$1"

# Descobre o usuário "de verdade" por trás do sudo — os arquivos de
# instalação rodam como root, mas o ícone precisa ir pro Desktop/menu de
# quem efetivamente vai usar a tela (SUDO_USER), não pro /root (que não
# tem sessão gráfica nenhuma).
REAL_USER="${SUDO_USER:-}"
if [ -z "$REAL_USER" ] || [ "$REAL_USER" = "root" ]; then
  echo "Sem usuário detectado por trás do sudo — pulando ícone no desktop (rode \"sudo ./install.sh\"/\"sudo ./update.sh\" a partir do seu usuário normal, não logado direto como root, pra isso funcionar)." >&2
  exit 0
fi

REAL_HOME="$(getent passwd "$REAL_USER" | cut -d: -f6)"
if [ -z "$REAL_HOME" ] || [ ! -d "$REAL_HOME" ]; then
  echo "Não encontrei a pasta pessoal de \"$REAL_USER\" — pulando ícone no desktop." >&2
  exit 0
fi

if [ ! -f "$INSTALL_DIR/electron-main.js" ] || [ ! -x "$INSTALL_DIR/node_modules/.bin/electron" ]; then
  echo "Modo desktop (Electron) não disponível nesta instalação (instalação via executável empacotado não inclui Electron ainda) — pulando ícone." >&2
  exit 0
fi

# node_modules inteiro foi criado por "npm install" rodado via sudo (dono
# root), mas quem executa o desktop-launcher.sh é o usuário comum, sem
# sudo (tem que ser assim — Electron precisa da sessão gráfica do
# usuário, não dá pra abrir janela como root). O pacote "electron" tem
# lógica própria de reinstalar seu binário (dist/) se perceber que está
# ausente/incompleto, e isso falha com "Permission denied" se dist/ não
# existir e o usuário comum não puder escrever dentro de node_modules/
# electron (dono root) — já aconteceu em produção. Dono certo evita o
# problema de novo, mesmo que o reinstall do pacote não seja acionado.
chown -R "$REAL_USER":"$REAL_USER" "$INSTALL_DIR/node_modules/electron" 2>/dev/null || true

# Remove ícone/launcher de uma instalação anterior antes de gerar os
# novos — nunca confia só no "sobrescrever por cima" (ex.: se o caminho
# do ícone ou o nome do arquivo mudar numa versão futura, o antigo
# ficaria largado, clicável, apontando pra um launcher desatualizado).
LAUNCHER="$INSTALL_DIR/desktop-launcher.sh"
rm -f "$LAUNCHER" 2>/dev/null || true
rm -f "$REAL_HOME/.local/share/applications/disk-monitor.desktop" 2>/dev/null || true
rm -f "$REAL_HOME/Desktop/disk-monitor.desktop" 2>/dev/null || true

cat > "$LAUNCHER" <<EOF
#!/bin/bash
# --no-sandbox: o sandbox do Chromium (setuid) exige que
# node_modules/electron/dist/chrome-sandbox seja dono root com modo
# 4755 — mas esse chown acima já trocou node_modules/electron inteiro
# pro usuário real (necessário pro resto do pacote, já que quem abre
# esse launcher nunca é root). Em vez de proteger só esse arquivo
# específico contra o chown -R (frágil — qualquer reinstalação futura
# do Electron via sudo recria o arquivo e perde a proteção de novo),
# desativa o sandbox: essa janela só carrega conteúdo nosso mesmo
# (http://localhost, nunca site/HTML de terceiros), então não há
# conteúdo não-confiável pro sandbox precisar isolar.
cd "$INSTALL_DIR" && exec ./node_modules/.bin/electron --no-sandbox electron-main.js
EOF
chmod +x "$LAUNCHER"
chown "$REAL_USER":"$REAL_USER" "$LAUNCHER"

ICON_PATH="$INSTALL_DIR/public/favicon.png"
DESKTOP_ENTRY="[Desktop Entry]
Type=Application
Name=disk-monitor
Comment=Monitor de disco e limpeza automática
Exec=$LAUNCHER
Icon=$ICON_PATH
Terminal=false
Categories=System;Utility;
"

APPS_DIR="$REAL_HOME/.local/share/applications"
DESKTOP_DIR="$REAL_HOME/Desktop"
mkdir -p "$APPS_DIR"

echo "$DESKTOP_ENTRY" > "$APPS_DIR/disk-monitor.desktop"
chmod +x "$APPS_DIR/disk-monitor.desktop"
chown "$REAL_USER":"$REAL_USER" "$APPS_DIR/disk-monitor.desktop"
echo "Atalho adicionado ao menu de aplicativos (\"disk-monitor\")."

if [ -d "$DESKTOP_DIR" ]; then
  echo "$DESKTOP_ENTRY" > "$DESKTOP_DIR/disk-monitor.desktop"
  chmod +x "$DESKTOP_DIR/disk-monitor.desktop"
  chown "$REAL_USER":"$REAL_USER" "$DESKTOP_DIR/disk-monitor.desktop"
  # GNOME/Nautilus marca atalhos novos como "não confiável" até o usuário
  # confirmar manualmente (ícone com ponto de interrogação, não clicável
  # até autorizar) — tenta marcar como confiável automaticamente via
  # `gio`; se não existir ou falhar, não é motivo pra parar nada, o
  # usuário só precisa clicar em "Permitir execução" uma vez na primeira
  # vez (comportamento padrão do GNOME, não um bug deste instalador).
  sudo -u "$REAL_USER" gio set "$DESKTOP_DIR/disk-monitor.desktop" "metadata::trusted" true 2>/dev/null || true
  echo "Ícone criado em $DESKTOP_DIR/disk-monitor.desktop"
else
  echo "Pasta $DESKTOP_DIR não existe — ícone ficou só no menu de aplicativos." >&2
fi
