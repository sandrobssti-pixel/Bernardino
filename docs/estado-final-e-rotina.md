# Servidor do Brasil + NAS — estado final (13/11/2026) e rotina de conferência

Resumo do que ficou pronto na manutenção de novembro/2026 e **o que conferir, e quando**. Detalhes de cada
parte: `monitoramento-backups.md`, `backup-arquivos.md`, `servidor-paraguai.md`.

> Nenhum segredo está neste arquivo. Token do WhatsApp, e-mail de destino e limites ficam em
> `/etc/confianza-alertas.conf` (600, só root); a senha de app do Gmail só em `/etc/msmtprc` (600, só root);
> a senha do Confianza cifrado fica **fora do servidor**.

## 1. Estado final

| Parte | Como está |
|---|---|
| Servidor | `192.168.100.78` (reserva de DHCP no roteador), interface `enp4s0`, sem remendo de rota |
| NAS Synology DS223j | `192.168.100.77` (reserva de DHCP), **SHR com tolerância a 1 disco** (2 × 4 TB), Btrfs, sem rota estática |
| Verificação dos discos | S.M.A.R.T. ampliado passou nos dois (11/11); **depuração mensal** (dia 11, janela 08:00–23:59) e **S.M.A.R.T. ampliado mensal** (dia 15, 10:00) agendados |
| Montagens | `/mnt/nas-backup`, `/mnt/nas-seafile`, `/mnt/nas-confianza`, `/mnt/nas-arquivos` (CIFS por `fstab`, `x-systemd.automount`) |
| Swap | só `/srv/confianza/swapfile` (8 GB); entrada antiga `/swap.img` comentada no `fstab` |
| Placa de vídeo | `nouveau` com `noaccel=1` (causa dos travamentos); watchdog em **modo log** |

### Rotinas automáticas (horários locais)

> Horários de Seafile e Confianza conforme combinado na manutenção; confirme com `crontab -l` e `systemctl list-timers --all` se mudar algo.

| Hora | O quê | Onde |
|---|---|---|
| 02:37 | backup do Seafile | servidor → `/mnt/nas-seafile` |
| 03:00 | backup do AtendeFlow (v2: tenta de novo, grava `.partial`, verifica, retenção de **10**) | servidor → `/mnt/nas-backup` |
| 03:30 | backup cifrado do Confianza | servidor → `/mnt/nas-confianza` |
| 04:30 | cópia dos arquivos de trabalho (`~/Sandro`, `outputs`), sem apagar nada no destino | servidor → `/mnt/nas-arquivos` |
| 05:00 | `Limpar backups antigos` | tarefa do DSM |
| 06:30 e 14:00 | monitor de backups, aviso por **WhatsApp e e-mail** | servidor (systemd timer) |
| 07:00 | `Verificar backups`, e-mail do DSM **só se anormal** | tarefa do DSM (funciona com o servidor desligado) |
| dia 11, a partir das 08:00 | depuração de dados | NAS |
| dia 15, 10:00 | teste S.M.A.R.T. ampliado nos dois discos | tarefa `SMART ampliado mensal` |

O monitor confere: NAS montado e respondendo, espaço livre, idade (≤ 26 h) e tamanho mínimo do backup mais novo,
último registro do `backup.log` terminado em "concluído", `.partial` parado, checksum do Confianza, containers
(`confianza-seafile`, `confianza-seafile-db`, `atendeflow-backend-1`), disco `/` abaixo de 90 % e, se ligado, o
backup de arquivos.

## 2. Rotina de conferência

### Todo dia (30 segundos, ou só ler o WhatsApp/e-mail)
Se **não chegou alerta**, está tudo bem. Para conferir manualmente:
```bash
sudo confianza-monitor-backups --dry; echo "codigo=$?"      # codigo=0 = nenhum problema
tail -8 /mnt/nas-backup/backup.log                          # termina em "Backup concluído"
```
**Ausência de alerta só vale se o monitor estiver rodando:** `systemctl list-timers confianza-monitor-backups.timer --no-pager`.

### Toda semana (5 minutos)
```bash
df -h / /mnt/nas-backup /mnt/nas-seafile /mnt/nas-confianza /mnt/nas-arquivos    # / abaixo de ~80 %
docker ps --format '{{.Names}} {{.Status}}' | grep -E 'seafile|atendeflow-backend'  # Seafile healthy
sudo journalctl -t confianza-watchdog --since "7 days ago" --no-pager                # sem disparos
sudo journalctl -b -p err --no-pager | tail -15                                      # sem erro novo
tail -6 ~/backup-arquivos.log                                                       # "concluído" recente
```
No DSM: **Armazenamento** com pool e volume em "Boas condições" (sem "Degradado") e nenhum e-mail de falha de disco.

### Todo mês
- **Dia 11–12:** no DSM, a depuração de dados terminou sem erro (Armazenamento > Pool: "Concluído em").
- **Dia 15–16:** HDD/SSD > Informações de integridade > S.M.A.R.T. > Histórico: o teste ampliado dos **dois** discos em
  "Boas condições". Se uma execução disser "Previous test is not completed", é só um teste anterior ainda rodando.
