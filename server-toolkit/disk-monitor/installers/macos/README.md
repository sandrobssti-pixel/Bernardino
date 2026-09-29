# Instalação no macOS

Instalação por **terminal** (o mesmo padrão do Linux) — ainda não existe
um instalador gráfico `.pkg` pro macOS (ver "Por que não tem instalador
gráfico ainda" no final).

> ⚠️ Esta sessão rodou inteira num container Linux, sem acesso a
> hardware Apple. O que **foi** validado: o `disk-monitor-macos-x64` e
> o `disk-monitor-macos-arm64` compilam de verdade a partir daqui (o
> `pkg` cross-compila sem precisar de um Mac), e o motor interno
> (leitura de disco, limpeza) usa bibliotecas multiplataforma testadas
> no Linux. O que **não** foi validado por falta de uma máquina macOS:
> rodar o executável de verdade, a assinatura `codesign` automática do
> `install.sh`, e o serviço `launchd`. Teste com atenção antes de
> confiar em produção, e reporte qualquer erro que aparecer.

## Instalando

1. Gere os executáveis do disk-monitor (numa máquina com Node.js — pode
   ser este mesmo Linux, o `pkg` compila pra macOS sem precisar de um
   Mac pra isso):
   ```
   cd server-toolkit/disk-monitor
   npm run build:macos
   ```
   Isso cria `server-toolkit/dist/macos/disk-monitor-macos-x64` (Mac
   Intel) e `disk-monitor-macos-arm64` (Mac com chip Apple — M1/M2/M3...).
2. Monte uma pasta com os dois executáveis, a pasta `public/`, e o
   conteúdo desta pasta `installers/macos/`. O script
   `package-for-new-server.sh` já faz esse pacote pra você.
3. Copie essa pasta pro Mac de destino (pendrive, rede, AirDrop, o que
   for mais fácil).
4. No Mac, abra o **Terminal** e rode:
   ```bash
   cd caminho/onde/voce/copiou/a/pasta
   chmod +x installers/install.sh
   sudo ./installers/install.sh
   ```
5. Responda usuário/senha do administrador inicial quando pedido. O
   script:
   - Detecta sozinho se o Mac é Intel ou Apple Silicon, e usa o
     executável certo.
   - **Assina o executável automaticamente** (`codesign`, ad-hoc — sem
     custo, sem precisar de conta de desenvolvedor Apple). Isso é
     **obrigatório** em Mac com chip Apple (o sistema mata o programa
     na hora sem isso) e evita o aviso do Gatekeeper em qualquer Mac.
   - Instala em `/opt/disk-monitor` e registra o serviço via `launchd`
     (equivalente ao `systemd` do Linux) — inicia sozinho quando o Mac
     liga.

Pra atualizar depois: `sudo ./installers/update.sh` (mesmo padrão do
Linux, não mexe em `.env`/dados/usuários já configurados).

## Onde ficam as coisas

- Instalação: `/opt/disk-monitor`
- Configuração: `/opt/disk-monitor/.env`
- Logs: `/var/log/disk-monitor/disk-monitor.log` (e `.error.log`)
- Serviço: `/Library/LaunchDaemons/com.confiancatechnologies.disk-monitor.plist`

Comandos úteis:
```bash
tail -f /var/log/disk-monitor/disk-monitor.log
sudo launchctl list | grep disk-monitor
sudo launchctl unload /Library/LaunchDaemons/com.confiancatechnologies.disk-monitor.plist
sudo launchctl load -w /Library/LaunchDaemons/com.confiancatechnologies.disk-monitor.plist
```

## Se o Gatekeeper ainda bloquear na primeira vez

O `install.sh` já assina e libera o executável automaticamente, mas se
mesmo assim aparecer um aviso ("não é possível verificar o
desenvolvedor" ou parecido) ao tentar rodar manualmente:

1. **Painel do Sistema → Privacidade e Segurança** → procure o aviso
   sobre o disk-monitor perto do final da página → clique **"Permitir
   Assim Mesmo"**.
2. Ou pelo terminal: `xattr -cr /opt/disk-monitor/disk-monitor-macos`
   e rode `sudo ./installers/update.sh` de novo pra re-assinar.

## Por que não tem instalador gráfico ainda

Um instalador gráfico `.pkg` de verdade (duplo-clique, "Avançar,
Avançar, Concluir", igual o `DiskMonitorSetup.exe` do Windows) precisa
das ferramentas `pkgbuild`/`productbuild`, que **só existem dentro do
próprio macOS** — não dá pra gerar isso a partir de um Linux, diferente
do executável em si (que o `pkg` cross-compila numa boa). Pra ter esse
instalador gráfico no futuro, alguém precisa montá-lo rodando essas
ferramentas direto num Mac.

## Diferenças em relação ao Linux/Windows

- **Serviço**: usa `launchd` (arquivo `.plist`) em vez de `systemd`
  (Linux) ou `WinSW` (Windows) — mesmo conceito (inicia sozinho no
  boot, reinicia se cair), mecanismo diferente.
- **Log de container Docker**: igual ao Windows — o Docker Desktop pra
  Mac também guarda log dentro de uma VM interna, sem caminho de
  arquivo comum pro host acessar, então esse passo específico da
  limpeza fica "pulado" (aparece assim no histórico), mas
  `docker system prune` continua funcionando normal.
- **Pasta temporária**: limpa `$TMPDIR` (a pasta temporária de sistema
  do macOS), automaticamente.
- **Agrupamento de disco físico com partições** ("Discos físicos" no
  painel): funciona, mas o mapeamento partição → disco físico é menos
  testado no macOS que no Linux (ver README principal do disk-monitor).
- **Particionar/formatar disco**: **não implementado no macOS ainda**
  (só Linux por enquanto) — o painel mostra esse aviso se tentar usar.
