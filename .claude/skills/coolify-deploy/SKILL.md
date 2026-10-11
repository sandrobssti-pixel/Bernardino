---
name: coolify-deploy
description: Use sempre que for instalar o Coolify num servidor de cliente novo, configurar o Postgres compartilhado, ou subir um app via recurso "Docker Compose" nele. Roteiro genérico, reaproveitável em qualquer cliente. Inclui a lição mais importante e menos óbvia já aprendida na prática — colisão de nome de serviço (`redis`, `db`, etc.) na rede Docker externa compartilhada do Coolify, que já derrubou sessões de WhatsApp em produção (Confiança Technologies, `docs/MANUAL_TECNICO.md` seção 39) — e os ajustes reais de Postgres/SSL (seção 34).
---

# Instalar e usar o Coolify num servidor de cliente

Roteiro genérico. Coolify é uma plataforma self-hosted que builda e roda
containers Docker a partir de compose/Dockerfiles, com painel web
próprio — não precisa saber Kubernetes nem mexer em proxy/SSL na mão.

## 0. Pedido ambíguo → perguntar antes de agir

Mesma regra do `CLAUDE.md` da raiz. Em especial, confirmar ANTES de
começar:
- O cliente quer o Postgres de cada app dentro do próprio compose do app
  (banco isolado, mais simples) ou um **Postgres compartilhado** gerido
  pelo Coolify (um recurso só, vários apps conectando nele — é o padrão
  usado na implantação real que validou este roteiro)?
- O app vai precisar de acesso público — se sim, ver skill
  `cloudflare-tunnel-deploy` em vez de expor domínio/SSL pelo próprio
  Coolify (padrão usado aqui, funciona em VPS cloud e em máquina física
  atrás de NAT).
- Repositório Git do app está acessível pro Coolify puxar direto, ou vai
  ser um recurso "Docker Compose" colado manualmente (sem Git
  conectado)? Muda como o deploy/redeploy funciona (ver etapa 5).

## 1. Instalar

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

O instalador mostra a URL de acesso no final (geralmente
`http://<ip-do-servidor>:8000`). Entrar e criar o usuário admin.

**Checkpoint**: painel acessível, login funcionando.

## 2. Postgres compartilhado (se for esse o padrão escolhido)

No painel: criar um recurso do tipo **PostgreSQL**. Depois de criado,
pegar os dados de conexão em **dois lugares diferentes** (já aconteceu
de ficarem inconsistentes entre si — conferir os dois):

- Campo "Port mappings" da tela do recurso.
- Campo **"Postgres URL (internal)"** — essa é a fonte confiável, é
  literalmente a string de conexão que o Coolify monta pra uso entre
  containers na rede interna.

Se a `Postgres URL (internal)` terminar em `?sslmode=require`, esse
Postgres **exige SSL mesmo em conexão interna** — o app precisa suportar
isso (`DB_SSL=true` + lib de conexão configurada pra SSL, não é dado por
garantido em todo projeto).

**Checkpoint**: host interno do Postgres anotado (algo como
`<nome-do-recurso>-postgres`, rede interna do Coolify), porta e exigência
de SSL confirmadas pela `Postgres URL (internal)`, não pelo "Port
mappings" isolado.

## 3. Criar o recurso do app (Docker Compose)

No painel: **Projects → novo recurso → Docker Compose**. Duas formas:

- **Conectado a um repositório Git**: aponta pro repo + branch de
  produção + caminho do arquivo compose (ex.: `docker-compose.coolify.yml`
  — nome separado do compose de desenvolvimento local, se o projeto tiver
  os dois). Deploy novo = `git push` na branch + clicar em "Deploy" no
  painel (ou webhook, se configurado) — `git push` sozinho nunca
  implanta nada sem esse segundo passo.
- **Colado direto na interface, sem Git**: o compose fica só dentro do
  Coolify — deploy novo é editar e clicar em "Deploy" direto lá.

