const path = require("path");
const { baseDir, publicDir } = require("./lib/paths");

// Carrega o .env de ao lado do executável/projeto, nunca do cwd de onde
// o processo foi chamado — assim funciona igual rodando com `node
// server.js` dentro da pasta ou rodando o binário empacotado de
// qualquer diretório (ex.: chamado pelo systemd).
require("dotenv").config({ path: path.join(baseDir, ".env") });

const express = require("express");
const cron = require("node-cron");
const multer = require("multer");

const { readDiskUsage } = require("./lib/diskUsage");
const { readDiskTopology } = require("./lib/diskTopology");
const { createFileManager } = require("./lib/fileManager");
const { createSynologyClient } = require("./lib/synologyApi");
const { runCleanup } = require("./lib/cleanup");
const { getConfig, updateConfig } = require("./lib/configStore");
const {
  readAllDisks,
  readCpuLoad,
  readMemory,
  readTopProcesses
} = require("./lib/systemStats");
const {
  appendReading,
  getHistory,
  appendAction,
  getActions,
  appendCpuReading,
  getCpuHistory,
  appendMemReading,
  getMemHistory,
  appendDisksReading,
  getDisksHistory
} = require("./lib/historyStore");
const { ensureMachineProfile, getMachineProfile } = require("./lib/machineProfile");
const { version } = require("./lib/version");
const { createAuthSystem } = require("toolkit-auth");
const { dataDir } = require("./lib/paths");

const PORT = process.env.PORT || 8091;
// Sem MOUNT_PATH configurado, usa a raiz de cada sistema: "/" no
// Linux, unidade do sistema (normalmente "C:") no Windows.
const MOUNT_PATH =
  process.env.MOUNT_PATH ||
  (process.platform === "win32" ? `${process.env.SystemDrive || "C:"}\\` : "/");
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
  console.error(
    "SESSION_SECRET não definido no .env — configure antes de rodar (ver .env.example)."
  );
  process.exit(1);
}

// Compatibilidade com quem já rodava a versão antiga (usuário/senha fixos
// no .env, sem tela de login): se ainda não existe nenhum usuário
// cadastrado, DASHBOARD_USER/DASHBOARD_PASSWORD viram o admin inicial —
// depois disso o gerenciamento passa a ser todo pela tela de Usuários.
const auth = createAuthSystem({
  dataDir,
  sessionSecret: SESSION_SECRET,
  envBootstrap: {
    username: process.env.DASHBOARD_USER,
    password: process.env.DASHBOARD_PASSWORD
  }
});

// Painel do NAS (opcional) — sem NAS_ROOTS configurado no .env, fica
// `null` e a seção de arquivos/discos do NAS simplesmente não aparece no
// painel; o resto do disk-monitor funciona normalmente. Pensado pra isso
// já vir "de fábrica" em qualquer servidor novo — só liga configurando
// as variáveis, sem precisar instalar nada a mais.
const fileManager = process.env.NAS_ROOTS ? createFileManager(process.env.NAS_ROOTS) : null;
const NAS_MAX_UPLOAD_MB = Number(process.env.NAS_MAX_UPLOAD_MB || 2048);

// Integração com a API do Synology DSM (discos/desligamento) — também
// opcional e independente do navegador de arquivos acima.
const synologyClient = createSynologyClient({
  host: process.env.DSM_HOST,
  port: Number(process.env.DSM_PORT || 5001),
  useHttps: process.env.DSM_HTTPS !== "false",
  user: process.env.DSM_USER,
  password: process.env.DSM_PASSWORD,
  allowSelfSigned: process.env.DSM_ALLOW_SELF_SIGNED === "true",
  deviceId: process.env.DSM_DEVICE_ID
});

const app = express();
app.use(express.json());
app.use(auth.sessionMiddleware);
app.use("/api", auth.router);
app.use(express.static(publicDir));

let cleanupRunning = false;

