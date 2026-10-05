# Extensão do AtendeFlow (atalho de navegador)

Ícone na barra do navegador que abre o painel do AtendeFlow
(`https://atendeflow.confiancatechnologies.com`) numa aba nova — ou só
foca a aba já aberta, se já tiver uma. Criada como alternativa ao ícone
de app instalado (PWA), já que o ícone de um PWA instalado fica preso ao
que existia no momento da instalação e não atualiza sozinho.

Duas pastas, uma pra cada formato de extensão — mesmo ícone e mesmo
`background.js`, só o `manifest.json` muda:

- `chrome/` — Chrome, Edge, Brave, Opera (qualquer navegador baseado em
  Chromium).
- `firefox/` — Firefox.

## Instalar no Chrome / Edge / Brave / Opera

1. Abre `chrome://extensions` (ou `edge://extensions`, `brave://extensions`).
2. Ativa o **"Modo do desenvolvedor"** (canto superior direito).
3. Clica em **"Carregar sem compactação"** ("Load unpacked").
4. Seleciona a pasta `browser-extension/chrome/` deste repositório.
5. O ícone do AtendeFlow aparece na barra de extensões — clica no pin
   (📌) pra deixar fixo na barra de ferramentas.

## Instalar no Firefox

Duas opções:

**Temporária (some ao fechar o navegador, mais rápido pra testar):**
1. Abre `about:debugging#/runtime/this-firefox`.
2. Clica em **"Carregar extensão temporária..."**.
3. Seleciona o arquivo `browser-extension/firefox/manifest.json`.

**Permanente (sobrevive a reiniciar o navegador):**
Extensões não assinadas pela Mozilla só carregam permanentemente no
Firefox Developer Edition ou Firefox ESR com a flag
`xpinstall.signatures.required` desativada em `about:config` — pra uso
normal, o caminho mais simples é usar o Firefox Developer Edition ou
empacotar e assinar via
[addons.mozilla.org](https://addons.mozilla.org/developers/) (fluxo
"unlisted", sem precisar publicar na loja pública).

## Honestidade sobre o que foi testado

Os dois manifests foram validados só por leitura/sintaxe JSON
(`json.load` passou sem erro) — **não foram carregados de verdade num
Chrome/Edge/Firefox real ainda**. O `background.js` usa
`chrome.action.onClicked`/`chrome.tabs`/`chrome.windows`, que são APIs
padrão do Manifest V3 e também suportadas pelo namespace `chrome.*` do
Firefox (109+), mas o comportamento de foco de aba/janela
(`chrome.windows.update({focused: true})`) pode variar entre
sistemas operacionais — não confirmado contra hardware real. Testar
clicando no ícone com o AtendeFlow já aberto numa aba, e com ele fechado,
antes de confiar cegamente nisso em produção.

## Se precisar reaproveitar pra outro domínio/cliente

A URL do painel está fixa em `background.js` (constante
`ATENDEFLOW_URL`) e repetida em `host_permissions` nos dois
`manifest.json` — trocar as duas em conjunto.
