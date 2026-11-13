---
name: vps-manutencao-backups
description: Use sempre que for manter/verificar a saúde de um servidor de cliente já em produção (VPS ou máquina física) com NAS — backups que falham em silêncio, monitor de backups com aviso por WhatsApp e e-mail, rotina de conferência diária/semanal/mensal, backup dos arquivos de trabalho, watchdog de travamento, e e-mail do servidor (msmtp). Reúne os scripts da raiz deste repositório (`monitor-backups.sh`, `nas-verifica-backups.sh`, `backup-atendeflow.sh` v2, `backup-arquivos.sh`, `check-servidor.sh`) e a tabela "alerta → o que olhar". Baseada na manutenção real de nov/2026 (Confiança Technologies). Complementa `nas-setup` (NAS/rede), `vps-provisioning` e `seafile-deploy`.
---

# Manutenção de servidor e backups com aviso de falha

Uso: servidor **já em produção**. O problema que originou isto: em out/2026 o NAS ficou ~10 dias sem receber
backup (IP mudou) e **ninguém foi avisado**. Tudo aqui parte do princípio: **backup sem aviso de falha falha em silêncio**.

Documentação detalhada (não duplicar aqui; ler quando precisar do passo a passo):
`docs/monitoramento-backups.md`, `docs/backup-arquivos.md`, `docs/estado-final-e-rotina.md`, `docs/servidor-paraguai.md`.

## 0. Pedido ambíguo → perguntar antes de agir
Mesma regra do `CLAUDE.md`. Este trabalho mexe em servidor real (montagens, `fstab`, discos). Confirmar antes:
- Qual canal avisa quem (WhatsApp pela API do AtendeFlow? e-mail? ambos) e **quais números/e-mails** recebem.
- Onde guardar cópia de arquivos de trabalho (compartilhamento novo do NAS, Seafile, só uma cópia manual).
- Qualquer ação **destrutiva** (apagar backup antigo, remover pool, `docker prune`, mudar `fstab`): mostrar o
  comando e esperar confirmação. Cópias/limpezas só depois de **conferir** que o destino é o NAS montado.

## 1. O que existe (scripts na raiz do repositório)

| Arquivo | Para quê | Onde roda |
|---|---|---|
| `check-servidor.sh` | diagnóstico **somente leitura** (rede, NAS, backups, discos) | servidor, à mão |
| `monitor-backups.sh` + `instalar-monitor-backups.sh` | confere idade/tamanho/término/`.partial`/checksum, NAS montado, containers, disco `/`; avisa por WhatsApp e e-mail; `--dry`, `--teste` | servidor (timer 06:30 e 14:00) |
| `nas-verifica-backups.sh` | mesma ideia **dentro do NAS**, e-mail do DSM só se anormal; funciona com o servidor desligado | DSM > Programador de tarefas, 07:00 |
| `backup-atendeflow.sh` (v2) | dump + volume, tenta de novo, grava `.partial`, verifica, **retenção por quantidade** | servidor (cron 03:00) |
| `backup-arquivos.sh` + `instalar-backup-arquivos.sh` | copia pastas de trabalho para o NAS, **sem `--delete`**, só se o destino for o NAS montado | servidor (timer 04:30) |

Config do monitor: `/etc/confianza-alertas.conf` (600, root). Variáveis: `WHATSAPP_API_URL`, `WHATSAPP_TOKEN`,
`WHATSAPP_NUMBERS`, `WHATSAPP_NO_REGISTER` (1 em conexão Baileys, 0 na API Oficial), `EMAIL_TO`, `EMAIL_FROM`,
`NAS_ARQUIVOS_DIR` (liga a checagem do backup de arquivos), limites `MIN_*`, `CONTAINERS=""` (desliga a checagem).
Códigos de saída: `0` ok · `1` problema avisado · `2` problema **sem** canal entregue. Sem enxurrada: o mesmo problema
só é reenviado após 24 h, e chega "RECUPERADO" quando normaliza.

## 2. Implantar (ordem)
1. `sudo ./instalar-monitor-backups.sh`, preencher `/etc/confianza-alertas.conf` (WhatsApp: URL do backend + `/api/messages/send`,
   token **da conexão de WhatsApp**, números com DDI+DDD, só dígitos), depois `sudo confianza-monitor-backups --teste`.
2. E-mail do servidor (msmtp + Gmail): ver §3. Depois `--teste` deve chegar por **WhatsApp e e-mail**.
3. No NAS, tarefa `Verificar backups` com `nas-verifica-backups.sh` (07:00, e-mail só se anormal).
4. `backup-atendeflow.sh` v2 no servidor; se houver arquivos só no disco local, `backup-arquivos.sh` (ver `docs/backup-arquivos.md`).
5. **Reiniciar o servidor de verdade** e conferir IP, montagens, containers `healthy`, `--dry` com `codigo=0`.
6. Ajustar limites `MIN_*` aos tamanhos reais (alto demais = alarme falso, baixo demais = deixa passar backup cortado).

## 3. E-mail do servidor com msmtp + Gmail (o que travou na prática)
1. Conta que envia: a **verificação em duas etapas precisa estar ATIVADA** (não basta adicionar o Authenticator). Se
   `myaccount.google.com/apppasswords` disser "configuração não está disponível para sua conta", é isso (ou só chave
   de segurança/passkey, Proteção Avançada, conta Workspace bloqueada). Alternativa: SMTP de outro provedor (ex.: Resend).
