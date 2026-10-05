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

### Modo rápido/manual (um técnico testando, uma máquina só)

1. Abre `chrome://extensions` (ou `edge://extensions`, `brave://extensions`).
2. Ativa o **"Modo do desenvolvedor"** (canto superior direito).
3. Clica em **"Carregar sem compactação"** ("Load unpacked").
4. Seleciona a pasta `browser-extension/chrome/` deste repositório.
5. O ícone do AtendeFlow aparece na barra de extensões — clica no pin
   (📌) pra deixar fixo na barra de ferramentas.

### Modo produção (instalação forçada + atualização automática)

Pra configurar várias máquinas sem repetir o passo manual, e fazer o
Chrome/Edge atualizar a extensão sozinho a cada nova versão — sem
passar pela Chrome Web Store, distribuição privada.

**Numa máquina só, a primeira vez (ou toda vez que mudar a versão):**

```bash
cd browser-extension/tooling
npm install          # só na primeira vez
./pack.sh
```

Isso gera `browser-extension/tooling/dist/atendeflow.crx` e
`update.xml`. Copia os dois pra `frontend/public/extension/` e faz o
deploy do frontend (mesmo processo de sempre) — o Chrome baixa
`update.xml` desse endereço público pra saber se tem versão nova.

**Em cada máquina de técnico (uma vez só por máquina):**

```bash
sudo browser-extension/tooling/install-policy-linux.sh
```

Isso escreve a política `ExtensionInstallForcelist` pro Chrome/Chromium/
Edge instalados na máquina — na próxima vez que o navegador abrir, a
extensão já aparece instalada sozinha, e fica se atualizando sozinha a
cada novo `./pack.sh` + deploy.

**IMPORTANTE — a chave de assinatura**: `pack.sh` gera (na primeira vez)
um arquivo `browser-extension/tooling/signing-key.pem` — é ele que
garante que toda versão nova seja reconhecida como "a mesma extensão,
só atualizada" em vez de uma extensão diferente. **Faz backup desse
arquivo fora do git assim que for gerado** (gerenciador de senhas,
backup criptografado) — nunca é commitado (está no `.gitignore`). Se
perder esse arquivo, toda atualização futura gera um ID novo de
extensão, e cada máquina já configurada vai precisar reinstalar na mão
de novo.

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

**Sem atualização automática por enquanto**: diferente do Chrome/Edge
(que tem o fluxo de distribuição privada com `pack.sh` +
`install-policy-linux.sh` acima), o Firefox exige que QUALQUER
extensão, mesmo de distribuição privada/não listada, seja assinada
pela Mozilla pra poder se atualizar sozinha — não tem equivalente ao
`ExtensionInstallForcelist` do Chrome pra isso. Enquanto não for esse
o caminho escolhido, instalação no Firefox continua manual (temporária
ou via Developer Edition) a cada atualização.

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

`pack.sh` foi rodado de ponta a ponta e gerou um `.crx` + `update.xml`
válidos (confirmado com `crx3-info`, que leu o ID da extensão de volta
do arquivo gerado sem erro) — a geração do pacote está confirmada.
**O que ainda não foi confirmado**: a instalação forçada de verdade via
`install-policy-linux.sh` numa máquina real (se o Chrome/Edge realmente
detecta a política e instala sozinho), nem se o `update.xml` publicado
em `frontend/public/extension/` é consultado e aceito pelo navegador do
jeito esperado. Testar numa máquina de verdade antes de distribuir pra
vários técnicos de uma vez.

## Se precisar reaproveitar pra outro domínio/cliente

A URL do painel está fixa em `background.js` (constante
`ATENDEFLOW_URL`) e repetida em `host_permissions` nos dois
`manifest.json` — trocar as duas em conjunto.
