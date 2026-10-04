const fs = require("fs");
const { execFileSync } = require("child_process");
const si = require("systeminformation");

// Montar uma partição já existente (ex.: um HD extra plugado sem estar
// montado) e, opcionalmente, deixar isso persistente no /etc/fstab pra
// montar sozinho em todo boot — é o caso de uso real que motivou isso:
// um disco extra (ex.: "/dev/sdd1") aparece na máquina mas fica sem
// ponto de montagem até alguém rodar `mount` manualmente.
//
// Camadas de proteção (mesmo espírito do diskPartition.js):
// 1. Só aceita ponto de montagem dentro de /mnt ou /media — nunca deixa
//    montar em cima de um caminho arbitrário do sistema (ex.: /etc, /usr).
// 2. Reconfere a partição em si.blockDevices() na hora, tanto no preview
//    quanto no execute — nunca confia em "já está montado" ou "existe"
//    que o cliente mandou.
// 3. Nunca reescreve o /etc/fstab inteiro: faz backup datado antes de
//    qualquer alteração, e só ACRESCENTA uma linha nova (nunca mexe nas
//    linhas existentes); se já existir uma entrada pra esse UUID, não
//    duplica.
// 4. Só Linux por enquanto — fstab é um conceito específico de Linux.

const isLinux = process.platform === "linux";
const FSTAB_PATH = "/etc/fstab";
const ALLOWED_MOUNT_PREFIXES = ["/mnt/", "/media/"];

function parentDiskName(blockDeviceName) {
  if (!blockDeviceName) return null;
  const match = blockDeviceName.match(/^(nvme\d+n\d+|mmcblk\d+|sd[a-z]+|hd[a-z]+|vd[a-z]+|xvd[a-z]+)/);
  return match ? match[1] : blockDeviceName.replace(/\d+$/, "");
}

function normalizeDevice(device) {
  return (device || "").replace(/^\/dev\//, "");
}

function isAllowedMountPoint(mountPoint) {
  return typeof mountPoint === "string" && ALLOWED_MOUNT_PREFIXES.some(prefix => mountPoint.startsWith(prefix));
}

// Se essa partição está "segurada" por outro dispositivo do kernel (um
// array RAID mdadm montado através dela, um mapeamento dm-crypt/LUKS
// aberto, um grupo LVM) — o /sys é a fonte mais confiável disso, sem
// depender de nenhuma ferramenta extra instalada. Mesma função usada em
// diskPartition.js (duplicada aqui de propósito, mesmo padrão já usado
// pra `parentDiskName` nos outros módulos deste painel — cada lib fica
// independente, sem importar uma da outra).
//
// Bug real que isso corrige: uma partição membro de RAID ativo (ex.:
// `/dev/sdb2`, tipo "linux_raid_member", parte do array de sistema)
// nunca aparece como "montada" num sentido tradicional — quem está
// montado é o ARRAY (`/dev/md0`), não a partição membro — então sem
// essa checagem ela aparecia na lista de "partições sem montar",
// oferecendo o botão "Montar" pra uma partição que na verdade está
// ativamente em uso, segurando o sistema rodando.
function partitionHolders(partitionShortName) {
  try {
    return fs.readdirSync(`/sys/class/block/${partitionShortName}/holders`);
  } catch {
    return [];
  }
}

const EFI_LIKE_FS = new Set(["vfat", "fat", "fat16", "fat32"]);
const EFI_LIKE_MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2GiB — EFI de verdade é 512MiB-1GiB

// Só um palpite, nunca uma certeza: uma partição FAT pequena geralmente é
// a de boot/EFI, "swap" é sempre swap, e o resto é dado — serve só pra
// explicar na tela o PORQUÊ de cada partição existir (ex.: distinguir a
// partição de boot/memória virtual, que o particionador cria sozinha,
// da partição principal que o técnico realmente vai usar), nunca pra
// decidir nada sozinho.
function inferPartitionRole(fsType, sizeBytes) {
  const normalized = (fsType || "").toLowerCase();
  if (normalized === "swap") return "swap";
  if (EFI_LIKE_FS.has(normalized) && sizeBytes > 0 && sizeBytes <= EFI_LIKE_MAX_BYTES) return "boot";
  return "data";
}

// Lista as partições que existem no servidor mas não estão montadas em
// lugar nenhum agora — candidatas a "montar" pelo painel.
async function listMountablePartitions() {
  if (!isLinux) return [];
  const blockDevices = await si.blockDevices().catch(() => []);
  return blockDevices
    .filter(bd => bd.type === "part" && !bd.mount && partitionHolders(bd.name).length === 0)
    .map(bd => ({
      device: `/dev/${bd.name}`,
      label: bd.label || "",
      fsType: bd.fsType || "",
      role: inferPartitionRole(bd.fsType, bd.size || 0),
      uuid: bd.uuid || "",
      sizeBytes: bd.size || 0,
      parentDisk: parentDiskName(bd.name)
    }));
}

async function findPartition(device) {
  const shortName = normalizeDevice(device);
  if (!shortName) return null;
  const blockDevices = await si.blockDevices().catch(() => []);
  return blockDevices.find(bd => bd.name === shortName && bd.type === "part") || null;
}

function fstabHasUuid(uuid) {
  if (!uuid || !fs.existsSync(FSTAB_PATH)) return false;
  const content = fs.readFileSync(FSTAB_PATH, "utf8");
  return content.split("\n").some(line => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith("#") && trimmed.includes(`UUID=${uuid}`);
  });
}

