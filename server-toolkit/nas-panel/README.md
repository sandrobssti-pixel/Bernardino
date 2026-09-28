# nas-panel — Painel do NAS

Módulo do `server-toolkit`: painel web **separado** do AtendeFlow pra
gerenciar o NAS (Synology) usado nos backups da Confiança Technologies —
navegar pelas pastas, baixar e enviar arquivos, sem precisar abrir o DSM
(painel do próprio Synology) pra tarefas do dia a dia.

Mesmo login com dois papéis do `disk-monitor` (compartilhado via
`toolkit-auth`): **administrador** (acesso completo, inclusive enviar
arquivos) e **visualizador** (só navega e baixa, não envia nada).

## O que faz (e o que NUNCA faz)

Faz:
- Lista o conteúdo das pastas do NAS já montadas no servidor (via SMB,
  configuradas em `NAS_ROOTS` no `.env`).
- Baixa qualquer arquivo dessas pastas.
- Envia (upload) arquivo pra dentro delas — **só administrador**.

**Nunca**:
- Nunca acessa nada fora das pastas listadas em `NAS_ROOTS` — toda
  operação resolve o caminho real no disco (segue symlink, resolve `..`)
  e confirma que continua dentro da raiz permitida antes de ler ou
  escrever qualquer coisa (`lib/fileManager.js`).
- Nunca apaga nem renomeia arquivo (fora do escopo desta primeira
  versão — só leitura, download e upload).
- Nunca expõe a raiz do disco (`/`) nem pastas do sistema — só o que
  estiver explicitamente listado em `NAS_ROOTS`.

## Instalação

Mesmo modelo do `disk-monitor` (ver
[`../disk-monitor/README.md`](../disk-monitor/README.md) pros detalhes
gerais de instalação/atualização — a diferença é só a porta padrão
(8092 em vez de 8091) e a variável `NAS_ROOTS`).

```bash
cd ~/atendeflow/server-toolkit/nas-panel
npm install
cp .env.example .env
nano .env   # preencha SESSION_SECRET, DASHBOARD_USER/PASSWORD e NAS_ROOTS
node server.js
```

`NAS_ROOTS` é a lista de pastas permitidas, no formato
`"Rótulo:/caminho,Rótulo2:/caminho2"` — use os mesmos pontos de montagem
já configurados pro backup (`docs/MANUAL_TECNICO.md`, seção 38):

```bash
NAS_ROOTS="Backups:/mnt/nas-backup,Seafile:/mnt/nas-seafile"
```

## Segurança — IMPORTANTE

Mesma regra do `disk-monitor`: **nunca** deixe a porta 8092 aberta
direto pra internet — só via túnel SSH ou Nginx com allowlist de IP.
Esse painel dá acesso de leitura/escrita a arquivo de verdade do NAS
(inclusive backups do AtendeFlow), então merece o mesmo cuidado.
