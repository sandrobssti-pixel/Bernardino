const path = require("path");
const { baseDir, publicDir } = require("./lib/paths");

// Carrega o .env de ao lado do executável/projeto, nunca do cwd de onde
// o processo foi chamado — assim funciona igual rodando com `node
// server.js` dentro da pasta ou rodando o binário empacotado de
// qualquer diretório (ex.: chamado pelo systemd).
require("dotenv").config({ path: path.join(baseDir, ".env") });

const express = require("express");
const cron = require("node-cron");

const { readDiskUsage } = require("./lib/diskUsage");
const { runCleanup, planDiskCleanup } = require("./lib/cleanup");
const { readPhysicalDisks, readMountedPartitions, diskOfPath } = require("./lib/hardware");
const { getConfig, updateConfig } = require("./lib/configStore");
const {
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
    readMountedPartitions()
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
  // "Uso de disco agora" é lido na hora (não o último ponto do histórico,
  // que só é gravado a cada intervalo de checagem) — assim bate com o card
  // do disco logo depois de uma limpeza.
  const current = await readDiskUsage(MOUNT_PATH).catch(() => history[history.length - 1]);

  const cpuHistory = getCpuHistory();
  const memHistory = getMemHistory();
  const disksHistory = getDisksHistory();

  // Discos e CPU/RAM "agora": se ainda não rodou nenhuma amostragem (painel
  // recém-instalado), lê na hora em vez de esperar o próximo tick do cron.
  const disks = disksHistory.length
    ? disksHistory[disksHistory.length - 1].disks
    : (await readMountedPartitions()).map(d => ({ mount: d.mount, percent: d.percent }));
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
  const [physicalDisks, current] = await Promise.all([
    readPhysicalDisks(getConfig().diskNames),
    readDiskUsage(MOUNT_PATH).catch(() => null)
  ]);
  res.json({
    cpuHistory: liveCpuHistory,
    memHistory: liveMemHistory,
    physicalDisks,
    current
  });
});

// Discos FÍSICOS (disco → partições) com uso em tempo real — é o que o
// painel mostra nos cards e no painel de detalhe de cada disco.
app.get("/api/disks", auth.requireAuth, async (req, res) => {
  res.json({ disks: await readPhysicalDisks(getConfig().diskNames) });
});

// O que a limpeza faria NESTE disco (tarefas cujas pastas ficam nele) e
// quanto estima liberar. Só leitura — viewer também pode ver.
app.get("/api/disks/:id/cleanup-plan", auth.requireAuth, async (req, res) => {
  const disks = await readPhysicalDisks(getConfig().diskNames);
  const disk = disks.find(item => item.id === req.params.id);
  if (!disk) return res.status(404).json({ error: "Disco não encontrado" });
  const plan = planDiskCleanup(disk, disks, getConfig(), diskOfPath);
  res.json({
    disk: { id: disk.id, model: disk.model, device: disk.device },
    tasks: plan.map(item => ({
      id: item.task.id,
      label: item.task.label,
      partitionMount: item.partitionMount,
      estimateBytes: item.estimateBytes,
      estimateIsTotal: item.estimateIsTotal
    }))
  });
});

// Nome próprio de um disco/NAS (ex.: "HD Seafile"), para identificar cada
// um no painel. Texto vazio volta ao nome automático. Admin apenas.
app.post("/api/disks/:id/name", auth.requireRole("admin"), async (req, res) => {
  const config = getConfig();
  const disk = (await readPhysicalDisks(config.diskNames)).find(item => item.id === req.params.id);
  if (!disk) return res.status(404).json({ error: "Disco não encontrado" });
  const name = String((req.body && req.body.name) || "").trim().slice(0, 60);
  const diskNames = { ...(config.diskNames || {}) };
  if (name) diskNames[disk.nameKey] = name;
  else delete diskNames[disk.nameKey];
  updateConfig({ diskNames });
  res.json({ id: disk.id, customName: name });
});

// Limpa logs e arquivos desnecessários SÓ do disco escolhido e mede o espaço
// liberado em cada partição (antes/depois). Admin apenas.
app.post("/api/disks/:id/cleanup", auth.requireRole("admin"), async (req, res) => {
  if (cleanupRunning) return res.json({ skipped: true, reason: "já tem uma limpeza em andamento" });
  cleanupRunning = true;
  try {
    const before = await readPhysicalDisks(getConfig().diskNames);
    const disk = before.find(item => item.id === req.params.id);
    if (!disk) return res.status(404).json({ error: "Disco não encontrado" });

    const plan = planDiskCleanup(disk, before, getConfig(), diskOfPath);
    const steps = plan.map(item => item.task.run());

    const after = (await readPhysicalDisks(getConfig().diskNames)).find(item => item.id === disk.id) || disk;
    // Ponto novo no histórico já com o espaço liberado (gráfico e "Uso de
    // disco agora" não esperam o próximo intervalo de checagem).
    appendReading(await readDiskUsage(MOUNT_PATH));
    const partitions = disk.partitions
      .filter(part => part.mount && part.usedBytes !== null)
      .map(part => {
        const now = after.partitions.find(p => p.id === part.id) || part;
        return {
          mount: part.mount,
          percentBefore: part.percent,
          percentAfter: now.percent,
          freedBytes: Math.max(0, part.usedBytes - (now.usedBytes ?? part.usedBytes))
        };
      });
    const freedBytes = partitions.reduce((sum, part) => sum + part.freedBytes, 0);

    const action = {
      timestamp: new Date().toISOString(),
      trigger: "manual",
      disk: `${disk.model || disk.device} (${disk.device})`,
      percentBefore: disk.usage ? disk.usage.percent : null,
      percentAfter: after.usage ? after.usage.percent : null,
      freedMB: Math.round(freedBytes / 1024 / 1024),
      steps
    };
    appendAction(action);
    res.json({ ...action, partitions });
  } finally {
    cleanupRunning = false;
  }
});

// Perfil da máquina (hardware/SO) — varrido uma vez só, na instalação (ver
// ensureMachineProfile mais abaixo), não muda a cada request.
app.get("/api/machine-profile", auth.requireAuth, (req, res) => {
  res.json({ profile: getMachineProfile() });
});

// Lista de processos é sempre lida na hora (nunca fica em cache/histórico)
// — é o que dá o efeito de "tempo real" pedido pelo cliente.
app.get("/api/processes", auth.requireAuth, async (req, res) => {
  const processes = await readTopProcesses(15);
  res.json({ processes });
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
