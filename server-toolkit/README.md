# server-toolkit

Conjunto de ferramentas de operação de servidor da **Confiança
Technologies**, separado do AtendeFlow (não depende do app web nem do
banco dele). Pensado desde o início pra ser reaproveitado em qualquer
servidor novo que a empresa montar — **Linux ou Windows** — com o mesmo
modelo do VPS atual: cada módulo roda sozinho, pode virar um executável
único por sistema (sem precisar instalar Node.js no servidor novo),
instala por terminal ou por instalador gráfico nos dois sistemas, e tem
seu próprio README com o passo a passo.

## Módulos

- **[`disk-monitor/`](disk-monitor/README.md)** — monitor de uso de
  disco com painel visual (gráfico, tema claro/escuro, português/
  espanhol/inglês, com login admin/visualizador) e limpeza automática
  quando passar de um limite configurável (remove imagem/container
  Docker não usado, trunca log gigante, limpa pasta temporária — nunca
  mexe em volume nem em dado de cliente). Instala no Linux
  (`installers/linux/install.sh` ou `install-gui.sh`) e no Windows
  (`installers/windows/install.ps1` ou o assistente `DiskMonitorSetup.exe`).

## Bibliotecas compartilhadas

- **[`shared/auth/`](shared/auth/index.js)** (pacote local `toolkit-auth`)
  — login com dois papéis (administrador / visualizador), reaproveitável
  por qualquer módulo novo. Cada módulo que quiser login/permissões
  adiciona `"toolkit-auth": "file:../shared/auth"` no seu
  `package.json` (junto com `bcryptjs` e `cookie-session` como
  dependências diretas, e um `.npmrc` com `install-links=true` — ver
  o de `disk-monitor/` como referência) e monta as rotas de
  `/api/login`, `/api/logout`, `/api/me` e `/api/users` que o pacote já
  expõe prontas.

## Planejado (ainda não implementado)

Conversado com o cliente que o `server-toolkit` vai crescer aos poucos.
Próximos módulos previstos:

- **Painel de backup pra nuvem**: configuração visual (gráficos e
  botões) pra ligar o backup do NAS já existente
  (`backup-atendeflow.sh`, `backup-para-drive.sh`, `backup-seafile.sh`,
  na raiz do repositório) a provedores de nuvem de terceiros — Google
  Drive, Microsoft/OneDrive, Hostinger, etc.
- **Checklist/script de provisionamento** de servidor novo, replicando
  o modelo já rodando neste VPS (Docker, Coolify, montagem SMB do NAS,
  crontab de backup) — hoje esse conhecimento está só documentado no
  `docs/MANUAL_TECNICO.md` do AtendeFlow.
- **"Otimização do sistema operacional"** — item pedido pelo cliente,
  ainda sem escopo definido (o que exatamente otimizar). Não implementar
  sem alinhar o escopo antes: mexer em configuração de SO de servidor em
  produção sem saber exatamente o que mudar é arriscado.

## Convenção entre os módulos

- Cada módulo é independente: seu próprio `package.json`, suas próprias
  dependências, seu próprio `.env`. Um módulo nunca depende de outro.
- Todo módulo com painel web usa o login do `toolkit-auth` (administrador
  / visualizador) e documenta, no seu README, que a porta nunca deve
  ficar aberta direto pra internet (só via túnel SSH ou Nginx com
  allowlist).
- Todo módulo que mexe em disco/processo do servidor documenta bem
  claro, no seu README, o que a ação faz e — mais importante — o que ela
  **nunca** faz (nunca apagar volume Docker, nunca mexer em dado de
  cliente).
- Cada módulo pode ser empacotado como executável único (via `pkg`),
  pra instalar num servidor novo sem precisar clonar o repositório do
  AtendeFlow nem instalar Node.js lá.
