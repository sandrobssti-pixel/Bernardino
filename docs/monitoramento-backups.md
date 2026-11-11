# Monitoramento dos backups (Fase 1) — alerta por WhatsApp e e-mail

Motivo: em outubro/2026 o NAS ficou ~10 dias sem receber backup (o IP dele mudou e os backups
noturnos passaram a falhar) e **ninguém foi avisado**. Estes scripts avisam em poucas horas.

Há **duas camadas**, de propósito:

| Camada | Onde roda | Avisa por | Cobre |
|---|---|---|---|
| `monitor-backups.sh` | servidor (systemd timer, 06:30 e 14:00) | **WhatsApp** (API do AtendeFlow) e **e-mail** | backups, NAS, containers, disco |
| `nas-verifica-backups.sh` | NAS (Programador de tarefas do DSM, 07:00) | **e-mail do DSM** | backup novo existe? — funciona **mesmo com o servidor desligado/travado** |

Os dois são **somente leitura**: não apagam nem alteram backups.

## O que cada um verifica

`monitor-backups.sh`:
- NAS montado, respondendo (sem travar) e com espaço livre (padrão: ≥ 20 GB)
- backup mais recente de cada tipo: **idade** ≤ 26 h e **tamanho mínimo** (AtendeFlow: banco ≥ 50 MB, arquivos ≥ 10 GB; Seafile: banco ≥ 500 KB, arquivos ≥ 8 GB; Confianza ≥ 1 MB)
- `backup.log`: a última linha de início/fim precisa ser de **término** (pega backup que começou e não terminou)
- arquivos `.partial` com mais de 3 h (backup interrompido)
- Confianza: o checksum `.sha256` confere
- containers essenciais rodando e sem `unhealthy`; disco do sistema (`/`) abaixo de 90 %

Aviso sem enxurrada: o **mesmo problema** só é reenviado depois de 24 h; quando tudo volta ao
normal, chega uma mensagem **RECUPERADO**.

## Instalação no servidor

```bash
cd ~/Bernardino            # ou /srv/confianza/Bernardino-ops
sudo ./instalar-monitor-backups.sh
sudo nano /etc/confianza-alertas.conf     # preencher WhatsApp e e-mail (arquivo só do root)
```

### WhatsApp (pela API do AtendeFlow)

No `/etc/confianza-alertas.conf`:

```
WHATSAPP_API_URL="https://<endereco-do-backend>/api/messages/send"
WHATSAPP_TOKEN="<token da conexao>"
WHATSAPP_NUMBERS="5571999999999 5571988888888"     # DDI+DDD+numero, so digitos, separados por espaco
WHATSAPP_NO_REGISTER=1
```

- **URL:** o endereço público do backend do AtendeFlow (veja `BACKEND_URL` no `.env` do deploy) + `/api/messages/send`.
- **Token:** o token da **conexão de WhatsApp** que vai enviar (Conexões no AtendeFlow). Use uma conexão
  que **não seja a de atendimento a clientes**, se possível.
- **`WHATSAPP_NO_REGISTER=1`** evita criar contato/ticket no AtendeFlow (funciona em conexão Baileys). Se a
  conexão for da **API Oficial**, coloque `0` (a API Oficial rejeita esse parâmetro).
- Limite: se o AtendeFlow estiver fora do ar, o WhatsApp não sai — por isso existe a camada do NAS (e-mail).

### E-mail (msmtp + Gmail com "senha de app")

```bash
sudo apt-get install -y msmtp
sudo nano /etc/msmtprc
```
```
defaults
auth           on
tls            on
tls_trust_file /etc/ssl/certs/ca-certificates.crt
logfile        /var/log/msmtp.log

account        default
host           smtp.gmail.com
port           587
tls_starttls   on
from           SEU_EMAIL@gmail.com
user           SEU_EMAIL@gmail.com
password       SENHA_DE_APP_DE_16_LETRAS
```
```bash
sudo chmod 600 /etc/msmtprc
```
A senha de app é criada em myaccount.google.com > Segurança > Verificação em duas etapas > Senhas de app
(a verificação em duas etapas precisa estar ligada). **Não use a senha normal da conta.** Depois, no
`/etc/confianza-alertas.conf`: `EMAIL_TO="voce@exemplo.com"` e `EMAIL_FROM="SEU_EMAIL@gmail.com"`.

