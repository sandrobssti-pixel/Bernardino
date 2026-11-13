# Servidor do Paraguai (principal) + servidor do Brasil (reserva) — roteiro

> **Status: roteiro, ainda não executado.** Foi escrito a partir do que já funciona no servidor do
> Brasil (Ubuntu, AtendeFlow, Seafile, Confianza, NAS Synology, monitor de backups). Cada etapa tem uma
> **verificação** — não passe para a próxima sem ela. Nada aqui foi testado no hardware do Paraguai.
> As skills `vps-provisioning`, `atendeflow-deploy`, `seafile-deploy`, `cloudflare-tunnel-deploy`,
> `nas-setup` e `vps-disk-expansion` detalham as partes de instalação das aplicações.

## 0. Decisões que precisam estar tomadas antes

| Decisão | Recomendação | Por quê |
|---|---|---|
| Interface gráfica | **Nenhuma** (Ubuntu Server) | Menos coisa para travar. O travamento do Brasil foi o driver de vídeo (nouveau + GT 730); sem GUI e sem placa de vídeo dedicada isso não existe. |
| Acesso | SSH com **chave** + **Tailscale** | Funciona de qualquer lugar, sem abrir porta no roteador. |
| Discos de dados | **RAID1** (mdadm) dos dois HDs, mais um SSD só para o sistema | Um disco falhar não derruba o serviço. RAID1 **não** é backup. |
| IP | Reserva de DHCP no roteador **e** rota sem desvios para o NAS (conferir `ttl=64`, ver §6) | No Brasil o IP do NAS mudou 4 vezes e uma rota estática errada atrasou tudo. |
| Energia | **Nobreak** (UPS) com desligamento automático (`nut`) | Queda de energia sem UPS corrompe banco e RAID. |
| Mesma versão | Mesma versão do Ubuntu, Docker e das imagens usadas no Brasil | O Brasil é o ensaio da restauração. |

## 1. Instalar o sistema (sem interface)

1. Ubuntu Server (mesma versão do Brasil), instalação mínima, **OpenSSH marcado**, usuário `sandro`.
2. Partição do sistema no SSD; **não** use LVM aninhado sem necessidade.
3. Depois do primeiro boot: `sudo apt update && sudo apt -y full-upgrade`, `sudo reboot`.

**Verificação:** `ssh sandro@IP-DO-PARAGUAI` entra por chave; `systemctl get-default` mostra `multi-user.target`
(não `graphical.target`).