2. Senha de app: 16 letras, colar **sem espaços** (com espaços a autenticação falha). Conferir **sem mostrar**:
   `sudo awk '$1=="password"{print NF-1, "bloco(s);", length($2), "letras"}' /etc/msmtprc` → `1 bloco(s); 16 letras`.
3. Criar o arquivo já restrito: `sudo install -m 600 /dev/null /etc/msmtprc`, editar no `nano`. Conferir texto-modelo
   esquecido: `sudo grep -n 'SEU_EMAIL\|SENHA_DE_APP' /etc/msmtprc || echo ok`. `logfile /var/log/msmtp.log` (criar o arquivo, 600).
4. Preencher `EMAIL_TO`/`EMAIL_FROM` lendo o remetente do próprio `msmtprc` (sem digitar de novo):
   `FROM=$(sudo awk '$1=="from"{print $2}' /etc/msmtprc); [ -n "$FROM" ] && printf 'EMAIL_TO="..."\nEMAIL_FROM="%s"\n' "$FROM" | sudo tee -a /etc/confianza-alertas.conf`.
   Linhas repetidas no `.conf`: **vale a última**.
5. **Nunca** pedir/aceitar senha de app, token ou passphrase no chat: o usuário digita só no arquivo do servidor.

## 4. Rotina de conferência
- **Diário:** não chegou alerta = ok. À mão: `sudo confianza-monitor-backups --dry; echo "codigo=$?"` e
  `tail -8 /mnt/nas-backup/backup.log` (termina em "Backup concluído"). O monitor precisa estar ativo:
  `systemctl list-timers confianza-monitor-backups.timer`.
- **Semanal:** `df -h` (/ abaixo de ~80%), containers `healthy`, `journalctl -t confianza-watchdog`, `journalctl -b -p err`, log dos arquivos, pool no DSM.
- **Mensal:** depuração e S.M.A.R.T. no DSM; **restaurar** um backup de teste (AtendeFlow **sem reconectar WhatsApp**; Confianza com a senha, que fica **fora** do servidor); `--teste` do aviso.

## 5. Alerta → o que olhar primeiro
| Mensagem | Ação |
|---|---|
| `NAO esta montado` / `nao responde` | `ping` ao NAS (`ttl=64`); NAS ligado? iniciar os `.automount` (ver `nas-setup` problema 6) |
| `ultimo backup ... tem Nh` | `tail -20 .../backup.log`, procurar `!!! Backup FALHOU na etapa:` |
| `provavelmente cortado` | rodar à mão e testar `gzip -t`/`tar tzf`; ajustar `MIN_*` só se o dado diminuiu de verdade |
| container `UNHEALTHY`/parado | `docker ps -a`, `docker logs --tail 50`; Seafile: ver `seafile-deploy` problema 5 |
| `/` acima do limite | `du -xh --max-depth=1 / \| sort -h \| tail`; **não** rodar `docker image prune -a` |
| e-mail do DSM de disco/pool degradado | não desligar o NAS; trocar o disco e reparar o pool no DSM |

## 6. Armadilhas já encontradas (não repetir)
- **Retenção por idade** apagou todo o histórico quando o NAS ficou 10 dias sem backup → **por quantidade**.
- **`docker image prune -a`** apagou a imagem `alpine` usada pelo backup; a v2 usa a imagem do Postgres e **sempre registra a falha**.
- `df -h` bater **não prova** que os arquivos chegaram: conferir com `rsync -rn --size-only --itemize-changes`.
- **Restaurar com o compartilhamento desmontado** grava no disco local: checar `mountpoint -q` antes (o `backup-arquivos.sh` já recusa).
- **Placeholders colados literalmente** (`<ID>`, `SEU_EMAIL`, `192.168.100.XX`) quebraram `fstab` e `curl`: dar valor real ou um guard (`grep` do modelo).
- **`ls | head` em ordem alfabética** parece "sem backup recente": usar `ls -t`.
- `systemctl`/`journalctl -k` só olham o boot **atual**; para o anterior usar `-b -1`/`-b <id>`.
- **`pkill -f 'padrão'`** pode matar o próprio `sudo`/shell que contém o padrão.
- **GPU `nouveau`** travando o servidor (GT 730): `nouveau.noaccel=1`; diagnóstico só vale após ~15 dias sem travar.
- **Watchdog**: começar em **modo log** (3 checagens falhas seguidas, após 600 s de uptime) e só trocar para `reboot` depois de ~7 dias sem disparo falso.
- Cópia de arquivos **não é versionada** (sobrescreve com a versão estragada) e **links simbólicos não vão** para CIFS.
- NAS e servidor no **mesmo local**: incêndio/roubo levam tudo; considerar cópia fora (Drive via `rclone`, ou NAS de outra filial).

## 7. Checklist final
- [ ] `--teste` chega por WhatsApp **e** e-mail; `--dry` com `codigo=0` depois do primeiro backup noturno.
- [ ] Tarefa do NAS `Verificar backups` ativa; um teste forçando falha (`MAX_HORAS` 0) mandou e-mail.
- [ ] Reinício de teste feito, tudo sobe sozinho.
- [ ] Restauração de teste feita ao menos uma vez.
- [ ] Segredos **só** em `/etc/confianza-alertas.conf` e `/etc/msmtprc` (600, root); nada no chat/repositório.

## 8. Commit
Scripts e docs novos entram na branch de trabalho do repositório com mensagem descritiva, seguindo o `CLAUDE.md` da
raiz. Se descobrir um problema novo, acrescentar na seção 5/6 desta skill **e** em `docs/estado-final-e-rotina.md`.
