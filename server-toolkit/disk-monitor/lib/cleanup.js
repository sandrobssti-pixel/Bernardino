const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Regra de ouro deste arquivo: NUNCA apagar volume Docker nem dado de
// cliente. Toda ação aqui só reclama espaço de coisa descartável
// (imagem/container/cache não usado, log gigante, pasta temporária
// velha). Se um dia alguém for adicionar uma ação nova aqui, ela tem que
// respeitar essa regra. Escrito pra funcionar igual no Linux e no
// Windows (o disk-monitor roda nos dois, ver README.md).

const isWindows = process.platform === "win32";

function runSafe(label, fn) {
  try {
    const detail = fn();
    return { label, ok: true, detail: detail || "" };
  } catch (err) {
    return { label, ok: false, detail: String(err.message || err) };
  }
}

// Limpeza SEGURA do Docker: só imagens órfãs (sem nome, "<none>") e cache
// de build com mais de 7 dias. Não usa `docker system prune -a`: ele apagava
// a imagem com nome de um serviço (ex.: atendeflow-backend:latest) quando o
// container ainda rodava a versão anterior, e também apagava containers
// parados — e aí o serviço não subia mais sem reconstruir. Nunca remove
// volume, container nem imagem com nome.
function dockerPrune() {
  return runSafe("docker prune (seguro)", () => {
    const images = execSync("docker image prune -f 2>&1", { encoding: "utf8" });
    const builder = execSync('docker builder prune -f --filter "until=168h" 2>&1', { encoding: "utf8" });
    const last = text => text.trim().split("\n").slice(-1)[0] || "";
    return `imagens órfãs: ${last(images)} | cache de build: ${last(builder)}`;
  });
}

// Log de container Docker (`*-json.log`) cresce sem limite se o
// docker-compose não configurar rotação — trunca (não apaga o arquivo,
// só zera o conteúdo) os que passarem do limite, o que é seguro: o Docker
// continua escrevendo no mesmo arquivo aberto sem quebrar o container.
// Só existe nesse caminho previsível no Linux — no Windows o Docker
// Desktop guarda isso dentro da VM (WSL2/Hyper-V), sem um caminho de
// arquivo comum pra acessar direto do host, então esse passo é pulado.
function truncateLargeDockerLogs(maxSizeMB) {
  return runSafe(`truncar logs docker > ${maxSizeMB}MB`, () => {
    if (isWindows) {
      return "pulado no Windows (Docker Desktop guarda o log dentro da VM, sem caminho de arquivo direto pelo host)";
    }

    const maxBytes = maxSizeMB * 1024 * 1024;
    const base = "/var/lib/docker/containers";
    if (!fs.existsSync(base)) return "diretório de containers não encontrado (Docker não usa esse caminho aqui?)";

    let truncated = 0;
    let freedBytes = 0;
    for (const containerDir of fs.readdirSync(base)) {
      const logFile = path.join(base, containerDir, `${containerDir}-json.log`);
      if (!fs.existsSync(logFile)) continue;
      const { size } = fs.statSync(logFile);
      if (size > maxBytes) {
        fs.truncateSync(logFile, 0);
        truncated += 1;
        freedBytes += size;
      }
    }
    return `${truncated} log(s) truncado(s), ~${(freedBytes / 1024 / 1024).toFixed(0)}MB liberados`;
  });
}

// Percorre recursivamente `dir` e apaga arquivo mais velho que
// `olderThanMs`, contando quantos removeu — implementação em JS puro (sem
// `find`/shell) pra funcionar igual no Linux e no Windows.
function deleteOldFilesRecursive(dir, olderThanMs) {
  let removed = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return removed; // pasta sumiu/sem permissão no meio do caminho — segue a vida
  }

  const cutoff = Date.now() - olderThanMs;
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        removed += deleteOldFilesRecursive(fullPath, olderThanMs);
        continue;
      }
      const { mtimeMs } = fs.statSync(fullPath);
      if (mtimeMs < cutoff) {
        fs.unlinkSync(fullPath);
        removed += 1;
      }
    } catch {
      // arquivo em uso por outro processo, sem permissão, etc. — pula e
      // continua limpando o resto em vez de abortar tudo.
    }
  }
  return removed;
}

// Compacta os logs do systemd/journald, descartando os mais antigos que
// `olderThanDays` — só marca como "vazio" o espaço, quem decide o que
// journald apaga de fato é o próprio `journalctl` (nunca mexemos direto
// em arquivo de log do sistema). Só existe em distros com systemd; no
// Windows (Visualizador de Eventos é outra coisa, gerido de outro jeito)
// esse passo aparece "pulado", igual ao truncamento de log do Docker.
function cleanSystemLogs(olderThanDays) {
  return runSafe(`limpar logs do sistema (> ${olderThanDays} dias)`, () => {
    if (isWindows) {
      return "pulado no Windows (log de eventos do Windows é gerido de outro jeito, fora do escopo desta limpeza)";
    }
    const output = execSync(`journalctl --vacuum-time=${olderThanDays}d 2>&1`, {
      encoding: "utf8"
    });
    return output.trim().split("\n").slice(-2).join(" | ");
  });
}

