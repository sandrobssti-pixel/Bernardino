# nas-panel — Painel do NAS

Módulo do `server-toolkit`: painel web **separado** do AtendeFlow pra
gerenciar o NAS (Synology) usado nos backups da Confiança Technologies —
navegar pelas pastas, baixar e enviar arquivos, sem precisar abrir o DSM
(painel do próprio Synology) pra tarefas do dia a dia.

Tem também uma segunda parte opcional, que fala direto com a API do
próprio Synology (DSM): ver status dos discos e desligar o NAS de
verdade — só aparece no painel se configurada (ver seção própria
abaixo), e é a única parte deste módulo com risco real (ação física,
irreversível remotamente).

Mesmo login com dois papéis do `disk-monitor` (compartilhado via
`toolkit-auth`): **administrador** (acesso completo, inclusive enviar
arquivos e desligar o NAS) e **visualizador** (só navega, baixa e vê o
status dos discos — nunca envia arquivo nem desliga nada).

## O que faz (e o que NUNCA faz)

Faz:
- Lista o conteúdo das pastas do NAS já montadas no servidor (via SMB,
  configuradas em `NAS_ROOTS` no `.env`).
- Baixa qualquer arquivo dessas pastas.
- Envia (upload) arquivo pra dentro delas — **só administrador**.
- (Opcional) Mostra o status de cada disco físico do NAS (saúde,
  temperatura, capacidade) e desliga o NAS — **só administrador**, via
  API do DSM.

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

## Discos e desligamento (integração com o DSM)

Opcional — sem essas variáveis no `.env`, essa parte do painel simplesmente
não aparece (o navegador de arquivos continua funcionando normal):

```bash
DSM_HOST=192.168.3.21
DSM_PORT=5001
DSM_HTTPS=true
DSM_USER=
DSM_PASSWORD=
#DSM_ALLOW_SELF_SIGNED=true   # descomente se o DSM usa certificado autoassinado (comum em rede local)
```

Use uma conta **administradora do DSM** dedicada a isso — nunca a conta
de serviço `atendeflow-sync` usada pro compartilhamento SMB (são coisas
diferentes: uma é usuário de pasta compartilhada, a outra precisa
conseguir logar no próprio painel do DSM).

**Duas travas de segurança no desligamento**: só administrador do painel
(`requireRole("admin")`) **e** precisa digitar a frase exata `DESLIGAR`
na tela de confirmação antes do botão liberar — nunca só um clique.

> ⚠️ **Desligar é uma ação física, irreversível remotamente**: sem
> Wake-on-LAN configurado no NAS, a única forma de ligar de novo é
> apertando o botão físico no próprio aparelho. Pense bem antes de usar.

### Honestidade sobre o que foi testado

`lib/synologyApi.js` segue a documentação pública da API do Synology
(`SYNO.API.Auth`, `SYNO.Storage.CGI.Storage`, `SYNO.Core.System`) — a
mesma usada por ferramentas conhecidas da comunidade (ex.: a integração
Synology DSM do Home Assistant). **Não foi testada contra um Synology
de verdade** nesta sessão de desenvolvimento (sem acesso a um NAS real
pra validar). O que **foi** testado diretamente: o painel sem DSM
configurado (a seção some, resto do painel funciona normal), a trava de
confirmação por frase exata (recusa com frase errada, mesmo antes de
tentar falar com o DSM), e o tratamento de erro de conexão (falha
graciosamente com uma mensagem clara, sem derrubar o resto do painel).
Teste contra o DSM real com cuidado antes de confiar em produção —
comece só lendo os discos, deixe o desligamento por último.

## Segurança — IMPORTANTE

Mesma regra do `disk-monitor`: **nunca** deixe a porta 8092 aberta
direto pra internet — só via túnel SSH ou Nginx com allowlist de IP.
Esse painel dá acesso de leitura/escrita a arquivo de verdade do NAS
(inclusive backups do AtendeFlow), então merece o mesmo cuidado.
