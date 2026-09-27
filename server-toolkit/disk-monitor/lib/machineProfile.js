const si = require("systeminformation");
const { readPhysicalDisks } = require("./hardware");
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
  const [cpu, mem, osInfo, system, physicalDisks] = await Promise.all([
    si.cpu(),
    si.mem(),
    si.osInfo(),
    si.system(),
    readPhysicalDisks().then(disks => disks.filter(disk => disk.group === "physical"))
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
    // Arquitetura de discos da máquina: disco físico → partições (tamanho,
    // sistema de arquivos, onde monta). Substitui a lista de pontos de
    // montagem (que trazia camadas do Docker, NAS etc.).
    physicalDisks: physicalDisks.map(d => ({
      id: d.id,
      device: d.device,
      model: d.model,
      kind: d.kind,
      transport: d.transport,
      system: d.system,
      sizeBytes: d.sizeBytes,
      partitions: d.partitions.map(p => ({ id: p.id, sizeBytes: p.sizeBytes, fsType: p.fsType, mount: p.mount, swap: p.swap }))
    })),
    disks: physicalDisks.map(d => ({ mount: d.device, fsType: d.kind, totalBytes: d.sizeBytes }))
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
  const current = getMachineProfile();
  // Perfil de versão antiga (sem o mapa de discos físicos): varre de novo.
  if (current && Array.isArray(current.physicalDisks)) return;
  const profile = await scanMachineProfile();
  ensureDataDir();
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2));
}

module.exports = { ensureMachineProfile, getMachineProfile };
