const https = require("https");
const http = require("http");

// Cliente mínimo pra API web do Synology DSM (SYNO.API.Auth,
// SYNO.Storage.CGI.Storage, SYNO.Core.System) — a mesma API que o
// próprio DSM usa por trás da tela de Armazenamento e do botão
// "Desligar". Sem dependência nova: só `https`/`http` do Node.
//
// O login (com conta protegida por verificação em duas etapas, via
// device_id de dispositivo confiável) foi validado contra um Synology
// DS223j real, DSM 7.4.1. Leitura de discos e desligamento ainda não
// confirmados contra hardware real — teste com cuidado antes de
// confiar em produção, em especial o desligamento, que é uma ação
// física irreversível remotamente (sem Wake-on-LAN configurado, só liga
// de novo apertando o botão físico do NAS).

function createSynologyClient({ host, port, useHttps, user, password, allowSelfSigned, deviceId }) {
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
      req.on("error", err => {
        // Mensagem crua do Node ("unable to verify the first certificate")
        // não diz nada útil pro cliente final — troca por uma explicação
        // acionável. Só deveria acontecer se allowSelfSigned estiver
        // desligado contra um DSM com certificado autoassinado.
        const isCertError =
          /certificate|CERT_|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(err.code || err.message || "");
        if (isCertError) {
          reject(new Error(
            "Não foi possível confiar no certificado HTTPS do DSM. Se for um Synology na rede local " +
            "com certificado autoassinado (o mais comum), defina DSM_ALLOW_SELF_SIGNED=true no .env."
          ));
          return;
        }
        reject(err);
      });
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
    // version=7 é o mínimo que aceita device_id — necessário pra contas
    // com verificação em duas etapas ativada (ver DSM_DEVICE_ID no
    // .env.example: identifica esse servidor como dispositivo confiável,
    // sem precisar do código de 6 dígitos a cada login).
    let query =
      `/webapi/auth.cgi?api=SYNO.API.Auth&version=7&method=login` +
      `&account=${encodeURIComponent(user)}&passwd=${encodeURIComponent(password)}` +
      `&session=nas-panel&format=sid`;
    if (deviceId) query += `&device_id=${encodeURIComponent(deviceId)}`;
    const data = await request(query);
    if (!data.success) {
      const code = data.error?.code;
      const hint =
        code === 403 || code === 404
          ? " A conta exige verificação em duas etapas — confira se DSM_DEVICE_ID está correto no .env."
          : " Confira DSM_USER/DSM_PASSWORD.";
      throw new Error(`Login no DSM falhou (código de erro ${code}).${hint}`);
    }
    cachedSid = data.data.sid;
    cachedAt = Date.now();
    return cachedSid;
  }

  // Status conhecidos de falha real do disco — qualquer outra coisa
  // (incluindo "not_use", que só significa "disco presente mas ainda
  // fora de qualquer pool/volume", o caso normal de um disco recém-
  // colocado) fica "unknown" (neutro) em vez de soar alarme falso. Mesmo
  // princípio já usado no badge de SMART dos discos locais: nunca
  // assumir falha a partir de dado ambíguo.
  const KNOWN_BAD_STATUSES = new Set(["crashed", "system_partition_fail", "partition_fail"]);

  async function getDisks() {
    const sid = await login();
    const data = await request(`/webapi/entry.cgi?api=SYNO.Storage.CGI.Storage&version=1&method=load_info&_sid=${sid}`);
    if (!data.success) {
      throw new Error(`Falha ao ler informações de disco (código de erro ${data.error?.code}).`);
    }
    return (data.data?.disks || []).map(d => {
      const status = d.status || "unknown";
      const healthy = status === "normal" ? true : (KNOWN_BAD_STATUSES.has(status) ? false : null);
      return {
        id: d.id,
        model: d.model || "",
        vendor: d.vendor || "",
        status,
        healthy,
        tempCelsius: typeof d.temp === "number" ? d.temp : null,
        // `size_total` já vem em bytes nesta versão da API do DSM (validado
        // contra hardware real) — versões antigas deste código multiplicavam
        // por 1024 achando que vinha em KB, inflando o tamanho em 1024x.
        sizeBytes: d.size_total ? Number(d.size_total) : null
      };
    });
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
