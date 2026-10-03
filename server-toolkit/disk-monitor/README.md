# disk-monitor — Disco & Limpeza automática

Módulo do `server-toolkit`: ferramenta **separada** do AtendeFlow (não faz
parte do app web nem do banco de dados dele) que roda em qualquer
servidor/computador — Linux, Windows ou macOS — pra:

- Acompanhar o uso de disco do servidor ao longo do tempo (gráfico) —
  detecta sozinho **todos os discos/partições montados**, não só um.
- Mostrar os **discos físicos agrupados com suas partições dentro** (ex.:
  um disco de 480GB com duas partições de 240GB cada aparecem juntos,
  não soltos), separando também **discos USB externos** e
  **compartilhamentos de rede (NAS via SMB)** em seções próprias — com
  status de saúde do disco (SMART) quando disponível no servidor.
- Acompanhar o uso de CPU e de memória RAM ao longo do tempo (gráficos).
- Mostrar os processos rodando **em tempo real** (atualiza a cada poucos
  segundos), com um gráfico de consumo (CPU e RAM) dos que mais pesam.
- Disparar limpeza automática quando o uso passar de um limite configurável.
- Permitir rodar a limpeza manualmente pelo painel, com um clique.
- Registrar o histórico de todas as limpezas (o que rodou, quanto liberou).
- (Opcional) **Painel do NAS** embutido — navegar/baixar/enviar arquivo
  nas pastas do NAS já montadas no servidor, e ver discos/desligar o
  NAS via API do Synology DSM. Vem "de fábrica" com o disk-monitor,
  mas só liga se você configurar `NAS_ROOTS` (e opcionalmente
  `DSM_*`) no `.env` desse servidor — sem essa configuração, essa
  parte do painel simplesmente não aparece (ver seção própria abaixo).

Painel web simples (gráfico + botões), com login e dois papéis de
usuário: **administrador** (acesso completo) e **visualizador** (só
acompanha o painel, não limpa nem muda configuração).

Pensado pra reaproveitar em qualquer servidor/computador novo de cliente
— **Linux, Windows ou macOS** —, instalando por terminal (nos três
sistemas) ou por instalador gráfico (Linux e Windows só, por enquanto —
ver `installers/macos/README.md`). Dá pra rodar direto do código-fonte
(como está instalado aqui) OU como um **executável único** por sistema,
sem precisar instalar Node.js na máquina de destino.

## O que a limpeza faz (e o que ela NUNCA faz)

Faz (Linux, Windows e macOS, mesmo motor):
- `docker system prune -af` — remove container parado, imagem não usada,
  rede órfã e cache de build.
- Trunca (zera o conteúdo, sem apagar o arquivo) log de container Docker
  que passar do tamanho configurado — o Docker continua escrevendo nele
  normalmente depois. **Só no Linux** (no Windows e no macOS, o Docker
  Desktop guarda isso dentro de uma VM sem caminho de arquivo acessível
  pelo host — esse passo aparece "pulado" no histórico de limpezas).
- Remove arquivo mais velho que N dias da pasta temporária do sistema
  (`/tmp` no Linux, `%TEMP%` no Windows, `$TMPDIR` no macOS).
- Compacta os logs do sistema mais velhos que N dias (`journalctl
  --vacuum-time`). **Só no Linux** (log de eventos do Windows e o log
  unificado do macOS são geridos de outro jeito, fora do escopo desta
  limpeza — esse passo aparece "pulado" no histórico nos dois).

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
| macOS   | `sudo installers/macos/install.sh` | ainda não existe (precisa ser gerado num Mac — ver `installers/macos/README.md`) |

Detalhes completos do lado Windows (inclusive o pré-requisito do WinSW e
como compilar o instalador gráfico) em
[`installers/windows/README.md`](installers/windows/README.md), e do
lado macOS (inclusive a assinatura automática do executável) em
[`installers/macos/README.md`](installers/macos/README.md).

As seções abaixo detalham o caminho manual/passo a passo no Linux — útil
pra entender o que o `install.sh` faz por trás, ou pra quem prefere
instalar na mão.

## Atualizando uma instalação já existente

