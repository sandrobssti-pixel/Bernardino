const https = require("https");
const http = require("http");

// Cliente mínimo pra API web do Synology DSM (SYNO.API.Auth,
// SYNO.Storage.CGI.Storage, SYNO.Core.System) — a mesma API que o
// próprio DSM usa por trás da tela de Armazenamento e do botão
// "Desligar". Sem dependência nova: só `https`/`http` do Node.
//
// ATENÇÃO — NÃO TESTADO CONTRA UM SYNOLOGY DE VERDADE nesta sessão (sem
// acesso a um NAS real pra validar). Escrito seguindo a documentação
// pública dessa API, usada por ferramentas conhecidas da comunidade
// (ex.: a integração Synology DSM do Home Assistant, o pacote Python
// `synology-dsm`). Teste com cuidado antes de confiar em produção — em
// especial o desligamento, que é uma ação física irreversível
// remotamente (sem Wake-on-LAN configurado, só liga de novo apertando o
// botão físico do NAS).

function createSynologyClient({ host, port, useHttps, user, password, allowSelfSigned }) {
  if (!host || !user || !password) return null;

  const scheme = useHttps ? "https" : "http";
  const agent = useHttps ? new https.Agent({ rejectUnauthorized: !allowSelfSigned }) : undefined;

  function request(pathAndQuery) {
    return new Promise((resolve, reject) => {
      const mod = useHttps ? https : http;
      const req = mod.get(
        `${scheme}://${host}:${port}${pathAndQuery}`,
        agent ? { agent } : {},
        res => {
          let body = "";
          res.on("data", chunk => { body += chunk; });
          res.on("end", () => {
            try {
              resolve(JSON.parse(body));
            } catch {
              reject(new Error("Resposta inesperada do DSM (não veio JSON válido)."));
            }
          });
        }
      );
      req.on("error", reject);
      req.setTimeout(10000, () => req.destroy(new Error("Tempo esgotado ao falar com o DSM.")));
    });
  }

  // Sessão do DSM cacheada por alguns minutos — evita logar de novo a
  // cada clique, mas nunca fica pendurada indefinidamente.
  let cachedSid = null;
  let cachedAt = 0;
  const SID_TTL_MS = 5 * 60 * 1000;

  async function login() {
    if (cachedSid && Date.now() - cachedAt < SID_TTL_MS) return cachedSid;
    const query =
      `/webapi/auth.cgi?api=SYNO.API.Auth&version=6&method=login` +
      `&account=${encodeURIComponent(user)}&passwd=${encodeURIComponent(password)}` +
      `&session=nas-panel&format=sid`;
    const data = await request(query);
    if (!data.success) {
      throw new Error(`Login no DSM falhou (código de erro ${data.error?.code}). Confira DSM_USER/DSM_PASSWORD.`);
    }
    cachedSid = data.data.sid;
    cachedAt = Date.now();
    return cachedSid;
  }

  // `size_total` da API do Synology vem em KB — convertido aqui pra
  // bytes, mesma unidade usada no resto do painel (formatBytes no
  // frontend).
  async function getDisks() {
    const sid = await login();
    const data = await request(`/webapi/entry.cgi?api=SYNO.Storage.CGI.Storage&version=1&method=load_info&_sid=${sid}`);
    if (!data.success) {
      throw new Error(`Falha ao ler informações de disco (código de erro ${data.error?.code}).`);
    }
    return (data.data?.disks || []).map(d => ({
      id: d.id,
      model: d.model || "",
      vendor: d.vendor || "",
      status: d.status || "unknown",
      healthy: d.status === "normal",
      tempCelsius: typeof d.temp === "number" ? d.temp : null,
      sizeBytes: d.size_total ? Number(d.size_total) * 1024 : null
    }));
  }

  async function shutdown() {
    const sid = await login();
    const data = await request(`/webapi/entry.cgi?api=SYNO.Core.System&version=1&method=shutdown&_sid=${sid}`);
    if (!data.success) {
      throw new Error(`Falha ao desligar (código de erro ${data.error?.code}).`);
    }
    return true;
  }

  return { getDisks, shutdown };
}

module.exports = { createSynologyClient };
