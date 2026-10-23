---
name: vps-provisioning
description: Use sempre que for preparar um VPS/servidor NOVO do zero (sistema operacional limpo) pra deixá-lo pronto pra receber aplicações em produção — Docker, Coolify, disco(s) extra(s)/RAID1 se houver, Cloudflare Tunnel pro acesso público, e backup local pro NAS do cliente. É o roteiro genérico de implantação (infraestrutura), reaproveitável em qualquer cliente novo — não é sobre código deste repositório, é sobre deixar a máquina pronta antes de rodar o deploy de um app nela (ex.: ver a skill atendeflow-dev / seção 32 do MANUAL_TECNICO.md pra subir o AtendeFlow especificamente depois que o Coolify já estiver de pé).
---

# Provisionar um VPS/servidor novo do zero até "pronto pra produção"

Roteiro genérico de infraestrutura — vale pra qualquer cliente novo
(VPS na nuvem ou máquina física na rede dele). Os valores entre `<...>`
são o que muda a cada cliente; o resto é repetível. Cada etapa tem um
checkpoint de verificação antes de passar pra próxima — não pular
verificação achando que "deu certo" sem conferir.

Se o cliente já tiver algo pronto (ex.: Coolify já instalado, ou um RAID
já configurado), pular direto pra etapa correspondente em vez de refazer
do zero.

## 0. Pedido ambíguo → perguntar antes de agir

Mesma regra do `CLAUDE.md` da raiz. Em especial, conferir ANTES de
começar:
- É VPS na nuvem (Hostinger, etc.) ou máquina física na rede do cliente?
  Muda se existe IP público direto (então dá pra pensar em exposição
  direta) ou se depende de túnel (Cloudflare Tunnel é quase sempre a
  resposta certa pra máquina física atrás de NAT/roteador doméstico).
- Tem disco(s) extra(s) além do disco de sistema? Vai usar RAID1 (redundância)
  ou discos separados por função (sistema / dados / backup)?
- O cliente já tem NAS próprio pra backup, ou isso fica só na nuvem
  (Google Drive, S3, etc.)?
- Qual app vai rodar nessa máquina no final — isso decide que Dockerfiles/
  compose usar na etapa 5 (cada produto deste projeto tem sua própria
  skill de deploy: `atendeflow-dev` seção 6, `api-oficial-dev`).

## 1. Sistema operacional base

```bash
# Atualiza tudo primeiro, sempre
sudo apt update && sudo apt full-upgrade -y
sudo reboot   # se o kernel foi atualizado

# Pacotes essenciais
sudo apt install -y curl wget git ca-certificates gnupg lsb-release \
  rsync cifs-utils ufw
```

Confirma a versão (`lsb_release -a`) e que o fuso horário está certo
(`timedatectl` — importante: datas de agendamento de campanha/mensagem no
AtendeFlow dependem do `TZ` certo no container, mas o relógio do host
também importa pra log/cron bater com a hora real do cliente):

```bash
sudo timedatectl set-timezone America/Sao_Paulo   # ajustar pro fuso do cliente
```

## 2. Disco(s) — decidir o layout ANTES de instalar qualquer coisa pesada

Se o servidor só tem um disco: segue direto, sem RAID.

Se tem 2+ discos e o cliente quer redundância no disco de sistema
(RAID1): isso é arriscado de fazer DEPOIS que o sistema já está instalado
e rodando (reparticionar, copiar bit a bit, reconfigurar bootloader, com
reboot no meio). O `server-toolkit/disk-monitor` já tem uma ferramenta
pra isso (`lib/raidMirror.js`) que **gera o roteiro exato de comandos**
pra rodar manualmente (não executa sozinho de propósito, é risco alto
demais pra automatizar) — usar ela em vez de montar os comandos de RAID
na mão.

Se tem disco(s) extra(s) que não vão entrar no RAID (só armazenamento
separado pra dados/Docker): formatar e montar agora, com ponto de
montagem definitivo e entrada em `/etc/fstab` por UUID (nunca por nome
`/dev/sdX`, que pode mudar entre boots):

```bash
sudo mkfs.ext4 -L DADOS /dev/sdX1
sudo mkdir -p /srv/<nome-do-cliente>
sudo mount /dev/sdX1 /srv/<nome-do-cliente>
sudo blkid /dev/sdX1   # pega o UUID
echo "UUID=<uuid>  /srv/<nome-do-cliente>  ext4  defaults  0 2" | sudo tee -a /etc/fstab
```

**Checkpoint**: `df -h` mostra o disco novo montado no caminho certo, com
o tamanho esperado.

## 3. Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # relogar depois, pro grupo valer
sudo systemctl enable --now docker
```

Se o disco de sistema for pequeno e já existir um disco de dados
dedicado (etapa 2), já aproveitar pra apontar o Docker pra lá desde o
início, em vez de instalar em `/var/lib/docker` (no disco de sistema) e
ter que mover depois (ver skill `vps-disk-expansion` pra esse cenário de
correção posterior):

```bash
sudo systemctl stop docker
sudo mkdir -p /srv/<nome-do-cliente>/docker
echo '{"data-root": "/srv/<nome-do-cliente>/docker"}' | sudo tee /etc/docker/daemon.json
sudo systemctl start docker
```

**Checkpoint**: `docker run hello-world` funciona. `docker info | grep -i
"docker root"` mostra o caminho esperado.

## 4. Coolify

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

O instalador mostra a URL de acesso no final (geralmente
`http://<ip-do-servidor>:8000`). Entrar, criar o usuário admin, e:

