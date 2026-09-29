const { execFileSync } = require("child_process");
const si = require("systeminformation");

// Particionar/formatar um disco inteiro — a ação mais destrutiva e
// irreversível deste painel (apaga TODO o conteúdo do disco escolhido).
// Por isso, três camadas de proteção, nenhuma opcional:
//
// 1. NUNCA elegível se qualquer partição desse disco estiver montada
//    agora (reconfere direto em si.blockDevices() a cada chamada, não
//    confia em nada que o cliente mandou) — isso sozinho já impede
//    formatar o disco do sistema, qualquer disco de dados em uso, ou
//    qualquer coisa montada.
// 2. `preview` só MONTA os comandos como texto — nunca executa nada.
//    `execute` exige exatamente essa mesma checagem de novo, mais duas
//    confirmações explícitas do cliente (caminho do disco + frase).
// 3. Só Linux por enquanto — no Windows a API é bem diferente
//    (diskpart/PowerShell) e não foi implementada ainda; retorna erro
//    claro em vez de tentar algo não testado.

const isWindows = process.platform === "win32";
const CONFIRM_PHRASE = "FORMATAR";

function parentDiskName(blockDeviceName) {
  if (!blockDeviceName) return null;
  const match = blockDeviceName.match(/^(nvme\d+n\d+|mmcblk\d+|sd[a-z]+|hd[a-z]+|vd[a-z]+|xvd[a-z]+)/);
  return match ? match[1] : blockDeviceName.replace(/\d+$/, "");
}

// Reconfere na hora se o disco está livre pra mexer — chamado tanto no
// preview (só informativo) quanto, de novo, bem antes de executar.
async function checkEligibility(device) {
  if (isWindows) {
    return { eligible: false, reason: "Particionamento ainda não implementado no Windows." };
  }
  const shortName = (device || "").replace(/^\/dev\//, "");
  if (!shortName) {
    return { eligible: false, reason: "Disco não informado." };
  }
  const blockDevices = await si.blockDevices().catch(() => []);
  const exists = blockDevices.some(bd => bd.name === shortName || parentDiskName(bd.name) === shortName);
  if (!exists) {
    return { eligible: false, reason: "Disco não encontrado no servidor." };
  }
  const mountedPartition = blockDevices.find(
    bd => parentDiskName(bd.name) === shortName && bd.mount
  );
  if (mountedPartition) {
    return {
      eligible: false,
      reason: `O disco tem uma partição montada em "${mountedPartition.mount}" — desmonte tudo antes (isso nunca é feito automaticamente).`
    };
  }
  return { eligible: true, reason: null };
}

const FS_TYPES = new Set(["ext4", "xfs", "exfat"]);

function buildPlan(device, fsType) {
  const type = FS_TYPES.has(fsType) ? fsType : "ext4";
  const shortName = device.replace(/^\/dev\//, "");
  const partitionDevice = /^(nvme|mmcblk)/.test(shortName) ? `${device}p1` : `${device}1`;
  const mkfsCmd = type === "exfat" ? "mkfs.exfat" : `mkfs.${type}`;
  const commands = [
    { cmd: "wipefs", args: ["-a", device] },
    { cmd: "parted", args: ["-s", device, "mklabel", "gpt"] },
    { cmd: "parted", args: ["-s", device, "mkpart", "primary", type === "exfat" ? "ntfs" : type, "0%", "100%"] },
    { cmd: mkfsCmd, args: type === "ext4" ? ["-F", partitionDevice] : [partitionDevice] }
  ];
  return { device, partitionDevice, fsType: type, commands };
}

function planToPreviewLines(plan) {
  return plan.commands.map(c => `${c.cmd} ${c.args.join(" ")}`);
}

async function previewPartition(device, fsType) {
  const plan = buildPlan(device, fsType);
  const eligibility = await checkEligibility(device);
  return { ...eligibility, device, fsType: plan.fsType, partitionDevice: plan.partitionDevice, commands: planToPreviewLines(plan) };
}

async function executePartition(device, fsType) {
  const eligibility = await checkEligibility(device);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason || "Disco não elegível pra particionar.");
  }
  const plan = buildPlan(device, fsType);
  const log = [];
  for (const step of plan.commands) {
    try {
      execFileSync(step.cmd, step.args, { encoding: "utf8", timeout: 60000 });
      log.push({ command: `${step.cmd} ${step.args.join(" ")}`, ok: true });
    } catch (err) {
      log.push({ command: `${step.cmd} ${step.args.join(" ")}`, ok: false, error: String(err.message || err) });
      // Para na primeira falha — nunca tenta o próximo passo (ex.: formatar)
      // se o passo anterior (ex.: criar a partição) não funcionou.
      throw Object.assign(new Error(`Falhou em "${step.cmd}" — veja o log.`), { log });
    }
  }
  return { ok: true, device, partitionDevice: plan.partitionDevice, fsType: plan.fsType, log };
}

module.exports = { previewPartition, executePartition, CONFIRM_PHRASE };