// Pasta temporária do sistema é espaço descartável por definição — remove
// só arquivo mais velho que N dias, nunca a pasta inteira de uma vez.
// `os.tmpdir()` já resolve certo em cada sistema (`/tmp` no Linux,
// `C:\Users\<usuário>\AppData\Local\Temp` no Windows).
function cleanTmp(olderThanDays) {
  const tmpDir = os.tmpdir();
  return runSafe(`limpar pasta temporária (> ${olderThanDays} dias) [${tmpDir}]`, () => {
    const removed = deleteOldFilesRecursive(tmpDir, olderThanDays * 24 * 60 * 60 * 1000);
    return `${removed} arquivo(s) removido(s)`;
  });
}

// Roda a limpeza completa e mede o espaço realmente liberado (antes/depois),
// que é mais confiável do que somar estimativa de cada etapa.
function runCleanup(
  { dockerLogMaxSizeMB, tmpFilesOlderThanDays, systemLogsOlderThanDays },
  diskUsageBefore
) {
  const steps = [
    dockerPrune(),
    truncateLargeDockerLogs(dockerLogMaxSizeMB),
    cleanSystemLogs(systemLogsOlderThanDays),
    cleanTmp(tmpFilesOlderThanDays)
  ];

  return { steps, diskUsageBefore };
}

// ---------------------------------------------------------------------------
// Limpeza POR DISCO (painel: clicar no disco → "Limpar logs e arquivos
// desnecessários"). Cada tarefa sabe em que pasta atua; só entram as tarefas
// cujas pastas ficam no disco escolhido (ver lib/hardware.js diskOfPath).
// Mesma regra de ouro: só coisa descartável, nunca volume/dado de cliente.
// ---------------------------------------------------------------------------

const ROTATED_LOG = /\.(gz|xz|bz2|zip|old)$|\.\d+$/;

// Tamanho de uma pasta (com limite de arquivos, para não travar em pasta
// enorme). `filter(fullPath, stat)` escolhe o que conta.
function dirSize(dir, filter = () => true, budget = { left: 200000 }) {
  let total = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (budget.left-- <= 0) break;
    const full = path.join(dir, entry.name);
    try {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        total += dirSize(full, filter, budget);
        continue;
      }
      const stat = fs.statSync(full);
      if (filter(full, stat)) total += stat.size;
    } catch {
      // sem permissão / sumiu — ignora
    }
  }
  return total;
}

const olderThan = days => (_full, stat) => stat.mtimeMs < Date.now() - days * 86400000;

function deleteMatching(dir, predicate) {
  let removed = 0;
  let freed = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return { removed, freed };
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    try {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        const sub = deleteMatching(full, predicate);
        removed += sub.removed;
        freed += sub.freed;
        continue;
      }
      const stat = fs.statSync(full);
      if (predicate(full, stat)) {
        fs.unlinkSync(full);
        removed += 1;
        freed += stat.size;
      }
    } catch {
      // arquivo em uso / sem permissão — segue
    }
  }
  return { removed, freed };
}

const mb = bytes => `${(bytes / 1024 / 1024).toFixed(0)}MB`;

function dockerRootDir() {
  try {
    return execSync("docker info -f '{{.DockerRootDir}}' 2>/dev/null", { encoding: "utf8", timeout: 5000 }).trim() || null;
  } catch {
    return null;
  }
}

function journalDiskUsage() {
  try {
    const out = execSync("journalctl --disk-usage 2>/dev/null", { encoding: "utf8", timeout: 5000 });
    const match = out.match(/([\d.]+)\s*([KMGT])/i);
    if (!match) return null;
    const power = { K: 1, M: 2, G: 3, T: 4 }[match[2].toUpperCase()];
    return Math.round(Number(match[1]) * 1024 ** power);
  } catch {
    return null;
  }
}

// Pastas de lixeira dos usuários e das partições (.Trash-<uid>).
function trashDirs(mounts) {
  const dirs = [];
  for (const mount of mounts) {
    try {
      for (const name of fs.readdirSync(mount)) {
        if (/^\.Trash(-\d+)?$/.test(name)) dirs.push(path.join(mount, name));
      }
    } catch {
      // partição sem permissão de leitura na raiz
    }
  }
  for (const home of ["/root", ...(() => {
    try {
      return fs.readdirSync("/home").map(user => path.join("/home", user));
    } catch {
      return [];
    }
  })()]) {
    const trash = path.join(home, ".local/share/Trash");
    if (fs.existsSync(trash)) dirs.push(trash);
  }
  return dirs;
}

