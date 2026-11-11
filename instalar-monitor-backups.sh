#!/bin/bash
# Instala o monitor de backups no servidor (roda como root, uma vez; pode repetir sem problema).
#
#   sudo ./instalar-monitor-backups.sh
#
# O que faz:
#   - copia monitor-backups.sh para /usr/local/bin/confianza-monitor-backups
#   - cria /etc/confianza-alertas.conf (modelo, permissão 600) SE ainda não existir
#   - cria e ativa o serviço + timer do systemd (06:30 e 14:00, todos os dias)
# Não coloca nenhuma senha/token: eles vão no arquivo de configuração, que só o root lê.

set -eu

[ "$(id -u)" -eq 0 ] || { echo "Rode como root: sudo $0" >&2; exit 1; }

ORIGEM="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$ORIGEM/monitor-backups.sh"
[ -f "$SCRIPT" ] || { echo "Nao achei $SCRIPT" >&2; exit 1; }

install -m 755 "$SCRIPT" /usr/local/bin/confianza-monitor-backups
echo "Instalado: /usr/local/bin/confianza-monitor-backups"

CONF=/etc/confianza-alertas.conf
if [ ! -f "$CONF" ]; then
  cat > "$CONF" <<'EOF'
# Configuracao do monitor de backups (lido por /usr/local/bin/confianza-monitor-backups).
# Este arquivo guarda segredos: so o root deve ler (chmod 600).

# --- WhatsApp (pela API do AtendeFlow) -------------------------------------------------
# URL: <endereco do backend>/api/messages/send
# Token: o token da conexao de WhatsApp usada para enviar (Conexoes no AtendeFlow).
# Numeros: com DDI e DDD, so digitos, separados por espaco. Ex.: "5571999999999"
WHATSAPP_API_URL=""
WHATSAPP_TOKEN=""
WHATSAPP_NUMBERS=""
# 1 = nao cria contato/ticket no AtendeFlow (conexao Baileys). Use 0 se a conexao for da API Oficial.
WHATSAPP_NO_REGISTER=1

# --- E-mail (precisa do msmtp configurado em /etc/msmtprc; ver docs/monitoramento-backups.md) ---
EMAIL_TO=""
EMAIL_FROM=""

# --- Limites (os valores abaixo ja sao os padroes; descomente para mudar) ----------------
# MAX_AGE_HOURS=26
# MIN_ATENDEFLOW_DB_MB=50
# MIN_ATENDEFLOW_FILES_GB=10
# MIN_SEAFILE_DB_KB=500
# MIN_SEAFILE_FILES_GB=8
# MIN_FREE_GB=20
# CONTAINERS="confianza-seafile confianza-seafile-db atendeflow-backend-1"
# EXTRA_UNITS="nas-neigh-fix.timer"
# REPEAT_HOURS=24
EOF
  chmod 600 "$CONF"
  echo "Criado modelo: $CONF  (PREENCHA antes de usar)"
else
  echo "Mantido: $CONF (ja existia)"
fi

cat > /etc/systemd/system/confianza-monitor-backups.service <<'EOF'
[Unit]
Description=Confianza - verifica os backups e avisa por WhatsApp/e-mail
After=network-online.target remote-fs.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/confianza-monitor-backups
# Codigo 1 = achou problema (e avisou). Nao tratar como falha do proprio servico.
SuccessExitStatus=1
EOF

cat > /etc/systemd/system/confianza-monitor-backups.timer <<'EOF'
[Unit]
Description=Roda o monitor de backups do Confianza 2x por dia

[Timer]
OnCalendar=*-*-* 06:30:00
OnCalendar=*-*-* 14:00:00
Persistent=true
RandomizedDelaySec=120

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now confianza-monitor-backups.timer
echo
systemctl list-timers confianza-monitor-backups.timer --no-pager || true
cat <<'EOF'

Proximos passos:
  1. Edite /etc/confianza-alertas.conf (WhatsApp e e-mail).
  2. Teste os canais:        sudo confianza-monitor-backups --teste
  3. Veja o que ele acharia: sudo confianza-monitor-backups --dry
EOF