Pra trazer uma versão nova de código pra um servidor que **já tem** o
disk-monitor instalado, sem repetir o passo a passo de instalação inteiro
(nem pedir usuário/senha do admin de novo): use o `update.sh` (Linux) ou
`update.ps1` (Windows) em vez do `install.sh`/`install.ps1`. Os dois só
trocam o código — nunca mexem em `.env`, usuários cadastrados ou
histórico já registrado.

**Linux**, de dentro do checkout do repositório já atualizado (`git
pull`/`git checkout` da branch nova):
```bash
cd ~/atendeflow/server-toolkit/disk-monitor
sudo installers/linux/update.sh
sudo systemctl status disk-monitor   # confirma a versão nova no log
```

**Windows**, de dentro da pasta com o `disk-monitor.exe` novo (gerado por
`npm run build:win` ou baixado atualizado):
```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\update.ps1
```

**macOS**, de dentro da pasta com o executável novo (gerado por
`npm run build:macos` ou baixado atualizado):
```bash
sudo installers/macos/update.sh
sudo launchctl list | grep disk-monitor   # confirma que subiu de novo
```

Testado nesta sessão (Linux): simulei uma instalação antiga (versão
`0.9.0` de propósito, com `.env`/histórico com dado próprio) e confirmei
que o `update.sh` troca o código, reinstala as dependências, reinicia o
serviço, mostra `v0.9.0 -> v1.5.0` no final — e o `.env`/histórico
continuaram exatamente iguais depois. **Não testado** no Windows real
(mesma limitação já documentada pro `install.ps1`/`uninstall.ps1` — sem
máquina Windows disponível nesta sessão).

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

## Perfil da máquina

Na primeira vez que o serviço sobe depois de instalado, ele faz uma
varredura única de hardware e sistema operacional (CPU, memória RAM
total, discos, SO/versão, hostname — via `systeminformation`, a mesma
lib usada nas métricas ao vivo) e guarda em
`data/machine-profile.json`. O painel mostra isso num card no topo,
fixo (não é uma métrica que fica atualizando sozinha — hardware não
muda sozinho). Serve tanto pra identificar de relance o que tem no
servidor quanto, principalmente, pra replicar as mesmas características
ao montar um servidor novo de outro cliente.

Pra forçar uma nova varredura (ex.: trocou o disco ou a RAM da
máquina), apague `data/machine-profile.json` e reinicie o serviço — ele
varre de novo sozinho, sem precisar reinstalar nada.

## Discos, CPU, RAM e processos

Além do disco monitorado (o que aciona a limpeza automática), o painel
também mostra, sem nenhuma configuração extra:

- **Todos os discos/partições detectados** automaticamente no servidor,
  agrupados por disco físico de verdade (ver seção "Discos físicos, USB
  e compartilhamentos de rede" abaixo) — nunca lista sistema de arquivo
  virtual/interno (overlay do Docker, tmpfs, proc, etc.) como se fosse
  um disco, mesmo que o servidor tenha dezenas de containers rodando.
- **CPU e memória RAM em tempo real de verdade**: janela ao vivo em
  memória, amostrada a cada 5 segundos no servidor (não depende do
  intervalo de checagem do disco, que é bem mais espaçado) — o mesmo
  princípio dos processos abaixo, com o indicativo visual "●" piscando
  ao lado do título.
- **Processos em tempo real**: os 15 que mais consomem CPU no momento
  (PID, nome, % de CPU, % de RAM), atualizado a cada poucos segundos —
  e um gráfico comparando o consumo dos que mais pesam.

### Discos físicos, USB e compartilhamentos de rede

Além do grid plano acima, o painel também agrupa os mesmos discos por
**disco físico de verdade** (`lib/diskTopology.js`): um HD de 480GB com
duas partições de 240GB aparece como um card só, com as duas partições
listadas dentro dele — em vez de dois cards soltos sem relação visível
um com o outro. Junto de cada disco, mostra (quando o sistema
operacional expõe essa informação): fabricante, tamanho, tipo de
interface, temperatura e **status de saúde (SMART)** — "Saudável" ou
"Com falha".

Separado em três seções:
- **Discos físicos** — discos internos do servidor.
- **Discos externos (USB)** — só aparece se detectar algum.
- **NAS / Compartilhamentos de rede** — pontos de montagem SMB/NFS (ex.:
  o mesmo NAS usado pelo backup), só aparece se detectar algum.

**Honestidade sobre limitação conhecida**: o agrupamento de partição
dentro do disco físico usa o nome do dispositivo (ex.: `sda1` pertence a
`sda`) — funciona bem em Linux, mas no Windows a API do sistema expõe
menos detalhe, então esse agrupamento fica mais limitado lá (os discos
continuam aparecendo, só a relação disco-físico/partição pode não ficar
tão precisa quanto no Linux). O status SMART depende do que o sistema
operacional consegue expor sem ferramenta extra — se vier vazio **ou**
ambíguo (texto que não indica claramente OK nem falha — comum sem
`smartctl` instalado), o painel mostra "Indisponível", **nunca**
assume "com falha" por padrão (uma versão anterior tinha esse bug —
corrigido: só mostra "com falha" quando o texto realmente indica isso).

### Verificar saúde e manutenção preventiva

Cada card de disco físico (incluindo USB) tem um botão **"Verificar
saúde agora"** — sempre só leitura, disponível pra qualquer usuário
(admin ou visualizador). Ele consulta (`lib/diskHealth.js`):

- **SMART** (via `smartctl`, se o pacote `smartmontools` estiver
  instalado no servidor): status geral, temperatura, horas ligado,
  setores realocados/pendentes. Se `smartctl` não estiver instalado,
  mostra "indisponível" — nunca trata como erro nem impede o resto do
  painel de funcionar.
- **Log do kernel** (`journalctl -k`, só Linux): procura por erro de
  E/S ou bloco defeituoso relacionado àquele disco nas últimas 1000
  linhas — sinal real de problema de hardware, sem precisar rodar
  `fsck` num sistema de arquivos montado (**deliberadamente evitado**:
  rodar `fsck` em disco montado é arriscado e pode dar resultado
  incorreto, então essa opção não existe no painel).

O disco do **sistema** (o mesmo do `MOUNT_PATH`, com a badge "Sistema"
no card) também ganha o botão **"Rodar limpeza agora"** — a mesma
limpeza segura já descrita em ["O que a limpeza faz (e o que ela NUNCA
faz)"](#o-que-a-limpeza-faz-e-o-que-ela-nunca-faz), só que acessível
direto pelo card do disco, admin-only (igual ao botão principal do
painel de Limpeza).

**Por que os outros discos não têm botão de limpeza**: a limpeza
existente (Docker, `/tmp`, log do sistema) só faz sentido no disco do
sistema — não existe um padrão de "lixo" seguro e genérico pra aplicar
em qualquer partição, e um disco de dados de cliente, NAS ou backup
**nunca** deve ter arquivo apagado automaticamente pelo painel. Isso seria
quebrar a regra de ouro do projeto ("nunca mexer em dado de cliente").

### Particionar e formatar disco (ação irreversível)

Pensado pra disco **novo** (sem nenhuma partição ainda) ou disco **com
problema na tabela de partições** que precisa ser recriado do zero — nunca
pra disco em uso. Aparece como botão **"Particionar / Formatar"** em
qualquer disco que não seja o do sistema, admin-only.

Duas camadas de segurança, nenhuma pulável pela interface:

1. **Elegibilidade sempre reconferida no servidor** (`lib/diskPartition.js`),
   nunca confia em nada vindo do navegador: se **qualquer** partição
   desse disco estiver montada no momento — mesmo que não seja o disco
   do sistema — o painel recusa e mostra exatamente qual pasta está
   montada, pedindo pra desmontar manualmente primeiro (o painel nunca
   desmonta nada sozinho).
2. **Prévia sempre antes de executar**: "Ver comando" só monta o texto
   dos comandos exatos que seriam rodados (`wipefs`, `parted`, `mkfs.*`)
   — nada é executado nessa etapa. Só depois de ver a prévia é que
   aparecem os dois campos de confirmação: digitar o **caminho exato do
   disco** (ex.: `/dev/sdd`) e a **frase exata** `FORMATAR`. O botão de
   executar (vermelho, "Apagar e formatar agora") só fica clicável
   quando os dois campos batem exatamente — sem meio-termo, sem "clicar
   sem querer".

Três esquemas de disco pra escolher (dropdown "Esquema do disco"):

- **Volume único (dados)** — uma partição só ocupando o disco inteiro,
  sistema de arquivos à escolha (`ext4`, `xfs`, `exfat`). Pra usar o
  disco como armazenamento extra, não pra instalar sistema operacional.
- **Linux com UEFI (EFI + swap + raiz)** — GPT com três partições: EFI
  (`fat32`, 512MiB, com a flag `esp`), `swap` (4GiB) e raiz (o resto do
  disco, `ext4`/`xfs` à escolha) — a estrutura que um instalador de
  Linux moderno (Ubuntu, Debian, etc.) espera encontrar.
- **Windows com UEFI (EFI + principal NTFS)** — GPT com EFI (`fat32`,
  512MiB, flag `esp`) + uma partição principal `NTFS` ocupando o resto —
  a estrutura básica que o instalador do Windows espera.

**Importante — o que isso NÃO faz**: os esquemas Linux/Windows só
deixam o disco com as **partições prontas**; **não instalam o sistema
operacional** (não copiam nenhum arquivo do Windows/Linux, não
configuram bootloader). Depois de rodar isso, ainda é preciso instalar
o sistema normalmente (pendrive bootável, PXE, etc.) — só que já
apontando pra um disco com a estrutura certa.

Antes de deixar prosseguir, a checagem de elegibilidade também confere
se as ferramentas que aquele esquema precisa estão instaladas no
servidor (`parted`, `wipefs`, `mkfs.fat`/`dosfstools`, `mkfs.ntfs`/
`ntfs-3g`, `mkswap`/`util-linux`, `mkfs.ext4`/`e2fsprogs`,
`mkfs.xfs`/`xfsprogs`, conforme o esquema) — se faltar alguma, recusa
**antes** de apagar qualquer coisa, em vez de travar no meio do
particionamento com o disco pela metade.

**Honestidade sobre o que foi testado**: a lógica de elegibilidade
(nunca deixar particionar disco com algo montado, e recusar se faltar
ferramenta) foi testada com dados simulados nos três esquemas —
incluindo disco inexistente, disco com partição montada e ferramenta
faltando, todos recusados corretamente; testado também o fluxo completo
até a prévia (com `parted`/`dosfstools` instalados) mostrando a lista de
partições e os comandos certos pros três esquemas. A execução de
verdade foi confirmada contra hardware real (HD de 240GB com partições
antigas vfat/ext4/LUKS) — e revelou um bug real: sem `partprobe` depois
de criar as partições, o kernel continuava com a visão antiga da tabela
de partições, então o painel (e o `mkfs` seguinte) lia o layout velho em
vez do novo. Corrigido adicionando `partprobe <disco>` +
`udevadm settle` logo depois de criar as partições, antes de formatar
cada uma. **Só Linux** por enquanto — no Windows e no macOS a
integração ainda não existe (retorna erro claro em vez de tentar algo
não testado).

**Progresso em tempo real e desenho visual**: a prévia agora mostra uma
barra colorida proporcional ao tamanho de cada partição antes de
confirmar (cor fixa por posição — EFI/swap/raiz, nunca ciclada). A
execução deixou de ser uma chamada HTTP única e bloqueante: o `execute`
dispara o trabalho em segundo plano (`POST .../execute` devolve um
`jobId` na hora) e o painel consulta o progresso a cada 1.5s
(`GET .../execute/status?jobId=...`), mostrando o passo atual, "X de Y"
e % concluído numa barra de verdade — em vez de uma mensagem estática de
"rodando" sem noção de quanto falta.

**Layout inspirado no painel nativo "Discos" do Ubuntu (GNOME Disks)**:
a ferramenta de particionar/formatar ganhou uma ficha técnica do disco
(Modelo / Número de série / Tamanho / Interface) antes do seletor de
esquema — igual à barra lateral do GNOME Disks —, e o seletor de sistema
de arquivos deixou de ser um `<select>` seco e virou uma lista de opções
explicadas (igual ao passo "Tipo" do assistente de formatação do GNOME
Disks: "Disco interno para usar somente com sistemas Linux (Ext4)",
"Para usar com todos os sistemas e dispositivos (exFAT)", "Avançado —
Linux (XFS)"). A barra proporcional de partições ganhou uma legenda
embaixo com número da partição, tamanho e tipo de sistema de arquivos de
cada pedaço, com a cor batendo com o segmento na barra — igual à
legenda "Partição 1 / 1.1 GB / FAT" do GNOME Disks. Número de série vem
de `systeminformation` (`si.diskLayout()`); quando o fabricante/driver
não expõe esse dado, mostra "Não informado pelo fabricante" em vez de
inventar um valor. Não existe (e não foi adicionado) campo de "nome do
volume" nem alternância de "apagar com sobrescrita segura" — o GNOME
Disks tem essas duas opções no assistente dele, mas esta ferramenta não
suporta nomear volume nem apagamento seguro por sobrescrita, então elas
ficaram de fora em vez de aparecer sem funcionar de verdade.

**Três etapas separadas e visíveis — apagar / criar / formatar**: o
botão único "Apagar e formatar agora" virou três botões independentes,
um por etapa, cada um com sua própria prévia e resultado. Motivo: um
caso real em hardware do próprio ambiente de testes onde o job parava
logo na primeira etapa (apagar a tabela de partições antiga) sem
nenhuma explicação visível — e como era um job único, nada rodava
depois disso, então parecia que a ferramenta "não apagava partição
nenhuma" quando na verdade só tinha falhado silenciosamente bem no
começo. A causa raiz identificada: uma partição antiga do disco ainda
estava "em uso" no nível do kernel (um mapeamento LUKS ou um array
RAID aberto de uma formatação anterior que nunca foi fechado) — isso
não aparece como "montada" (`si.blockDevices().mount` fica vazio), mas
o `parted` recusa reescrever a tabela de partições mesmo assim.

Correções:
- `checkEligibility()` agora também confere `/sys/class/block/<partição>/holders/`
  pra cada partição existente antes de liberar a etapa "apagar" — se
  tiver algo lá, recusa com uma mensagem nomeando o dispositivo que está
  segurando (ex.: `dm-2`) e o comando exato pra resolver
  (`cryptsetup close <nome>` ou `mdadm --stop /dev/mdX`), em vez de só
  deixar o `parted` falhar no meio sem explicação.
- A etapa "apagar" nunca mais inicia a criação/formatação sozinha — e
  vice-versa: `checkEligibility()` recusa "criar partição" se o disco
  ainda tiver qualquer partição (precisa rodar "apagar" antes) e recusa
  "formatar" se a partição esperada ainda não existir (precisa rodar
  "criar" antes) — a ordem é garantida pelo servidor, reconferida do
  zero em cada chamada, nunca só pela tela.
- Só a etapa "apagar" pede a confirmação em duas camadas (caminho exato
  do disco + frase "FORMATAR") — é a única que leva dado já existente;
  criar partição num disco que a própria etapa anterior já deixou vazio,
  ou formatar uma partição recém-criada, não tem nada de usuário pra
  perder.
- Quando um comando falha, o erro mostrado na tela agora inclui a saída
  de verdade do comando (stderr/stdout), não só "falhou — veja o log" —
  o técnico vê o motivo real sem precisar de SSH na máquina.
- A barra proporcional de partições agora é clicável: clicar num pedaço
  da barra (ou na linha correspondente da legenda) destaca os dois
  juntos, pra deixar claro qual partição é qual antes de agir.

**Partições sem montar, unificadas no card do disco**: a seção "Partições
sem montar" deixou de ser um painel à parte, com seus próprios cards —
agora cada partição sem ponto de montagem aparece dentro do card do
próprio disco físico dono dela (campo `parentDisk` que `listMountablePartitions()`
já devolvia), junto com o resto das ferramentas daquele disco. Tudo num
lugar só, como pedido.

**Honestidade sobre o que foi testado nesta rodada**: a correção do
`holders` foi validada por leitura/raciocínio sobre `/sys/class/block`
(mecanismo padrão do kernel Linux pra isso) e por execução das três
etapas em modo de prévia contra discos reais do ambiente de
desenvolvimento (sem `parted`/`udevadm` instalados ali, então a
checagem de ferramenta faltando foi o que disparou — validando que o
caminho de código roda sem erro) — ainda não foi confirmada contra um
disco físico de verdade com um mapeamento LUKS/RAID aberto reproduzindo
o sintoma original relatado. Ainda só Linux; Windows e macOS continuam
retornando erro claro de "não implementado" em qualquer uma das três
etapas.

### Limpeza avançada por categorias

Painel "Limpeza avançada de disco" (admin, dentro da seção de Limpeza):
varre categorias seguras e conhecidas — arquivos temporários, lixeira,
cache de navegador, cache de pacotes do sistema (`apt` no Linux, cache do
Homebrew no macOS) e revisões antigas de pacotes Snap no Linux — mostra
o tamanho de cada uma num gráfico de barras, e deixa escolher quais
limpar (nada é apagado sem seleção explícita e clique em "Limpar
selecionados").

Deliberadamente **não** inclui duas coisas que foram pedidas e decidimos
não implementar por segurança:
- **"Achar executáveis sem uso há muito tempo" pra deletar** — um
  binário do sistema pode ficar meses sem rodar e continuar essencial; a
  data de último acesso (atime) também é pouco confiável no Linux
  moderno. Não existe forma segura de automatizar isso sem risco real de
  quebrar o sistema operacional do cliente.
- **"Desfragmentação"** — obsoleto em SSD (desgasta à toa, não ajuda em
  nada) e nem existe no Linux (ext4) ou macOS (APFS) do jeito que existia
  no Windows antigo. O gráfico de uso por categoria substitui essa ideia
  mostrando informação real e acionável.

**Honestidade sobre o que foi testado**: a varredura (leitura de
tamanho) foi testada em ambiente Linux real nesta sessão, incluindo
cache de pacotes (`apt`) e arquivos temporários — funcionou
corretamente. A limpeza de verdade (apagar os arquivos) foi exercitada
no código mas **não foi confirmada contra um ambiente Windows ou macOS
real** — os caminhos de cache/lixeira dessas plataformas foram escritos
com base na documentação oficial de cada sistema, não testados ao vivo.
Teste com cautela a primeira vez em cada plataforma nova antes de
confiar em produção.

### Espelhar disco do sistema (RAID1) — só gera roteiro, nunca executa

Painel "Espelhar disco do sistema (RAID1)" (admin): detecta um disco do
mesmo tamanho do disco do sistema (ou **maior**) sem nenhuma partição
montada, e gera o roteiro exato de comandos (`sgdisk`, `mdadm`, `rsync`,
`grub-install`, etc.) pra espelhar o sistema manualmente. Se o disco
escolhido for maior que o disco do sistema (ex.: sistema de 120GB num
disco novo de 240GB), o espaço que sobra vira automaticamente uma 3ª
partição formatada, **fora do RAID**, pra usar como área de backup
independente — o roteiro já inclui os comandos pra criar e formatar essa
partição extra.

**Essa é a única ação deste painel que deliberadamente nunca vira um
botão "executar"** — diferente de particionar um disco de dados (ação
isolada, reversível ao trocar o disco), espelhar o disco do sistema
envolve copiar o sistema de arquivo por arquivo, reconfigurar o
bootloader (GRUB), reiniciar no meio do processo e só então apagar o
disco original — um erro em qualquer passo pode deixar o servidor **sem
conseguir ligar**, sem desfazer fácil. O roteiro gerado precisa ser
executado manualmente, passo a passo, com mídia de resgate (live USB)
disponível, confirmando o boot do RAID antes do último passo (que apaga
o disco original).

Só cobre o layout mais comum (GPT + partição EFI + raiz ext4, sem LVM,
sem swap separado) — qualquer outro layout recusa a gerar o roteiro em
vez de arriscar um comando errado.

**Honestidade sobre o que foi testado**: a detecção de disco candidato
(leitura de tamanho/montagem) foi testada nesta sessão. A geração do
roteiro foi escrita com base no procedimento padrão documentado pra
Debian/Ubuntu (`mdadm` + `grub-install` + `chroot`), mas **o roteiro em
si não foi executado contra uma máquina real** — não há como testar
isso com segurança sem um servidor descartável. Revise cada comando
antes de rodar, e tenha certeza de entender o que cada passo faz.

## Painel do NAS (opcional)

Módulo embutido no próprio disk-monitor — sem instalar nada a mais,
sem outro serviço rodando, sem outra porta pra abrir. Fica escondido
até você configurar; assim, quando esse mesmo disk-monitor for pro
servidor de outro cliente, a opção já está lá, só falta ligar.

**Diagnóstico**: toda vez que o serviço sobe, ele anuncia no log
(`journalctl -u disk-monitor` ou o log do `launchd`/Visualizador de
Eventos) se o painel do NAS e a integração com o DSM estão ativos ou
não — ex.: `[disk-monitor] Painel do NAS: ATIVO | Synology DSM: inativo
(DSM_HOST/DSM_USER/DSM_PASSWORD não configurados)`. Se a seção do NAS
sumir do painel sem ninguém ter mexido em nada, primeiro olhar é esse
log — ele diz imediatamente se é falta de configuração no `.env` ou
outra coisa, sem precisar caçar manualmente.

### Arquivos do NAS

Navega, baixa e envia arquivo nas pastas do NAS já montadas no
servidor (via SMB). Configure em `.env`:

```bash
NAS_ROOTS="Backups:/mnt/nas-backup,Seafile:/mnt/nas-seafile"
#NAS_MAX_UPLOAD_MB=2048   # padrão: 2GB
```

**Nunca** acessa nada fora das pastas listadas — toda operação resolve
o caminho real no disco (`fs.realpathSync`, segue symlink) e confirma
que continua dentro de uma raiz permitida antes de ler ou escrever
qualquer coisa (`lib/fileManager.js`). Visualizador navega e baixa; só
administrador envia arquivo.

### Discos do NAS e desligamento (Synology)

Opcional e independente do `NAS_ROOTS` acima — fala direto com a API
do próprio DSM (Synology):

```bash
DSM_HOST=192.168.3.21
DSM_PORT=5001
DSM_HTTPS=true
DSM_USER=
DSM_PASSWORD=
#DSM_ALLOW_SELF_SIGNED=true   # comum em certificado de rede local
#DSM_DEVICE_ID=               # ver "Login com verificação em duas etapas" abaixo
```

Use uma conta **administradora do DSM** dedicada a isso (nunca a conta
de serviço do SMB). Mostra o status de cada disco físico (saúde,
temperatura, capacidade) e permite desligar o NAS de verdade — só
administrador, com duas travas: `requireRole("admin")` e uma frase de
confirmação exata (`DESLIGAR`) digitada na tela, nunca só o clique do
botão.

> ⚠️ **Desligar é uma ação física, irreversível remotamente**: sem
> Wake-on-LAN configurado no NAS, só liga de novo apertando o botão
> físico no aparelho.

#### Login com verificação em duas etapas (2FA)

Se a conta usada em `DSM_USER` tiver 2FA ativado (recomendado — **nunca
desligue o 2FA só pra essa integração funcionar**), o login simples com
usuário/senha não passa. É preciso fazer **uma única vez** um login
manual incluindo o código de 6 dígitos do app autenticador, pedindo pro
DSM lembrar esse servidor como dispositivo confiável:

```bash
curl -sk -G "https://SEU_IP_DSM:5001/webapi/auth.cgi" \
  --data-urlencode "api=SYNO.API.Auth" \
  --data-urlencode "version=7" \
  --data-urlencode "method=login" \
  --data-urlencode "account=SEU_USUARIO" \
  --data-urlencode "passwd=SUA_SENHA" \
  --data-urlencode "otp_code=CODIGO_DE_6_DIGITOS_AGORA" \
  --data-urlencode "enable_device_token=yes" \
  --data-urlencode "device_name=disk-monitor" \
  --data-urlencode "session=nas-panel" \
  --data-urlencode "format=sid"
```

A resposta (se o código ainda estiver válido) traz um `device_id` bem
longo — copia esse valor pro `DSM_DEVICE_ID` no `.env` e reinicia o
serviço. Daí em diante, os logins da integração usam esse identificador
no lugar do código, sem precisar repetir esse processo (a menos que a
conta perca a confiança no DSM, aí é só gerar de novo).

**Honestidade sobre o que foi testado**: o login (incluindo o fluxo
acima com conta 2FA) foi validado contra um **Synology DS223j real,
DSM 7.4.1**. Leitura dos discos e desligamento ainda não foram
confirmados contra hardware real nesta sessão. Testado diretamente:
painel sem DSM configurado (some sem quebrar nada), trava de
confirmação por frase exata, erro de conexão tratado sem derrubar o
resto do painel, e agora o login em si. Teste com cuidado antes de
confiar o desligamento em produção — comece só pela leitura dos discos.

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