### Testar

```bash
sudo confianza-monitor-backups --teste     # manda uma mensagem de teste por todos os canais
sudo confianza-monitor-backups --dry       # mostra o aviso que mandaria, sem enviar
sudo confianza-monitor-backups             # execução real (o timer faz isso sozinho)
systemctl list-timers confianza-monitor-backups.timer --no-pager
sudo journalctl -t confianza-monitor --since "2 days ago" --no-pager
```

Códigos de saída: `0` tudo ok · `1` problema encontrado (e avisado) · `2` problema e **nenhum** canal entregou.

## Instalação no NAS (aviso mesmo se o servidor cair)

DSM > **Painel de controle > Programador de tarefas > Criar > Tarefa agendada > Script definido pelo usuário**:

1. **Geral:** nome `Verificar backups`, usuário **root**.
2. **Programação:** diariamente, **07:00** (depois dos backups das 02:37, 03:00 e 03:30).
3. **Configurações de tarefa:** marque **"Enviar detalhes de execução por e-mail"** e **"Enviar somente quando o
   script terminar de forma anormal"**, e informe o e-mail. Cole o conteúdo de `nas-verifica-backups.sh`.

O script termina com **erro (código 1)** quando falta backup, e é isso que faz o DSM enviar o e-mail.
Para **testar** o e-mail: edite a tarefa, troque a linha `MAX_HORAS="${MAX_HORAS:-26}"` por
`MAX_HORAS="${MAX_HORAS:-0}"` (nada será "novo o bastante"), clique em **Executar**, confira o e-mail e
**volte para 26**.

Os caminhos assumem o **Volume 1** (`/volume1/atendeflow-backup`, `/volume1/seafile-data`,
`/volume1/confianza-backup`). Se o volume tiver outro nome, ajuste `VOLUME`.

## Ajustes e manutenção

- Limites: descomente e altere as linhas de `/etc/confianza-alertas.conf` (a lista está no próprio arquivo).
  Os tamanhos mínimos foram escolhidos para os volumes de hoje (AtendeFlow ~18–20 GB, Seafile ~16 GB). Se
  os dados **crescerem muito ou diminuírem**, reavalie — um mínimo alto demais gera alarme falso, baixo
  demais deixa passar backup cortado.
- Desligar uma checagem de containers: `CONTAINERS=""` no arquivo de configuração.
- Verificar serviços extras (ex.: o remendo de rede do NAS): `EXTRA_UNITS="nas-neigh-fix.timer"`.
- Estado do "não repetir": `/var/lib/confianza-alertas/` (apagar essa pasta faz o próximo ciclo reavisar).
- Desinstalar: `sudo systemctl disable --now confianza-monitor-backups.timer && sudo rm /etc/systemd/system/confianza-monitor-backups.* /usr/local/bin/confianza-monitor-backups`.

## O que isto **não** garante (honestidade)

- Confere **presença, idade, tamanho, término no log e checksum (Confianza)** — **não prova que o
  conteúdo abre**. Continue fazendo, de vez em quando, `gzip -t` no backup grande e o teste de restauração
  do backup cifrado do Confianza (abrir com a senha e conferir os bancos).
- Um backup **cheio de lixo com tamanho plausível** passaria. O tamanho mínimo reduz esse risco, mas não o elimina.
- O WhatsApp depende do AtendeFlow e do servidor estarem de pé; o e-mail do NAS cobre o caso do servidor fora.
- Se o próprio **NAS** estiver desligado, nenhum dos dois avisa pelo NAS; o monitor do servidor acusa
  "NAO esta montado / nao responde" — por isso o WhatsApp e o e-mail do servidor importam.
