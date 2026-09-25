const si = require("systeminformation");

// Tudo neste arquivo usa a `systeminformation` (multiplataforma: Linux e
// Windows, mesma chamada nos dois) — só leitura, nunca mexe em nada do
// sistema. Complementa lib/diskUsage.js (que cuida só do disco monitorado
// pra limpeza) com uma visão mais ampla: todos os discos, CPU, RAM e
// processos, pro painel mostrar em tempo real.

// Detecta sozinho todos os discos/partições montados — o usuário não
// precisa informar caminho nenhum. `size`/`used`/`available` já vêm em
// bytes; `use` já vem em percentual (0-100).
async function readAllDisks() {
  const disks = await si.fsSize();
  return disks
    .filter(d => d.size > 0) // ignora entradas virtuais sem tamanho (ex.: alguns pontos de bind mount)
    .map(d => ({
      mount: d.mount,
      fsType: d.type || d.fs || "",
      totalBytes: d.size,
      usedBytes: d.used,
      availBytes: d.available,
      percent: Math.round(d.use)
    }));
}

// `currentLoad` já devolve um percentual médio de todos os núcleos (0-100),
// pronto pra mostrar direto, sem precisar calcular nada aqui.
async function readCpuLoad() {
  const load = await si.currentLoad();
  return {
    percent: Math.round(load.currentLoad),
    checkedAt: new Date().toISOString()
  };
}

// Usa `active` (memória realmente em uso pelos processos) em vez de `used`
// (que no Linux inclui cache/buffer do próprio sistema operacional e faria
// a RAM aparecer sempre quase cheia, o que confunde mais do que ajuda).
async function readMemory() {
  const mem = await si.mem();
  const percent = mem.total > 0 ? Math.round((mem.active / mem.total) * 100) : 0;
  return {
    totalBytes: mem.total,
    usedBytes: mem.active,
    availBytes: mem.available,
    percent,
    checkedAt: new Date().toISOString()
  };
}

// Top N processos por consumo de CPU no instante da chamada — sempre lido
// na hora (nunca fica em cache), pra representar de verdade "tempo real".
async function readTopProcesses(limit = 15) {
  const data = await si.processes();
  return data.list
    .slice()
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, limit)
    .map(p => ({
      pid: p.pid,
      name: p.name,
      cpuPercent: Math.round(p.cpu * 10) / 10,
      memPercent: Math.round(p.mem * 10) / 10,
      memBytes: p.memRss ? p.memRss * 1024 : 0
    }));
}

module.exports = { readAllDisks, readCpuLoad, readMemory, readTopProcesses };