function buildFstabLine(uuid, mountPoint, fsType) {
  return `UUID=${uuid}  ${mountPoint}  ${fsType || "auto"}  defaults,nofail  0  2`;
}

// Reconfere elegibilidade na hora — chamado tanto no preview (informativo)
// quanto, de novo, bem antes de executar.
async function checkEligibility(device, mountPoint) {
  if (!isLinux) {
    return { eligible: false, reason: "Montagem de disco ainda só implementada em Linux (fstab é específico dessa plataforma)." };
  }
  if (!isAllowedMountPoint(mountPoint)) {
    return { eligible: false, reason: `O ponto de montagem precisa começar com ${ALLOWED_MOUNT_PREFIXES.join(" ou ")} — por segurança, nunca em cima de uma pasta arbitrária do sistema.` };
  }
  const partition = await findPartition(device);
  if (!partition) {
    return { eligible: false, reason: "Partição não encontrada no servidor." };
  }
  if (partition.mount) {
    return { eligible: false, reason: `Essa partição já está montada em "${partition.mount}".` };
  }
  const holders = partitionHolders(partition.name);
  if (holders.length > 0) {
    return {
      eligible: false,
      reason: `Essa partição está em uso por outro dispositivo do kernel (${holders.join(", ")}) — provavelmente membro ativo de um array RAID ou mapeamento LUKS/LVM. Não é uma partição livre, mesmo sem aparecer "montada" diretamente — nunca deve ser montada por aqui.`
    };
  }
  if (!partition.uuid) {
    return { eligible: false, reason: "Não foi possível identificar o UUID dessa partição (necessário pra montar de forma estável)." };
  }
  let mountPointWarning = null;
  try {
    if (fs.existsSync(mountPoint) && fs.readdirSync(mountPoint).length > 0) {
      mountPointWarning = `O caminho "${mountPoint}" já existe e não está vazio — o conteúdo atual fica oculto (não é apagado) enquanto o disco estiver montado ali.`;
    }
  } catch {
    // sem permissão de leitura no caminho — segue sem o aviso, o mount vai falhar sozinho se for o caso
  }
  return { eligible: true, reason: null, partition, mountPointWarning };
}

async function previewMount(device, mountPoint) {
  const eligibility = await checkEligibility(device, mountPoint);
  if (!eligibility.eligible) {
    return { eligible: false, reason: eligibility.reason, device, mountPoint };
  }
  const { partition, mountPointWarning } = eligibility;
  const alreadyInFstab = fstabHasUuid(partition.uuid);
  const commands = [`mkdir -p ${mountPoint}`, `mount UUID=${partition.uuid} ${mountPoint}`];
  const fstabLine = buildFstabLine(partition.uuid, mountPoint, partition.fsType);
  return {
    eligible: true,
    reason: null,
    device,
    mountPoint,
    fsType: partition.fsType || "",
    uuid: partition.uuid,
    label: partition.label || "",
    mountPointWarning,
    commands,
    fstabLine,
    alreadyInFstab
  };
}

