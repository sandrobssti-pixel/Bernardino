const { execFileSync } = require("child_process");

// Lê o uso de disco via `df` (POSIX, existe em qualquer Linux) — evita
// depender de nenhuma lib externa só pra isso.
function readDiskUsage(mountPath = "/") {
  const output = execFileSync(
    "df",
    ["-B1", "--output=size,used,avail,pcent", mountPath],
    { encoding: "utf8" }
  );

  const lines = output.trim().split("\n");
  const dataLine = lines[lines.length - 1].trim().split(/\s+/);
  const [sizeBytes, usedBytes, availBytes, pcent] = dataLine;

  return {
    mountPath,
    totalBytes: Number(sizeBytes),
    usedBytes: Number(usedBytes),
    availBytes: Number(availBytes),
    percent: Number(String(pcent).replace("%", "")),
    checkedAt: new Date().toISOString()
  };
}

module.exports = { readDiskUsage };
