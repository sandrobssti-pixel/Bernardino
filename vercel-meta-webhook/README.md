# Proxy do webhook da Meta na Vercel

Projeto mínimo (só `vercel.json`) que publica, na Vercel, um endereço para o
Webhook da Meta (Instagram Direct / Facebook Messenger) e repassa tudo — a
verificação (`GET`) e as mensagens (`POST`), com query string e corpo — para
o backend do AtendeFlow:

```
https://<projeto>.vercel.app/api/webhook/<ID>
  → https://api.confiancatechnologies.com/webhook/meta/<ID>
```

`<ID>` é o número no fim da "Callback URL" da conexão em
**Conexões → Conexões Meta**. O Verify Token continua sendo o do modal da
conexão no AtendeFlow (a Vercel só repassa).

## Publicar

```bash
cd ~/atendeflow/vercel-meta-webhook
vercel --prod
```

Na primeira vez, responda: criar projeto novo (não ligar ao
`confiancafacilities`), nome `atendeflow-meta-webhook`, sem framework.

Ver docs/MANUAL_TECNICO.md, seção 68.
