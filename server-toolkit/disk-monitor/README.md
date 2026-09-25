# disk-monitor — Disco & Limpeza automática

Módulo do `server-toolkit`: ferramenta **separada** do AtendeFlow (não faz
parte do app web nem do banco de dados dele) que roda em qualquer servidor
Linux (o VPS atual, ou um servidor novo de outro cliente) pra:

- Acompanhar o uso de disco do servidor ao longo do tempo (gráfico) —
  detecta sozinho **todos os discos/partições montados**, não só um.
- Acompanhar o uso de CPU e de memória RAM ao longo do tempo (gráficos).
- Mostrar os processos rodando **em tempo real** (atualiza a cada poucos
  segundos), com um gráfico de consumo (CPU e RAM) dos que mais pesam.
- Disparar limpeza automática quando o uso passar de um limite configurável.
- Permitir rodar a limpeza manualmente pelo painel, com um clique.
- Registrar o histórico de todas as limpezas (o que rodou, quanto liberou).

Painel web simples (gráfico + botões), com login e dois papéis de
usuário: **administrador** (acesso completo) e **visualizador** (só
acompanha o painel, não limpa nem muda configuração).

Pensado pra reaproveitar em qualquer servidor novo que a Confiança
Technologies montar — **Linux ou Windows** —, instalando por terminal
ou por um instalador gráfico, nos dois sistemas. Dá pra rodar direto do
código-fonte (como está instalado aqui) OU como um **executável único**
por sistema, sem precisar instalar Node.js no servidor novo.

## O que a limpeza faz (e o que ela NUNCA faz)

Faz (Linux e Windows, mesmo motor):
- `docker system prune -af` — remove container parado, imagem não usada,
  rede órfã e cache de build.
- Trunca (zera o conteúdo, sem apagar o arquivo) log de container Docker
  que passar do tamanho configurado — o Docker continua escrevendo nele
  normalmente depois. **Só no Linux** (no Windows, o Docker Desktop
  guarda isso dentro de uma VM sem caminho de arquivo acessível pelo
  host — esse passo aparece "pulado" no histórico de limpezas).
- Remove arquivo mais velho que N dias da pasta temporária do sistema
  (`/tmp` no Linux, `%TEMP%` no Windows).
- Compacta os logs do sistema mais velhos que N dias (`journalctl
  --vacuum-time`). **Só no Linux** (log de eventos do Windows é gerido de
  outro jeito, fora do escopo desta limpeza — esse passo aparece
  "pulado" no histórico).

**Nunca**:
- Não remove volume Docker (onde ficam o banco Postgres e os arquivos
  enviados pelo sistema — mídia de mensagens, etc.).
- Não mexe no backup do NAS (`/mnt/nas-backup`) — isso continua sendo
  gerido pelo `backup-atendeflow.sh` (retenção de 30 dias já configurada
  lá, na raiz do repositório).
- Não apaga nada de dentro do próprio AtendeFlow (banco, uploads).

## Instalação — visão geral

| Sistema | Terminal | Gráfico |
|---|---|---|
| Linux   | `sudo installers/linux/install.sh` | `installers/linux/install-gui.sh` (usa zenity) |
| Windows | `installers\windows\install.ps1` (PowerShell, como Admin) | `DiskMonitorSetup.exe` — assistente compilado do `installers/windows/disk-monitor.iss` |

Detalhes completos do lado Windows (inclusive o pré-requisito do WinSW e
como compilar o instalador gráfico) em
[`installers/windows/README.md`](installers/windows/README.md).

As seções abaixo detalham o caminho manual/passo a passo no Linux — útil
pra entender o que o `install.sh` faz por trás, ou pra quem prefere
instalar na mão.

## Instalação nesta máquina (a partir do código-fonte)

Use esse caminho no VPS atual, onde o repositório já está clonado.

