const { execFileSync } = require("child_process");
const fs = require("fs");
const si = require("systeminformation");

// Discos FÍSICOS da máquina, cada um com as suas partições — é o que o
// painel mostra. Antes o painel usava si.fsSize(), que lista TODO ponto de
// montagem (camadas overlay do Docker, bind mounts de container, NAS/cifs,
// tmpfs...) e aparecia "um monte de HD". Aqui a fonte é o hardware:
//   - Linux: `lsblk` (árvore disco → partição → LVM/cripto), cruzado com o
//     espaço usado de cada ponto de montagem (statfs via si.fsSize).
//   - Windows: cada unidade (C:, D:...) vira um disco com uma partição
//     (mapear partição → disco físico no Windows exige WMI por disco; fica
//     para uma próxima versão).
// O painel separa em 4 grupos: discos físicos internos, externos (USB),
// NAS (cifs/smb/nfs) e nuvem montada (rclone, s3fs, davfs...). NAS e nuvem
// não são disco da máquina, mas o cliente quer ver o espaço deles.
// Cada disco, partição e compartilhamento ganha uma identificação (papel:
// Sistema, Boot EFI, Seafile, Backup...) e o admin pode dar um nome próprio.
// Só leitura: nunca monta, formata nem altera nada.

const isWindows = process.platform === "win32";

// Dispositivos que não são disco de verdade.
const IGNORED_DISK = /^(loop|zram|ram|sr|fd|nbd|md\d+p)/;

const toNumber = value => (value === null || value === undefined || value === "" ? 0 : Number(value)) || 0;
const toBool = value => value === true || value === 1 || value === "1" || value === "true";

// Grupos do painel: "physical" (HD/SSD interno), "external" (USB/removível),
// "nas" (compartilhamento de rede) e "cloud" (nuvem montada: rclone, s3fs...).
const NAS_FS = /^(cifs|smb3?|smbfs|nfs4?|fuse\.sshfs|sshfs|9p|afpfs)$/i;
const CLOUD_FS = /^(davfs|fuse\.(rclone|s3fs|gcsfuse|goofys|geesefs|onedriver|google-drive-ocamlfuse|blobfuse2?|juicefs|seadrive|mount-s3|dropbox))$/i;


const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);