async function executeMount(device, mountPoint, persist) {
  const eligibility = await checkEligibility(device, mountPoint);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason || "Partição não elegível pra montar.");
  }
  const { partition } = eligibility;
  const log = [];

  try {
    fs.mkdirSync(mountPoint, { recursive: true });
    log.push({ command: `mkdir -p ${mountPoint}`, ok: true });
  } catch (err) {
    log.push({ command: `mkdir -p ${mountPoint}`, ok: false, error: String(err.message || err) });
    throw Object.assign(new Error(`Falhou ao criar o ponto de montagem — veja o log.`), { log });
  }

  try {
    execFileSync("mount", ["-U", partition.uuid, mountPoint], { encoding: "utf8", timeout: 30000 });
    log.push({ command: `mount -U ${partition.uuid} ${mountPoint}`, ok: true });
  } catch (err) {
    log.push({ command: `mount -U ${partition.uuid} ${mountPoint}`, ok: false, error: String(err.message || err) });
    throw Object.assign(new Error(`Falhou ao montar — veja o log.`), { log });
  }

  let fstabUpdated = false;
  if (persist) {
    if (fstabHasUuid(partition.uuid)) {
      log.push({ command: "atualizar /etc/fstab", ok: true, note: "Já existia uma entrada pra esse UUID — nada foi duplicado." });
    } else {
      try {
        const backupPath = `${FSTAB_PATH}.bak-${Date.now()}`;
        fs.copyFileSync(FSTAB_PATH, backupPath);
        const line = buildFstabLine(partition.uuid, mountPoint, partition.fsType);
        fs.appendFileSync(FSTAB_PATH, `\n${line}\n`);
        fstabUpdated = true;
        log.push({ command: `adicionar linha ao ${FSTAB_PATH} (backup em ${backupPath})`, ok: true });
      } catch (err) {
        // O disco já está montado nesse momento — só o fstab falhou, não desfaz o mount.
        log.push({ command: `adicionar linha ao ${FSTAB_PATH}`, ok: false, error: String(err.message || err) });
      }
    }
  }

  return { ok: true, device, mountPoint, uuid: partition.uuid, fstabUpdated, log };
}

// Desmontar uma partição (ou disco inteiro sem partição, ver nota
// abaixo) que já está montada agora — caso de uso real: antes de poder
// apagar/reparticionar um disco pelo painel, ele precisa estar
// desmontado primeiro, e sem isso o único jeito era abrir terminal e
// rodar `umount` na mão.
//
// Por PONTO DE MONTAGEM, não por device — é o que a tela de partições
// montadas já tem à mão (o card de cada disco mostra o `mount`, não o
// `/dev/sdX` da partição por trás dele), e "desmontar" é conceitualmente
// uma ação sobre o PONTO DE MONTAGEM mesmo (`umount` aceita os dois,
// device ou ponto de montagem — aqui usamos ponto de montagem).
//
// `bd.mount === mountPoint` (sem filtrar por `type`) de propósito —
// mesma lição do bug crítico já corrigido em diskPartition.js: alguns
// discos de dados têm o sistema de arquivos gravado DIRETO no disco
// inteiro (type "disk"), sem nenhuma partição (type "part"). Um disco
// assim nunca apareceria aqui se a busca só olhasse partições.
const CRITICAL_MOUNT_POINTS = new Set(["/", "/boot", "/boot/efi", "/usr", "/var", "/etc", "/proc", "/sys", "/dev", "/run", "/home"]);

async function findMountedByMountPoint(mountPoint) {
  if (!mountPoint) return null;
  const blockDevices = await si.blockDevices().catch(() => []);
  return blockDevices.find(bd => bd.mount === mountPoint) || null;
}

async function checkUnmountEligibility(mountPoint) {
  if (!isLinux) {
    return { eligible: false, reason: "Desmontar disco ainda só implementado em Linux." };
  }
  if (CRITICAL_MOUNT_POINTS.has(mountPoint)) {
    return {
      eligible: false,
      reason: `"${mountPoint}" é um ponto de montagem essencial do próprio sistema operacional — nunca pode ser desmontado por aqui (desmontar isso travaria o servidor).`
    };
  }
  const found = await findMountedByMountPoint(mountPoint);
  if (!found) {
    return { eligible: false, reason: "Esse ponto de montagem não está montado agora (ou não foi encontrado)." };
  }
  return { eligible: true, reason: null, partition: found };
}

async function previewUnmount(mountPoint) {
  const eligibility = await checkUnmountEligibility(mountPoint);
  if (!eligibility.eligible) {
    return { eligible: false, reason: eligibility.reason, mountPoint };
  }
  const { partition } = eligibility;
  return {
    eligible: true,
    reason: null,
    mountPoint,
    device: `/dev/${partition.name}`,
    fsType: partition.fsType || "",
    commands: [`umount ${mountPoint}`]
  };
}

async function executeUnmount(mountPoint) {
  const eligibility = await checkUnmountEligibility(mountPoint);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason || "Não elegível pra desmontar.");
  }
  try {
    execFileSync("umount", [mountPoint], { encoding: "utf8", timeout: 30000 });
  } catch (err) {
    // Causa mais comum de falha aqui: algum processo ainda com arquivo
    // aberto dentro do ponto de montagem (ex.: um container Docker com
    // bind mount, um terminal com `cd` dentro da pasta) — mostra o erro
    // de verdade (geralmente "target is busy") em vez de só "falhou".
    const detail = String(err.stderr || err.stdout || err.message || err).trim();
    throw new Error(`Falhou ao desmontar "${mountPoint}": ${detail}`);
  }
  return { ok: true, mountPoint };
}

module.exports = { listMountablePartitions, previewMount, executeMount, previewUnmount, executeUnmount };
