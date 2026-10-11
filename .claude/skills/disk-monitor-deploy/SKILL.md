---
name: disk-monitor-deploy
description: Use sempre que for instalar o disk-monitor (painel de monitoramento de disco/CPU/RAM/processos + limpeza automática, com navegador de NAS e API do Synology DSM opcionais) num servidor NOVO de cliente — Linux, Windows ou macOS. Diferente da skill `disk-monitor-dev` (que é sobre desenvolver/mexer no código do módulo) — esta é sobre levar o executável já pronto pra uma máquina de cliente, sem precisar clonar o repositório nem instalar Node.js lá. Roteiro genérico, reaproveitável em qualquer cliente.
---

# Implantar o disk-monitor num servidor de cliente

Duas formas de instalar — escolher pelo cenário:

- **Servidor NOVO de outro cliente** (não tem o repositório, não tem
  Node.js): usar o **pacote executável** (seção 2) — é o caminho
  recomendado, mais simples e rápido.
- **Máquina onde o repositório já está clonado** (ex.: o próprio VPS do
  AtendeFlow): instalar **a partir do código-fonte** (seção 3).

Pra **atualizar** uma instalação que já existe (não reinstalar do zero),
ver seção 5 — nunca repetir o passo a passo de instalação inteiro só pra
trazer uma versão nova de código.

## 0. Pedido ambíguo → perguntar antes de agir

Mesma regra do `CLAUDE.md` da raiz. Em especial, confirmar ANTES de
começar:
- Sistema operacional do servidor de destino (Linux/Windows/macOS) —
  muda totalmente o instalador a usar.
- Vai ligar o **painel do NAS** embutido (navegador de pastas +
  desligamento via API do Synology DSM)? Se sim, ver a skill
  `nas-setup` primeiro (o NAS precisa estar montado/acessível antes de
  configurar `NAS_ROOTS`/`DSM_*` aqui).
- Como vai acessar o painel depois de instalado — túnel SSH (padrão
  recomendado) ou outro método? **Nunca** expor a porta do painel direto
  pra internet (ver seção 4).

## 1. O que é (resumo pra não confundir escopo)

Ferramenta **separada** do app principal do cliente (não mexe no banco
nem no código dele) — roda sozinha, monitora disco/CPU/RAM/processos,
dispara limpeza automática configurável (nunca apaga volume Docker,
dado do app, nem backup do NAS), e tem painel web próprio com
login/papéis (administrador / visualizador).

## 2. Instalação num servidor NOVO (pacote executável, sem Node.js)

**No lado de onde o pacote é gerado** (pode ser este VPS atual ou
qualquer máquina com Node.js — o empacotador cross-compila os dois
sistemas a partir de qualquer um, não precisa ter Windows pra gerar o
`.exe`):

```bash
cd ~/<pasta-do-projeto>/server-toolkit/disk-monitor
./package-for-new-server.sh
```

Gera `server-toolkit/dist/linux/` e `server-toolkit/dist/windows/`,
cada um já com Node.js embutido (~40-80MB), pronto pra copiar.

**Linux** — copiar e instalar:

```bash
scp -r dist/linux <usuario>@<servidor-novo>:/tmp/disk-monitor-pkg
ssh <usuario>@<servidor-novo> 'sudo /tmp/disk-monitor-pkg/installers/install.sh'
```

**Windows** — ver `installers/windows/README.md` deste repositório
(precisa baixar o `winsw.exe` uma vez antes, único pré-requisito
externo). Instalador gráfico compilado também disponível
(`DiskMonitorSetup.exe`, de `installers/windows/disk-monitor.iss`).

**macOS** — `sudo installers/macos/install.sh` a partir do pacote
gerado (ver `installers/macos/README.md` pra assinatura automática do
executável).

**Checkpoint**: serviço rodando no servidor novo sem precisar clonar o
repositório inteiro nem instalar Node.js nele.

## 3. Instalação a partir do código-fonte (repositório já clonado)

```bash
cd ~/<pasta-do-projeto>/server-toolkit/disk-monitor
npm install
cp .env.example .env
nano .env   # trocar SESSION_SECRET, DASHBOARD_USER, DASHBOARD_PASSWORD
```

Testar manualmente primeiro, sem systemd, pra confirmar que sobe:

```bash
node server.js
# abrir http://<ip-do-servidor>:8091 (ou túnel SSH, ver seção 4)
```

Se estiver certo, `Ctrl+C` e instalar como serviço (sobrevive a reboot):