1. Conferir/criar o **Postgres resource** que os apps vão usar (se o app
   não sobe o próprio banco — ver seção 32 do `docs/MANUAL_TECNICO.md`
   pra entender por quê o AtendeFlow faz assim). Anotar o host interno
   (algo como `<nome-do-servico>-postgres`, porta 5432) — isso vai virar
   `DB_HOST`/`DB_PORT` do app depois.
2. Conferir se o Postgres resource exige SSL internamente (campo
   "Postgres URL (internal)" terminando em `?sslmode=require`) — se sim,
   o app precisa suportar `DB_SSL=true` (ver seção 34 do manual pra
   contexto de um bug real que isso já causou).

**Checkpoint**: painel do Coolify acessível, Postgres resource com
status rodando.

## 5. Deploy do app (específico de cada produto)

Essa etapa muda conforme o que vai rodar na máquina — não genérico. Ver:
- AtendeFlow (backend/frontend): skill `atendeflow-dev`, e seção 32 do
  `docs/MANUAL_TECNICO.md` (`docker-compose.coolify.yml`, variáveis de
  ambiente, `.env.coolify.example`).
- API Oficial da Meta: skill `api-oficial-dev`.

**Checkpoint**: `docker compose ps` (dentro do recurso Docker Compose do
Coolify) mostra todos os serviços com status `Up`.

## 6. Cloudflare Tunnel — acesso público sem IP/porta exposta

Praticamente sempre a resposta certa (não depende de IP público nem
porta aberta no roteador/firewall do cliente — funciona igual numa VPS
cloud ou numa máquina física atrás de NAT doméstico). Passo a passo
completo, validado numa migração real, está na seção 33 do
`docs/MANUAL_TECNICO.md` — resumo:

1. Cloudflare → **Zero Trust > Networks > Tunnels > Create a tunnel**
   (tipo Cloudflared), nomear com `<nome-do-cliente>-<ambiente>`.
2. Copiar o **token** gerado → variável `CLOUDFLARE_TUNNEL_TOKEN` no
   Coolify (aba de variáveis do recurso).
3. Adicionar o serviço `cloudflared` no compose do app (ver exemplo na
   seção 33), apontando pros nomes de serviço internos
   (`http://backend:8080`, `http://frontend:3000`, etc. — nomes do
   próprio compose, resolvidos pela rede interna do Docker).
4. Na aba **Public Hostname** do túnel, mapear cada subdomínio público
   pro serviço interno correspondente.

**Checkpoint**: subdomínio público abre no navegador e carrega o app,
com certificado HTTPS válido (Cloudflare cuida disso sozinho).

**Cuidado em corte de produção** (trocar servidor antigo pelo novo sem
derrubar o cliente): usar subdomínio temporário pro novo servidor
primeiro (ex.: `app-novo.dominio.com`), validar com o cliente, e só
depois repontar o túnel do domínio definitivo — nunca testar direto no
domínio de produção.

## 7. Backup local pro NAS do cliente (se houver)

Se o cliente tiver um NAS próprio (Synology ou similar) na mesma rede,
seção 38 do `docs/MANUAL_TECNICO.md` tem o roteiro completo e os dois
problemas reais já resolvidos (nome de pasta com espaço quebrando
`mount.cifs`, e "Permission denied" por resíduo de permissão —
recriar a pasta do zero em vez de tentar corrigir em cima). Resumo:

```bash
sudo apt install -y cifs-utils
sudo mkdir -p /mnt/nas-backup
# /etc/samba/credentials-<cliente> (chmod 600): username=.../password=...
echo "//<ip-do-nas>/<pasta-compartilhada> /mnt/nas-backup cifs credentials=/etc/samba/credentials-<cliente>,uid=1000,gid=1000,iocharset=utf8,vers=3.0,_netdev 0 0" | sudo tee -a /etc/fstab
sudo mount -a
```

Depois, um script de backup (banco via `docker exec ... pg_dump`,
arquivos via volume Docker nomeado — nunca caminho físico direto, ver
skill `vps-disk-expansion` pra entender por quê isso importa) agendado
via cron. `backup-atendeflow.sh` na raiz deste repositório é o modelo
de referência pra copiar/adaptar pro app específico do cliente.

**Checkpoint**: rodar o script manualmente uma vez, conferir que o
arquivo apareceu em `/mnt/nas-backup` com tamanho não-zero. Só depois
agendar no cron.

## 8. Checklist final antes de entregar

- [ ] `df -h` em todos os discos — nenhum perto de 100%.
- [ ] `docker ps` — todos os containers esperados com status `Up`.
- [ ] App abre no domínio público definitivo, login funciona.
- [ ] Backup rodou manualmente pelo menos uma vez com sucesso, e está
      agendado no cron (`crontab -l`).
- [ ] Firewall (`ufw status`) com só as portas necessárias liberadas (SSH
      e o que mais for preciso — Cloudflare Tunnel não precisa de porta
      de entrada nenhuma).
- [ ] Senhas/segredos gerados novos pra esse cliente (nunca reaproveitar
      segredo de outro cliente/ambiente — `JWT_SECRET`,
      `REDIS_SECRET_KEY`, senha do admin, etc.).

## 9. Commit

Essa skill normalmente não gera commit neste repositório (é trabalho de
infraestrutura no servidor do cliente). Se virar necessário documentar
algo novo descoberto no processo (um problema real resolvido, um ajuste
de roteiro), atualizar o `docs/MANUAL_TECNICO.md` do produto
correspondente (nova seção numerada, nunca reaproveitar número) seguindo
as instruções de commit do `CLAUDE.md` da raiz.
