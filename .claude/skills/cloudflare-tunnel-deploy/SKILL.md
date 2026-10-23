---
name: cloudflare-tunnel-deploy
description: Use sempre que for publicar um app/serviço de um servidor de cliente na internet via Cloudflare Tunnel, em vez de expor IP/porta direto — funciona igual numa VPS cloud ou numa máquina física atrás de NAT doméstico/roteador, sem precisar de IP público nem porta aberta. Roteiro genérico, reaproveitável em qualquer cliente e qualquer app (um túnel pode servir vários subdomínios/serviços). Baseado na implantação real validada (Confiança Technologies, `docs/MANUAL_TECNICO.md` seções 33 e 40).
---

# Publicar um app via Cloudflare Tunnel

Roteiro genérico — vale pra qualquer cliente e qualquer app Docker
(AtendeFlow, Seafile, outro). Um único túnel por servidor normalmente
basta pra vários serviços/subdomínios diferentes — não precisa criar um
túnel novo a cada app, só uma rota nova (Public Hostname) no túnel já
existente.

## 0. Pedido ambíguo → perguntar antes de agir

Mesma regra do `CLAUDE.md` da raiz. Em especial, confirmar ANTES de
começar:
- Esse servidor já tem um túnel Cloudflare configurado (reaproveitar,
  só adicionar rota) ou é a primeira vez (criar um novo)?
- Domínio/subdomínio(s) que o cliente quer usar pra esse app.
- Se é uma migração de servidor antigo pra novo (corte de produção): usar
  subdomínio temporário primeiro, nunca testar direto no domínio
  definitivo (ver "Cuidado em corte de produção" abaixo).

## 1. Pré-requisito do lado do app

O serviço a publicar precisa estar rodando num container Docker, numa
rede que o `cloudflared` também vai entrar — geralmente a mesma rede
externa que o resto do stack do cliente usa (ex.: `coolify`, se o
servidor usar Coolify — ver skill `coolify-deploy`). Não precisa expor
porta pro host (`ports:` no compose) — o túnel alcança o container pelo
nome, direto na rede interna do Docker.

## 2. Criar (ou reaproveitar) o túnel no painel Cloudflare

Se **já existe** um túnel nesse servidor pra outro app: pular pra etapa
3, só adicionando uma rota nova no túnel existente.

Se é a **primeira vez** nesse servidor:

1. **Zero Trust → Networks → Tunnels → Create a tunnel**, tipo
   **Cloudflared**, nome `<cliente>-<ambiente>` (ex.: `confianza-vps`).
2. Copiar o **token** gerado — vai ser usado na variável de ambiente do
   `cloudflared` (etapa 3).

## 3. Adicionar o serviço `cloudflared` no compose do app

```yaml
cloudflared:
  image: cloudflare/cloudflared:latest
  container_name: <cliente>-<app>-cloudflared   # nome único, ver nota abaixo
  restart: unless-stopped
  command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
  depends_on:
    - backend   # ou o(s) serviço(s) que ele vai expor
  networks:
    - <rede-externa-compartilhada>   # ex: coolify
```

Preencher `CLOUDFLARE_TUNNEL_TOKEN` nas variáveis de ambiente do
recurso (Coolify) ou no `.env` do compose, com o token da etapa 2.

**`container_name` único e explícito, sempre** — se esse servidor já
roda outro stack na mesma rede externa, um nome genérico de serviço
(`cloudflared` sem prefixo) pode colidir em alias de rede com o
`cloudflared` de outro stack. Mesma lição documentada na skill
`coolify-deploy` sobre o incidente real do Redis (seção 39 do manual).

**Checkpoint**: `docker compose ps` (ou `docker ps`) mostra o container
`cloudflared` com status `Up`. `docker logs <container>` deve mostrar
linhas de conexão bem-sucedida com a borda do Cloudflare (sem erro de
autenticação/token).

## 4. Mapear o(s) domínio(s) público(s)

No painel do túnel (Cloudflare → o túnel criado/reaproveitado → aba
**Public Hostname → Add a public hostname**), uma entrada por serviço a
expor:

| Campo | Valor |
|---|---|
| Subdomain | `<ex: app, api, arquivos>` |
| Domain | `<domínio do cliente>` |
| Type | `HTTP` |
| URL | `<nome-do-serviço-ou-container>:<porta-interna>` |

A `URL` usa o **nome do serviço no compose** (resolvido pela rede
interna do Docker) ou o `container_name`, nunca IP — ex.:
`http://backend:8080`, `http://confianza-seafile:80`.

Salvar. O Cloudflare cuida do certificado HTTPS sozinho — não precisa
configurar nada de SSL do lado do servidor/Coolify.

**Checkpoint**: `https://<subdominio>.<dominio>` abre o app no
navegador, com cadeado válido.

## 5. Cuidado em corte de produção (trocar servidor sem derrubar o cliente)

Ao migrar um app de um servidor antigo pro novo: usar um subdomínio
**temporário** pro servidor novo primeiro (ex.: `app-novo.dominio.com`),
nunca o domínio de produção direto. Validar com o cliente que o novo
está funcionando igual ou melhor. Só depois, o corte final é **só
repontar o túnel do domínio definitivo** pro servidor novo (mudar a
`URL` da rota existente, ou criar a rota com o domínio certo e remover a
antiga) e desligar o túnel do servidor antigo — normalmente **não
precisa mudar nada no código nem no compose do app**, só a configuração
do túnel no painel Cloudflare e as variáveis `BACKEND_URL`/`FRONTEND_URL`
(ou equivalentes) do app, se elas gravarem o domínio.

**Atenção a variáveis de BUILD vs runtime**: se o app for tipo Create
React App (ou qualquer front que grave URL de API dentro dos arquivos
estáticos no momento do build, não lê em runtime), trocar só a variável
de ambiente e reiniciar o container **não muda nada** — precisa
reconstruir a imagem depois de trocar a variável. Ver seção 32 do
`docs/MANUAL_TECNICO.md` pra um exemplo real disso (`REACT_APP_*` do
AtendeFlow).

## 6. Checklist final

- [ ] Container `cloudflared` com `container_name` único, status `Up`.
- [ ] Log do `cloudflared` sem erro de token/autenticação.
- [ ] Cada subdomínio mapeado abre o serviço certo, com HTTPS válido.
- [ ] Se migração de servidor: subdomínio temporário validado antes do
      corte final pro domínio definitivo.
- [ ] Nenhuma porta exposta desnecessariamente no host (`ports:` do
      compose) — o túnel não precisa disso.

## 7. Commit

Normalmente essa skill não gera commit (é configuração no painel
Cloudflare + no servidor do cliente). Se adicionar o serviço
`cloudflared` a um compose deste repositório, seguir as instruções de
commit do `CLAUDE.md` da raiz e da skill do produto correspondente
(`atendeflow-dev`, etc.).
