const fs = require("fs");
const path = require("path");
const { dataDir } = require("./paths");

const DATA_DIR = dataDir;
const CONFIG_FILE = path.join(DATA_DIR, "config.json");

const DEFAULT_CONFIG = {
  thresholdPercent: 85,
  checkIntervalMinutes: 15,
  autoCleanupEnabled: true,
  dockerLogMaxSizeMB: 200,
  tmpFilesOlderThanDays: 7,
  systemLogsOlderThanDays: 14
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getConfig() {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    return { ...DEFAULT_CONFIG, ...raw };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function updateConfig(partial) {
  const current = getConfig();
  const next = { ...current, ...partial };
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2));
  return next;
}

module.exports = { getConfig, updateConfig, DEFAULT_CONFIG };