// Só uma limpeza por vez — evita duas execuções concorrentes (uma
// automática batendo com um clique manual) brigando pelos mesmos
// recursos do Docker.
async function triggerCleanup(trigger) {
  if (cleanupRunning) {
    return { skipped: true, reason: "já tem uma limpeza em andamento" };
  }
  cleanupRunning = true;
  try {
    const before = await readDiskUsage(MOUNT_PATH);
    const config = getConfig();
    const result = runCleanup(config, before);
    const after = await readDiskUsage(MOUNT_PATH);

    const freedBytes = Math.max(0, before.usedBytes - after.usedBytes);

    const action = {
      timestamp: new Date().toISOString(),
      trigger,
      percentBefore: before.percent,
      percentAfter: after.percent,
      freedMB: Math.round(freedBytes / 1024 / 1024),
      steps: result.steps
    };
    appendAction(action);
    return action;
  } finally {
    cleanupRunning = false;
  }
}

// Roda na mesma amostragem periódica do disco monitorado (mesmo cron,
// mesmo intervalo configurável) — CPU, RAM e a lista de todos os discos
// detectados não entram na decisão de limpeza automática (só o disco
// monitorado por MOUNT_PATH aciona isso), são só pra alimentar os
// gráficos de histórico do painel.
async function sampleSystemStats() {
  const [cpu, mem, disks] = await Promise.all([
    readCpuLoad(),
    readMemory(),
    readAllDisks()
  ]);
  appendCpuReading(cpu);
  appendMemReading(mem);
  appendDisksReading(disks);
}

// Janela "ao vivo" de CPU/RAM pro painel — em memória, nunca em disco:
// amostra a cada 5s (independente do intervalo de checagem do disco, que é
// configurável e normalmente bem mais espaçado). Guarda só os últimos ~10
// minutos, o suficiente pra um gráfico de tempo real de verdade sem virar
// um banco de série histórica.
const LIVE_SAMPLE_INTERVAL_MS = 5000;
const LIVE_MAX_POINTS = 120;
const liveCpuHistory = [];
const liveMemHistory = [];

async function sampleLiveStats() {
  const [cpu, mem] = await Promise.all([readCpuLoad(), readMemory()]);
  liveCpuHistory.push(cpu);
  liveMemHistory.push(mem);
  if (liveCpuHistory.length > LIVE_MAX_POINTS) liveCpuHistory.shift();
  if (liveMemHistory.length > LIVE_MAX_POINTS) liveMemHistory.shift();
}

sampleLiveStats().catch(err => console.error("Falha na amostragem inicial ao vivo:", err));
setInterval(() => {
  sampleLiveStats().catch(err => console.error("Falha ao amostrar CPU/RAM ao vivo:", err));
}, LIVE_SAMPLE_INTERVAL_MS);

async function checkDiskAndMaybeClean() {
  const reading = await readDiskUsage(MOUNT_PATH);
  appendReading(reading);

  await sampleSystemStats().catch(err =>
    console.error("Falha ao amostrar CPU/RAM/discos:", err)
  );

  const config = getConfig();
  if (config.autoCleanupEnabled && reading.percent >= config.thresholdPercent) {
    await triggerCleanup("auto");
  }
}

app.get("/api/status", auth.requireAuth, async (req, res) => {
  const config = getConfig();
  const history = getHistory();
  const current = history[history.length - 1] || (await readDiskUsage(MOUNT_PATH));

  const cpuHistory = getCpuHistory();
  const memHistory = getMemHistory();
  const disksHistory = getDisksHistory();

  // Discos e CPU/RAM "agora": se ainda não rodou nenhuma amostragem (painel
  // recém-instalado), lê na hora em vez de esperar o próximo tick do cron.
  const disks = disksHistory.length
    ? disksHistory[disksHistory.length - 1].disks
    : (await readAllDisks()).map(d => ({ mount: d.mount, percent: d.percent }));
  const cpuCurrent = cpuHistory[cpuHistory.length - 1] || (await readCpuLoad());
  const memCurrent = memHistory[memHistory.length - 1] || (await readMemory());

  res.json({
    current,
    history,
    disks,
    disksHistory,
    cpuCurrent,
    cpuHistory,
    memCurrent,
    memHistory,
    actions: getActions(),
    config,
    cleanupRunning,
    version
  });
});

