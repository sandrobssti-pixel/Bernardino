const fs = require("fs");
const path = require("path");
const { dataDir } = require("./paths");

const DATA_DIR = dataDir;
const HISTORY_FILE = path.join(DATA_DIR, "history.json");
const ACTIONS_FILE = path.join(DATA_DIR, "actions.json");

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

module.exports = {
  appendReading,
  getHistory,
  appendAction,
  getActions
};
