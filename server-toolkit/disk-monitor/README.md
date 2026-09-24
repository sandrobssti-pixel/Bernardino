# disk-monitor — Disco & Limpeza automática

Módulo do `server-toolkit`: ferramenta **separada** do AtendeFlow (não faz
parte do app web nem do banco de dados dele) que roda em qualquer servidor
Linux (o VPS atual, ou um servidor novo de outro cliente) pra:

- Acompanhar o uso de disco do servidor ao longo do tempo (gráfico).
- Disparar limpeza automática quando o uso passar de um limite configurável.
- Permitir rodar a limpeza manualmente pelo painel, com um clique.
- Registrar o histórico de todas as limpezas (o que rodou, quanto liberou).

Painel web simples (gráfico + botões), protegido por usuário/senha.

Pensado pra reaproveitar em qualquer servidor novo que a Confiança
Technologies montar (mesmo modelo do VPS atual) — dá pra rodar direto do
código-fonte (como está instalado aqui) OU como um **executável único**,
sem precisar instalar Node.js no servidor novo.

## O que a limpeza faz (e o que ela NUNCA faz)

Faz:
- `docker system prune -af` — remove container parado, imagem não usada,
  rede órfã e cache de build.
- Trunca (zera o conteúdo, sem apagar o arquivo) log de container Docker
  que passar do tamanho configurado — o Docker continua escrevendo nele
  normalmente depois.
- Remove arquivo de `/tmp` mais velho que N dias.

**Nunca**:
- Não remove volume Docker (onde ficam o banco Postgres e os arquivos
  enviados pelo sistema — mídia de mensagens, etc.).
- Não mexe no backup do NAS (`/mnt/nas-backup`) — isso continua sendo
  gerido pelo `backup-atendeflow.sh` (retenção de 30 dias já configurada
  lá, na raiz do repositório).
- Não apaga nada de dentro do próprio AtendeFlow (banco, uploads).

## Instalação nesta máquina (a partir do código-fonte)

Use esse caminho no VPS atual, onde o repositório já está clonado.

```bash
cd ~/atendeflow/server-toolkit/disk-monitor
npm install
cp .env.example .env
nano .env   # troque DASHBOARD_USER e DASHBOARD_PASSWORD
```

Testar manualmente primeiro (sem systemd), pra confirmar que sobe:

```bash
node server.js
# abra http://SEU_IP:8091 (ou faça um túnel SSH, ver seção de segurança)
```

Se estiver tudo certo, `Ctrl+C` e instale como serviço (fica rodando
sempre, mesmo depois de reiniciar o servidor):

```bash
sudo cp disk-monitor.service /etc/systemd/system/disk-monitor.service
# ajuste o caminho em WorkingDirectory/EnvironmentFile/ExecStart no
# arquivo copiado se o seu diretório não for /root/atendeflow
sudo systemctl daemon-reload
sudo systemctl enable --now disk-monitor
sudo systemctl status disk-monitor
```

Ver os logs do serviço:

```bash
journalctl -u disk-monitor -f
```

## Instalação num servidor NOVO (só o executável, sem Node.js)

Pra levar essa ferramenta pra um servidor de outro cliente sem precisar
clonar o repositório inteiro nem instalar Node.js lá:

**1. Gere o pacote** (numa máquina com internet — pode ser aqui no VPS
atual, ou no seu computador; só precisa rodar uma vez por atualização):

```bash
cd ~/atendeflow/server-toolkit/disk-monitor
./package-for-new-server.sh
```

Isso cria `server-toolkit/dist/` com: o executável
`disk-monitor-linux` (Node.js já embutido, ~40-80MB), a pasta `public/`,
`.env.example` e o systemd unit pronto.

**2. Copie pro servidor novo:**

```bash
scp -r ../dist usuario@servidor-novo:/opt/disk-monitor
```

**3. No servidor novo:**

```bash
cd /opt/disk-monitor
chmod +x disk-monitor-linux
cp .env.example .env
nano .env   # troque DASHBOARD_USER e DASHBOARD_PASSWORD

sudo cp disk-monitor-standalone.service /etc/systemd/system/disk-monitor.service
sudo systemctl daemon-reload
sudo systemctl enable --now disk-monitor
sudo systemctl status disk-monitor
```

Pronto — o servidor novo já fica com o mesmo monitor de disco/limpeza do
VPS atual, sem precisar instalar Node.js nem clonar o repositório do
AtendeFlow nele.

## Segurança — IMPORTANTE

Esse painel roda `docker system prune` e mexe em arquivo do sistema.
**Nunca** deixe a porta 8091 aberta direto pra internet. Duas opções:

1. **Túnel SSH** (mais simples, recomendado): no seu computador,
   `ssh -L 8091:localhost:8091 usuario@seu-vps`, e acesse
   `http://localhost:8091` no seu navegador local.
2. **Nginx com autenticação/IP allowlist**, se quiser acesso direto de
   um IP fixo (escritório).

O usuário/senha do `.env` é uma segunda camada, não substitui isso.

## Configuração pelo painel

- **Limite pra limpeza automática (%)**: quando o uso de disco bater
  esse valor, a limpeza roda sozinha (padrão: 85%).
- **Intervalo de checagem**: de quanto em quanto tempo o disco é
  verificado (padrão: 15 minutos).
- **Truncar log do Docker maior que**: tamanho a partir do qual um log
  de container é zerado (padrão: 200MB).
- **Limpar /tmp com mais de**: idade mínima pra um arquivo de `/tmp` ser
  removido (padrão: 7 dias).
- **Limpeza automática habilitada**: liga/desliga o gatilho automático
  sem precisar reiniciar o serviço.

## Próximas etapas planejadas (fora do escopo desta primeira versão)

Combinado com o cliente que essa primeira versão foca só em
disco + limpeza automática do servidor. Ainda ficaram de fora, pra fases
seguintes do `server-toolkit`:

- Painel de configuração visual pros backups pra nuvem (Google Drive,
  Microsoft/OneDrive, Hostinger, etc.), reaproveitando as rotinas de
  backup já existentes (`backup-atendeflow.sh`, `backup-para-drive.sh`,
  `backup-seafile.sh`).
- "Otimização do sistema operacional" — item citado no pedido original,
  mas que precisa ser definido com mais detalhe (o que exatamente
  otimizar) antes de implementar, já que mexer em configuração de SO de
  um servidor em produção sem escopo claro é arriscado.
- Um script/checklist de provisionamento pra replicar o resto do modelo
  desta máquina num servidor novo (Docker, Coolify, montagem do NAS,
  crontab dos backups) — hoje esse conhecimento está documentado no
  `docs/MANUAL_TECNICO.md` do AtendeFlow, ainda não virou automação.
