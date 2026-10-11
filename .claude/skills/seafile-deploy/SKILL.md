---
name: seafile-deploy
description: Use sempre que for implantar o Seafile (solução própria tipo "Google Drive" pra arquivos das empresas, hospedada na infraestrutura do próprio cliente) num servidor novo ou existente. Roteiro genérico, reaproveitável em qualquer cliente — stack Docker isolado, disco dedicado, túnel Cloudflare, backup pro NAS. Já inclui os 4 problemas reais encontrados e corrigidos na primeira implantação (Confiança Technologies, v2.3.56/`docs/MANUAL_TECNICO.md` seção 40), pra não precisar redescobrir cada um de novo.
---

# Implantar o Seafile num servidor de cliente

Roteiro genérico — os arquivos de template (`docker-compose.seafile.yml`,
`.env.seafile.example`, `backup-seafile.sh`) **já existem na raiz deste
repositório**, prontos pra copiar/adaptar. Não recriar do zero: copiar
pro servidor do cliente e só trocar os valores entre `<...>`.

Pré-requisito: Docker já instalado (ver skill `vps-provisioning` se o
servidor ainda for novo).

## 0. Pedido ambíguo → perguntar antes de agir

Mesma regra do `CLAUDE.md` da raiz. Em especial, confirmar ANTES de
começar:
- Onde os dados do Seafile vão morar: **disco local dedicado**
  (recomendado — mais rápido/confiável, é o que a Confiança usa hoje) ou
  compartilhamento de rede (SMB/NFS do NAS do cliente — mais lento,
  evitar se houver alternativa). Ver "Decisão de arquitetura" abaixo.
- Se esse servidor já roda outro stack Docker Compose na mesma pasta
  (ex.: o AtendeFlow) — se sim, **nome de projeto Compose (`-p`) é
  obrigatório** em todo comando, nunca opcional (ver problema 2 abaixo).
- Se existe Cloudflare Tunnel já configurado nesse servidor (reaproveitar
  o mesmo túnel, só adicionar uma rota nova) ou precisa criar um túnel
  novo.
- Domínio/subdomínio público que o cliente quer usar.

## 1. Decisão de arquitetura (já tomada e validada — seguir por padrão)

- **Disco local dedicado**, não SMB/NFS do NAS — banco de dados e
  servidor de arquivos em disco local é mais rápido e confiável que
  acessar via rede a cada operação. O NAS entra só como **destino do
  backup** (padrão 3-2-1), nunca como armazenamento principal.
- **Stack isolado**: `docker-compose.seafile.yml` próprio, separado do
  compose de qualquer outro app no mesmo servidor, com nome de projeto
  Compose dedicado (`-p seafile`) e `container_name` prefixado com o
  nome do cliente (nunca nomes genéricos tipo `memcached`/`redis` — ver
  problema 2 abaixo e a mesma lição já documentada na skill
  `vps-disk-expansion`/seção 39 do manual, sobre colisão de nome em rede
  Docker compartilhada).

## 2. Preparar o disco

```bash
# Se a partição já existe mas só monta automático via ambiente gráfico
# (não sobrevive a reboot), ou se é um disco novo:
sudo mkdir -p /srv/<nome-do-cliente>-data
sudo blkid /dev/sdXN   # pega o UUID da partição a usar
echo "UUID=<uuid>  /srv/<nome-do-cliente>-data  ext4  defaults,noatime  0 2" | sudo tee -a /etc/fstab
sudo mount -a
sudo chown -R <usuario>:<usuario> /srv/<nome-do-cliente>-data
```

**Checkpoint**: `df -h /srv/<nome-do-cliente>-data` mostra o tamanho
esperado, montado de verdade (não a partição raiz por baixo).

## 3. Copiar e ajustar o stack

```bash
cd ~/<pasta-do-projeto-no-servidor>
cp docker-compose.seafile.yml .   # se ainda não estiver lá
cp .env.seafile.example .env.seafile
```

Editar `docker-compose.seafile.yml`:
- Trocar `confianza-` (prefixo dos `container_name`) pelo nome do
  cliente novo, em TODOS os serviços (`seafile-db`, `seafile-memcached`,
  `seafile`) — nunca deixar nome genérico.
- Trocar `/srv/seafile-data` pelo caminho montado na etapa 2.
- Conferir `TIME_ZONE` (fuso do cliente).

Editar `.env.seafile`, preenchendo **direto no arquivo no servidor,
nunca colando segredo no chat**:
- `SEAFILE_DB_ROOT_PASSWORD` — `openssl rand -base64 24`
- `SEAFILE_JWT_PRIVATE_KEY` — `openssl rand -base64 32` (**obrigatória**,
  ver problema 1 abaixo — sem ela o container nem sobe)
- `SEAFILE_ADMIN_EMAIL` / `SEAFILE_ADMIN_PASSWORD` — email/senha inicial
  do admin (ver problema 4 — pode precisar resetar depois mesmo assim)
- `SEAFILE_SERVER_HOSTNAME` — o domínio público definitivo (etapa 5)

```bash
docker compose -p seafile -f docker-compose.seafile.yml --env-file .env.seafile up -d
```

**Sempre usar `-p seafile`** (ou outro nome de projeto único por
cliente) em TODO comando Compose daqui pra frente (`up`, `down`, `ps`,
`logs`) — ver problema 2.

