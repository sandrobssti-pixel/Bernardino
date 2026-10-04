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

**Corrigido: "criar partição" falhando em disco nunca particionado
antes** — bug real, batido em produção: um disco de fábrica, zero
partições, mostra "Disco novo/vazio" no painel e nenhum motivo óbvio
pra rodar a etapa "apagar partições existentes" (não tem nada pra
apagar) — então o técnico pula direto pra "criar partição(ões)". Só que
`buildCreateCommands()` ia direto pro `parted mkpart`, presumindo que já
existia uma tabela GPT (criada normalmente pela etapa "apagar", via
`mklabel gpt`) — um disco nunca particionado não tem tabela nenhuma, e
o `parted` falhava com `token inválido: primary` / `Error: Se esperaba
un tipo de sistema de ficheros`. Corrigido adicionando um
`parted mklabel gpt` como primeiro comando da própria etapa "criar" —
seguro mesmo quando chamado depois da etapa "apagar" (que já deixou uma
tabela GPT vazia): `checkEligibility()` da etapa "criar" já exige zero
partições existentes antes de liberar, então recriar a tabela GPT nesse
ponto nunca tem dado nenhum pra perder, seja porque o disco é mesmo
novo, seja porque já estava vazio. **Honestidade**: o erro real e a
causa raiz foram confirmados contra produção (mensagem de erro exata
reproduzida); a correção em si (rodar `mklabel gpt` como passo 0 da
etapa "criar") foi validada só gerando o comando via `previewPartition()`
— ainda não foi confirmada executando de ponta a ponta contra o disco
que gerou o erro original.

**CRÍTICO — Corrigido: checagem de "disco vazio" não detectava sistema
de arquivos gravado direto no disco inteiro (sem partição)**. Achado
batido em produção, quase causando perda de dado real: ao tentar o
`mklabel gpt` do item acima contra um disco de dados que JÁ tinha
`ext4` gravado direto nele (`/dev/sdd`, sem nenhuma partição `/dev/sdd1`
— um padrão válido e nada incomum pra disco de dados simples, sem
GPT/MBR), o painel mostrou "Disco novo/vazio" (`checkEligibility()` só
procurava partições filhas, tipo `"part"`, nunca olhava se o PRÓPRIO
disco já tinha um sistema de arquivos) — e deixou o técnico avançar até
a etapa "Criar partições agora" contra um disco com 439GB de dado real
montado em produção (`/mnt/disco03`). **O que impediu a perda de dado
de fato foi o próprio `parted`**, que recusou escrever a tabela nova
porque o kernel reportou a partição como "em uso" (montada) — não a
checagem de elegibilidade do painel, que é quem deveria ter barrado
isso antes de chegar perto do `parted`. Corrigido: `checkEligibility()`
agora também verifica se o disco inteiro (não só suas partições) tem um
`fsType`, e trata isso como "disco não está vazio" nas duas etapas
("apagar" recusa com a mensagem de partição montada, "criar" recusa
pedindo pra apagar antes) — mesmo tratamento dado a qualquer partição
normal, sem duplicar lógica. **Honestidade**: causa raiz confirmada
contra produção com certeza absoluta (`lsblk -f` mostrando `sdd` — sem
número — com `ext4` e `/mnt/disco03` montado, exatamente o disco que
quase foi apagado); a correção foi validada simulando esse cenário
exato (disco sem partição, com `fsType`/`mount` preenchidos direto na
entrada do disco) contra as duas etapas via `previewPartition()`, com
resultado correto nas duas — ainda não foi reexecutada contra o disco
real que gerou o incidente (ele já está fora de perigo, não há motivo
pra testar destrutivamente de novo nele).

**Esquema personalizado (escolher quantas partições) e contador visível
de partições**: o seletor de esquema ganhou uma 4ª opção, "Personalizado
— escolher quantas partições" — ao escolher, aparece um campo numérico
(2 a 8) e o espaço do disco é dividido em partes iguais entre essa
quantidade, todas com o mesmo sistema de arquivos escolhido na lista de
rádio. Implementado como um esquema a mais em `describeScheme()`
(`lib/diskPartition.js`), reaproveitando o mesmo fluxo de três etapas —
"criar" e "formatar" funcionam exatamente igual aos esquemas prontos, só
que com N partições em vez de 1–3 fixas. `withVisualPercent()` foi
ajustado pra aceitar um `percentHint` por partição (a fatia exata que o
esquema personalizado já sabe, em vez do cálculo de "o que sobrar"
usado pelos esquemas de tamanho fixo). Também foi adicionado um contador
("N partições") visível no topo de cada card de disco físico, somando
partições montadas e sem montar — antes só dava pra saber a quantidade
contando as linhas na tela.

**Honestidade**: o esquema personalizado foi validado só por execução em
modo de prévia (2, 3, 5, 8 e um valor fora do limite confirmando o
travamento em 8) contra um disco do ambiente de desenvolvimento — ainda
não foi confirmado criando/formatando de verdade N partições custom
contra hardware físico real.

