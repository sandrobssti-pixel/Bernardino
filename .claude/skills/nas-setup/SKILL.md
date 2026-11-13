---
name: nas-setup
description: Use sempre que for integrar um NAS (Synology ou similar) novo na infraestrutura de um cliente — criar o usuário de serviço e pastas compartilhadas no NAS, montar via SMB no servidor com persistência correta (fstab), e opcionalmente ligar ao painel disk-monitor (navegador de pastas + API do Synology DSM pra discos/desligamento). Roteiro genérico, reaproveitável em qualquer cliente. Já inclui os problemas reais encontrados e corrigidos na primeira implantação (Confiança Technologies, v2.3.54/`docs/MANUAL_TECNICO.md` seção 38), pra não precisar redescobrir cada um de novo. Inclui também (nov/2026): espelhar o pool (JBOD não converte), reserva de DHCP, rota estática errada no NAS, erros de mount do compartilhamento novo e as rotinas mensais do DSM (depuração e S.M.A.R.T.).
---

# Integrar um NAS num servidor de cliente

Roteiro genérico — vale pra qualquer cliente com NAS próprio na rede
(testado contra um Synology DS223j). Os valores entre `<...>` mudam a
cada cliente. Três partes independentes, pode fazer só a 1 e 2 (backup
local básico) sem a 3 (painel):

1. Configurar o NAS (pastas + usuário de serviço).
2. Montar no servidor (SMB/fstab), com persistência de verdade.
3. (Opcional) Ligar ao painel `disk-monitor` — navegador de arquivos e/ou
   API do Synology DSM.

## 0. Pedido ambíguo → perguntar antes de agir

Mesma regra do `CLAUDE.md` da raiz. Em especial, confirmar ANTES de
começar:
- Pra que esse NAS vai servir: só backup (1 pasta), backup +
  armazenamento do Seafile (2+ pastas, ver skill `seafile-deploy`), ou
  também navegação/gestão pelo painel `disk-monitor` (precisa das
  variáveis `NAS_ROOTS`/`DSM_*`)?
- O NAS é Synology (DSM, suporta a integração de API deste projeto) ou
  outra marca/firmware (só o mount SMB/NFS genérico se aplica, sem a
  parte 3)?
- Protocolo disponível: SMB é o mais comum e testado aqui; NFS é uma
  alternativa se o modelo não suportar SMB bem (**conferir — alguns
  modelos Synology de entrada, como o DS223j usado na primeira
  implantação, não têm suporte a NFS**, então SMB acaba sendo a única
  opção viável nesses casos).

## 1. No NAS: usuário de serviço + pastas compartilhadas

Pelo DSM (interface web do Synology):

1. **Painel de Controle → Usuário → Criar** um usuário de serviço
   dedicado (ex.: `<cliente>-sync`) — **nunca usar a conta admin** pra
   isso.
2. **Painel de Controle → Pasta Compartilhada → Criar**, uma pasta por
   finalidade (ex.: `<cliente>-backup`, e `<cliente>-seafile` se for usar
   o Seafile também). Marcar a permissão de Leitura/Gravação do usuário
   de serviço **já na tela de criação**, não editar depois (ver problema
   2 abaixo).
3. Se quiser limitar espaço, usar cota por pasta compartilhada
   (Painel de Controle → Pasta Compartilhada → editar → Cota).

### Problema real 1: nome de pasta com espaço quebra o mount depois

Autocompletar do navegador pode inserir espaço no nome da pasta (ex.:
`seafile-data` virar `seafile-data Confianca`), e tentar corrigir
removendo só o espaço pode colar as palavras (`seafile-dataconfianca`).
Nome de compartilhamento com espaço (ou nome errado difícil de desfazer)
complica `mount.cifs`/`fstab`. **Nunca tentar corrigir o nome depois de
criado** — apagar a pasta (se ainda vazia) e recriar do zero com o nome
exato desejado, digitado com cuidado.

### Problema real 2: "Permission denied" mesmo com a permissão certa

Se o mount falhar com `mount error(13): Permission denied` mesmo com a
permissão de Leitura/Gravação do usuário de serviço visivelmente
marcada no DSM, testar direto com `smbclient` antes de desconfiar da
configuração do servidor:

```bash
smbclient //<ip-do-nas>/<pasta> -U <usuario-de-servico> -c 'ls'
```

Erro `NT_STATUS_ACCESS_DENIED` no "tree connect" (não num arquivo
específico) indica estado de permissão inconsistente no próprio
compartilhamento — geralmente resíduo de ter editado a pasta depois de
criada (ex.: tentativa de corrigir nome, problema 1). **Resolvido
apagando a pasta (vazia) e recriando do zero**, com a permissão já
marcada na tela de criação, em vez de tentar consertar em cima.

## 2. No servidor: montar via SMB com persistência de verdade

```bash
sudo apt install -y cifs-utils
sudo mkdir -p /mnt/<cliente>-nas-<finalidade>   # ex: /mnt/nas-backup

sudo mkdir -p /etc/samba
sudo tee /etc/samba/credentials-<cliente>-sync > /dev/null <<'EOF'
username=<usuario-de-servico>
password=<senha>
EOF
sudo chmod 600 /etc/samba/credentials-<cliente>-sync
```

`/etc/fstab` — **a parte que mais importa é o final da linha**:

```
//<ip-do-nas>/<pasta> /mnt/<cliente>-nas-<finalidade> cifs credentials=/etc/samba/credentials-<cliente>-sync,uid=1000,gid=1000,iocharset=utf8,vers=3.0,_netdev,nofail,x-systemd.automount,x-systemd.after=network-online.target 0 0
```

```bash
sudo mount -a
```

### Problema real 3: NAS desmonta silenciosamente num reboot, sem erro visível

Sem `_netdev,nofail,x-systemd.automount,x-systemd.after=network-online.target`
na linha do `fstab`, um reboot pode deixar o compartilhamento
**desmontado** — a pasta local (vazia) continua existindo no mesmo
lugar, então qualquer script que só confira `[ -d "$PASTA" ]` (existe
como diretório) "funciona" normalmente, gravando no **disco local da
própria máquina**, sem proteção real nenhuma e **sem nenhum erro no
log**. Essa é a causa mais perigosa de todas aqui, porque passa
despercebida por semanas até alguém precisar restaurar um backup que
nunca existiu de verdade.

Duas camadas de proteção, sempre as duas:
1. As opções de `fstab` acima (`_netdev,nofail,x-systemd.automount,...`)
   — remonta sozinho quando a rede sobe, sem travar o boot se o NAS
   estiver fora do ar.
2. Todo script que grava backup no NAS precisa checar
   `mountpoint -q "$PASTA"` (não `[ -d "$PASTA" ]`) **antes** de
   escrever qualquer coisa, e abortar com erro alto se não for um mount
   de verdade — ver `backup-atendeflow.sh`/`backup-seafile.sh` na raiz
   deste repositório como referência já corrigida.

**Checkpoint**: `df -h /mnt/<cliente>-nas-<finalidade>` mostra o
tamanho real do compartilhamento SMB (não o disco raiz da máquina por
baixo). Testar escrita: `touch /mnt/<...>/teste && rm
/mnt/<...>/teste`. Depois, **reiniciar o servidor de verdade** pelo
menos uma vez e reconferir o `df -h` — é o único jeito de pegar o
problema 3 antes dele acontecer em produção.

## 2.1 Rede estável: IP do NAS e rota

### Problema real 4: o IP do NAS mudou por DHCP (4 vezes na primeira implantação)
Backup falhando "do nada" costuma ser IP novo do NAS: o `fstab` aponta pro IP antigo. **Reservar o IP no
roteador** (DHCP estático por MAC) para o NAS **e** para o servidor, e conferir no DSM em **Painel de
controle > Rede > Interface de rede** que a LAN está em DHCP ou com IP manual igual ao reservado.
Sem acesso ao roteador, fixar o IP manualmente no DSM (máscara, gateway e DNS do roteador, marcando
"Configurar como gateway padrão").