**Checkpoint**: `docker compose -p seafile ps` mostra os 3 serviços
`Up`. Se `confianza-seafile` reiniciar em loop, ver problemas 1 e 3
abaixo antes de qualquer outra investigação.

## 4. Problemas reais já resolvidos (conferir estes primeiro)

1. **`JWT_PRIVATE_KEY` ausente → container não sobe.** Erro no log:
   `Cannot find JWT_PRIVATE_KEY value from environment... .env file not
   found`. Corrigido preenchendo `SEAFILE_JWT_PRIVATE_KEY` no
   `.env.seafile` (etapa 3).

2. **`docker compose down` sem `-p` enxerga containers de OUTRO stack
   como "órfãos"** quando os dois composes ficam na mesma pasta (o nome
   da pasta vira nome de projeto padrão pros dois). Nunca rodar comando
   Compose do Seafile sem `-p seafile` explícito — mesmo que pareça
   redundante.

3. **Seahub ignora `MEMCACHED_HOST`/`MEMCACHED_PORT` — sempre resolve o
   hostname fixo `memcached`.** Sintoma: `pylibmc.ServerDown ... host:
   memcached:11211` no log (`/shared/seafile/logs/seahub.log`, dentro do
   container `seafile`) e erro 500 ao tentar logar. O
   `docker-compose.seafile.yml` deste repositório **já tem a correção**
   (alias de rede `memcached` no serviço `*-memcached`, dentro da rede
   interna isolada do stack) — só conferir que não foi removido ao
   adaptar o compose.

4. **Senha do admin inicial pode não funcionar no primeiro login.**
   Resetar direto pelo script oficial dentro do container (ajustar
   nome do container e versão do Seafile conforme a imagem usada):
   ```bash
   printf '<email-admin>\n<nova-senha>\n<nova-senha>\n' \
     | docker exec -i <container-seafile> /opt/seafile/seafile-server-<versão>/reset-admin.sh
   ```

## 5. Acesso público (Cloudflare Tunnel)

Reaproveitar o túnel já existente nesse servidor, se houver (mesma VPS,
mesma rede Docker externa — geralmente `coolify` ou equivalente). No
painel Cloudflare: **Zero Trust → Networks → Tunnels → `<túnel do
cliente>` → Public Hostname → Add a public hostname**:

| Campo | Valor |
|---|---|
| Subdomain | `<ex: arquivos>` |
| Domain | `<domínio do cliente>` |
| Type | `HTTP` |
| URL | `<container-name-do-seafile>:80` |

**Checkpoint**: `https://<subdominio>.<dominio>` abre a tela de login do
Seafile, com HTTPS válido (Cloudflare cuida sozinho).

## 6. Backup pro NAS do cliente

Copiar e adaptar `backup-seafile.sh` deste repositório (mesma lógica do
`backup-atendeflow.sh` — dump das 3 bases MySQL via `docker exec ...
mysqldump`, mais `tar` da pasta de dados excluindo `logs`, com retenção
de 30 dias):

```bash
cp backup-seafile.sh ~/scripts/
chmod +x ~/scripts/backup-seafile.sh
# editar: nome do container do banco, caminho do disco local, pasta de
# destino no NAS (ex: /mnt/<cliente>-nas-seafile)
```

**Pegadinha já batida duas vezes**: se o destino do backup for um
compartilhamento de rede (NAS via SMB/NFS), a entrada do `/etc/fstab`
**precisa** ter `_netdev,nofail,x-systemd.automount,x-systemd.after=network-online.target`
— sem isso, um reboot pode deixar o compartilhamento desmontado
silenciosamente, e a pasta local vazia continua existindo no lugar dele.
O script de backup também precisa checar `mountpoint -q "$BACKUP_DIR"`
(não só `[ -d "$BACKUP_DIR" ]`) antes de gravar qualquer coisa — senão
ele "funciona" gravando no disco local da própria VPS, sem proteção
real nenhuma e sem erro nenhum no log. `backup-seafile.sh` e
`backup-atendeflow.sh` deste repositório **já têm as duas correções**.

Agendar no cron:

```
30 3 * * * /home/<usuario>/scripts/backup-seafile.sh
```

**Checkpoint**: rodar o script manualmente uma vez, conferir que dump
(banco) e tar (arquivos) apareceram no destino com tamanho não-zero.

## 7. Checklist final

- [ ] `docker compose -p seafile ps` — 3 serviços `Up`.
- [ ] Login funciona no domínio público, com o admin resetado se
      necessário (problema 4).
- [ ] `docker compose -p seafile down` não lista containers de outro
      stack como órfão (confirma que o `-p` está sendo respeitado em
      todo lugar).
- [ ] Backup rodado manualmente com sucesso e agendado no cron.
- [ ] Segredos (`SEAFILE_DB_ROOT_PASSWORD`, `SEAFILE_JWT_PRIVATE_KEY`,
      senha do admin) gerados novos pra esse cliente — nunca
      reaproveitar segredo de outro cliente.

## 8. Commit

Normalmente essa skill não gera commit (é trabalho no servidor do
cliente). Se descobrir um problema novo não listado aqui, documentar
como nova seção numerada no `docs/MANUAL_TECNICO.md` e atualizar esta
skill também, seguindo as instruções de commit do `CLAUDE.md` da raiz.