**Papel de cada partição (boot/memória/dado) e resultado visual final**:
cada partição dos esquemas (inclusive o personalizado) agora carrega um
`role` — `boot` (EFI), `swap` (memória virtual) ou `data` (a partição
que o técnico realmente vai usar). Isso aparece em dois lugares que
antes tratavam tudo igual:
- Na lista "Partições sem montar" dentro do card do disco, que agora
  separa visualmente a "Partição principal" (o `ext4`/`NTFS`/etc. de
  verdade) das "Partições padrão (boot/memória)" — antes era uma pilha
  só de `/dev/sdbN` sem distinção, o que gerava a dúvida de qual delas
  era "o HD" de fato.
- Depois que a etapa "Formatar" termina, em vez de só uma frase de
  texto, a tela mostra a mesma barra proporcional + legenda da prévia
  (reaproveitada de `_phaseData`, guardado no próprio elemento durante a
  prévia — não busca nada de novo no servidor) representando o
  resultado final de verdade, seguida de uma frase dizendo pra que esse
  layout serve: **"install"** (esquemas Linux/Windows UEFI — pronto pra
  rodar um instalador de sistema operacional depois) ou **"storage"**
  (volume único/personalizado — pronto pra usar direto como dado de uma
  aplicação específica ou só backup). Isso responde diretamente à
  pergunta "esse HD vai servir pra instalar sistema, rodar uma aplicação
  específica, ou só backup?" sem o técnico precisar adivinhar pelo
  esquema escolhido.
- `role` em partição detectada como "sem montar" (fora do fluxo desta
  ferramenta, ex.: disco que já veio particionado de outro lugar) é só
  um palpite por tipo de sistema de arquivos + tamanho (FAT pequeno ≈
  boot, `swap` ≈ swap, resto ≈ dado) — nunca uma certeza, só pra
  explicar visualmente o que provavelmente é cada partição.

**Corrigido: atualização automática apagava trabalho em andamento**. A
tela de discos físicos se atualiza sozinha a cada 60s (pra pegar disco
novo plugado, etc.) recriando os cards do zero — e como a ferramenta de
particionar/montar vive dentro desses cards, se o técnico estivesse no
meio de preencher a frase de confirmação, olhando uma prévia, ou
esperando uma etapa rodar, a atualização automática apagava tudo sem
aviso nenhum, obrigando a recomeçar do zero. `loadDiskTopology()` agora
confere antes (`hasOpenDiskTool()`) se alguma ferramenta de particionar
ou montar está aberta em qualquer card, e se estiver, a atualização
*periódica* é pulada inteira — só uma ação explícita do usuário (trocar
o idioma, por exemplo, via `loadDiskTopology(true)`) força a atualização
mesmo com algo aberto. CPU/RAM/processos continuam atualizando normal
nesse meio tempo, só a grade de discos físicos fica parada enquanto
houver algo aberto.

**Tamanho em GB por partição no esquema personalizado**: antes o
esquema "Personalizado" só deixava escolher QUANTAS partições (divididas
sempre em partes iguais); agora também deixa definir o tamanho de cada
uma em GB — exceto a última, que automaticamente fica com o que sobrar
do disco (mesmo padrão já usado pelas partições EFI/swap de tamanho fixo
nos esquemas prontos). Campo por campo: ao escolher N partições, aparecem
N-1 campos ("Partição 1 (GB)", "Partição 2 (GB)"...) e uma linha final
fixa avisando que a última é automática. Se QUALQUER um dos N-1 campos
ficar vazio, a ferramenta ignora todos e volta pra divisão igual — nunca
tenta adivinhar um valor parcial. `checkEligibility()` da etapa "criar"
confere se a soma dos tamanhos informados cabe no disco antes de deixar
prosseguir (em vez de deixar o `parted` recusar a última partição no
meio da execução). Validado em modo de prévia (120GB numa partição de
2, soma estourando o tamanho do disco pra confirmar a recusa, e sem
nenhum tamanho preenchido pra confirmar que cai na divisão igual) contra
um disco do ambiente de desenvolvimento — ainda não confirmado criando
partições de tamanho customizado de verdade contra hardware físico real.

### Pra que serve essa partição — rótulo + autounattend.xml (Windows)

Pedido do usuário: depois de formatar, apontar automaticamente a
instalação do sistema operacional pra uma partição específica — "o
técnico coloca o pendrive e o sistema já sabe pra qual partição
instalar". **Isso tem um limite técnico real, explicado ao usuário antes
de implementar** (não dava pra simplesmente fazer o que foi pedido ao
pé da letra): o instalador que roda do pendrive (Windows Setup, Ubuntu,
etc.) é um sistema operacional totalmente à parte, e o disk-monitor já
não está mais rodando no momento em que ele inicia — os dois nunca se
encontram, então não existe como "avisar" o instalador em tempo real.

Duas coisas reais foram implementadas em vez disso (usuário escolheu as
duas, entre as opções apresentadas):

