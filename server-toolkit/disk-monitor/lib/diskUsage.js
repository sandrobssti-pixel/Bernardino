const checkDiskSpace = require("check-disk-space").default;

// `check-disk-space` sabe ler o espaço em disco tanto no Linux (via
// statvfs) quanto no Windows (via GetDiskFreeSpaceEx) — evita ter que
// escrever e manter duas implementações (`df` num lado, `wmic`/PowerShell
// no outro).
async function readDiskUsage(mountPath = "/") {
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
