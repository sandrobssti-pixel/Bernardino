const fs = require("fs");
const path = require("path");
const { dataDir } = require("./paths");

const DATA_DIR = dataDir;
const HISTORY_FILE = path.join(DATA_DIR, "history.json");
const ACTIONS_FILE = path.join(DATA_DIR, "actions.json");
const CPU_HISTORY_FILE = path.join(DATA_DIR, "cpu-history.json");
const MEM_HISTORY_FILE = path.join(DATA_DIR, "mem-history.json");
const DISKS_HISTORY_FILE = path.join(DATA_DIR, "disks-history.json");

// Guarda só os últimos N pontos — o painel é pra acompanhar tendência
// recente, não virar um banco de série histórica. Em check a cada 15min,
// 2000 pontos cobrem ~20 dias.
const MAX_HISTORY_POINTS = 2000;
const MAX_ACTIONS = 500;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJsonArray(file) {
  ensureDataDir();
  if (!fs.existsSync(file)) return [];
  try {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // arquivo corrompido/parcial (ex.: processo morto no meio da escrita) —
    // melhor recomeçar do zero do que derrubar o painel inteiro.
    return [];
  }
}

function writeJsonArray(file, list) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(list, null, 2));
}

function appendReading(reading) {
  const history = readJsonArray(HISTORY_FILE);
  history.push(reading);
  const trimmed = history.slice(-MAX_HISTORY_POINTS);
  writeJsonArray(HISTORY_FILE, trimmed);
  return trimmed;
}

function getHistory() {
  return readJsonArray(HISTORY_FILE);
}

function appendAction(action) {
  const actions = readJsonArray(ACTIONS_FILE);
  actions.push(action);
  const trimmed = actions.slice(-MAX_ACTIONS);
  writeJsonArray(ACTIONS_FILE, trimmed);
  return trimmed;
}

function getActions() {
  return readJsonArray(ACTIONS_FILE).slice().reverse();
}

// Mesmo formato/retenção do histórico de disco (lib/diskUsage.js), só que
// pra CPU, RAM e a lista de todos os discos detectados (lib/systemStats.js)
// — séries separadas porque são amostradas juntas mas exibidas em
// gráficos diferentes no painel.
function appendCpuReading(reading) {
  const history = readJsonArray(CPU_HISTORY_FILE);
  history.push(reading);
  const trimmed = history.slice(-MAX_HISTORY_POINTS);
  writeJsonArray(CPU_HISTORY_FILE, trimmed);
  return trimmed;
}

function getCpuHistory() {
  return readJsonArray(CPU_HISTORY_FILE);
}

function appendMemReading(reading) {
  const history = readJsonArray(MEM_HISTORY_FILE);
  history.push(reading);
  const trimmed = history.slice(-MAX_HISTORY_POINTS);
  writeJsonArray(MEM_HISTORY_FILE, trimmed);
  return trimmed;
}

function getMemHistory() {
  return readJsonArray(MEM_HISTORY_FILE);
}

// Guarda só {mount, percent} de cada disco por leitura (não os bytes
// inteiros) — é o suficiente pro gráfico de histórico e mantém o arquivo
// pequeno mesmo com vários discos.
function appendDisksReading(disks) {
  const history = readJsonArray(DISKS_HISTORY_FILE);
  history.push({
    checkedAt: new Date().toISOString(),
    disks: disks.map(d => ({ mount: d.mount, percent: d.percent }))
  });
  const trimmed = history.slice(-MAX_HISTORY_POINTS);
  writeJsonArray(DISKS_HISTORY_FILE, trimmed);
  return trimmed;
}

function getDisksHistory() {
  return readJsonArray(DISKS_HISTORY_FILE);
}

module.exports = {
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
};