**1. Rotular a partição (`lib/osInstallTarget.js`, `applyPartitionLabel`)**
— depois que a etapa "Formatar" termina, aparece a pergunta "pra que
essa partição vai servir?" (instalar SO vs. backup/aplicação/dado). A
resposta rotula a partição de verdade, na hora, com `e2label` (ext4),
`ntfslabel` (NTFS), `xfs_admin -L` (XFS), `exfatlabel` (exFAT) ou
`fatlabel` (FAT) — rótulo "OSINSTALL" ou "DADOS". Isso faz a partição
aparecer destacada, por nome, na tela de particionamento de qualquer
instalador que o técnico rodar manualmente depois — baixo risco (só
muda o rótulo de uma partição que o próprio técnico acabou de formatar
segundos antes), ação imediata (não é job em segundo plano).

**2. Gerar `autounattend.xml` pro Windows (`buildWindowsAutounattendXml`)**
— só aparece quando o esquema é "Windows com UEFI" e a escolha foi
"instalar sistema operacional". Gera (nunca executa, nunca escreve em
disco nem em pendrive nenhum) o texto de um arquivo de resposta do
Windows Setup, pro técnico baixar e copiar manualmente pra raiz do
MESMO pendrive do instalador. Isso sim faz o Windows Setup pular a
pergunta de "em qual partição instalar" e instalar direto na partição
já criada/formatada.

**Risco real, não hipotético, documentado dentro do próprio arquivo
gerado**: o `DiskID` que o Windows PE usa pra identificar o disco (0,
1, 2...) é a ordem de enumeração NAQUELE boot específico — pode mudar
por cabo SATA, ordem de boot na BIOS/UEFI, modo do controlador
(AHCI/RAID). Não tem garantia de bater com o que este servidor via
Linux considera "o disco". Por isso o arquivo sempre vem com um aviso
grande no topo mandando o técnico confirmar o disco certo (por modelo/
número de série/tamanho, todos informados no aviso) via
`Shift+F10 → diskpart → list disk` ANTES de deixar a instalação
prosseguir, e editar o `DiskID` se não bater. O arquivo também só cuida
do alvo da instalação — não configura conta de usuário, chave de
produto, idioma/região nem pula outras telas do instalador.

**Honestidade**: o módulo de rotulagem foi validado só com o caminho de
erro (partição inexistente) — nenhuma das ferramentas de rótulo
(`e2label`/`ntfslabel`/`xfs_admin`/`exfatlabel`/`fatlabel`) foi
exercitada contra uma partição real ainda. O `autounattend.xml` gerado
tem a estrutura XML conferida visualmente (bem formado, segue o schema
de unattend do Windows pelas tags documentadas pela Microsoft), mas
**nunca foi testado rodando de verdade contra um Windows Setup real** —
o usuário foi avisado desse risco (DiskID instável) antes de pedir a
implementação, e o arquivo gerado carrega o mesmo aviso. Trate como um
rascunho que precisa de verificação manual, não como "pronto pra
confiar cegamente", igual ao roteiro de RAID1 (`lib/raidMirror.js`).

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

**Corrigido: "Esquema de disco não suportado" em disco GPT de verdade**.
A detecção de tabela de partições lia o texto normal do `parted ...
print` ("Partition Table: gpt") com um regex em inglês — só que esse
texto é **traduzido** conforme o idioma configurado no servidor
(`LANG`/`LC_ALL`); num servidor com locale em português/espanhol/etc.,
`parted` respondia a mesma informação com outras palavras, e o regex
em inglês não batia — fazendo o gerador recusar um disco que, na
verdade, podia ser GPT perfeitamente válido. Trocado pra `parted -m`
(modo máquina: campos fixos separados por `:`, nunca traduzidos,
documentado como estável pelo próprio `parted`) tanto pra ler o tipo de
tabela quanto pra reconhecer a partição EFI — elimina essa classe de
falso negativo. Se o disco do sistema **realmente** não for GPT (MBR/
`msdos` de verdade, não é incomum em VPS mais antigas com boot BIOS em
vez de UEFI), a mensagem de erro agora também informa o tipo de tabela
detectado de verdade, em vez de um "não suportado" genérico — mas a
limitação em si (gerar roteiro só pra sistema GPT) continua de pé; dar
suporte a MBR precisaria de outra lógica inteira (`sfdisk` em vez de
`sgdisk`, `grub-install --target=i386-pc` em vez de UEFI, sem partição
EFI no layout) — não implementado.

**Aprendido executando o roteiro de verdade contra um servidor real do
usuário** (primeira vez que esse roteiro foi seguido passo a passo, ao
vivo) — três ajustes:

1. **Checagem de ferramentas instaladas, antes de gerar o roteiro.**
   `mdadm` não veio instalado por padrão nesse servidor (comum — RAID
   não é uso frequente numa VPS), e só foi descoberto no passo 3,
   depois do disco já estar reparticionado pelos passos 1/1b/2. Agora
   `buildMirrorRunbook()` confere `sgdisk`, `partprobe`, `udevadm`,
   `mkfs.fat`, `mkfs.ext4`, `mdadm`, `rsync`, `blkid` e `chroot` logo no
   início, e recusa gerar o roteiro (com a lista exata do que falta e
   sugestão de `apt install`) em vez de deixar o técnico descobrir no
   meio do procedimento.