```bash
cd ~/atendeflow/server-toolkit/disk-monitor
npm install
cp .env.example .env
nano .env   # troque SESSION_SECRET, DASHBOARD_USER e DASHBOARD_PASSWORD
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

Pra levar essa ferramenta pra um servidor de outro cliente (Linux ou
Windows) sem precisar clonar o repositório inteiro nem instalar Node.js
lá:

**1. Gere os pacotes** (numa máquina com internet — pode ser aqui no
VPS atual, ou no seu computador; o `pkg` cross-compila os dois sistemas
a partir de qualquer um deles, não precisa ter Windows pra gerar o
`.exe`):

```bash
cd ~/atendeflow/server-toolkit/disk-monitor
./package-for-new-server.sh
```

Isso cria `server-toolkit/dist/linux/` (executável `disk-monitor-linux`,
`public/`, `.env.example`, `installers/`) e
`server-toolkit/dist/windows/` (executável `disk-monitor.exe`, `public/`,
`.env.example`, `installers/`) — cada um já com Node.js embutido
(~40-80MB), pronto pra copiar.

**2. Linux — copie e instale:**

```bash
scp -r dist/linux usuario@servidor-novo:/tmp/disk-monitor-pkg
ssh usuario@servidor-novo 'sudo /tmp/disk-monitor-pkg/installers/install.sh'
```

**3. Windows** — ver
[`installers/windows/README.md`](installers/windows/README.md) (precisa
baixar o `winsw.exe` uma vez antes, é o único pré-requisito externo).

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

O login (usuário/senha reais, não mais fixo no `.env`) é uma segunda
camada, não substitui isso.

## Login e usuários

Na primeira vez que o painel sobe (sem nenhum usuário cadastrado ainda),
`DASHBOARD_USER`/`DASHBOARD_PASSWORD` do `.env` viram o **administrador
inicial**, salvo em `data/users.json` (senha guardada com hash, nunca em
texto puro). A partir daí, todo o gerenciamento de usuários é feito pela
própria tela **Usuários** do painel (só visível pra quem é admin) —
pode inclusive apagar essas duas linhas do `.env` depois, elas só
importam nesse primeiro boot.

Dois papéis:
- **Administrador**: acesso completo — vê o painel, roda limpeza manual,
  muda configuração, cria/remove outros usuários.
- **Visualizador**: só acompanha o painel (uso de disco, histórico,
  limpezas já feitas) — os botões de limpeza e o formulário de
  configuração ficam desabilitados, e a tela Usuários nem aparece.

Duas travas de segurança embutidas: ninguém consegue remover o próprio
usuário logado no momento, nem remover o último administrador
existente — sem isso seria possível trancar todo mundo pra fora do
painel sem nenhum jeito de voltar.

## Configuração pelo painel

- **Limite pra limpeza automática (%)**: quando o uso de disco bater
  esse valor, a limpeza roda sozinha (padrão: 85%).
- **Intervalo de checagem**: de quanto em quanto tempo o disco é
  verificado (padrão: 15 minutos).
- **Truncar log do Docker maior que**: tamanho a partir do qual um log
  de container é zerado (padrão: 200MB).
- **Limpar /tmp com mais de**: idade mínima pra um arquivo de `/tmp` ser
  removido (padrão: 7 dias).
- **Limpar logs do sistema com mais de**: idade mínima pro `journalctl`
  descartar logs arquivados (padrão: 14 dias; só no Linux).
- **Limpeza automática habilitada**: liga/desliga o gatilho automático
  sem precisar reiniciar o serviço.

## Discos, CPU, RAM e processos

Além do disco monitorado (o que aciona a limpeza automática), o painel
também mostra, sem nenhuma configuração extra:

- **Todos os discos/partições detectados** automaticamente no servidor,
  cada um com um card próprio: ícone, sistema de arquivos, gráfico de
  rosca (usado/livre) e o valor exato em GB/TB usado, total e livre.
- **CPU e memória RAM em tempo real de verdade**: janela ao vivo em
  memória, amostrada a cada 5 segundos no servidor (não depende do
  intervalo de checagem do disco, que é bem mais espaçado) — o mesmo
  princípio dos processos abaixo, com o indicativo visual "●" piscando
  ao lado do título.
- **Processos em tempo real**: os 15 que mais consomem CPU no momento
  (PID, nome, % de CPU, % de RAM), atualizado a cada poucos segundos —
  e um gráfico comparando o consumo dos que mais pesam.

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
