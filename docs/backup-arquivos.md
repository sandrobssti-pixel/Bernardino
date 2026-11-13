# Backup dos arquivos de trabalho (`~/Sandro`, `outputs`) para o NAS

Motivo: `~/Sandro` (19 GB: projetos, código-fonte, material de clientes) e as pastas `outputs`
(plano de segurança do Cactus, backup do site/CRM da Confiança) só existiam **no disco do servidor**.
Os backups que já existem (AtendeFlow, Seafile, Confianza) **não cobrem** essas pastas.

`backup-arquivos.sh` copia essas pastas para um compartilhamento próprio do NAS (que é espelhado),
todo dia às 04:30. **Nunca apaga nada no destino**: um arquivo apagado por engano na origem continua
na cópia. (Custo: o destino só cresce; limpe à mão quando quiser.)

## 1. Criar o compartilhamento no NAS (DSM)

**Painel de controle > Pasta compartilhada > Criar**
1. Nome: `sandro-arquivos` · Descrição: backup dos arquivos de trabalho.
2. **Desmarque** "Habilitar lixeira" (como nas outras pastas de backup).
3. **Habilitar soma de verificação de dados** para Btrfs: marcado. **Cota**: opcional, por exemplo 200 GB.
4. Permissões: dê **Leitura/Gravação** ao usuário `atendeflow-sync` (o mesmo das outras pastas).
5. Clique em Concluir.

## 2. Montar no servidor

Copie a linha que já existe para uma das outras pastas e troque o nome do compartilhamento e o ponto de montagem:

```bash
grep nas-confianza /etc/fstab
```
Exemplo do resultado (os valores de `uid`, `gid` e opções devem ser **os da sua linha**, não estes):
```
//192.168.100.77/confianza-backup /mnt/nas-confianza cifs credentials=/etc/samba/credentials-atendeflow-sync,vers=3.0,...,x-systemd.automount ... 0 0
```
Crie a pasta e a linha nova (mesmas opções, só mudando o compartilhamento e o destino):
```bash
sudo mkdir -p /mnt/nas-arquivos
sudo cp /etc/fstab /etc/fstab.bak-$(date +%F)
sudo nano /etc/fstab        # acrescente a linha copiada, com //192.168.100.77/sandro-arquivos /mnt/nas-arquivos
sudo systemctl daemon-reload
sudo systemctl start 'mnt-nas\x2darquivos.automount'
ls /mnt/nas-arquivos && df -h /mnt/nas-arquivos && touch /mnt/nas-arquivos/teste && rm /mnt/nas-arquivos/teste
```
Se `mountpoint -q /mnt/nas-arquivos` não retornar sucesso, **não siga**: o script se recusa a rodar fora do NAS.

## 3. Instalar e fazer a primeira cópia

```bash
cd /srv/confianza/Bernardino-ops          # ou ~/Bernardino
git fetch origin claude/dazzling-franklin-j7aqci && git checkout --detach origin/claude/dazzling-franklin-j7aqci
sudo ./instalar-backup-arquivos.sh
sudo systemctl start --no-block confianza-backup-arquivos.service
tail -f ~/backup-arquivos.log             # termina com "Backup de arquivos concluído"
```
A primeira vez copia ~20 GB (cerca de 6 a 15 minutos pela rede). Depois só vai o que mudou.

Pastas copiadas (padrão) e onde caem no NAS:

| Origem | Destino em `/mnt/nas-arquivos/` |
|---|---|
| `~/Sandro` | `Sandro/` |
| `~/2026-10-12/c/outputs` | `cactus-outputs/` |
| `~/2026-10-21/referenced-chatgpt-conversation-this-is-an/outputs` | `site-crm-outputs/` |

Excluídos (recriáveis): `node_modules/`, `.cache/`, `__pycache__/`, `.wrangler/`.
Para mudar a lista, crie `/etc/confianza-arquivos.conf`:
```bash
FONTES=( "$HOME/Sandro:Sandro" "$HOME/Projetos:Projetos" )    # "origem:pasta-no-destino"
```

## 4. Conferir e ligar o aviso

```bash
# a copia bate com a origem? (nao deve listar nada alem de arquivos excluidos)
rsync -rn --size-only --itemize-changes --exclude=node_modules/ --exclude=.cache/ ~/Sandro/ /mnt/nas-arquivos/Sandro/ | head

# avisar no WhatsApp/e-mail se esse backup falhar ou parar:
echo 'NAS_ARQUIVOS_DIR="/mnt/nas-arquivos"' | sudo tee -a /etc/confianza-alertas.conf
sudo ./instalar-monitor-backups.sh            # atualiza o monitor (a configuração é mantida)
sudo confianza-monitor-backups --dry; echo "codigo=$?"
```
O monitor passa a avisar se o destino não estiver montado, se o `backup-arquivos.log` não terminar
em "concluído" ou se ele ficar mais de 26 h sem atualizar.

## O que isto **não** faz (honestidade)

- **Não é versionado:** se um arquivo for **alterado** (e estragado) na origem, a cópia seguinte
  sobrescreve a boa. Só protege contra perda de disco e contra **apagar** arquivo.
- Não prova que os arquivos abrem; confere só que a cópia terminou sem erro.
- O NAS e o servidor ficam no mesmo local: contra incêndio/roubo não adianta. Se esses arquivos forem
  críticos, copie também para fora (Google Drive via `rclone`, ou o NAS do Paraguai).