2. **`partprobe`/`udevadm settle` depois do `sgdisk` no passo 1/1b** —
   mesmo problema já corrigido na ferramenta de particionar comum
   (`lib/diskPartition.js`): sem isso, o kernel pode continuar
   enxergando a tabela de partições antiga por mais alguns instantes
   depois do `sgdisk` escrever a nova, e o `mkfs` seguinte falhar ou
   mexer no nó errado. Também passou a incluir `sgdisk -e` (recomendado
   pelo próprio `sgdisk` depois de clonar tabela com `-R` entre dois
   discos — reposiciona o cabeçalho de backup do GPT pro fim de
   verdade do disco, corrigindo um aviso real visto em produção quando
   os dois discos, mesmo "do mesmo tamanho", tinham contagem de setores
   levemente diferente).
3. **Aviso embutido no passo 3** sobre o `mdadm --create` perguntar
   interativamente "Continue creating array?" quando a partição alvo já
   teve um sistema de arquivos formatado nela antes (ex.: o técnico
   particionou o disco pelo painel antes de começar o roteiro de RAID,
   como no caso real que motivou isso) — responder "y" é o esperado,
   mas sem o aviso o técnico fica sem saber se deve confirmar.

**Honestidade**: os três ajustes acima vieram de uma execução real,
completa até o passo 3, contra o servidor de produção do usuário — não
é mais só teoria/documentação padrão. Os passos 4 em diante (cópia
rsync, chroot, bootloader, reinicialização) ainda não foram confirmados
executando de ponta a ponta.

**Mais dois ajustes, vindos de continuar a mesma execução real até o
passo 4/5**:

4. **Cópia em duas passadas (4a/4b/4c) em vez de "parar tudo, copiar,
   religar"**. No caso real que motivou isso, o servidor tinha 23
   containers Docker rodando (incluindo 5 bancos de dados — Postgres,
   MariaDB, Mongo — e uma plataforma de deploy, Coolify, gerenciando
   parte deles), e o jeito antigo (parar tudo, copiar ~85GB, religar)
   significava uma parada total de serviço do tamanho do tempo de cópia
   inteiro. Agora o roteiro faz uma primeira cópia com tudo rodando
   (sem downtime), só então para os containers, e faz uma segunda
   passada rápida (só as diferenças, com `--delete`) — o downtime fica
   do tamanho da segunda passada, não da cópia inteira. Também trocou o
   jeito de parar/religar: em vez de supor caminhos de
   `docker-compose.yml` (que nem sempre existem de forma acessível —
   containers geridos por uma plataforma tipo Coolify não têm um
   arquivo óbvio), salva a lista de containers rodando num arquivo
   (`docker ps -q > /root/containers-parados.txt`) e usa `docker stop`/
   `docker start` nela — funciona igual não importa como os containers
   foram criados.
5. **Corrigido: `mount --bind` falhando com "ponto de montagem não
   existe"** no passo 5. O `rsync` do passo 4 exclui `/dev`, `/proc`,
   `/sys`, `/tmp`, `/run`, `/mnt`, `/media` da cópia — mas excluir esses
   caminhos também excluiu as PASTAS vazias em si, não só o conteúdo
   delas, então elas nunca existiam dentro de `/mnt/newroot` pro
   `mount --bind` do passo 5 montar em cima. Corrigido adicionando um
   `mkdir -p` dessas pastas vazias logo depois de montar o array,
   dentro do próprio passo 4a — pegadinha clássica de clonar sistema via
   `rsync`, documentada até nas wikis do Debian/Arch, que o roteiro não
   tinha coberto antes.

**Honestidade (atualizada)**: a execução real avançou até o meio do
passo 5 (UUID do array confirmado, prestes a editar o fstab) — passos
5 (resto), 6, 7 e 8 ainda não foram confirmados executando de ponta a
ponta.

6. **Corrigido: `grub-install` sem a ESP de verdade montada**. O
   `/boot/efi` é uma partição separada (`fat32`); o `rsync` só copia os
   ARQUIVOS que estavam visíveis ali, não deixa uma partição de verdade
   montada no destino — então rodar `grub-install` direto, sem montar a
   ESP de cada disco antes, ia falhar (ou pior, escrever num diretório
   comum do ext4 em vez da partição EFI de verdade, deixando o disco
   silenciosamente não-bootável). Corrigido: o passo 5 agora monta a
   ESP do disco original (`${sysDevice}1`), instala o bootloader nela,
   desmonta, monta a ESP do disco novo (`${targetDevice}1`), instala o
   bootloader nela também, desmonta, e remonta a do disco original por
   último (pra bater com o que o `/etc/fstab` da nova raiz espera no
   próximo boot). Achado ANTES de rodar o `grub-install` de verdade —
   ainda não confirmado executando.

**Honestidade (atualizada de novo)**: passo 5 completo (incluindo o
ajuste do EFI acima) ainda não foi confirmado executando de ponta a
ponta — a correção foi feita a partir do raciocínio sobre como
`grub-install`/ESP funcionam, não de um erro já visto em produção como
os itens 1-5 acima. Reboot (passo 6) e o que vem depois continuam sem
nenhuma confirmação real.

