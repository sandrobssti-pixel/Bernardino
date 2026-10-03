# Instruções permanentes deste repositório

## Pedido com contexto ambíguo → perguntar antes de implementar

Quando um pedido do usuário permitir mais de um caminho razoável de
implementação (comportamento exato não especificado, escopo incerto,
mais de uma camada onde a mudança poderia entrar), **pare e faça um
questionário curto antes de codar** — não escolha o caminho "mais
provável" por conta própria. Presumir errado custa retrabalho, e neste
projeto em especial (produtos vendidos sem suporte pós-venda, com ações
destrutivas reais em disco/servidor) um caminho errado pode significar
código arriscado indo pra produção sem revisão.

Só pular a pergunta quando o pedido já é inequívoco — bug reproduzido
com clareza, ou pedido com um único jeito óbvio de resolver.

## Procedimentos por módulo — usar as skills do projeto

Antes de mexer num módulo que já tem skill própria em `.claude/skills/`,
usar essa skill pra ver os procedimentos já estabelecidos (versionamento,
padrões de código, validação, etc.) em vez de redescobrir ou inventar de
novo a cada pedido. Isso evita que a mesma informação fique espalhada em
conversas antigas sem registro.

- **`server-toolkit/disk-monitor/`** → skill `disk-monitor-dev`
  (`.claude/skills/disk-monitor-dev/SKILL.md`)

Se um módulo novo ganhar procedimentos próprios que valha a pena
reaproveitar (padrão de versionamento, de i18n, de validação, de
segurança), criar uma skill pra ele seguindo o mesmo modelo — não deixar
o conhecimento só na conversa.
