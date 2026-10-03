const si = require("systeminformation");

// Agrupa os discos físicos detectados (si.diskLayout) com as partições
// montadas dentro de cada um (cruzando com si.fsSize via si.blockDevices),
// e separa em três grupos: discos internos, discos USB removíveis, e
// compartilhamentos de rede (NAS via SMB/NFS — que não têm disco físico
// "pai" nesta máquina). Tudo leitura, nunca altera nada no disco.
//
// Honestidade: o cruzamento de partição -> disco pai usa o prefixo do
// nome do dispositivo (ex.: "sda1" pertence a "sda"), porque nem toda
// versão do systeminformation expõe esse vínculo pronto. Funciona bem em
// Linux (sd*, nvme*n*, vd*, hd*); em Windows o agrupamento por disco
// físico fica mais limitado (a API do SO expõe menos detalhe aqui).

const NETWORK_FS_TYPES = new Set(["cifs", "nfs", "nfs4", "smbfs", "smb"]);

// si.diskLayout() lê SMART de cada disco físico chamando `smartctl` por
// baixo dos panos — num disco USB que não responde direito a comandos
// ATA, isso pode travar por muito tempo em vez de simplesmente falhar.
// Limite de tempo evita que o painel fique "carregando..." pra sempre
// por causa de UM disco problemático.
const DISK_LAYOUT_TIMEOUT_MS = 8000;

function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms))
  ]);
}

function parentDiskName(blockDeviceName) {
  if (!blockDeviceName) return null;
  const match = blockDeviceName.match(/^(nvme\d+n\d+|mmcblk\d+|sd[a-z]+|hd[a-z]+|vd[a-z]+|xvd[a-z]+)/);
  return match ? match[1] : blockDeviceName.replace(/\d+$/, "");
}

async function readDiskTopology(systemMountPath) {
  const [layout, fsList, blockDevices] = await Promise.all([
    withTimeout(si.diskLayout().catch(() => []), DISK_LAYOUT_TIMEOUT_MS, []),
    si.fsSize().catch(() => []),
    si.blockDevices().catch(() => [])
  ]);

  const parentByMount = new Map();
  for (const bd of blockDevices) {
    if (bd.mount) parentByMount.set(bd.mount, parentDiskName(bd.name));
  }

  const claimedMounts = new Set();

  const disksWithPartitions = layout.map(disk => {
    const shortName = (disk.device || "").replace(/^\/dev\//, "");
    const partitions = fsList
      .filter(fs => parentByMount.get(fs.mount) === shortName)
      .map(fs => {
        claimedMounts.add(fs.mount);
        return {
          mount: fs.mount,
          fsType: fs.type || "",
          sizeBytes: fs.size || 0,
          usedBytes: fs.used || 0,
          availBytes: Math.max(0, (fs.size || 0) - (fs.used || 0)),
          percent: fs.size ? Math.round((fs.used / fs.size) * 100) : 0,
          isSystemMount: fs.mount === systemMountPath
        };
      });

    const interfaceType = (disk.interfaceType || "").toUpperCase();
    return {
      device: disk.device || shortName,
      name: disk.name || shortName || "—",
      vendor: disk.vendor || "",
      serialNum: disk.serialNum || "",
      sizeBytes: disk.size || 0,
      interfaceType: disk.interfaceType || "",
      isUsb: interfaceType.includes("USB"),
      // smartStatus/temperature vêm vazios se o SO não tiver smartmontools
      // instalado (ou não tiver permissão) — o painel mostra "indisponível"
      // nesse caso, nunca trata como erro.
      smartStatus: disk.smartStatus || null,
      temperatureCelsius: typeof disk.temperature === "number" ? disk.temperature : null,
      partitions
    };
  });

  const networkShares = fsList
    .filter(fs => !claimedMounts.has(fs.mount) && NETWORK_FS_TYPES.has((fs.type || "").toLowerCase()))
    .map(fs => ({
      mount: fs.mount,
      fsType: fs.type || "",
      sizeBytes: fs.size || 0,
      usedBytes: fs.used || 0,
      availBytes: Math.max(0, (fs.size || 0) - (fs.used || 0)),
      percent: fs.size ? Math.round((fs.used / fs.size) * 100) : 0
    }));

  return {
    internalDisks: disksWithPartitions.filter(d => !d.isUsb),
    usbDisks: disksWithPartitions.filter(d => d.isUsb),
    networkShares
  };
}

module.exports = { readDiskTopology };