7. **Adicionado `--removable` em cada `grub-install`**. Confirmado em
   execução real: o `grub-install` dentro do chroot terminou sem erro
   fatal nos dois discos ("Instalación terminada. No se notificó ningún
   error."), mas avisou `"EFI variables cannot be set on this
   system... You will have to complete the GRUB setup manually"` — a
   causa é o `mount --bind /sys` (não `--rbind`) não carregar o
   `efivarfs` que fica montado dentro de `/sys/firmware/efi` pro
   chroot, então o grub-install não consegue registrar a entrada de
   boot na NVRAM da UEFI de dentro do chroot (confirmado comparando:
   `efivarfs` aparece montado no HOST via `mount | grep efi`, mas o
   aviso só acontece pro `grub-install` de dentro do `chroot`). Isso
   por si só não impede o boot (os arquivos do bootloader já foram
   gravados certos na ESP), mas entradas de NVRAM são por disco e nada
   confiáveis nesse cenário (RAID1, disco pode sumir/trocar de
   posição) — `--removable` grava uma cópia extra no caminho padrão
   (`EFI/BOOT/BOOTX64.EFI`) que a BIOS/UEFI acha sozinha mesmo sem
   nenhuma entrada NVRAM, prática recomendada justamente pra esse
   cenário. Rodado em cada disco **além** do `grub-install` normal (sem
   `--removable`), não no lugar dele.

**Honestidade (passo 5, versão final)**: a execução real confirmou que
os dois `grub-install` terminam sem erro fatal e o aviso de EFI
variables é esperado/não-bloqueante nesse contexto — mas o
`grub-install --removable` adicional em si (a correção deste item) só
foi orientado ao usuário, ainda não confirmado rodando. Reboot (passo
6) em diante continua sem nenhuma confirmação real.

8. **Corrigido: boot travando em emergency mode se um dos dois discos
   do RAID sair do ar**. Bug real, batido em produção numa execução
   completa: depois do passo 7 (array sincronizado, `[2/2] [UU]`,
   confirmado por reboot real), o usuário desconectou o disco original
   do sistema por um motivo à parte (fazer espaço físico pra reconectar
   um terceiro disco, de dados, que havia sido removido antes de
   começar o RAID) — e o servidor não voltou a bootar, caindo em
   `dracut` emergency mode. Causa raiz: a linha do `/boot/efi` no
   `/etc/fstab` aponta pra UUID da ESP de **um disco só** (os dois
   discos de um RAID1 EFI têm ESPs separadas — não fazem parte do
   array, não são espelhadas) e **não tinha `nofail`**, diferente de
   toda outra linha extra do fstab. Sem `nofail`, essa é uma montagem
   obrigatória: se a UUID dela não existir nesse boot (porque o disco
   dono daquela ESP está desconectado), o systemd trava esperando
   indefinidamente (confirmado via `systemctl list-jobs` dentro do
   `dracut`: o job do device ficava em `running` sem nunca resolver, e
   todos os outros 13 jobs atrás dele em `waiting`). Pior: como o
   `update-initramfs -u` do passo 5 roda DEPOIS da edição do fstab, essa
   exigência fica "fotografada" dentro do próprio initramfs — corrigir
   o `/etc/fstab` manualmente depois (o que foi tentado durante o
   incidente, editando direto de dentro do shell de emergência) **não
   teve efeito nenhum**, porque o initramfs carregado pelo GRUB já
   tinha a versão antiga congelada dentro dele. A única saída real foi
   reconectar o disco original (restaurando a UUID que faltava) e
   deixar bootar normal de novo. Corrigido na fonte: o passo 5 agora
   roda um `sed` que adiciona `nofail` na linha do `/boot/efi` logo
   depois da edição da linha da raiz e **antes** do
   `update-initramfs -u`, pra essa exigência nunca mais ser gravada
   dentro do initramfs.

**Honestidade (item 8)**: a causa raiz e o comportamento de trava foram
confirmados numa execução real completa (não é suposição) — inclusive
o detalhe de que corrigir só o `/etc/fstab` sem regenerar o initramfs
depois não resolve. A correção em si (o `sed` automático, rodando antes
do `update-initramfs -u`) ainda não foi testada executando o roteiro
inteiro de novo do zero; o que foi confirmado é que, aplicada
manualmente nesse mesmo formato, a edição resolve o fstab corretamente
(testado isoladamente contra um fstab de exemplo, não dentro do roteiro
completo).

**Honestidade (item 8, verificação pós-correção — IMPORTANTE, não
confirmado)**: depois do incidente, rodamos `update-initramfs -u -k all`
no servidor real já com o `/etc/fstab` corrigido (`nofail` no
`/boot/efi`), e inspecionamos o initramfs gerado
(`lsinitramfs`/`unmkinitramfs`). Dois achados, um bom e um inconclusivo:

- **Bom**: a unidade `systemd` do dispositivo da ESP antiga passou a
  aparecer em `initrd.target.wants/` (dependência opcional), não mais
  em `initrd.target.requires/` (obrigatória) — sinal de que o `nofail`
  foi reconhecido pelo gerador do dracut.
- **Inconclusivo/preocupante**: o drop-in de timeout dessa mesma
  unidade (`.device.d/timeout.conf`) mostra `JobTimeoutSec=infinity` e
  `JobRunningTimeoutSec=infinity` — ou seja, o job de esperar aquele
  dispositivo não expira sozinho nunca, só vira "opcional" no sentido
  de não derrubar o boot inteiro se *falhar*, mas não há garantia,
  confirmada por leitura estática do initramfs, de que algum mecanismo
  do dracut cancele esse job sozinho dentro de um tempo razoável. No
  incidente real, foi precisamente isso que travou o boot por mais de
  5 minutos até cancelarmos o job manualmente
  (`systemctl cancel <job>`) — e não foi possível confirmar, só lendo
  arquivos, se esse comportamento mudou de fato com o `nofail` ou se o
  mesmo travamento aconteceria de novo numa queda real do disco.

**Conclusão honesta**: o `nofail` resolve a causa raiz identificada
(dependência deixa de ser obrigatória), mas **não foi validado com um
teste físico real pós-correção** (desconectar um dos discos e bootar
só com o outro). Até esse teste acontecer, a correção deve ser tratada
como "aplicada e logicamente correta, mas não comprovada na prática".
Recomendação registrada: fazer esse teste físico num momento planejado,
de baixo risco — não em seguida de um incidente já exaustivo como o de
hoje.

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

### Preparar disco "not_use" (roteiro de volume, não automação)

Cada disco do NAS com status `not_use` (presente, mas fora de qualquer
pool/volume — o caso normal de um disco recém-colocado) ganhou um botão
"Preparar volume" na tabela de discos. Ele **não mexe no NAS** — gera um
roteiro passo a passo (`lib/nasVolumeGuide.js`) pra seguir manualmente
na própria tela do Storage Manager do DSM: criar o Storage Pool (tipo
"Basic", só com aquele disco) e depois o Volume (Btrfs por padrão) em
cima dele.

**Por que roteiro em vez de criar o volume direto pela API do DSM**:
diferente da leitura de discos e do desligamento (API já usada neste
módulo, mesmo sem confirmação em produção ainda), criar Storage
Pool/Volume usa uma parte da API do Synology cujos parâmetros exatos eu
não tenho como validar sem acesso de teste ao DSM real — e essa é uma
operação que formata um disco inteiro. Mesmo princípio já usado no
espelhamento RAID1 do disco de sistema (`lib/raidMirror.js`): ação de
risco alto sem como confirmar vira geração de roteiro pra execução
manual, nunca automação às cegas. Aqui o "manual" é clicar na própria
tela oficial do fabricante (Storage Manager), não digitar comando algum
— então o risco de seguir o roteiro errado é bem menor do que inventar
uma chamada de API não testada.

O endpoint (`GET /api/nas/disks/:id/prepare-volume-guide`) reconfere o
disco contra o DSM de novo na hora (nunca confia só no id que veio da
tela) e recusa gerar o roteiro se o status não for mais `not_use` —
evita montar instrução pra apagar um disco que passou a ter dado entre
o carregamento da tabela e o clique no botão.

**Honestidade**: essa funcionalidade (texto do roteiro, endpoint, botão
na tabela) foi validada só por leitura de código e por chamar
`buildVolumePrepGuide()` com dado de disco de exemplo — **nunca
confirmada contra um Synology real nem seguindo o roteiro até o fim**.
Como é um roteiro pra fazer na tela oficial do DSM (não um comando que
o painel executa), o risco de dano por um texto impreciso é baixo, mas
ainda vale conferir no seu DSM se os nomes de tela ("Storage Pool",
"Create", "Basic") batem com a versão instalada antes de confiar
cegamente — telas do DSM mudam nome ocasionalmente entre versões
maiores.

### Saúde do RAID1 (card com alerta visual)

Novo card "Saúde do RAID1" no painel principal (`lib/raidHealth.js`),
lendo `/proc/mdstat` (arquivo de kernel, leitura liberada pra qualquer
usuário — não precisa de root, diferente de `mdadm --detail`) a cada
minuto. Mostra, por array: saudável/sincronizando/degradado, quantos
discos ativos de quantos esperados, e qual membro específico está
falho (se houver). O card some sozinho se o servidor não tiver nenhum
array RAID configurado.

**Sobre o "aviso"**: este painel não tem nenhum mecanismo de e-mail/
webhook implementado ainda (nada no disk-monitor tem, hoje) — o aviso é
visual, no próprio painel. Quando o estado de um array muda (fica
degradado, ou volta a sincronizar), isso também fica registrado no log
do serviço (`journalctl -u disk-monitor`), pra aparecer mesmo se
ninguém estiver com o painel aberto no momento. Alertas por e-mail
ficam pra uma fase futura (teria que entrar numa lista com as outras
integrações já listadas abaixo, tipo backup pra nuvem).

**Honestidade**: o parser de `/proc/mdstat` (`parseMdstat`) foi testado
contra três formatos reais capturados de uma execução real desta sessão
(array saudável `[UU]`, degradado `[_U]`, e sincronizando com `%` de
progresso) — os três interpretados corretamente. O endpoint
(`/api/raid/status`) e a integração com o painel (card, cores, i18n)
foram validados só por leitura de código e checagem de sintaxe — ainda
não confirmados contra o servidor rodando de verdade (não tive motivo
pra simular um array degradado de propósito só pra testar isso, já que
o servidor de produção está saudável agora).

### Desmontar disco pelo painel (sem terminal)

Até aqui, o painel sabia MONTAR uma partição sem ponto de montagem
(`lib/diskMount.js`), mas não tinha o inverso — desmontar algo que já
está montado só dava pra fazer via `umount` direto no terminal. Isso
quebrava o objetivo do produto (técnico de campo sem precisar de linha
de comando pra nada), e também bloqueava um passo real necessário:
antes de apagar/reparticionar um disco com conteúdo, ele precisa estar
desmontado primeiro.

Agora cada partição montada (card de disco físico) ganha um botão
"Desmontar", com confirmação (`window.confirm`, igual já usado pra
apagar usuário). Duas proteções:

- **Lista fixa de pontos de montagem essenciais do SO** (`/`, `/boot`,
  `/boot/efi`, `/usr`, `/var`, `/etc`, `/proc`, `/sys`, `/dev`, `/run`,
  `/home`) — nunca aceita desmontar nenhum desses, nem que o cliente
  mande (checado no servidor, não só escondido na tela).
- Busca por `bd.mount === mountPoint` em vez de filtrar por tipo de
  dispositivo — mesma lição do bug crítico já corrigido na checagem de
  particionamento: um disco com sistema de arquivos gravado DIRETO nele
  (sem partição) precisa ser encontrado igual a um normal.

**Honestidade**: a lógica (`previewUnmount`/`executeUnmount`) foi
testada com `si.blockDevices()` simulado cobrindo os três casos que
importam — desmontar um disco sem partição (tipo `/mnt/disco03`),
recusar a raiz do sistema, e recusar um ponto de montagem inexistente
— os três corretos. A integração com o painel (botão, confirmação,
toast) foi validada só por leitura de código/sintaxe, ainda não
confirmada clicando de verdade contra um servidor rodando.

### App desktop (Electron) — sem abrir pelo navegador

Pedido do cliente: o técnico não deve precisar abrir um navegador e
digitar `http://localhost:8091` — a instalação tem que parecer um
programa de verdade, com janela própria, não "um site". `electron` já
estava como devDependency no `package.json` (preparação que tinha
ficado pela metade, sem nenhum arquivo usando ele) — agora tem
`electron-main.js` na raiz do módulo, que abre uma `BrowserWindow`
(sem barra de menu, sem nada de cara de navegador) carregando o mesmo
servidor Express de sempre (`require("./server.js")` — zero duplicação
de lógica, é o mesmo `server.js` usado na instalação como serviço
systemd).

Rodar: `npm run desktop` (roda `electron electron-main.js`) dentro da
pasta do módulo.

**Modelo de acesso, confirmado com o cliente antes de implementar**: é
um app local — roda DIRETO na máquina/servidor onde foi instalado, o
técnico abre e usa na tela daquela máquina (local ou por acesso remoto
tipo RDP/VNC). Não é um cliente separado rodando no computador do
técnico conectando por rede num servidor remoto — isso ficou
explicitamente descartado nessa conversa.

**Ainda falta, fora do escopo desta mudança**:
- **Empacotamento num instalador de verdade** (`.exe`/`.AppImage`/
  `.dmg` com ícone, sem precisar de `npm`/`node_modules` instalado na
  máquina do cliente) — isso precisa de `electron-builder` ou
  `electron-packager` (nenhum dos dois está configurado ainda). Hoje
  `npm run desktop` só funciona rodando de dentro do projeto com as
  dependências instaladas — não é o instalador final que vai pra mão
  do técnico.
- Decidir se a distribuição por `pkg` (binário CLI/serviço, usada pelo
  systemd) continua existindo em paralelo pra quem quiser rodar sem
  interface nenhuma (ex.: servidor sem monitor físico conectado), ou
  se o Electron substitui de vez esse caminho.

**Honestidade**: o binário do Electron foi confirmado funcionando
(`electron --version`, baixou e executou de verdade) — mas **a janela
em si nunca foi vista abrindo**, porque este ambiente de
desenvolvimento roda como root e sem tela (display), e o Chromium
embutido no Electron recusa rodar como root sem a flag
`--no-sandbox` (trava de segurança esperada, não é bug do código).
`electron-main.js` foi validado só por leitura/sintaxe. Preciso que
você rode `npm run desktop` numa máquina de verdade (com tela, usuário
normal) e confirme se a janela abre e carrega o painel certinho antes
de eu considerar isso confirmado.

**Corrigido: `electron` estava em `devDependencies`, nunca ia pra
produção**. Bug real, pego na primeira tentativa de testar em
produção: o `update.sh` (instalador/atualizador usado no servidor de
verdade) roda `npm install --omit=dev` — ou seja, o Electron nunca era
instalado na cópia que o servidor realmente usa, só no ambiente de
desenvolvimento. `npm run desktop` ia falhar (binário do Electron
inexistente) em qualquer instalação real. Corrigido: `electron` movido
pra `dependencies`. **Efeito colateral a saber**: o Electron é um
download grande (~100MB+) — toda instalação/atualização a partir daqui
baixa isso, mesmo em servidores que nunca vão rodar o modo desktop (ex.:
quem continuar usando só o serviço systemd sem interface). Isso é uma
troca consciente dado o pedido explícito do cliente pelo app desktop;
se algum dia fizer sentido tornar isso opcional (ex.: um pacote
separado só pra quem quer o modo desktop), fica pra decisão futura.

**Corrigido: `update.sh` falhava com erro confuso rodado de dentro da
própria instalação**. Bug real, pego em produção na mesma tentativa:
rodar `installers/linux/update.sh` de dentro de `/opt/disk-monitor`
(em vez de um checkout do repositório) fazia a detecção de origem do
script apontar pra ele mesmo, e o `cp -r` subsequente tentava copiar a
pasta por cima dela mesma — `cp: '...' y '...' son el mismo fichero`,
sem nenhuma explicação do motivo real. Corrigido: o script agora checa
se origem e destino são o mesmo caminho ANTES de tentar copiar, e
explica exatamente o que fazer (`git pull` no checkout + rodar o script
de lá) em vez de deixar o `cp` falhar com uma mensagem técnica.

### Ícone no desktop (modo aplicativo)

Faltava a última parte do pedido do cliente: ter o Electron funcionando
(`npm run desktop`) não adianta nada se o técnico ainda precisa abrir
terminal e digitar o comando — o objetivo era zero linha de comando.
Agora `install.sh` e `update.sh` chamam
`installers/linux/create-desktop-icon.sh` no final, que:

- Gera `$INSTALL_DIR/desktop-launcher.sh` (um wrapper que entra na
  pasta certa e chama `./node_modules/.bin/electron electron-main.js`
  — não depende de `npm` estar no `PATH` de quem clicar no ícone).
- Cria um arquivo `.desktop` (padrão freedesktop.org) apontando pro
  launcher e usando `public/favicon.png` como ícone, copiado tanto pro
  menu de aplicativos (`~/.local/share/applications/`) quanto pro
  Desktop de verdade (`~/Desktop/`) do usuário.
- Descobre o usuário certo via `$SUDO_USER` (o instalador roda como
  root via `sudo`, mas o ícone precisa ir pra quem tem sessão gráfica,
  não pro `/root`) — se não detectar (ex.: instalado logado direto como
  root, sem `sudo`), avisa e pula sem quebrar o resto da
  instalação/atualização.
- Tenta marcar o atalho como "confiável" via `gio` (evita o aviso
  padrão do GNOME de "launcher não confiável" na primeira vez) — se
  `gio` não existir, só avisa, não é erro.

**Honestidade**: a lógica foi validada por leitura de código e
checagem de sintaxe (`bash -n`) nos três scripts — ainda não foi
confirmada rodando de verdade (criando o ícone, clicando nele, vendo o
app abrir) contra um servidor real. Só Linux (GNOME) considerado até
aqui — Windows/macOS ficam pra depois, se vier pedido.

### CRÍTICO — Corrigido: "Montar" oferecia partição membro de RAID ativo

Bug real, batido em produção no pior disco possível: o próprio disco do
sistema (RAID1). `/dev/sdb2` (tipo `linux_raid_member`, membro ativo do
array `/dev/md0` que segura a raiz do servidor) aparecia na seção
"Partições sem montar", com o botão "Montar" disponível — porque quem
fica "montado" num RAID é o ARRAY (`/dev/md0`), nunca a partição membro
diretamente, então `listMountablePartitions()` (que só olhava
`!bd.mount`) via essa partição como livre. A etapa de apagar/criar/
formatar já tinha proteção contra isso por acaso (checagem de
`holders` em `/sys/class/block`, implementada antes pro caso de LUKS/
RAID aberto de formatações antigas) — mas o "Montar" nunca tinha essa
checagem.

Corrigido: `listMountablePartitions()` agora exclui qualquer partição
com um `holder` ativo no kernel (RAID, LUKS, LVM — não só RAID
especificamente), e `checkEligibility()` do mount ganhou a mesma
checagem como segunda camada de defesa, caso alguém tente montar uma
partição com holder passando o device direto (sem passar pela lista).
Mesma função `partitionHolders()` já usada em `diskPartition.js`,
duplicada aqui (mesmo padrão de módulos independentes já usado nesse
painel).

**Honestidade**: a causa raiz foi confirmada contra produção (captura
de tela real mostrando `/dev/sdb2` com botão "Montar" disponível). A
correção foi validada com `si.blockDevices()` simulado reproduzindo
exatamente esse cenário (partição RAID sem mount + holder `md0`) contra
as duas funções (`listMountablePartitions` e `previewMount`) — as duas
corretas: a partição RAID sumiu da lista, e uma tentativa direta de
montar o device foi recusada com a mensagem explicando o motivo. Não
foi confirmado clicando de verdade no painel contra o servidor real
(nenhuma ação foi executada nesse disco durante a investigação,
intencionalmente).

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
