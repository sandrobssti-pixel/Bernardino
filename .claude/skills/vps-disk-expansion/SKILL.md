---
name: vps-disk-expansion
description: Use sempre que um servidor/VPS de cliente estiver com o disco do sistema cheio (ou perto disso) e existirem outros HDs/discos na máquina com espaço sobrando — diagnosticar o que está ocupando espaço, e mover com segurança o que for grande (tipicamente o Docker, `/var/lib/docker` + `/var/lib/containerd`) pra um disco separado. Cobre também como reconhecer um RAID1 já existente (`/proc/mdstat`, `md0`) sem mexer nele. Roteiro validado numa migração real (servidor da Confiança Technologies, outubro/2026) — segue exatamente os passos que funcionaram, pra não precisar redescobrir a sequência seção por seção a cada cliente novo.
---

# Expandir disco de um VPS/servidor de cliente movendo dados pra outro HD

Isso é sobre **infraestrutura do servidor do cliente** (Linux, geralmente
Ubuntu + Docker + Coolify), não sobre o código de nenhum módulo deste
repositório. Serve pra qualquer máquina de cliente com o mesmo sintoma:
disco do sistema cheio (ou perto de 100%), com containers/serviços em
produção rodando nela, e outro(s) disco(s) físico(s) com espaço livre.

**Contexto real que validou este roteiro**: VPS com disco de sistema em
RAID1 (`md0`, 116GB) a 100% de uso, travando risco real de corromper um
banco Postgres em produção. Tinha mais 2 discos de 447GB cada, um já em
uso parcial, outro com duas partições `ext4` já formatadas mas vazias
(`lost+found` só). Mover `/var/lib/docker` (20GB) + `/var/lib/containerd`
(18GB) pra lá resolveu, sem precisar reconfigurar nada (Cloudflare Tunnel,
rede Docker, Postgres externo, Seafile) — porque tudo isso referencia
container/volume por **nome**, não por caminho físico de disco.

## 0. Pedido ambíguo → perguntar antes de agir

Mesma regra do `CLAUDE.md` da raiz. Em especial, **sempre perguntar**:
- O que exatamente deve sair do disco de sistema (o cliente pode ter uma
  ideia vaga tipo "deixa só o sistema no HD1" sem saber o que está
  ocupando espaço de verdade — conferir com `du` antes de supor).
- Se pode haver indisponibilidade breve dos containers durante a troca
  (normalmente sim, mas confirmar — pode ter horário de menor uso
  preferido).
- Se há transferências/processos em paralelo rodando que o cliente queira
  proteger antes de mexer (raramente afeta, mas vale perguntar).

## 1. Diagnóstico — nunca mover nada antes de medir

```bash
df -h /
sudo du -h --max-depth=1 /var 2>/dev/null | sort -rh | head -15
sudo du -h --max-depth=1 /var/lib 2>/dev/null | sort -rh | head -15
sudo du -h --max-depth=1 /home/<usuario> 2>/dev/null | sort -rh | head -15
docker info 2>/dev/null | grep -i "docker root"
```

`/var/lib/docker` é o maior suspeito quase sempre, mas confirmar com
`du` de verdade — já aconteceu de uma leitura isolada de
`du -sh /var/lib/docker` sair errada (ex.: engasgo de permissão no meio
do `sudo`) e o `/var/lib` completo bater muito mais alto, revelando o
real tamanho só na segunda tentativa. **Não confiar numa única leitura
suspeita — reconferir.**

Também vale uma limpeza segura e imediata antes de qualquer coisa mais
arriscada: cache de usuário (`~/.cache`, `~/.npm`), sobras de exportações/
migrações antigas já superadas — zero risco, já que são regeneráveis ou
descartáveis.

## 2. Mapear os discos disponíveis

```bash
lsblk
df -h
mount | grep -v "^overlay\|^proc\|^tmpfs\|^sys\|^cgroup\|^dev"
```

- Se existir um dispositivo `md0` (ou `md*`) com dois discos físicos
  embaixo dele (ex.: `sda2` + `sdb2`), **isso é RAID1 do sistema** — não
  mexer nele, só reconhecer que é ele que está cheio.
- Procurar discos/partições SEM ponto de montagem — candidatos pra
  receber os dados.

## 3. NUNCA formatar sem antes confirmar que está vazio

```bash
sudo lsblk -f /dev/sdX
sudo blkid /dev/sdX1 /dev/sdX2
```

Se já aparecer `FSTYPE` preenchido (ex.: `ext4`), a partição **já foi
formatada antes** — pode já ter dado real dentro, mesmo sem estar
montada agora. Nunca rodar `mkfs` direto. Montar como **somente leitura**
primeiro e olhar o conteúdo:

```bash
sudo mkdir -p /mnt/check
sudo mount -o ro /dev/sdX1 /mnt/check
ls -la /mnt/check
du -sh /mnt/check
sudo umount /mnt/check
```

Só uma pasta `lost+found` vazia (do `mkfs` original) = seguro usar. Só
formatar (`mkfs.ext4`) se não existir filesystem nenhum (`blkid` sem
`FSTYPE`).

## 4. Mover o Docker com segurança (o caso mais comum)

Procedimento validado, nesta ordem exata:

```bash
# 1. Monta os discos novos num local temporário
sudo mkdir -p /mnt/new-docker /mnt/new-containerd
sudo mount /dev/sdX1 /mnt/new-docker
sudo mount /dev/sdY1 /mnt/new-containerd

# 2. PARA o Docker (indisponibilidade dos containers começa aqui)
sudo systemctl stop docker docker.socket containerd

# 3. Copia preservando TUDO (permissões, links, xattrs) — rsync, não cp
#    -z (compressão) só atrapalha aqui, dados já binários/mistos
sudo rsync -axHAX --info=progress2 /var/lib/docker/ /mnt/new-docker/
sudo rsync -axHAX --info=progress2 /var/lib/containerd/ /mnt/new-containerd/

# 4. Troca os diretórios — guarda o antigo como .old, NÃO apaga ainda
sudo umount /mnt/new-docker /mnt/new-containerd
sudo mv /var/lib/docker /var/lib/docker.old
sudo mv /var/lib/containerd /var/lib/containerd.old
sudo mkdir /var/lib/docker /var/lib/containerd
sudo mount /dev/sdX1 /var/lib/docker
sudo mount /dev/sdY1 /var/lib/containerd

# 5. Persiste no fstab por UUID (nunca /dev/sdX — nome pode mudar)
sudo blkid /dev/sdX1 /dev/sdY1   # pega os UUIDs
echo "UUID=<uuid-sdX1>  /var/lib/docker      ext4  defaults  0 2" | sudo tee -a /etc/fstab
echo "UUID=<uuid-sdY1>  /var/lib/containerd  ext4  defaults  0 2" | sudo tee -a /etc/fstab

# 6. Sobe de volta
sudo systemctl start containerd
sudo systemctl start docker
```

## 5. Verificar ANTES de apagar o backup antigo

```bash
docker ps
cd ~/<pasta-do-projeto> && docker compose ps
df -h /
```

Todo container precisa voltar com status `Up` (ou `Up` + `health:
starting`, que assenta sozinho em segundos). Depois, testar a aplicação
de verdade no navegador (login, funcionalidade principal) — não só
`docker ps`. **Só depois dessa confirmação explícita do cliente**, apagar
o backup:

```bash
sudo rm -rf /var/lib/docker.old /var/lib/containerd.old
df -h /
```

## 6. Por que isso não quebra nada externo

Tudo que depende do Docker referencia **nome** (de container, de volume,
de rede), nunca caminho físico de disco:
- Túnel Cloudflare: token de ambiente, não liga pra onde o Docker guarda
  arquivo.
- Rede Docker externa (ex.: `coolify`, usada por outros serviços
  acessarem Postgres): definição vive dentro do `/var/lib/docker`
  copiado — some junto se recriar do zero, sobrevive se **copiar**
  (passo 4.3 acima).
- Volumes nomeados (`docker run -v nome_do_volume:/caminho`, ou
  `volumes:` no compose): resolvidos pelo Docker internamente, mesmo
  comportamento antes/depois da troca de disco.
- Qualquer script de backup que grave dado puxando de dentro de um
  container (`docker exec ... pg_dump`) ou de um volume nomeado
  (`docker run -v nome_do_volume:/data ...`) **continua funcionando sem
  nenhuma mudança** — só pararia de cobrir algo se esse algo vivesse
  solto no disco (fora de volume/container), nunca foi este o caso do
  Docker em si.

Vale avisar o cliente, mas sem precisar reconfigurar nada na prática.

## 7. Pegadinhas já batidas nesta migração

- **Confundir qual terminal/máquina está ativo** é o erro mais comum
  quando o cliente tem duas sessões SSH abertas (origem e destino, ou
  duas VPS diferentes) — sempre conferir o prompt (`usuario@host:~#`)
  antes de interpretar o resultado de um comando. Se o comando retornar
  "No such file/directory" ou "permission denied" de forma inesperada,
  a explicação mais provável é terminal errado, não bug.
- **Transferência de arquivo grande entre dois servidores lenta**: testar
  **sem** `-z` no `rsync` primeiro se os arquivos já forem binários
  comprimidos por natureza (jpg, mp4, pdf, ogg, mp3) — a compressão do
  rsync nesse caso só consome CPU à toa e pode ser o gargalo real, não a
  rede. Se mesmo assim a velocidade for baixa e consistente nos dois
  sentidos, rodar um teste de velocidade genérico
  (`curl -o /dev/null -s -w '%{speed_download} bytes/s\n' <url-de-teste>`)
  nos dois lados pra saber se é limite real do link/plano antes de tentar
  otimizar o que não é o problema.
- Rede interna/privada entre duas VPS só existe se ambas estiverem no
  mesmo provedor/datacenter com peering configurado — conferir com
  `ip -4 addr show` nas duas pontas procurando por faixa privada (`10.x`,
  `172.16-31.x`, `192.168.x`) presente nas duas, antes de supor que dá
  pra usar.

## 8. Commit

Normalmente essa skill não gera commit nenhum neste repositório (é
trabalho de infraestrutura no servidor do cliente, não código). Se
alguma automação/documentação for criada como consequência (ex.: um
script novo salvo no repositório), seguir as instruções de commit do
`CLAUDE.md` da raiz.
