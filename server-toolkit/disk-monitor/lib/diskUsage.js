const si = require("systeminformation");

// Usa a mesma biblioteca (systeminformation) e o mesmo critério de
// "usado"/"livre" do restante do painel (ver lib/diskTopology.js) — já
// foi usado o `check-disk-space` aqui antes, mas ele calcula "livre" de
// um jeito diferente no Linux (exclui os blocos reservados pra root,
// ~5% do disco por padrão no ext4), o que fazia esse valor divergir do
// card "Discos físicos" pro MESMO disco. Unificado numa fonte só pra
// nunca mais mostrar dois números diferentes pra mesma coisa.
async function readDiskUsage(mountPath = "/") {
  const fsList = await si.fsSize();
  const match =
    fsList.find(fs => fs.mount === mountPath) ||
    fsList.find(fs => mountPath.toLowerCase().startsWith(fs.mount.toLowerCase())) ||
    null;

  const size = match ? match.size || 0 : 0;
  const used = match ? match.used || 0 : 0;
  const free = Math.max(0, size - used);
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
