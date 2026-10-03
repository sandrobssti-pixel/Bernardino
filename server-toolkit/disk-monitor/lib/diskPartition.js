const { execFileSync } = require("child_process");
const crypto = require("crypto");
const si = require("systeminformation");

// Particionar/formatar um disco inteiro — a ação mais destrutiva e
// irreversível deste painel (apaga TODO o conteúdo do disco escolhido).
// Por isso, três camadas de proteção, nenhuma opcional:
//
// 1. NUNCA elegível se qualquer partição desse disco estiver montada
//    agora (reconfere direto em si.blockDevices() a cada chamada, não
//    confia em nada que o cliente mandou) — isso sozinho já impede
//    formatar o disco do sistema, qualquer disco de dados em uso, ou
//    qualquer coisa montada. Também recusa se alguma ferramenta exigida
//    pelo esquema escolhido não estiver instalada — nunca começa a
//    apagar o disco pra descobrir isso no meio do caminho.
// 2. `preview` só MONTA os comandos como texto — nunca executa nada.
//    `execute` exige exatamente essa mesma checagem de novo, mais duas
//    confirmações explícitas do cliente (caminho do disco + frase).
// 3. Só Linux por enquanto — no Windows a API é bem diferente
//    (diskpart/PowerShell) e no macOS também (diskutil, nomes de
//    dispositivo /dev/diskN); nenhum dos dois foi implementado ainda,
//    retorna erro claro em vez de tentar algo não testado.
//
// IMPORTANTE — o que isso NÃO faz: os esquemas "linux-uefi" e
// "windows-uefi" só deixam o disco com a estrutura de partições que um
// instalador de sistema operacional espera encontrar (EFI + swap/MSR +
// partição principal) — NUNCA instalam o sistema operacional de verdade
// (não copiam arquivo nenhum de SO, não configuram bootloader). Depois
// de rodar isso, ainda é preciso instalar o Windows/Linux normalmente
// (pendrive bootável, PXE, etc.) — só que já com o disco pronto.

const isLinux = process.platform === "linux";
const CONFIRM_PHRASE = "FORMATAR";
const MIB = 1024 * 1024;