### Problema real 5: rota estática do NAS mandando a própria rede local pelo roteador
Sintoma: `ping` ao NAS responde, mas com **`ttl=63`** (o normal na mesma rede é `64`), e o SMB/`ls` no
compartilhamento **trava** quando se tira qualquer remendo de rota no servidor. Causa vista: em **Painel de
controle > Rede > Rota Estática** havia `192.168.100.0/255.255.255.0 via <gateway>`, que força o tráfego local
pelo roteador. **Remover essa rota** (rede local nunca precisa dela). Teste de sanidade, no servidor:
```bash
sudo ip neigh del <ip-do-nas> dev <interface>      # tira entrada fixa/PERMANENT, se existir
ping -c5 <ip-do-nas>                                # esperado: ttl=64
ip neigh show <ip-do-nas>                           # esperado: o MAC REAL do NAS, sem PERMANENT
timeout 20 ls /mnt/<pasta-do-nas> | head -3         # responde sem travar
```
`ip neigh flush` **não** remove entrada `PERMANENT`; use `ip neigh del`. Remendos no servidor (entrada de
vizinho fixa via timer) só escondem o problema: ache a causa no NAS/roteador.

### Problema real 6: compartilhamento novo não monta (`mount error(2)`, `(13)`, `No such device`)
Monte à mão numa pasta de teste para ver o erro real, em vez de depender do automount:
```bash
sudo mkdir -p /mnt/teste && sudo mount -t cifs //<ip>/<pasta> /mnt/teste -o credentials=/etc/samba/credentials-<cliente>-sync,uid=1000,gid=1000,vers=3.0; sudo dmesg | tail -4
```
- `mount error(2) No such file or directory`: o compartilhamento **não existe** no NAS ou o nome não confere.
- `mount error(13) Permission denied`: o usuário de serviço está sem Leitura/Gravação nele (ver problema 2).
- `ls: ... No such device` no ponto de montagem: **automount travado** depois de uma falha; corrija a causa e
  `sudo systemctl restart 'mnt-<caminho>.automount'` (o `-` do caminho vira `\x2d`, ex.: `mnt-nas\x2dbackup.automount`).
- Pasta compartilhada **criptografada** não monta sozinha depois de um reboot: não marcar criptografia.
- O CIFS **não guarda links simbólicos**: `rsync -rt` pula (`skipping non-regular file`); exclua `.venv/`/`node_modules/`.

## 2.2 Discos protegidos e rotinas do DSM

### Problema real 7: pool em JBOD/Basic = sem proteção nenhuma
Conferir logo no início em **Armazenamento > Pool > Tipo de RAID**: "JBOD" ou "Basic" **não** protege contra
falha de disco. **JBOD não converte no lugar**: é preciso **remover o pool e recriar** como **SHR** (tolerância a
1 disco) ou RAID 1. Isso **apaga as pastas compartilhadas** (configurações do DSM, usuários e tarefas ficam).
Ordem segura, sempre com confirmação do usuário antes do passo destrutivo:
1. Copiar **tudo** para um disco externo e **conferir** (`rsync -rn --size-only --itemize-changes` sem diferença).
2. Remover o pool, recriar em SHR (os dois discos), recriar volume e as pastas compartilhadas com os **mesmos nomes**.
3. Restaurar com `rsync -rt` **só depois de confirmar `mountpoint -q` nas três montagens**: restaurar com o
   compartilhamento ausente grava no **disco local** do servidor (aconteceu; foi interrompido antes de encher).
4. Conferir de novo com `rsync -rn --size-only`, e **guardar o disco externo ~1 semana** até haver backups noturnos limpos.
RAID/SHR **não é backup**: protege de falha de um disco, não de apagar, estragar ou ransomware.

### Rotinas mensais do DSM (agendar sempre, fora da janela dos backups)
- **Depuração de dados** (Armazenamento > Agendar depuração dos dados): mensal, marcando "somente durante períodos
  específicos" e **pausando a madrugada** (célula branca na grade) para não colidir com os backups.