- **Teste de restauração do Confianza** (abrir o `.tar.gz.enc` com a senha, que está fora do servidor, e conferir os bancos).
- **Restaurar o backup do AtendeFlow** numa instalação de teste **sem reconectar WhatsApp**, ao menos a cada poucos meses.
  Backup que nunca foi restaurado não é backup.
- `sudo confianza-monitor-backups --teste` chega por WhatsApp **e** e-mail (prova que o aviso continua funcionando).
- Reavaliar os limites mínimos do monitor (`MIN_*`) se os dados cresceram ou diminuíram muito.

## 3. Quando chegar um alerta

| Mensagem | O que olhar primeiro |
|---|---|
| `... NAO esta montado` / `nao responde` | `ping -c3 192.168.100.77` (esperado `ttl=64`); NAS ligado? `sudo systemctl start 'mnt-nas\x2dbackup.automount' 'mnt-nas\x2dseafile.automount' 'mnt-nas\x2dconfianza.automount' 'mnt-nas\x2darquivos.automount'` |
| `ultimo backup ... tem Nh` | `tail -20 /mnt/nas-backup/backup.log`; procure `!!! Backup FALHOU na etapa:` |
| `... provavelmente cortado` (tamanho) | rodar o backup à mão e conferir `gzip -t`/`tar tzf`; se o volume de dados **diminuiu de verdade**, ajustar o mínimo |
| `container ... UNHEALTHY / nao esta rodando` | `docker ps -a`, `docker logs --tail 50 NOME`; Seafile: ver o bloco no `/usr/local/bin/confianza-subir-servicos` |
| `disco do sistema (/) com N%` | `sudo du -xh --max-depth=1 / \| sort -h \| tail`; **não** rodar `docker image prune -a` (já apagou a imagem `alpine` e causou falha de backup) |
| `Arquivos: ...` | `tail -20 ~/backup-arquivos.log`, `mountpoint /mnt/nas-arquivos` |
| e-mail do DSM de falha de disco ou "Degradado" | **não desligue o NAS**; troque o disco com defeito e siga o procedimento de reparo do pool no DSM |
| `ls` no NAS dá `No such device` | automount travado: corrija a causa e `sudo systemctl restart 'mnt-nas\x2dXXXX.automount'` |

## 4. Armadilhas já encontradas (não repetir)

- **Rota estática no NAS** (`192.168.100.0/24` via gateway) forçava o tráfego local pelo roteador (`ttl=63`, SMB travava).
  Teste de sanidade: `ping` ao NAS com **`ttl=64`** e `ip neigh` mostrando o MAC real do NAS, sem `PERMANENT`.
- **DHCP mudou o IP do NAS 4 vezes** → reserva no roteador (NAS `.77`, servidor `.78`).
- **Retenção por idade** apagou todo o histórico quando o NAS ficou 10 dias sem backup → retenção **por quantidade**.
- **Limpeza do Docker** apagou a imagem `alpine` e o backup falhou sem ninguém saber → v2 usa a imagem do Postgres e sempre avisa.
- **`/swap.img` esparso** dava `Failed to activate swap` no boot → entrada comentada no `fstab`.
- **Placeholder colado literalmente** (`<ID>`, `SEU_EMAIL`, `192.168.100.XX`) já quebrou `fstab` e `curl`; confira com `grep` antes de salvar.
- **Senha de app do Google** deve ser colada **sem espaços** (16 letras juntas); com espaços a autenticação falha.
- **WhatsApp (Baileys) só roda em um servidor por vez**: restaurar o AtendeFlow em outro lugar com sessão conectada derruba a de produção.

## 5. Pendências (em ordem)

1. **Agora/dias seguintes:** conferir o primeiro ciclo completo (backup das 03:00 e cópia das 04:30 de cada dia).
2. **~7 dias:** se o watchdog não disparou, trocar `WATCHDOG_MODO` para `reboot` (ele só reinicia após 3 checagens seguidas falhas, depois de 600 s de uptime).
3. **Mais alguns dias de backups noturnos sem erro:** só então apagar `copia-nas` do HD externo TOSHIBA (ou guardá-lo desconectado).
4. **~15 dias sem travamento:** considerar resolvido o problema da placa de vídeo.
5. **Quando o equipamento chegar:** servidor do Paraguai (`servidor-paraguai.md`), com a mesma proteção do Brasil.
6. **Opcional:** cópia dos arquivos de trabalho também para **fora do prédio** (Google Drive via `rclone` ou o NAS do Paraguai);
   hoje NAS e servidor estão no mesmo local.

## 6. O que isto **não** garante

- Cópia no mesmo local do servidor: **incêndio, roubo ou enchente** levam tudo. O Google Drive guarda só uma parte (ver `backup-para-drive.sh`).
- O monitor prova **presença, idade, tamanho, término e checksum (Confianza)**, não que o conteúdo abre. Só a restauração de teste prova isso.
- A cópia de `~/Sandro` **não é versionada**: arquivo estragado na origem sobrescreve a cópia boa na rodada seguinte.
- RAID/SHR **não é backup**: protege contra falha de **um** disco, não contra apagar, estragar ou ransomware.
