const si = require("systeminformation");
const fs = require("fs");
const path = require("path");
const { dataDir } = require("./paths");

const PROFILE_FILE = path.join(dataDir, "machine-profile.json");

// Varredura de hardware/SO da máquina — roda uma vez só, na primeira
// subida depois de instalado (ver ensureMachineProfile). Não é uma
// métrica "ao vivo" como CPU/RAM/disco: é a identidade da máquina —
// útil pra saber o que tem no servidor de relance e, principalmente,
// pra replicar as mesmas características ao montar um servidor novo
// (motivo original desta ferramenta ter nascido reaproveitável).
async function scanMachineProfile() {
  const [cpu, mem, osInfo, system, disks] = await Promise.all([
    si.cpu(),
    si.mem(),
    si.osInfo(),
    si.system(),
    si.fsSize()
  ]);

  return {
    scannedAt: new Date().toISOString(),
    hostname: osInfo.hostname,
    os: {
      platform: osInfo.platform,
      distro: osInfo.distro,
      release: osInfo.release,
      arch: osInfo.arch,
      kernel: osInfo.kernel
    },
    cpu: {
      manufacturer: cpu.manufacturer,
      brand: cpu.brand,
      physicalCores: cpu.physicalCores,
      cores: cpu.cores,
      speedGhz: cpu.speed
    },
    totalMemBytes: mem.total,
    system: {
      manufacturer: system.manufacturer,
      model: system.model
    },
    disks: disks
      .filter(d => d.size > 0)
      .map(d => ({ mount: d.mount, fsType: d.type || d.fs || "", totalBytes: d.size }))
  };
}

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function getMachineProfile() {
  ensureDataDir();
  if (!fs.existsSync(PROFILE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(PROFILE_FILE, "utf8"));
  } catch {
    // arquivo corrompido/parcial — mais seguro varrer de novo do que
    // travar a subida do servidor por causa disso.
    return null;
  }
}

// Só varre e grava se ainda não existir nenhum perfil salvo — hardware e
// SO não mudam sozinhos, então não precisa repetir isso a cada boot do
// serviço (só quando o arquivo não existe: instalação nova, ou alguém
// apagou o data/machine-profile.json de propósito pra forçar uma nova
// varredura, por exemplo depois de trocar o disco/CPU da máquina).
async function ensureMachineProfile() {
  if (getMachineProfile()) return;
  const profile = await scanMachineProfile();
  ensureDataDir();
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2));
}

module.exports = { ensureMachineProfile, getMachineProfile };
