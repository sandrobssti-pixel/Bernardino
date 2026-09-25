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

// Remove container parado, imagem não usada, rede órfã e cache de build —
// nunca remove volume (não passamos `--volumes`), então banco e arquivos
// enviados pelo sistema nunca são tocados por aqui. Mesmo comando nos dois
// sistemas (Docker Desktop no Windows expõe o mesmo `docker` na PATH).
function dockerPrune() {
  return runSafe("docker system prune", () => {
    const output = execSync("docker system prune -af 2>&1", {
      encoding: "utf8"
    });
    return output.trim().split("\n").slice(-3).join(" | ");
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
function runCleanup({ dockerLogMaxSizeMB, tmpFilesOlderThanDays }, diskUsageBefore) {
  const steps = [
    dockerPrune(),
    truncateLargeDockerLogs(dockerLogMaxSizeMB),
    cleanTmp(tmpFilesOlderThanDays)
  ];

  return { steps, diskUsageBefore };
}

module.exports = { runCleanup };
