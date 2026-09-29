const { execFileSync } = require("child_process");

// Diagnóstico de um disco físico específico — SEMPRE só leitura, nunca
// escreve nem corrige nada sozinho. Duas fontes:
//
// 1. `smartctl -a <device> --json` (smartmontools) — atributos SMART já
//    reportados pelo próprio disco (setores realocados/pendentes, horas
//    ligado, temperatura). Se `smartctl` não estiver instalado no
//    servidor, retorna "indisponível" (nunca trata como erro).
// 2. Log do kernel (`journalctl -k` no Linux) filtrado pelo nome do
//    dispositivo, procurando por erro de E/S ou bloco defeituoso — sinal
//    real de problema de hardware, sem precisar rodar fsck num sistema
//    de arquivos montado (rodar fsck em disco montado é arriscado e foi
//    deliberadamente evitado aqui).

const isWindows = process.platform === "win32";
const isMac = process.platform === "darwin";

function runReadOnly(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function readSmartReport(device) {
  return runReadOnly(() => {
    const output = execFileSync("smartctl", ["-a", device, "--json"], {
      encoding: "utf8",
      timeout: 8000
    });
    const data = JSON.parse(output);
    const attrs = {};
    for (const a of data.ata_smart_attributes?.table || []) {
      if (["Reallocated_Sector_Ct", "Current_Pending_Sector", "Power_On_Hours", "Reported_Uncorrect"].includes(a.name)) {
        attrs[a.name] = a.raw?.value ?? a.raw?.string ?? null;
      }
    }
    return {
      available: true,
      healthy: data.smart_status?.passed !== false,
      temperatureCelsius: data.temperature?.current ?? null,
      powerOnHours: attrs.Power_On_Hours ?? null,
      reallocatedSectors: attrs.Reallocated_Sector_Ct ?? null,
      pendingSectors: attrs.Current_Pending_Sector ?? null,
      uncorrectableErrors: attrs.Reported_Uncorrect ?? null
    };
  }, { available: false });
}

// Só Linux — nem Windows (não existe journalctl, o Visor de Eventos
// exige integração própria) nem macOS (log unificado da Apple, outra
// ferramenta/formato) têm isso implementado ainda; fica documentado no
// README como limitação conhecida.
function readKernelErrors(deviceBaseName) {
  if (isWindows || isMac || !deviceBaseName) return { available: false, entries: [] };
  return runReadOnly(() => {
    const output = execFileSync(
      "journalctl",
      ["-k", "-n", "1000", "--no-pager", "-g", deviceBaseName],
      { encoding: "utf8", timeout: 8000 }
    );
    const errorKeywords = /error|fail|bad block|i\/o error|timeout/i;
    const entries = output
      .split("\n")
      .filter(line => line.trim() && errorKeywords.test(line))
      .slice(-10);
    return { available: true, entries };
  }, { available: false, entries: [] });
}

function checkDiskHealth(device) {
  const deviceBaseName = (device || "").replace(/^\/dev\//, "");
  return {
    device,
    checkedAt: new Date().toISOString(),
    smart: readSmartReport(device),
    kernelErrors: readKernelErrors(deviceBaseName)
  };
}

module.exports = { checkDiskHealth };