// Papel de uma partição/compartilhamento a partir do ponto de montagem e do
// rótulo. `role` é um código (o painel traduz), `roleName` é o texto pronto
// para quando não há tradução (nome da pasta).
function partitionRole(part) {
  const mount = (part.mount || "").toLowerCase();
  const hint = `${mount} ${(part.label || "").toLowerCase()}`;
  if (part.swap) return { role: "swap", roleName: "Swap" };
  if (!part.mount) return { role: "unmounted", roleName: "" };
  if (mount === "/" || /^c:\\?$/.test(mount)) return { role: "system", roleName: "" };
  if (mount === "/boot/efi" || mount === "/efi") return { role: "efi", roleName: "" };
  if (mount === "/boot") return { role: "boot", roleName: "" };
  if (mount === "/home" || mount.startsWith("/home/")) return { role: "home", roleName: "" };
  if (/seafile/.test(hint)) return { role: "seafile", roleName: "Seafile" };
  if (/backup|bkp/.test(hint)) return { role: "backup", roleName: "" };
  if (/confian[cz]a/.test(hint)) return { role: "confianza", roleName: "Confianza" };
  if (/docker/.test(hint)) return { role: "docker", roleName: "Docker" };
  const base = String(String(part.label || part.mount).split(/[\\/]/).filter(Boolean).pop() || part.mount)
    .replace(/^nas[-_ ]?/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return { role: "data", roleName: base ? capitalize(base) : "" };
}

const runLsblk = () => {
  const withPath = ["-J", "-b", "-o", "NAME,KNAME,PATH,TYPE,SIZE,MODEL,SERIAL,ROTA,TRAN,RM,FSTYPE,LABEL,MOUNTPOINT"];
  try {
    return JSON.parse(execFileSync("lsblk", withPath, { encoding: "utf8", timeout: 5000 }));
  } catch {
    // util-linux antigo não conhece a coluna PATH
    const noPath = ["-J", "-b", "-o", "NAME,KNAME,TYPE,SIZE,MODEL,SERIAL,ROTA,TRAN,RM,FSTYPE,LABEL,MOUNTPOINT"];
    return JSON.parse(execFileSync("lsblk", noPath, { encoding: "utf8", timeout: 5000 }));
  }
};

// Primeiro ponto de montagem do nó ou de um descendente (partição com LVM
// ou cripto em cima: o que monta é o filho).
const findMount = node => {
  if (node.mountpoint && node.mountpoint !== "[SWAP]") return { mount: node.mountpoint, fsType: node.fstype || "" };
  for (const child of node.children || []) {
    const found = findMount(child);
    if (found) return found;
  }
  return null;
};

const isSwap = node =>
  node.fstype === "swap" || node.mountpoint === "[SWAP]" || (node.children || []).some(isSwap);

const partitionFrom = (node, usageByMount) => {
  const found = findMount(node);
  const usage = found ? usageByMount.get(found.mount) : null;
  const size = toNumber(node.size);
  const part = {
    id: node.kname || node.name,
    device: node.path || `/dev/${node.kname || node.name}`,
    label: node.label || "",
    sizeBytes: size,
    fsType: (found && found.fsType) || node.fstype || (node.children || [])[0]?.fstype || "",
    mount: found ? found.mount : null,
    swap: isSwap(node),
    totalBytes: usage ? usage.totalBytes : null,
    usedBytes: usage ? usage.usedBytes : null,
    availBytes: usage ? usage.availBytes : null,
    percent: usage ? usage.percent : null
  };
  return { ...part, ...partitionRole(part) };
};

// Monta a lista de discos a partir da saída do lsblk (separado para teste).
function buildDisksFromLsblk(lsblkJson, usageByMount) {
  const disks = [];
  for (const node of lsblkJson.blockdevices || []) {
    const name = node.kname || node.name || "";
    if (node.type !== "disk" || IGNORED_DISK.test(name) || toNumber(node.size) <= 0) continue;

    const children = node.children || [];
    let partitions = children.filter(child => child.type === "part").map(child => partitionFrom(child, usageByMount));
    // Disco sem tabela de partição (sistema de arquivos direto no disco,
    // ou LVM direto no disco): trata o próprio disco como uma partição.
    if (!partitions.length && (node.mountpoint || node.fstype || children.length)) {
      partitions = [partitionFrom(node, usageByMount)];
    }

    const mounted = partitions.filter(part => part.totalBytes);
    const totalBytes = mounted.reduce((sum, part) => sum + part.totalBytes, 0);
    const usedBytes = mounted.reduce((sum, part) => sum + part.usedBytes, 0);
    const rotational = toBool(node.rota);
    const transport = (node.tran || "").toLowerCase();

    disks.push({
      id: name,
      device: node.path || `/dev/${name}`,
      model: String(node.model || "").trim(),
      serial: String(node.serial || "").trim(),
      sizeBytes: toNumber(node.size),
      kind: transport === "nvme" || name.startsWith("nvme") ? "NVMe" : rotational ? "HDD" : "SSD",
      transport,
      removable: toBool(node.rm),
      // HD externo (USB/removível): fica oculto no painel por padrão.
      external: toBool(node.rm) || transport === "usb",
      group: toBool(node.rm) || transport === "usb" ? "external" : "physical",
      system: partitions.some(part => part.mount === "/"),
      partitions,
      usage: mounted.length
        ? {
            totalBytes,
            usedBytes,
            availBytes: mounted.reduce((sum, part) => sum + part.availBytes, 0),
            percent: totalBytes ? Math.round((usedBytes / totalBytes) * 100) : 0
          }
        : null
    });
  }
  // Disco do sistema primeiro, depois pela ordem do kernel (sda, sdb...).
  return disks.sort((a, b) => Number(b.system) - Number(a.system) || a.id.localeCompare(b.id));
}

// "\040" etc. em /proc/mounts são espaços/caracteres escapados em octal.
const unescapeMount = text => text.replace(/\\([0-7]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));

// Compartilhamentos de rede montados (NAS), a partir do texto de
// /proc/mounts. Viram "discos" com network: true e uma partição só, para o
// painel e o detalhe funcionarem igual aos discos físicos.
function buildNetworkShares(procMountsText, usageByMount) {
  const shares = [];
  const seen = new Set();
  for (const line of String(procMountsText || "").split("\n")) {
    const [rawSource, rawMount, fsType] = line.trim().split(/\s+/);
    if (!rawMount || !(NAS_FS.test(fsType || "") || CLOUD_FS.test(fsType || ""))) continue;
    const mount = unescapeMount(rawMount);
    if (seen.has(mount)) continue;
    seen.add(mount);
    const source = unescapeMount(rawSource).replace(/\\/g, "/");
    const cloud = CLOUD_FS.test(fsType);
    // //192.168.3.21/backup  ou  192.168.3.21:/export/backup
    // gdrive:Pasta  (rclone) · https://nuvem.exemplo/remote.php/dav (davfs)
    const match = cloud
      ? source.match(/^https?:\/\/([^/]+)\/?(.*)$/) || source.match(/^([^:]+):(.*)$/)
      : source.match(/^\/\/([^/]+)\/?(.*)$/) || source.match(/^([^:]+):(.*)$/);
    const server = match ? match[1] : "";
    const share = match ? match[2].replace(/^\/+/, "") : source;
    const usage = usageByMount.get(mount) || null;
    const id = (cloud ? "cloud-" : "nas-") + mount.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const part = {
      id,
      device: source,
      label: share,
      sizeBytes: usage ? usage.totalBytes : 0,
      fsType: fsType.toLowerCase(),
      mount,
      swap: false,
      totalBytes: usage ? usage.totalBytes : null,
      usedBytes: usage ? usage.usedBytes : null,
      availBytes: usage ? usage.availBytes : null,
      percent: usage ? usage.percent : null
    };
    shares.push({
      id,
      device: source,
      model: "",
      serial: "",
      sizeBytes: part.sizeBytes,
      kind: cloud ? "Nuvem" : "NAS",
      group: cloud ? "cloud" : "nas",
      transport: /^nfs/i.test(fsType) ? "nfs" : /^(cifs|smb)/i.test(fsType) ? "smb" : fsType.toLowerCase().replace(/^fuse\./, ""),
      removable: false,
      external: false,
      network: true,
      server,
      share,
      system: false,
      partitions: [{ ...part, ...partitionRole(part) }],
      usage
    });
  }
  return shares.sort((a, b) => a.group.localeCompare(b.group) || a.partitions[0].mount.localeCompare(b.partitions[0].mount));
}

// Numera os discos físicos (Disco 1, 2, 3... — o do sistema é o 1) e aplica
// os nomes dados pelo admin (config.diskNames, chave = número de série ou
// id do disco; para NAS, o ponto de montagem).
const nameKey = disk => (disk.network ? `mount:${disk.partitions[0].mount}` : disk.serial ? `serial:${disk.serial}` : `id:${disk.id}`);

function applyIdentity(disks, customNames = {}) {
  const counters = {};
  return disks.map(disk => ({
    ...disk,
    index: (counters[disk.group] = (counters[disk.group] || 0) + 1),
    nameKey: nameKey(disk),
    customName: customNames[nameKey(disk)] || ""
  }));
}

async function usageByMountPoint() {
  const map = new Map();
  for (const fsEntry of await si.fsSize()) {
    if (!fsEntry.size) continue;
    map.set(fsEntry.mount, {
      totalBytes: fsEntry.size,
      usedBytes: fsEntry.used,
      availBytes: fsEntry.available,
      percent: Math.round(fsEntry.use)
    });
  }
  return map;
}

async function readWindowsDisks(usageByMount) {
  const disks = [];
  for (const [mount, usage] of usageByMount) {
    if (!/^[A-Z]:/i.test(mount)) continue;
    const id = mount.replace(/[^A-Za-z]/g, "");
    disks.push({
      id,
      device: mount,
      model: "",
      serial: "",
      sizeBytes: usage.totalBytes,
      kind: "",
      transport: "",
      removable: false,
      external: false,
      group: "physical",
      system: /^C:/i.test(mount),
      partitions: [{ id, device: mount, label: "", sizeBytes: usage.totalBytes, fsType: "", mount, swap: false, ...usage, ...partitionRole({ mount, swap: false }) }],
      usage
    });
  }
  return disks;
}

const readProcMounts = () => {
  try {
    return fs.readFileSync("/proc/mounts", "utf8");
  } catch {
    return "";
  }
};

// Lista de discos físicos com partições e uso em tempo real, seguida dos
// compartilhamentos de rede (NAS). `customNames` = config.diskNames.
async function readPhysicalDisks(customNames) {
  const usage = await usageByMountPoint();
  let disks;
  if (isWindows) {
    disks = await readWindowsDisks(usage);
  } else {
    try {
      disks = buildDisksFromLsblk(runLsblk(), usage);
    } catch (error) {
      console.error("lsblk indisponível, usando lista simples de montagens:", error.message);
      disks = await readWindowsDisks(new Map([...usage].filter(([mount]) => mount === "/")));
    }
    disks = disks.concat(buildNetworkShares(readProcMounts(), usage));
  }
  return applyIdentity(disks, customNames);
}

// Partições montadas dos discos físicos, no formato antigo de "disco"
// (mount/fsType/bytes) — para o histórico e para quem ainda usa a lista
// plana. Substitui a lista de si.fsSize() cheia de overlay/bind do Docker.
async function readMountedPartitions() {
  const disks = (await readPhysicalDisks()).filter(disk => !disk.network);
  return disks.flatMap(disk =>
    disk.partitions
      .filter(part => part.totalBytes)
      .map(part => ({
        mount: part.mount,
        fsType: part.fsType,
        totalBytes: part.totalBytes,
        usedBytes: part.usedBytes,
        availBytes: part.availBytes,
        percent: part.percent,
        diskId: disk.id
      }))
  );
}

// Em qual disco físico está um caminho (ex.: /var/lib/docker)? Usa o ponto
// de montagem mais longo que for prefixo do caminho real.
function diskOfPath(disks, targetPath) {
  let real = targetPath;
  try {
    real = fs.realpathSync(targetPath);
  } catch {
    return null;
  }
  let best = null;
  for (const disk of disks) {
    for (const part of disk.partitions) {
      if (!part.mount) continue;
      const prefix = part.mount === "/" ? "/" : `${part.mount}/`;
      if ((real === part.mount || real.startsWith(prefix)) && (!best || part.mount.length > best.partition.mount.length)) {
        best = { disk, partition: part };
      }
    }
  }
  return best;
}

module.exports = {
  readPhysicalDisks,
  readMountedPartitions,
  buildDisksFromLsblk,
  buildNetworkShares,
  applyIdentity,
  partitionRole,
  diskOfPath
};
