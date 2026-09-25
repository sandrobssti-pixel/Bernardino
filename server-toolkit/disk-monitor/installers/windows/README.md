# Instalação no Windows

Duas formas de instalar, igual no Linux: **terminal** (PowerShell) ou
**gráfico** (assistente `.exe`). As duas terminam no mesmo lugar: o
disk-monitor rodando como **serviço do Windows** (inicia sozinho quando
o computador liga, sem precisar abrir nada manualmente).

> ⚠️ Esta sessão rodou inteira num container Linux, sem acesso a
> Windows. O que **foi** validado: o `disk-monitor.exe` compila de
> verdade a partir daqui (`npm run build:win` gerou um `.exe` Windows de
> ~40MB com sucesso — o `pkg` cross-compila sem precisar de Windows), e
> o motor interno (leitura de disco, limpeza) usa bibliotecas
> multiplataforma testadas no Linux. O que **não** foi validado por
> falta de uma máquina Windows: rodar o `.exe` de verdade, o
> `install.ps1`, o `winsw.exe` registrando o serviço, e o instalador
> gráfico compilado. Reporte qualquer erro que aparecer ao testar.

## Pré-requisito único: WinSW

O Windows não sabe rodar um `.exe` qualquer como serviço sozinho (ele
precisa que o programa "converse" com o gerenciador de serviços de um
jeito específico) — por isso se usa o
**[WinSW](https://github.com/winsw/winsw)**, um "encapsulador" gratuito
e de código aberto, mantido pela comunidade .NET, que faz exatamente
isso pra qualquer executável.

1. Baixe a versão mais recente em
   `https://github.com/winsw/winsw/releases` — o arquivo chamado
   `WinSW-x64.exe` (ou `WinSW.NET4.exe` se o servidor for mais antigo).
2. Renomeie pra `winsw.exe`.
3. Coloque essa cópia dentro desta pasta (`installers/windows/`), junto
   dos outros arquivos, **antes** de instalar ou de compilar o
   instalador gráfico.

## Opção A — Instalar por terminal (PowerShell)

1. Gere o executável do disk-monitor (numa máquina com Node.js — pode
   ser este mesmo Linux, o `pkg` compila pra Windows sem precisar de
   Windows pra isso):
   ```
   cd server-toolkit/disk-monitor
   npm run build:win
   ```
   Isso cria `server-toolkit/dist/windows/disk-monitor.exe`.
2. Monte uma pasta com: `disk-monitor.exe`, a pasta `public/`, e o
   conteúdo desta pasta `installers/windows/` (incluindo o `winsw.exe`
   que você baixou). O script `package-for-new-server.sh` já faz esse
   pacote pra você.
3. Copie essa pasta pro servidor Windows novo (pendrive, rede, o que
   for mais fácil).
4. No servidor Windows, abra o **PowerShell como Administrador**
   (botão direito no menu Iniciar -> "Windows PowerShell (Admin)") e
   rode:
   ```powershell
   cd caminho\onde\voce\copiou\a\pasta
   Set-ExecutionPolicy -Scope Process Bypass -Force
   .\installers\install.ps1
   ```
5. Responda usuário/senha do administrador inicial quando pedido. O
   script instala em `C:\disk-monitor` e já registra e inicia o
   serviço.

Pra desinstalar: `installers\uninstall.ps1` (como Administrador).

## Opção B — Instalador gráfico (assistente `.exe`)

Esse caminho gera um único arquivo `DiskMonitorSetup.exe` que qualquer
pessoa (mesmo sem saber nada de terminal) instala com "Avançar,
Avançar, Concluir".

**Pré-requisito pra gerar o instalador** (só uma vez, não precisa
refazer pra cada servidor novo — o mesmo `DiskMonitorSetup.exe` serve
pra todos):

1. Instale o [Inno Setup](https://jrsoftware.org/isdl.php) (gratuito)
   numa máquina Windows, ou use `innosetup` via Wine num Linux/Mac (não
   testado nesta sessão — mais simples usar uma máquina Windows mesmo,
   ou uma VM).
2. Gere o executável do disk-monitor: `npm run build:win` (ver Opção A,
   passo 1) — pode rodar isso num Linux, o `pkg` cross-compila.
3. Baixe o `winsw.exe` (ver seção acima) e coloque dentro de
   `installers/windows/`.
4. Abra `installers/windows/disk-monitor.iss` no Inno Setup e clique em
   **Compilar** (ou `ISCC.exe disk-monitor.iss` pela linha de comando).
   Isso gera `Output\DiskMonitorSetup.exe`.

**Instalando num servidor novo**, a partir do `DiskMonitorSetup.exe`
gerado:

1. Copie o `DiskMonitorSetup.exe` pro servidor.
2. Dê duplo-clique (ele já pede elevação de Administrador sozinho).
3. Siga o assistente: escolha a pasta (padrão `C:\disk-monitor`),
   informe o usuário/senha do administrador inicial do painel, e
   Concluir.
4. O instalador já registra e inicia o serviço do Windows sozinho, e
   oferece abrir o painel no navegador ao final.

Pra desinstalar: Painel de Controle -> Programas -> "Disk Monitor" ->
Desinstalar (ou o atalho criado no menu Iniciar).

## Diferenças em relação ao Linux

- **Log de container Docker**: no Linux, a limpeza trunca log gigante
  de container Docker direto num caminho de arquivo conhecido
  (`/var/lib/docker/containers`). No Windows, o Docker Desktop guarda
  isso dentro de uma VM (WSL2/Hyper-V) sem um caminho de arquivo comum
  pra acessar pelo host — esse passo específico da limpeza fica "pulado"
  no Windows (aparece assim no histórico de limpezas do painel), mas o
  `docker system prune` (que é o que realmente libera mais espaço)
  continua funcionando normalmente nos dois sistemas.
- **Pasta temporária**: no Linux limpa `/tmp`; no Windows limpa a pasta
  de temporários do sistema (`%TEMP%`), automaticamente.
- **Disco monitorado**: no Linux, `/` por padrão; no Windows, a unidade
  do sistema (normalmente `C:\`) por padrão — dá pra mudar no `.env`
  (`MOUNT_PATH`).
