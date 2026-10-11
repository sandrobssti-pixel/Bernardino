---
name: vercel-deploy
description: Use sempre que for implantar QUALQUER app na Vercel (serverless) pra um cliente novo — não é específico de nenhum produto, é o procedimento genérico de CLI/projeto/variáveis/domínio que vale pra qualquer app Node/Next/API routes hospedado lá. Pra um caso concreto já documentado em cima deste procedimento, ver a skill `instagram-ai-agent-deploy`. Inclui as pegadinhas reais já batidas (projeto ligado errado, variável nova que não aparece sem redeploy).
---

# Implantar um app na Vercel pra um cliente novo

Roteiro genérico — vale pra qualquer app hospedado na Vercel
(serverless/edge functions), independente do produto. Se o app for
especificamente o Agente de IA do Instagram, usar a skill
`instagram-ai-agent-deploy` (já tem os passos deste procedimento
aplicados a esse app específico, com as variáveis e integrações dele).

## 0. Pedido ambíguo → perguntar antes de agir

Mesma regra do `CLAUDE.md` da raiz. Em especial, confirmar ANTES de
começar:
- Projeto Vercel **novo e independente** por cliente (padrão
  recomendado — nunca reaproveitar projeto/variáveis de outro cliente),
  ou é uma atualização de um projeto já existente?
- Qual plano Vercel o cliente vai usar — Hobby (gratuito, atende a
  maioria dos casos simples) ou Pro (se precisar de mais execuções,
  domínios de equipe, etc.)?
- Vai usar algum serviço de dados da própria Vercel (Storage — Redis,
  Postgres, Blob) ou um externo (banco já existente do cliente)?
- Domínio: subdomínio gratuito da Vercel (`<projeto>.vercel.app`) ou
  domínio próprio do cliente?

## 1. Pré-requisito: CLI instalada e logada

```bash
node -v   # confirmar Node instalado
sudo npm install -g vercel
vercel login
```

## 2. Criar e ligar o projeto

```bash
cd <pasta-do-app>
vercel project add <nome-do-projeto-do-cliente>
vercel link --yes --project <nome-do-projeto-do-cliente>
```

**A saída TEM que mostrar `Linked ... /<pasta-do-app>`, com o nome do
projeto certo.** Nunca prosseguir sem conferir essa linha.

### Pegadinha real já batida: pasta ligada ao projeto Vercel errado

Se a mesma máquina já tiver outros apps implantados na Vercel antes, é
fácil a pasta ficar ligada ao projeto **errado** (de outro cliente/app)
por engano. Sintomas: `vercel --prod` tenta publicar num projeto com
outro nome, erro `No Next.js version detected` (framework errado pro
projeto ligado), ou `Too many requests` de rate limit de um projeto que
não é esse. Corrigir sempre assim, nunca tentando "desligar" por outro
caminho:

```bash
rm -rf .vercel .env.local
# repetir vercel project add / vercel link, conferindo a saída com atenção
```

## 3. Variáveis de ambiente

```bash
vercel env add <NOME_DA_VARIAVEL> production
```

Cola o valor quando pedido (ou digita). Segredos sempre gerados novos
por cliente — nunca reaproveitar chave/senha de outro cliente/projeto.

Pelo site (mais fácil pra colar segredo grande): projeto → **Settings →
Environment Variables → Add** → Key, Value, Environments = Production
(e Preview/Development se for usar essas também) → Save.

Conferir tudo cadastrado:

```bash
vercel env ls
```

### Pegadinha real já batida (a mais importante de todas): variável nova não aparece sem novo deploy

**O deploy que já está no ar só enxerga as variáveis que existiam no
momento em que ele foi criado.** Cadastrar ou mudar uma variável não
atualiza um deploy já publicado sozinho — sempre:

```bash
vercel --prod
```

(ou, pelo site: Deployments → ⋯ → **Redeploy**) **toda vez** que
criar/alterar/remover uma variável de ambiente, antes de considerar a
mudança "aplicada". Esquecer esse passo é a causa mais comum de
"conferi tudo, está certo, mas não funciona".

## 4. Serviços de dados (Vercel Storage), se for usar

```
vercel.com → projeto → aba Storage → Create Database
```

Escolher o tipo (Redis, Postgres, Blob, etc.), plano Free pra começar,
região mais próxima do público do cliente. Na tela **Connect Project**:
escolher o projeto certo, ambiente **Production** → Connect — a Vercel
grava a variável de conexão sozinha (ex.: `REDIS_URL`,
`POSTGRES_URL`). **Nunca copiar/colar esse valor em lugar nenhum**, ele
contém a senha do banco.

**Mesma pegadinha da etapa 3 vale aqui**: depois de conectar o banco,
rodar `vercel --prod` de novo pro deploy atual passar a enxergar a
variável nova.

## 5. Publicar

```bash
vercel --prod
```

A URL pública aparece no campo `Aliased` da saída (ex.:
`https://<projeto>.vercel.app` — se o nome curto já for de outra
pessoa na Vercel, aparece com sufixo tipo `-omega`/`-xyz`; usar sempre
essa URL completa daí pra frente, não tentar adivinhar uma mais curta).

**Checkpoint**: abrir a URL no navegador, app responde. Pra uma API,
testar o endpoint principal com `curl`.

## 6. Domínio próprio (opcional)

`vercel.com → projeto → Settings → Domains → Add` → digitar o domínio
do cliente. A Vercel mostra os registros DNS pra criar no provedor do
domínio (geralmente um `CNAME` ou registro `A`) — configurar lá e
aguardar propagação. A Vercel emite o certificado HTTPS sozinha depois
que o DNS resolver certo.

## 7. Logs e depuração

```bash
vercel logs <url-do-projeto>
```

Acompanha em tempo real. Pra erro de variável ausente/errada, conferir
primeiro `vercel env ls` antes de desconfiar do código.

## 8. Atualizar o código depois de implantado

```bash
cd <pasta-do-app>
git pull   # ou git fetch/merge da branch certa, conforme o fluxo do projeto
vercel --prod
```

## 9. Checklist final

- [ ] `vercel link` confirmou o projeto certo (conferido na saída, não
      só assumido).
- [ ] Todas as variáveis obrigatórias cadastradas, com `vercel --prod`
      rodado **depois** da última mudança de variável.
- [ ] URL pública responde (app ou endpoint principal testado).
- [ ] Serviço de dados (se usado) conectado ao projeto certo, com
      deploy novo depois de conectar.
- [ ] Domínio próprio (se aplicável) com DNS propagado e HTTPS válido.
- [ ] Segredos gerados novos pra esse cliente.

## 10. Commit

Normalmente essa skill não gera commit (é configuração na conta
Vercel do cliente). Se o código do app em si mudar, seguir as
instruções de commit do `CLAUDE.md` da raiz e da skill específica do
produto (ex.: `instagram-ai-agent-deploy`).