Preencher as variáveis de ambiente do recurso (não direto no arquivo
compose — usar `${VAR}` no YAML e preencher na aba de variáveis do
Coolify), incluindo os dados de conexão do Postgres da etapa 2 e
segredos gerados novos pra esse cliente (nunca reaproveitar segredo de
outro cliente/ambiente).

**Atenção**: variáveis que um frontend tipo Create React App grava
dentro dos arquivos estáticos **no momento do build** (ex.:
`REACT_APP_BACKEND_URL`) precisam entrar como `args:` do build do
serviço no compose, não como `environment:` — e mudar o valor depois
exige **rebuild da imagem**, reiniciar o container sozinho não
atualiza nada.

**Checkpoint**: `docker compose ps` (dentro do recurso) mostra todos os
serviços com status `Up`.

## 4. A lição mais importante: rede externa compartilhada e colisão de nome

Pra um app conectar no Postgres do Coolify (etapa 2), os serviços dele
entram numa **rede Docker externa** do Coolify (geralmente chamada
`coolify`). Essa mesma rede é compartilhada por **todos os outros
stacks** que também precisam falar com esse Postgres (ou entre si) —
inclusive serviços internos do próprio Coolify.

**O nome do serviço no compose vira automaticamente um apelido (alias)
de rede dentro de QUALQUER rede a que o container se conecta — inclusive
a externa/compartilhada.** Se dois composes diferentes nessa mesma rede
usarem um nome de serviço genérico igual (`redis`, `db`, `app`,
`memcached`...), os dois containers registram o MESMO alias, e a
resolução de nome do Docker pode devolver ora um container, ora outro —
de forma imprevisível, sem erro óbvio.

**Isso já aconteceu de verdade**: o Redis do AtendeFlow (serviço
`redis` no compose) colidiu com o Redis interno do próprio Coolify
(que exige senha) na rede `coolify` compartilhada. O backend às vezes
caía no Redis errado, recebia `NOAUTH Authentication required`, e a
sessão inteira do WhatsApp (credenciais guardadas no Redis) parava de
funcionar — um dia inteiro de reinícios até achar a causa.

**Regra, sempre, em qualquer stack que entre numa rede externa
compartilhada**:
- Todo serviço ganha `container_name` explícito e único (prefixado
  com o nome do cliente/app, ex.: `confianza-redis`, nunca só `redis`).
- Toda variável de ambiente de outro serviço que referencia esse
  serviço usa o **`container_name`**, nunca o nome genérico do serviço
  do compose:
  ```yaml
  REDIS_URI: redis://<container_name>:6379   # não redis://redis:6379
  ```
- Isso vale pra QUALQUER serviço com nome comum — Redis, banco,
  memcached, app genérico — não só o caso específico do Redis que já
  aconteceu.

## 5. Checklist final

- [ ] Painel Coolify acessível, admin configurado.
- [ ] Postgres (se compartilhado): host/porta/SSL confirmados pela
      `Postgres URL (internal)`.
- [ ] Todo `container_name` do app é único e prefixado — nenhum nome
      genérico tipo `redis`/`db`/`app` sem prefixo.
- [ ] Variáveis de ambiente que referenciam outro container do mesmo
      stack usam o `container_name`, não o nome do serviço.
- [ ] `docker compose ps` — todos os serviços `Up`.
- [ ] Segredos gerados novos pra esse cliente (nunca reaproveitados).
- [ ] Acesso público: ver skill `cloudflare-tunnel-deploy` em vez de
      expor porta/domínio pelo próprio Coolify, se for esse o padrão do
      cliente.

## 6. Commit

Normalmente essa skill não gera commit (é configuração no painel
Coolify + no servidor do cliente). Se um compose novo entrar neste
repositório, seguir as instruções de commit do `CLAUDE.md` da raiz e da
skill do produto correspondente.
