---
name: disk-monitor
description: Use sempre que for mexer em server-toolkit/disk-monitor (ou em qualquer outro módulo do server-toolkit no mesmo estilo) — adicionar feature, corrigir bug, mudar a ferramenta de partição/formatação, integração com NAS, limpeza de disco, ou qualquer código do backend/frontend desse módulo. Reúne os procedimentos já estabelecidos neste projeto (versionamento, i18n, validação antes de commitar, seção de honestidade no README, padrão de segurança pra ação destrutiva) pra manter tudo consistente em vez de redescobrir ou espalhar a informação a cada pedido novo.
---

# Procedimentos do disk-monitor (server-toolkit/disk-monitor)

Este é um produto vendido pra técnicos de TI de terceiros que instalam
nas máquinas dos próprios clientes deles **sem suporte nosso depois da
venda**. Isso muda a régua de qualidade: nunca presume, sempre reconfere
no servidor em tempo real, e documenta honestamente o que foi e o que
não foi testado contra hardware real.

## 0. Antes de implementar — se o pedido não estiver claro, pergunte

Se o contexto do pedido do usuário permitir mais de um caminho razoável
de implementação (ex.: qual comportamento exato, qual escopo, qual
camada mexer), **pare e faça um questionário curto antes de codar**
(AskUserQuestion ou perguntas diretas no chat). Não adivinhe o caminho
"mais provável" e implemente — presumir errado custa tempo (ida e volta
de correção) e, nesse produto especificamente, pode significar uma
ação destrutiva mal desenhada chegando em produção. Só pule a pergunta
quando o pedido já é inequívoco (bug reproduzido com clareza, pedido
com um único jeito óbvio de fazer).

## 1. Versionamento — sempre em lockstep

Toda mudança relevante sobe a versão em TRÊS lugares, sempre juntos:
- `lib/version.js` (campo `version`)
- `package.json` (campo `"version"`)
- `package-lock.json` — regenerar com `npm install --package-lock-only`
  (nunca editar à mão)

Semântica: incremento de minor (`1.X.0`) pra feature nova, patch
(`1.20.X`) só pra correção pontual pequena. Versão aparece no rodapé da
UI e no log do `update.sh` — é como o técnico de campo confirma que
atualizou de verdade.

## 2. i18n — três blocos, sempre os três juntos

`public/index.html` tem um objeto `translations` com blocos `pt`, `es`
e `en`. Toda chave nova (texto fixo, label de botão, mensagem de erro)
precisa existir nos TRÊS blocos, na mesma posição relativa (geralmente
logo depois da chave mais parecida que já existe). Textos parametrizados
usam função: `confirmDeviceLabel: d => \`Digite exatamente "${d}"...\``.
Nunca deixar uma chave só em português — quebra os outros dois idiomas
silenciosamente (a UI cai pra `undefined` ou pro texto cru da chave).

## 3. Validação obrigatória antes de qualquer commit

Rodar sempre, nessa ordem, depois de editar:

```bash
cd server-toolkit/disk-monitor

# 1. Sintaxe do <script> do index.html (pega erro de template string,
#    parêntese sobrando, etc. sem precisar de navegador)
node -e '
const fs = require("fs");
const html = fs.readFileSync("public/index.html", "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
for (const s of scripts) { new Function(s); }
console.log("script OK");
'

# 2. Sintaxe do server.js
node --check server.js

# 3. Cada lib/*.js tocado carrega sem erro
node -e "require('./lib/NOME_DO_ARQUIVO.js'); console.log('OK')"
```

Pra lógica de elegibilidade/cálculo (ex.: `diskPartition.js`), também
vale rodar um teste manual rápido via `node -e` chamando a função
exportada direto com valores de exemplo (device inexistente, disco real
do ambiente, limites — 2/8/99 partições, etc.) antes de considerar
pronto. Ver o histórico de commits deste módulo pra exemplos do padrão.

## 4. README — seção de honestidade em toda feature nova

Toda feature ou correção relevante ganha um parágrafo no
`server-toolkit/disk-monitor/README.md` (procure
"**Honestidade sobre o que foi testado**" ou "**Honestidade**:" pra ver
o padrão) dizendo explicitamente:
- O que foi validado (e como — contra hardware real? só em modo prévia/
  simulação? contra qual ambiente?)
- O que ainda NÃO foi validado (nunca omitir isso)
- Limitação de plataforma, se houver (ex.: "só Linux por enquanto")

Isso não é burocracia — é o que permite ao técnico de campo (que não
tem nosso suporte) saber em que confiar cegamente e o que testar com
cuidado antes de usar num cliente real.

## 5. Padrão de segurança pra ação destrutiva/irreversível

Esse módulo tem ações que apagam dado de verdade (particionar/formatar
disco, desligar NAS). O padrão usado, sempre:

1. **Nunca confia no que o cliente mandou** — toda checagem de
   elegibilidade reconfere o estado real no servidor (`si.blockDevices()`
   etc.) tanto no preview quanto, de novo, no execute.
2. **Preview nunca executa nada** — só monta texto/comando.
3. **Confirmação pesada (caminho exato + frase digitada) só na etapa
   que realmente apaga dado existente** — etapas que só criam/formatam
   algo que já está vazio (ou seja, a parte destrutiva já foi
   confirmada antes) não precisam repetir a cerimônia.
4. **Fluxo de várias etapas irreversíveis = botões separados**, nunca
   uma função só fazendo tudo de uma vez — se um passo falhar no meio
   (ex.: partição presa por outro processo do kernel), o usuário precisa
   VER exatamente onde parou, não ficar adivinhando por que "não fez
   nada". Ver `lib/diskPartition.js` (delete/create/format) como
   referência de como dividir.
5. **Erro mostra o stderr/stdout real do comando**, nunca só "falhou —
   veja o log" sem log nenhum — quem usa isso não tem SSH nem suporte
   nosso pra investigar por fora.
6. Ação nova de risco alto demais pra rodar sem supervisão (ex.:
   espelhamento RAID1 do disco de sistema) vira **gerador de roteiro
   pra execução manual**, não execução automática — ver
   `lib/raidMirror.js`.

## 6. Cuidado com estado da UI sendo apagado por refresh automático

Vários painéis se auto-atualizam por `setInterval` (status, processos,
topologia de disco). Qualquer `innerHTML =` que recria cards inteiros
PODE apagar um formulário/prévia/confirmação que o usuário estava
preenchendo no meio do caminho, sem aviso — já aconteceu uma vez com
`loadDiskTopology()` e a ferramenta de particionar (corrigido com
`hasOpenDiskTool()` guardando o refresh periódico, mas forçando quando a
ação é explícita do usuário, ex. trocar idioma). Ao adicionar qualquer
`setInterval` novo que re-renderiza algo com estado interativo, pensar
nesse caso ANTES de escrever, não depois de alguém relatar o bug.

## 7. Deploy (servidor real do usuário)

Comando único, sempre:

```bash
sudo /opt/update-disk-monitor.sh
```

Esse script já faz `git pull` + reinstala dependências + reinicia o
serviço (`systemctl restart disk-monitor`) + mostra a versão antes/
depois. Nunca orientar o usuário a rodar `git pull`/`npm install`
manualmente em paralelo com esse script — misturar os dois já causou
problema de permissão (arquivo virando dono de `root` via `sudo` e
depois um `npm install` sem `sudo` batendo em `EACCES`).

## 8. Commit

Mensagem descrevendo o quê + por quê (nunca só "fix bug"), rodapé de
atribuição conforme as instruções da sessão. Nunca commitar sem rodar a
validação da seção 3 primeiro.
