const checkDiskSpace = require("check-disk-space").default;
const si = require("systeminformation");

// `check-disk-space` sabe ler o espaço em disco tanto no Linux (via
// statvfs) quanto no Windows (via GetDiskFreeSpaceEx) — evita ter que
// escrever e manter duas implementações (`df` num lado, `wmic`/PowerShell
// no outro).
//
// No Linux o número vem do mesmo lugar que os cards dos discos físicos
// (si.fsSize = `df`): percentual = usado / (usado + livre), sem contar o
// espaço reservado ao root. Antes o card "Uso de disco agora" contava o
// reservado como usado e mostrava um percentual diferente do card do disco.
async function readFromDf(mountPath) {
  const entry = (await si.fsSize()).find(item => item.mount === mountPath);
  if (!entry || !entry.size) return null;
  return {
    mountPath,
    totalBytes: entry.size,
    usedBytes: entry.used,
    availBytes: entry.available,
    percent: Math.round(entry.use),
    checkedAt: new Date().toISOString()
  };
}

async function readDiskUsage(mountPath = "/") {
  if (process.platform !== "win32") {
    const reading = await readFromDf(mountPath).catch(() => null);
    if (reading) return reading;
  }
  const { free, size } = await checkDiskSpace(mountPath);
  const used = size - free;
  const percent = size > 0 ? Math.round((used / size) * 100) : 0;

  return {
    mountPath,
    totalBytes: size,
    usedBytes: used,
    availBytes: free,
    percent,
    checkedAt: new Date().toISOString()
  };
}

module.exports = { readDiskUsage };
