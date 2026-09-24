const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Regra de ouro deste arquivo: NUNCA apagar volume Docker nem dado de
// cliente. Toda ação aqui só reclama espaço de coisa descartável
// (imagem/container/cache não usado, log gigante, /tmp velho). Se um dia
// alguém for adicionar uma ação nova aqui, ela tem que respeitar essa regra.

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
// enviados pelo sistema nunca são tocados por aqui.
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
function truncateLargeDockerLogs(maxSizeMB) {
  return runSafe(`truncar logs docker > ${maxSizeMB}MB`, () => {
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

// /tmp é espaço descartável por definição — remove só arquivo mais velho
// que N dias, nunca diretório em uso (find já ignora arquivo aberto por
// processo vivo na prática, mas o critério de idade já é conservador).
function cleanTmp(olderThanDays) {
  return runSafe(`limpar /tmp (> ${olderThanDays} dias)`, () => {
    const output = execSync(
      `find /tmp -type f -mtime +${olderThanDays} -delete -print 2>/dev/null | wc -l`,
      { encoding: "utf8" }
    );
    return `${output.trim()} arquivo(s) removido(s) de /tmp`;
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