// Catálogo de tarefas (Linux). Cada uma: onde atua, quanto estima liberar e
// como executar. `config` = mesmas opções do painel (dias/tamanhos).
function cleanupCatalog(config) {
  const tmpDays = config.tmpFilesOlderThanDays;
  const logDays = config.systemLogsOlderThanDays;

  if (isWindows) {
    return [
      {
        id: "tmp",
        label: `Arquivos temporários com mais de ${tmpDays} dias`,
        paths: [os.tmpdir()],
        estimate: () => dirSize(os.tmpdir(), olderThan(tmpDays)),
        run: () => cleanTmp(tmpDays)
      }
    ];
  }

  const dockerRoot = dockerRootDir();
  const tasks = [];

  if (dockerRoot) {
    tasks.push({
      id: "docker",
      label: "Docker: imagens órfãs, cache de build antigo e logs de container gigantes",
      paths: [dockerRoot],
      estimate: () => dirSize(path.join(dockerRoot, "containers"), (full, stat) => full.endsWith("-json.log") && stat.size > config.dockerLogMaxSizeMB * 1024 * 1024),
      run: () => {
        const prune = dockerPrune();
        const logs = truncateLargeDockerLogs(config.dockerLogMaxSizeMB);
        return { label: "Docker", ok: prune.ok && logs.ok, detail: `${prune.detail} | ${logs.detail}` };
      }
    });
  }

  tasks.push(
    {
      id: "journal",
      label: `Logs do sistema (journald) com mais de ${logDays} dias`,
      paths: ["/var/log/journal"],
      estimate: () => journalDiskUsage(),
      estimateIsTotal: true,
      run: () => cleanSystemLogs(logDays)
    },
    {
      id: "rotated-logs",
      label: `Logs antigos compactados/rotacionados em /var/log com mais de ${logDays} dias`,
      paths: ["/var/log"],
      estimate: () => dirSize("/var/log", (full, stat) => ROTATED_LOG.test(full) && olderThan(logDays)(full, stat)),
      run: () =>
        runSafe("logs rotacionados", () => {
          const { removed, freed } = deleteMatching("/var/log", (full, stat) => ROTATED_LOG.test(full) && olderThan(logDays)(full, stat));
          return `${removed} arquivo(s), ${mb(freed)} liberados`;
        })
    },
    {
      id: "apt-cache",
      label: "Cache de pacotes baixados (apt)",
      paths: ["/var/cache/apt/archives"],
      estimate: () => dirSize("/var/cache/apt/archives", full => full.endsWith(".deb")),
      run: () =>
        runSafe("cache do apt", () => {
          execSync("apt-get clean 2>&1", { encoding: "utf8", timeout: 60000 });
          return "cache de pacotes limpo";
        })
    },
    {
      id: "tmp",
      label: `Arquivos temporários (/tmp e /var/tmp) com mais de ${tmpDays} dias`,
      paths: [os.tmpdir(), "/var/tmp"],
      estimate: () => dirSize(os.tmpdir(), olderThan(tmpDays)) + dirSize("/var/tmp", olderThan(tmpDays)),
      run: () =>
        runSafe("temporários", () => {
          const a = deleteMatching(os.tmpdir(), olderThan(tmpDays));
          const b = deleteMatching("/var/tmp", olderThan(tmpDays));
          return `${a.removed + b.removed} arquivo(s), ${mb(a.freed + b.freed)} liberados`;
        })
    }
  );

  return tasks;
}

// Tarefas que valem para um disco (pastas que ficam nele), com estimativa.
function planDiskCleanup(disk, disks, config, diskOfPath) {
  // NAS/compartilhamento de rede: só monitora, nunca apaga nada lá.
  if (disk.network) return [];
  const onDisk = targetPath => {
    const hit = diskOfPath(disks, targetPath);
    return hit && hit.disk.id === disk.id ? hit.partition : null;
  };

  const tasks = [];
  for (const task of cleanupCatalog(config)) {
    const partitions = task.paths.map(onDisk).filter(Boolean);
    if (!partitions.length) continue;
    let estimateBytes = null;
    try {
      estimateBytes = task.estimate();
    } catch {
      estimateBytes = null;
    }
    tasks.push({ task, partitionMount: partitions[0].mount, estimateBytes, estimateIsTotal: Boolean(task.estimateIsTotal) });
  }

  // Lixeiras que ficam neste disco.
  if (!isWindows) {
    const mounts = disk.partitions.map(part => part.mount).filter(Boolean);
    const trash = trashDirs(mounts).filter(dir => onDisk(dir));
    if (trash.length) {
      const days = config.tmpFilesOlderThanDays;
      tasks.push({
        task: {
          id: "trash",
          label: `Lixeira (arquivos já apagados) com mais de ${days} dias`,
          run: () =>
            runSafe("lixeira", () => {
              let removed = 0;
              let freed = 0;
              for (const dir of trash) {
                const result = deleteMatching(dir, olderThan(days));
                removed += result.removed;
                freed += result.freed;
              }
              return `${removed} arquivo(s), ${mb(freed)} liberados`;
            })
        },
        partitionMount: onDisk(trash[0]).mount,
        estimateBytes: trash.reduce((sum, dir) => sum + dirSize(dir, olderThan(days)), 0),
        estimateIsTotal: false
      });
    }
  }
  return tasks;
}

module.exports = { runCleanup, planDiskCleanup, dirSize, deleteMatching };