```bash
sudo cp disk-monitor.service /etc/systemd/system/disk-monitor.service
# ajustar WorkingDirectory/EnvironmentFile/ExecStart no arquivo copiado
# se o diretório do projeto não for o padrão
sudo systemctl daemon-reload
sudo systemctl enable --now disk-monitor
sudo systemctl status disk-monitor
```

```bash
journalctl -u disk-monitor -f   # logs em tempo real
```

**Checkpoint**: `systemctl status disk-monitor` mostra `active
(running)`, e o painel abre na porta configurada.

## 4. Segurança — nunca expor a porta direto pra internet

O painel roda `docker system prune` e mexe em arquivo do sistema —
mesmo com login, **nunca** deixar a porta (padrão 8091) aberta direto
pra internet. Duas opções:

1. **Túnel SSH** (recomendado, mais simples): do computador de quem vai
   acessar, `ssh -L 8091:localhost:8091 <usuario>@<servidor>`, abrir
   `http://localhost:8091` localmente.
2. **Nginx com autenticação/IP allowlist**, se precisar de acesso
   direto de um IP fixo conhecido (ex.: escritório do cliente).

Login (`DASHBOARD_USER`/`DASHBOARD_PASSWORD` do `.env`) é segunda
camada, não substitui essa proteção de rede. Essas duas variáveis só
valem no **primeiro boot** sem usuário nenhum cadastrado (viram o
administrador inicial, senha salva com hash em `data/users.json`) —
depois disso, todo gerenciamento de usuário é pela própria tela
**Usuários** do painel, e dá pra apagar essas linhas do `.env`.

## 5. (Opcional) Ligar o painel do NAS embutido

Sem nenhuma configuração extra, essa parte do painel **nem aparece**.
Pra ligar, no `.env`:

```bash
NAS_ROOTS="<Rótulo>:/mnt/<pasta-montada>,<Outro>:/mnt/<outra-pasta>"
#NAS_MAX_UPLOAD_MB=2048
#DSM_HOST=<ip-do-nas>
#DSM_PORT=5001
#DSM_HTTPS=true
#DSM_USER=<conta-administradora-dedicada>
#DSM_PASSWORD=<senha>
```

O NAS precisa estar montado/acessível no servidor **antes** disso — ver
skill `nas-setup` (inclui os problemas reais de permissão/fstab já
encontrados).

## 6. Atualizar uma instalação que já existe

**Nunca** repetir o passo a passo de instalação inteiro só pra trazer
código novo — `install.sh`/`install.ps1` pedem usuário/senha do admin
do sistema de novo desnecessariamente. Usar o `update.sh`
(Linux)/`update.ps1` (Windows)/`update.sh` (macOS) — nenhum dos três
mexe em `.env`, usuários cadastrados ou histórico já registrado:

**Linux** (de dentro do checkout já atualizado — `git pull`/`checkout`
da versão nova antes):

```bash
cd ~/<pasta-do-projeto>/server-toolkit/disk-monitor
sudo installers/linux/update.sh
sudo systemctl status disk-monitor   # confirma versão nova no log
```

**Windows** (de dentro da pasta com o `.exe` novo):

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\update.ps1
```

**macOS** (de dentro da pasta com o executável novo):

```bash
sudo installers/macos/update.sh
sudo launchctl list | grep disk-monitor   # confirma que subiu de novo
```

**Checkpoint**: log do serviço mostra a transição de versão (ex.: `v1.X
-> v1.Y`), e `.env`/histórico continuam exatamente iguais depois.

## 7. Checklist final

- [ ] Serviço rodando e sobrevive a reboot (systemd/serviço Windows/
      launchd habilitado, não só `node server.js` manual).
- [ ] `SESSION_SECRET`/`DASHBOARD_USER`/`DASHBOARD_PASSWORD` trocados
      do padrão do `.env.example` — gerados novos por cliente.
- [ ] Acesso ao painel só via túnel SSH (ou Nginx com allowlist) —
      porta NUNCA exposta direto pra internet.
- [ ] Discos/CPU/RAM aparecendo corretamente no painel (confirma que a
      varredura de hardware rodou sem erro).
- [ ] (Se aplicável) Painel do NAS aparecendo, com `NAS_ROOTS`/`DSM_*`
      configurados e funcionando.
- [ ] Limite de limpeza automática revisado com o cliente (padrão 85%
      pode não servir pra todo mundo).

## 8. Commit

Normalmente essa skill não gera commit (é instalação no servidor do
cliente). Pra mudanças no próprio código do módulo `disk-monitor`, usar
a skill `disk-monitor-dev` em vez desta.