function partName(device, n) {
  const shortName = device.replace(/^\/dev\//, "");
  return /^(nvme|mmcblk)/.test(shortName) ? `${device}p${n}` : `${device}${n}`;
}

function toolExists(tool) {
  try {
    execFileSync("which", [tool], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function parentDiskName(blockDeviceName) {
  if (!blockDeviceName) return null;
  const match = blockDeviceName.match(/^(nvme\d+n\d+|mmcblk\d+|sd[a-z]+|hd[a-z]+|vd[a-z]+|xvd[a-z]+)/);
  return match ? match[1] : blockDeviceName.replace(/\d+$/, "");
}

const FS_TYPES = new Set(["ext4", "xfs", "exfat"]);
const SCHEMES = new Set(["single", "linux-uefi", "windows-uefi"]);

// Cada esquema devolve a lista de partições (rótulo, tamanho, comando de
// parted, comando de mkfs) — separado do "montar os comandos de verdade"
// pra poder checar ferramenta faltando e montar um resumo legível antes
// de qualquer coisa ser executada. `approxBytes`/`fixedSize` servem só
// pro desenho visual da barra de partições (não precisam ser exatos ao
// byte, só proporcionais).
function describeScheme(device, scheme, fsType) {
  const rootType = FS_TYPES.has(fsType) ? fsType : "ext4";
  const EFI_BYTES = 512 * MIB;
  const SWAP_BYTES = 4096 * MIB;

  if (scheme === "linux-uefi") {
    return {
      schemeLabel: "Linux com UEFI (EFI + swap + raiz)",
      partitions: [
        { label: "EFI (boot)", displayFsType: "FAT32", partedFsType: "fat32", start: "1MiB", end: "513MiB", mkfsCmd: "mkfs.fat", mkfsArgs: ["-F32"], espFlag: true, device: partName(device, 1), fixedBytes: EFI_BYTES },
        { label: "swap", displayFsType: "swap", partedFsType: "linux-swap", start: "513MiB", end: "4609MiB", mkfsCmd: "mkswap", mkfsArgs: [], device: partName(device, 2), fixedBytes: SWAP_BYTES },
        { label: `raiz (${rootType})`, displayFsType: rootType.toUpperCase(), partedFsType: rootType, start: "4609MiB", end: "100%", mkfsCmd: rootType === "ext4" ? "mkfs.ext4" : `mkfs.${rootType}`, mkfsArgs: rootType === "ext4" ? ["-F"] : [], device: partName(device, 3), fixedBytes: null }
      ]
    };
  }

  if (scheme === "windows-uefi") {
    return {
      schemeLabel: "Windows com UEFI (EFI + principal NTFS)",
      partitions: [
        { label: "EFI (boot)", displayFsType: "FAT32", partedFsType: "fat32", start: "1MiB", end: "513MiB", mkfsCmd: "mkfs.fat", mkfsArgs: ["-F32"], espFlag: true, device: partName(device, 1), fixedBytes: EFI_BYTES },
        { label: "principal (NTFS)", displayFsType: "NTFS", partedFsType: "ntfs", start: "513MiB", end: "100%", mkfsCmd: "mkfs.ntfs", mkfsArgs: ["-f"], device: partName(device, 2), fixedBytes: null }
      ]
    };
  }

  // "single" — um volume só ocupando o disco inteiro, pra uso como dado/
  // armazenamento (não serve pra instalar sistema operacional).
  return {
    schemeLabel: "Volume único (dados)",
    partitions: [
      { label: `dado (${rootType})`, displayFsType: rootType.toUpperCase(), partedFsType: rootType === "exfat" ? "ntfs" : rootType, start: "0%", end: "100%", mkfsCmd: rootType === "exfat" ? "mkfs.exfat" : `mkfs.${rootType}`, mkfsArgs: rootType === "ext4" ? ["-F"] : [], device: partName(device, 1), fixedBytes: null }
    ]
  };
}

// Preenche a % de cada partição em relação ao disco inteiro, só pro
// desenho visual (barra proporcional) — partição sem `fixedBytes` (a
// "raiz"/"principal"/"dado") fica com o que sobrar.
function withVisualPercent(partitions, diskSizeBytes) {
  if (!diskSizeBytes) return partitions.map(p => ({ ...p, percentOfDisk: null, sizeBytes: p.fixedBytes || null }));
  const fixedTotal = partitions.reduce((sum, p) => sum + (p.fixedBytes || 0), 0);
  const remainderBytes = Math.max(0, diskSizeBytes - fixedTotal);
  return partitions.map(p => ({
    ...p,
    sizeBytes: p.fixedBytes || remainderBytes,
    percentOfDisk: Math.max(1, Math.round(((p.fixedBytes || remainderBytes) / diskSizeBytes) * 100))
  }));
}

function buildPlan(device, scheme, fsType) {
  const normalizedScheme = SCHEMES.has(scheme) ? scheme : "single";
  const described = describeScheme(device, normalizedScheme, fsType);

  const commands = [
    { cmd: "wipefs", args: ["-a", device], label: "Apagando assinaturas antigas" },
    { cmd: "parted", args: ["-s", device, "mklabel", "gpt"], label: "Criando tabela de partições GPT" }
  ];
  described.partitions.forEach((p, i) => {
    commands.push({ cmd: "parted", args: ["-s", device, "mkpart", "primary", p.partedFsType, p.start, p.end], label: `Criando partição "${p.label}"` });
    if (p.espFlag) {
      commands.push({ cmd: "parted", args: ["-s", device, "set", String(i + 1), "esp", "on"], label: `Marcando "${p.label}" como partição de boot EFI` });
    }
  });
  // Sem isso, o kernel às vezes continua enxergando a tabela de partições
  // antiga (os nós /dev/sdXN novos não aparecem a tempo) e os `mkfs`
  // abaixo tanto podem falhar quanto formatar o nó errado — validado
  // contra hardware real: sem o partprobe, o disco ficava "formatado" só
  // no parted, mas o painel continuava lendo as partições antigas.
  commands.push({ cmd: "partprobe", args: [device], label: "Avisando o sistema sobre as partições novas" });
  commands.push({ cmd: "udevadm", args: ["settle", "--timeout=10"], label: "Aguardando o sistema reconhecer os discos novos" });
  described.partitions.forEach(p => {
    commands.push({ cmd: p.mkfsCmd, args: [...p.mkfsArgs, p.device], label: `Formatando "${p.label}" (${p.device})` });
  });

  return { device, scheme: normalizedScheme, schemeLabel: described.schemeLabel, partitions: described.partitions, commands };
}

function planToPreviewLines(plan) {
  return plan.commands.map(c => `${c.cmd} ${c.args.join(" ")}`);
}

function requiredTools(plan) {
  const tools = new Set(["wipefs", "parted", "partprobe", "udevadm"]);
  plan.partitions.forEach(p => tools.add(p.mkfsCmd));
  return [...tools];
}

// Reconfere na hora se o disco está livre pra mexer, E se as ferramentas
// que o esquema escolhido precisa estão instaladas — chamado tanto no
// preview (só informativo) quanto, de novo, bem antes de executar.
// Também devolve o tamanho do disco (pro desenho visual da barra).
async function checkEligibility(device, plan) {
  if (!isLinux) {
    return {
      eligible: false,
      reason: `Particionamento ainda não implementado em ${process.platform === "darwin" ? "macOS" : "Windows"} — os comandos usados aqui (wipefs/parted/mkfs) são específicos do Linux.`,
      diskSizeBytes: null
    };
  }
  const shortName = (device || "").replace(/^\/dev\//, "");
  if (!shortName) {
    return { eligible: false, reason: "Disco não informado.", diskSizeBytes: null };
  }
  const blockDevices = await si.blockDevices().catch(() => []);
  const diskEntry = blockDevices.find(bd => bd.name === shortName && bd.type === "disk");
  const existingPartitions = blockDevices
    .filter(bd => bd.type === "part" && parentDiskName(bd.name) === shortName)
    .map(bd => ({ device: `/dev/${bd.name}`, fsType: bd.fsType || "?", sizeBytes: bd.size || 0, mount: bd.mount || null }));
  const exists = diskEntry || existingPartitions.length > 0;
  if (!exists) {
    return { eligible: false, reason: "Disco não encontrado no servidor.", diskSizeBytes: null, existingPartitions: [] };
  }
  const diskSizeBytes = diskEntry?.size || null;
  const mountedPartition = existingPartitions.find(p => p.mount);
  if (mountedPartition) {
    return {
      eligible: false,
      reason: `O disco tem uma partição montada em "${mountedPartition.mount}" — desmonte tudo antes (isso nunca é feito automaticamente).`,
      diskSizeBytes,
      existingPartitions
    };
  }
  const missingTools = requiredTools(plan).filter(tool => !toolExists(tool));
  if (missingTools.length) {
    return {
      eligible: false,
      reason: `Ferramenta(s) não instalada(s) neste servidor, necessária(s) pra esse esquema: ${missingTools.join(", ")}. Instale antes de continuar (ex.: pacotes "parted", "dosfstools", "ntfs-3g", "util-linux", conforme a ferramenta faltando).`,
      diskSizeBytes,
      existingPartitions
    };
  }
  return { eligible: true, reason: null, diskSizeBytes, existingPartitions };
}

async function previewPartition(device, scheme, fsType) {
  const plan = buildPlan(device, scheme, fsType);
  const eligibility = await checkEligibility(device, plan);
  const partitionsWithPercent = withVisualPercent(plan.partitions, eligibility.diskSizeBytes);
  return {
    eligible: eligibility.eligible,
    reason: eligibility.reason,
    device,
    scheme: plan.scheme,
    schemeLabel: plan.schemeLabel,
    // Partições que JÁ existem no disco agora — mostradas pra deixar
    // explícito que elas serão apagadas (disco usado) ou que o disco já
    // está vazio (sem nenhuma, disco novo), sem precisar adivinhar.
    existingPartitions: eligibility.existingPartitions || [],
    diskSizeBytes: eligibility.diskSizeBytes,
    partitions: partitionsWithPercent.map(p => ({ label: p.label, device: p.device, percentOfDisk: p.percentOfDisk, sizeBytes: p.sizeBytes, fsType: p.displayFsType })),
    commands: planToPreviewLines(plan)
  };
}

// --- Execução assíncrona com progresso ---------------------------------
// Formatar um disco de centenas de GB demora (sobretudo o mkfs da
// partição principal) — em vez de deixar o cliente esperando uma
// resposta HTTP travada sem feedback, o execute dispara o trabalho em
// segundo plano e devolve um jobId na hora; o painel consulta o
// progresso (passo atual / total, % concluído) a cada poucos segundos
// até terminar. O job fica só em memória (reiniciar o disk-monitor
// durante uma formatação perde o acompanhamento, mas o comando que
// já tiver sido disparado continua rodando no sistema operacional).
const jobs = new Map();
const JOB_TTL_MS = 30 * 60 * 1000;

function cleanupOldJobs() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (job.finishedAt && now - job.finishedAt > JOB_TTL_MS) jobs.delete(id);
  }
}

async function startPartitionExecution(device, scheme, fsType) {
  const plan = buildPlan(device, scheme, fsType);
  const eligibility = await checkEligibility(device, plan);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason || "Disco não elegível pra particionar.");
  }

  cleanupOldJobs();
  const jobId = crypto.randomUUID();
  const job = {
    jobId,
    device,
    scheme: plan.scheme,
    status: "running",
    currentStep: 0,
    totalSteps: plan.commands.length,
    currentLabel: plan.commands[0]?.label || "",
    percent: 0,
    log: [],
    error: null,
    finishedAt: null
  };
  jobs.set(jobId, job);

  // Roda em segundo plano — a função que chamou já recebeu o jobId e
  // devolveu a resposta HTTP antes disso terminar.
  (async () => {
    for (const step of plan.commands) {
      job.currentLabel = step.label;
      try {
        execFileSync(step.cmd, step.args, { encoding: "utf8", timeout: 120000 });
        job.log.push({ command: `${step.cmd} ${step.args.join(" ")}`, ok: true });
      } catch (err) {
        job.log.push({ command: `${step.cmd} ${step.args.join(" ")}`, ok: false, error: String(err.message || err) });
        job.status = "error";
        job.error = `Falhou em "${step.cmd}" — veja o log.`;
        job.finishedAt = Date.now();
        return;
      }
      job.currentStep++;
      job.percent = Math.round((job.currentStep / job.totalSteps) * 100);
    }
    job.status = "done";
    job.percent = 100;
    job.currentLabel = "Concluído";
    job.finishedAt = Date.now();
  })();

  return { jobId, totalSteps: job.totalSteps };
}

function getPartitionJobStatus(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;
  const { jobId: id, device, scheme, status, currentStep, totalSteps, currentLabel, percent, log, error } = job;
  return { jobId: id, device, scheme, status, currentStep, totalSteps, currentLabel, percent, log, error };
}

module.exports = { previewPartition, startPartitionExecution, getPartitionJobStatus, CONFIRM_PHRASE };