// CPU/RAM em tempo real (janela ao vivo em memória, amostrada a cada 5s —
// ver sampleLiveStats acima) + discos sempre lidos na hora, com bytes
// completos (precisão total pro card de cada disco, não só o percentual).
app.get("/api/live", auth.requireAuth, async (req, res) => {
  const disks = await readAllDisks();
  res.json({
    cpuHistory: liveCpuHistory,
    memHistory: liveMemHistory,
    disks
  });
});

// Perfil da máquina (hardware/SO) — varrido uma vez só, na instalação (ver
// ensureMachineProfile mais abaixo), não muda a cada request.
app.get("/api/machine-profile", auth.requireAuth, (req, res) => {
  res.json({ profile: getMachineProfile() });
});

// Discos físicos agrupados com suas partições, mais USB e compartilhamentos
// de rede separados (ver lib/diskTopology.js) — sempre lido na hora (não
// entra no histórico, é caro demais pra amostrar a cada poucos segundos).
app.get("/api/disk-topology", auth.requireAuth, async (req, res) => {
  try {
    const topology = await readDiskTopology();
    res.json(topology);
  } catch (err) {
    console.error("[disk-monitor] Falha ao ler topologia de discos:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Lista de processos é sempre lida na hora (nunca fica em cache/histórico)
// — é o que dá o efeito de "tempo real" pedido pelo cliente.
app.get("/api/processes", auth.requireAuth, async (req, res) => {
  const processes = await readTopProcesses(15);
  res.json({ processes });
});

// ---------- Painel do NAS (arquivos + Synology DSM) ----------
// Tudo abaixo é opcional — sem NAS_ROOTS no .env, os endpoints respondem
// 501 e a seção correspondente do painel fica escondida no frontend.

app.get("/api/nas/roots", auth.requireAuth, (req, res) => {
  if (!fileManager) {
    return res.status(501).json({ error: "Painel do NAS não configurado (ver .env.example)." });
  }
  res.json({ roots: fileManager.listRoots(), dsmConfigured: !!synologyClient });
});

app.get("/api/nas/browse", auth.requireAuth, (req, res) => {
  if (!fileManager) {
    return res.status(501).json({ error: "Painel do NAS não configurado." });
  }
  try {
    const entries = fileManager.listDir(req.query.root, req.query.path || "");
    res.json({ entries });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Visualizador também baixa — só upload (escrita) e desligamento são
// exclusivos de admin, mesma regra de permissão já usada no resto do painel.
app.get("/api/nas/download", auth.requireAuth, (req, res) => {
  if (!fileManager) {
    return res.status(501).json({ error: "Painel do NAS não configurado." });
  }
  try {
    const filePath = fileManager.getFileForDownload(req.query.root, req.query.path);
    res.download(filePath);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// A pasta de destino é resolvida (com a mesma validação de path seguro)
// nesta função do multer, chamada antes de gravar qualquer byte — nunca
// escreve fora de uma raiz permitida. O formulário do frontend manda
// `root`/`path` como campos ANTES do campo do arquivo, pra já estarem em
// `req.body` quando o multer decide o destino.
const nasUpload = multer({
  limits: { fileSize: NAS_MAX_UPLOAD_MB * 1024 * 1024 },
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      try {
        const dest = fileManager.resolveUploadDestination(req.body.root, req.body.path || "");
        cb(null, dest);
      } catch (err) {
        cb(err);
      }
    },
    filename: (req, file, cb) => cb(null, path.basename(file.originalname))
  })
});

app.post("/api/nas/upload", auth.requireRole("admin"), (req, res) => {
  if (!fileManager) {
    return res.status(501).json({ error: "Painel do NAS não configurado." });
  }
  nasUpload.single("file")(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });
    res.status(201).json({ ok: true, name: req.file.filename, sizeBytes: req.file.size });
  });
});

// Discos/RAID do próprio Synology, via API do DSM — só aparece se
// DSM_HOST/DSM_USER/DSM_PASSWORD estiverem configurados no .env.
app.get("/api/nas/disks", auth.requireAuth, async (req, res) => {
  if (!synologyClient) {
    return res.status(501).json({ error: "Integração com o DSM não configurada (ver .env.example)." });
  }
  try {
    const disks = await synologyClient.getDisks();
    res.json({ disks });
  } catch (err) {
    console.error("[disk-monitor] Falha ao ler discos do DSM:", err.message);
    res.status(502).json({ error: err.message });
  }
});

// Desliga o NAS de verdade — ação física, irreversível remotamente sem
// Wake-on-LAN configurado. Duas travas: admin-only (já garantido pelo
// requireRole) e uma frase de confirmação exata mandada pelo cliente,
// nunca só o clique do botão.
app.post("/api/nas/shutdown", auth.requireRole("admin"), async (req, res) => {
  if (!synologyClient) {
    return res.status(501).json({ error: "Integração com o DSM não configurada (ver .env.example)." });
  }
  if (req.body?.confirm !== "DESLIGAR") {
    return res.status(400).json({ error: 'Confirmação inválida — digite exatamente "DESLIGAR".' });
  }
  try {
    console.log(
      `[disk-monitor] Desligamento do NAS disparado por "${req.session.user.username}" em ${new Date().toISOString()}`
    );
    await synologyClient.shutdown();
    res.json({ ok: true });
  } catch (err) {
    console.error("[disk-monitor] Falha ao desligar o NAS via DSM:", err.message);
    res.status(502).json({ error: err.message });
  }
});

// Usuário "viewer" só acompanha o painel — mudar configuração e disparar
// limpeza manual é exclusivo de "admin" (decisão do cliente).
app.post("/api/config", auth.requireRole("admin"), (req, res) => {
  const allowedKeys = [
    "thresholdPercent",
    "checkIntervalMinutes",
    "autoCleanupEnabled",
    "dockerLogMaxSizeMB",
    "tmpFilesOlderThanDays",
    "systemLogsOlderThanDays"
  ];
  const partial = {};
  for (const key of allowedKeys) {
    if (req.body[key] !== undefined) partial[key] = req.body[key];
  }
  const config = updateConfig(partial);
  res.json(config);
});

app.post("/api/cleanup", auth.requireRole("admin"), async (req, res) => {
  const result = await triggerCleanup("manual");
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`disk-monitor v${version} rodando em http://localhost:${PORT}`);
});

// Roda a primeira leitura já na subida (não espera o primeiro tick do
// cron) pra o painel não abrir vazio.
checkDiskAndMaybeClean().catch(err =>
  console.error("Falha na checagem inicial de disco:", err)
);

// Varredura de hardware/SO — só roda de verdade na primeira vez (ver
// ensureMachineProfile), então é barato chamar sempre na subida.
ensureMachineProfile().catch(err =>
  console.error("Falha na varredura de hardware/SO:", err)
);

// Reagenda a cada minuto e decide, olhando o config atual, se já passou o
// intervalo configurado — assim dá pra mudar `checkIntervalMinutes` pelo
// painel sem precisar reiniciar o processo pra ele valer.
let lastCheckAt = Date.now();
cron.schedule("* * * * *", () => {
  const config = getConfig();
  const intervalMs = Math.max(1, config.checkIntervalMinutes) * 60 * 1000;
  if (Date.now() - lastCheckAt >= intervalMs) {
    lastCheckAt = Date.now();
    checkDiskAndMaybeClean().catch(err =>
      console.error("Falha na checagem periódica de disco:", err)
    );
  }
});
