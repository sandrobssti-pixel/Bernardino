#!/bin/bash
# Instalador gráfico (janelas) do disk-monitor pra Linux, usando zenity —
# mesma instalação do install.sh, só que perguntando tudo por caixas de
# diálogo em vez de digitar no terminal. Precisa rodar com privilégio de
# root (o script já pede a senha via zenity/sudo).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v zenity >/dev/null 2>&1; then
  echo "O pacote 'zenity' não está instalado. Instale com:" >&2
  echo "  Ubuntu/Debian: sudo apt install zenity" >&2
  echo "  Fedora:        sudo dnf install zenity" >&2
  echo "Ou use o instalador por terminal: sudo ./install.sh" >&2
  exit 1
fi

zenity --info --title="Disk Monitor — Confiança Technologies" \
  --text="Esse assistente instala o disk-monitor (monitor de disco e limpeza automática) nesta máquina.\n\nClique OK pra continuar." \
  --width=400 || exit 0

INSTALL_DIR=$(zenity --entry --title="Disk Monitor — Instalação" \
  --text="Pasta de instalação:" \
  --entry-text="/opt/disk-monitor" --width=400) || exit 0
[ -z "$INSTALL_DIR" ] && INSTALL_DIR="/opt/disk-monitor"

ADMIN_USER=$(zenity --entry --title="Disk Monitor — Administrador" \
  --text="Usuário administrador inicial do painel:" \
  --entry-text="admin" --width=400) || exit 0
[ -z "$ADMIN_USER" ] && ADMIN_USER="admin"

ADMIN_PASSWORD=$(zenity --password --title="Disk Monitor — Senha" \
  --text="Senha do administrador inicial:" --width=400) || exit 0

if [ -z "$ADMIN_PASSWORD" ]; then
  zenity --error --text="Senha não pode ficar em branco." --width=300
  exit 1
fi

zenity --question --title="Confirmar instalação" \
  --text="Instalar em: $INSTALL_DIR\nUsuário: $ADMIN_USER\n\nConfirma?" \
  --width=400 || exit 0

# Delega a instalação de verdade pro install.sh (que já sabe lidar com
# executável pronto x código-fonte) — passa usuário/senha por variável de
# ambiente pra ele não perguntar de novo no terminal.
(
  export DISK_MONITOR_GUI_ADMIN_USER="$ADMIN_USER"
  export DISK_MONITOR_GUI_ADMIN_PASSWORD="$ADMIN_PASSWORD"
  pkexec env \
    DISK_MONITOR_GUI_ADMIN_USER="$ADMIN_USER" \
    DISK_MONITOR_GUI_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    "$SCRIPT_DIR/install.sh" "$INSTALL_DIR"
) 2>&1 | zenity --progress --pulsate --auto-close --title="Instalando..." \
  --text="Instalando o disk-monitor, aguarde..." --width=400

if [ $? -eq 0 ]; then
  zenity --info --title="Pronto!" \
    --text="disk-monitor instalado e rodando.\n\nAcesse o painel em: http://localhost:8091\n(ou pelo IP desta máquina, se acessar de outro computador)" \
    --width=400
else
  zenity --error --title="Falha na instalação" \
    --text="Alguma coisa deu errado. Rode pelo terminal (sudo ./install.sh) pra ver a mensagem de erro completa." \
    --width=400
fi
