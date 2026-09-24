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
const { runCleanup } = require("./lib/cleanup");
const { getConfig, updateConfig } = require("./lib/configStore");
const {
  appendReading,
  getHistory,
  appendAction,
  getActions
} = require("./lib/historyStore");
const { basicAuth } = require("./lib/auth");
const { version } = require("./lib/version");

const PORT = process.env.PORT || 8091;
const MOUNT_PATH = process.env.MOUNT_PATH || "/";
const DASHBOARD_USER = process.env.DASHBOARD_USER || "admin";
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;

if (!DASHBOARD_PASSWORD) {
  console.error(
    "DASHBOARD_PASSWORD não definido no .env — configure antes de rodar (ver .env.example)."
  );
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(basicAuth(DASHBOARD_USER, DASHBOARD_PASSWORD));
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
    const before = readDiskUsage(MOUNT_PATH);
    const config = getConfig();
    const result = runCleanup(config, before);
    const after = readDiskUsage(MOUNT_PATH);

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

async function checkDiskAndMaybeClean() {
  const reading = readDiskUsage(MOUNT_PATH);
  appendReading(reading);

  const config = getConfig();
  if (config.autoCleanupEnabled && reading.percent >= config.thresholdPercent) {
    await triggerCleanup("auto");
  }
}

app.get("/api/status", (req, res) => {
  const config = getConfig();
  const history = getHistory();
  const current = history[history.length - 1] || readDiskUsage(MOUNT_PATH);
  res.json({
    current,
    history,
    actions: getActions(),
    config,
    cleanupRunning,
    version
  });
});

app.post("/api/config", (req, res) => {
  const allowedKeys = [
    "thresholdPercent",
    "checkIntervalMinutes",
    "autoCleanupEnabled",
    "dockerLogMaxSizeMB",
    "tmpFilesOlderThanDays"
  ];
  const partial = {};
  for (const key of allowedKeys) {
    if (req.body[key] !== undefined) partial[key] = req.body[key];
  }
  const config = updateConfig(partial);
  res.json(config);
});

app.post("/api/cleanup", async (req, res) => {
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