- **Teste S.M.A.R.T. ampliado**: se a tela do disco só oferece "Iniciar" (sem agendamento), criar uma tarefa em
  **Programador de tarefas** (usuário root, mensal, e-mail **só se anormal**, "continuar executando no mesmo dia"
  **desmarcado**) com, num DS223j: `for d in /dev/sata1 /dev/sata2; do echo "== $d"; smartctl -d sat -t long "$d"; done`.
  Confirmar o resultado em **HDD/SSD > Informações de integridade > S.M.A.R.T. > Histórico**. Se executar de novo
  com teste em andamento, sai `Previous test is not completed` (status "Interrompido (4)"): é só isso.
- Tarefa diária de verificação dos backups dentro do NAS, com e-mail do DSM (funciona com o servidor desligado):
  ver `nas-verifica-backups.sh` e a skill `vps-manutencao-backups`.

## 3. (Opcional) Ligar ao painel disk-monitor

Duas integrações independentes, em `server-toolkit/disk-monitor/.env`:

**Navegador de pastas do NAS no painel** (lista pastas montadas,
permite navegar/baixar arquivo):

```bash
NAS_ROOTS="<Rótulo>:/mnt/<cliente>-nas-<finalidade>,<Outro Rótulo>:/mnt/<outra-pasta>"
#NAS_MAX_UPLOAD_MB=2048   # padrão: 2GB
```

**API do Synology DSM** (mostra discos/saúde do NAS e permite
desligamento remoto, direto do painel — independente do `NAS_ROOTS`
acima):

```bash
DSM_HOST=<ip-do-nas>
DSM_PORT=5001
DSM_HTTPS=true
DSM_USER=<conta-administradora-dedicada>   # NUNCA a mesma conta de uso diário
DSM_PASSWORD=<senha>
#DSM_ALLOW_SELF_SIGNED=false   # só mudar se o NAS tiver certificado válido de verdade (DDNS+Let's Encrypt)
```

Se o DSM tiver verificação em duas etapas ativada nessa conta, a
primeira autenticação pede um código OTP — o painel salva um
`DSM_DEVICE_ID` depois do primeiro login bem-sucedido, pra não pedir de
novo nas próximas vezes (ver README do `disk-monitor`, seção do painel
do NAS).

**Checkpoint**: reiniciar o serviço do `disk-monitor`
(`sudo systemctl restart disk-monitor` ou equivalente) e conferir no
painel que a aba de NAS aparece, lista as pastas de `NAS_ROOTS` e (se
configurado) mostra os discos reais via API do DSM.

## 4. Depois disso

Com o NAS montado e testado, as skills `seafile-deploy` (armazenamento
tipo "Google Drive") e os scripts `backup-atendeflow.sh`/
`backup-seafile.sh` já sabem usar esses pontos de montagem como destino
— não precisa reconfigurar nada neles além de apontar o caminho certo.

## 5. Checklist final

- [ ] Pasta(s) criada(s) no NAS com nome exato (sem espaço/engano),
      permissão do usuário de serviço marcada na criação.
- [ ] `smbclient` testado manualmente, sem erro de permissão.
- [ ] Montado via `fstab` com `_netdev,nofail,x-systemd.automount,x-systemd.after=network-online.target`.
- [ ] Sobreviveu a um reboot de teste de verdade (`df -h` confirma depois).
- [ ] Qualquer script de backup que usa esse destino checa
      `mountpoint -q`, não só `[ -d ]`.
- [ ] Pool em **SHR/RAID 1** (não JBOD), os dois discos em "Boas condições".
- [ ] IP do NAS e do servidor **reservados** no roteador; `ping` ao NAS com `ttl=64`; **nenhuma** rota estática da rede local.
- [ ] Depuração mensal (com a madrugada pausada) e S.M.A.R.T. ampliado mensal agendados; um teste S.M.A.R.T. já passou.
- [ ] (Se aplicável) `NAS_ROOTS`/`DSM_*` configurados e painel
      `disk-monitor` mostrando o NAS corretamente.

## 6. Commit

Normalmente essa skill não gera commit (é trabalho no NAS/servidor do
cliente). Se descobrir um problema novo não listado aqui, documentar
como nova seção numerada no `docs/MANUAL_TECNICO.md` e atualizar esta
skill também, seguindo as instruções de commit do `CLAUDE.md` da raiz.