## 2. Acesso remoto seguro (Tailscale + SSH)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh            # abre o link de login no navegador (conta da empresa)
```
Depois: no `/etc/ssh/sshd_config` use `PasswordAuthentication no` e `PermitRootLogin no`, e
`sudo systemctl restart ssh`. Firewall: `sudo ufw default deny incoming; sudo ufw allow in on tailscale0; sudo ufw allow 22/tcp from SUA_REDE_LOCAL; sudo ufw enable`.

**Verificação:** do Brasil, `ssh sandro@NOME-NO-TAILSCALE` funciona; da internet comum (sem VPN) a porta 22 **não** responde.
**Não** feche a sessão SSH atual antes de testar uma segunda, para não se trancar fora.

## 3. Discos: sistema, dados em RAID1, Docker e swap

Siga a skill `vps-disk-expansion` (o Docker em `/var/lib/docker` num disco próprio, como no Brasil).

```bash
sudo mdadm --create /dev/md1 --level=1 --raid-devices=2 /dev/sdX /dev/sdY      # CONFIRA os nomes antes! apaga os discos
cat /proc/mdstat                                                                # espere a sincronizacao terminar
sudo mkfs.ext4 /dev/md1 && sudo mkdir -p /srv/confianza
echo "UUID=$(sudo blkid -s UUID -o value /dev/md1) /srv/confianza ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab
sudo mdadm --detail --scan | sudo tee -a /etc/mdadm/mdadm.conf && sudo update-initramfs -u
```
Swap: **um** arquivo (`/srv/confianza/swapfile`, 8 GB, criado com `fallocate` + `mkswap`), sem restos de `/swap.img`
(no Brasil o `/swap.img` esparso dava erro no boot). **Verificação:** `swapon --show`, `cat /proc/mdstat` com `[UU]`,
`sudo reboot` e tudo remontado sozinho.

## 4. NAS do Paraguai e montagens

Repita o que foi feito no Brasil (skill `nas-setup`): NAS com **SHR** (2 discos), usuário `atendeflow-sync`, compartilhamentos
`atendeflow-backup`, `seafile-data`, `confianza-backup` e `confianzatechnologies-arquivos`, montados por `fstab` com
`x-systemd.automount`. **No DSM:** IP por reserva no roteador, **nenhuma rota estática** em Rede > Rota Estática,
depuração mensal e S.M.A.R.T. mensal (fora da janela dos backups). **Verificação:** `ping -c3 IP-DO-NAS` com `ttl=64`
e `ip neigh show IP-DO-NAS` mostrando o MAC do NAS (sem `PERMANENT`).

## 5. Aplicações

Na ordem das skills: `vps-provisioning` → `coolify-deploy` → `atendeflow-deploy` → `seafile-deploy` →
`cloudflare-tunnel-deploy`. Os backups do Brasil servem de ensaio: **restaure** o último backup do AtendeFlow e do
Seafile numa instalação limpa do Paraguai antes de apontar o domínio para lá.

> **Cuidado com o WhatsApp (Baileys):** uma sessão do WhatsApp só pode estar **ativa em um servidor por vez**.
> Subir o AtendeFlow restaurado no Paraguai com as sessões conectadas **derruba** as do Brasil (e o contrário).
> Antes da virada, desconecte as conexões no servidor antigo; na restauração de teste, **não** reconecte WhatsApp.

## 6. Backups, monitor e vigilância (a mesma proteção do Brasil)

Instale os mesmos scripts do repositório (`backup-atendeflow.sh` v2, `instalar-monitor-backups.sh`,
`instalar-backup-arquivos.sh`, `nas-verifica-backups.sh` no DSM, o watchdog e a regra `nouveau` só se houver placa de vídeo):
1. `sudo ./instalar-monitor-backups.sh` e preencher `/etc/confianza-alertas.conf` (WhatsApp, e-mail).
2. `~/scripts/backup-atendeflow.sh` e os de Seafile/Confianza com **retenção por quantidade**, nunca por idade.
3. No DSM, tarefa `Verificar backups` (07:00, e-mail só se anormal).
4. Limites do monitor (`MIN_*`) reavaliados para os **tamanhos do Paraguai** (alarme falso se alto demais).

**Verificação:** `sudo confianza-monitor-backups --teste` chega por WhatsApp e e-mail; `--dry` dá `codigo=0` depois do
primeiro backup noturno.

## 7. O Brasil como reserva (cópia entre os dois)

Objetivo: se o Paraguai cair, subir o AtendeFlow/Seafile no Brasil com dados de **no máximo 1 dia atrás**.

1. **Cópia dos backups:** todo dia, depois dos backups do Paraguai, um `rsync` por Tailscale dos arquivos novos do NAS do
   Paraguai para o NAS do Brasil (só leitura na origem, **sem `--delete`**):
   `rsync -rt --partial -e ssh sandro@PARAGUAI:/mnt/nas-backup/ /mnt/nas-reserva/atendeflow/`
   (e o equivalente para Seafile e Confianza). O monitor do Brasil confere idade e tamanho desses arquivos, como faz com os locais.
2. **Teste de restauração mensal** no Brasil (instalação à parte, **sem** reconectar WhatsApp): restaurar o banco e abrir o sistema.
   Backup que nunca foi restaurado não é backup.
3. **Virada (manual, não automática):** desligar o AtendeFlow do Paraguai (se ainda responder), restaurar o último backup no
   Brasil, apontar o túnel Cloudflare para o servidor do Brasil, reconectar as sessões do WhatsApp **uma vez**. Escreva e
   **ensaie** esse procedimento antes de precisar dele; o ensaio é o que mede o tempo real de recuperação.

Não há alta disponibilidade automática aqui (dois servidores ativos ao mesmo tempo): o banco e as sessões do WhatsApp não
permitem isso sem uma arquitetura bem maior. O que este roteiro entrega é **recuperação rápida e testada**.

## 8. Lista final de aceite (todos precisam estar OK)

- [ ] SSH por chave e Tailscale funcionando; porta 22 fechada para a internet
- [ ] `/proc/mdstat` com `[UU]`; reboot sem intervenção; swap ativo sem erro no `journalctl -b -p err`
- [ ] NAS com `ttl=64` e IP reservado; nenhuma rota estática no NAS; pool SHR em "Boas condições"
- [ ] Backups do AtendeFlow, Seafile e Confianza rodando sozinhos; monitor com `codigo=0`; teste de aviso recebido
- [ ] Um backup **restaurado** com sucesso numa instalação limpa
- [ ] Cópia diária Paraguai → Brasil conferida pelo monitor
- [ ] Procedimento de virada escrito e ensaiado uma vez
