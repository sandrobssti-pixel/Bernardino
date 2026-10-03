const { execFileSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
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
//    confirmações explícitas do cliente (caminho do disco + frase) —
//    só na etapa de APAGAR, que é a única irreversível de verdade.
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
//
// FLUXO EM TRÊS ETAPAS VISÍVEIS (delete / create / format) — antes era
// um único job que fazia tudo de uma vez só, sem o técnico ver em qual
// parte parou quando dava errado. Veio de um caso real: o job falhava
// bem no início (apagar a tabela de partições antiga) porque uma
// partição antiga ainda estava "em uso" no kernel (ex.: mapeamento LUKS
// aberto de uma formatação anterior que nunca foi fechado) — e como o
// job parava ali, NADA acontecia depois (nem criar partição nova, nem
// formatar), e pra quem estava olhando só a tela parecia que "não
// deletava partição nenhuma", sem explicação do motivo real. Agora cada
// etapa é uma chamada separada, com resultado visível antes de liberar
// a próxima, e a checagem de elegibilidade de "apagar" detecta
// especificamente esse caso (partição com holder ativo no kernel) e
// devolve o comando exato pra resolver, em vez de só falhar no meio do
// `parted`.

const isLinux = process.platform === "linux";
const CONFIRM_PHRASE = "FORMATAR";
const MIB = 1024 * 1024;
const PHASES = new Set(["delete", "create", "format"]);

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

// Se essa partição está "segurada" por outro dispositivo do kernel (um
// mapeamento dm-crypt/LUKS aberto, um membro de array mdadm, um grupo
// LVM) — o /sys é a fonte mais confiável disso, não depende de nenhuma
// ferramenta extra instalada. Uma partição com holder não aparece como
// "montada" (si.blockDevices().mount fica vazio), mas o kernel recusa
// apagar a tabela de partições dela mesmo assim — é exatamente o caso
// que fazia o "apagar partições" falhar silenciosamente no meio.
function partitionHolders(partitionShortName) {
  try {
    return fs.readdirSync(`/sys/class/block/${partitionShortName}/holders`);
  } catch {
    return [];
  }
}

const FS_TYPES = new Set(["ext4", "xfs", "exfat"]);
const SCHEMES = new Set(["single", "linux-uefi", "windows-uefi", "custom"]);
const MIN_CUSTOM_PARTITIONS = 2;
const MAX_CUSTOM_PARTITIONS = 8;

function normalizePartitionCount(partitionCount) {
  const n = parseInt(partitionCount, 10);
  if (!Number.isFinite(n)) return MIN_CUSTOM_PARTITIONS;
  return Math.min(MAX_CUSTOM_PARTITIONS, Math.max(MIN_CUSTOM_PARTITIONS, n));
}

// Cada esquema devolve a lista de partições (rótulo, tamanho, comando de
// parted, comando de mkfs) — separado do "montar os comandos de verdade"
// pra poder checar ferramenta faltando e montar um resumo legível antes
// de qualquer coisa ser executada. `approxBytes`/`fixedSize` servem só
// pro desenho visual da barra de partições (não precisam ser exatos ao
// byte, só proporcionais).
function describeScheme(device, scheme, fsType, partitionCount, customSizesBytes) {
  const rootType = FS_TYPES.has(fsType) ? fsType : "ext4";
  const EFI_BYTES = 512 * MIB;
  const SWAP_BYTES = 4096 * MIB;

  if (scheme === "custom") {
    const n = normalizePartitionCount(partitionCount);
    const mkfsCmd = rootType === "exfat" ? "mkfs.exfat" : `mkfs.${rootType}`;
    const mkfsArgs = rootType === "ext4" ? ["-F"] : [];
    const partedFsType = rootType === "exfat" ? "ntfs" : rootType;

    // Tamanho explícito por partição (ex.: "120GB na primeira, o
    // restante na segunda") — um valor em bytes por partição, EXCETO a
    // última, que sempre fica com o que sobrar (mesmo mecanismo de
    // EFI/swap: `fixedBytes` fixo pras primeiras, `null` na última).
    // Só é usado se vier um valor válido (> 0) pra CADA uma das n-1
    // primeiras partições — senão cai no modo antigo (divisão igual).
    const sizes = Array.isArray(customSizesBytes) ? customSizesBytes.slice(0, n - 1) : [];
    const hasExplicitSizes = sizes.length === n - 1 && sizes.every(s => Number.isFinite(s) && s > 0);

    const partitions = [];
    if (hasExplicitSizes) {
      let cursorMiB = 1; // 1MiB de alinhamento no início, igual aos outros esquemas
      for (let i = 0; i < n; i++) {
        const isLast = i === n - 1;
        const sizeBytes = isLast ? null : sizes[i];
        const start = `${cursorMiB}MiB`;
        if (!isLast) cursorMiB += Math.max(1, Math.round(sizeBytes / MIB));
        const end = isLast ? "100%" : `${cursorMiB}MiB`;
        partitions.push({
          label: `partição ${i + 1} (${rootType})`,
          role: "data",
          displayFsType: rootType.toUpperCase(),
          partedFsType,
          start,
          end,
          mkfsCmd,
          mkfsArgs,
          device: partName(device, i + 1),
          fixedBytes: sizeBytes
        });
      }
    } else {
      for (let i = 0; i < n; i++) {
        const startPct = Math.round((i * 100) / n);
        const endPct = i === n - 1 ? 100 : Math.round(((i + 1) * 100) / n);
        partitions.push({
          label: `partição ${i + 1} (${rootType})`,
          role: "data",
          displayFsType: rootType.toUpperCase(),
          partedFsType,
          start: `${startPct}%`,
          end: `${endPct}%`,
          mkfsCmd,
          mkfsArgs,
          device: partName(device, i + 1),
          fixedBytes: null,
          // % exato dessa partição (não "o que sobrar") — todas as
          // partições do esquema personalizado são do tipo "sobra
          // dividida", então withVisualPercent precisa desse valor
          // explícito em vez do cálculo de resto único de sempre.
          percentHint: endPct - startPct
        });
      }
    }
    return { schemeLabel: `Personalizado (${n} partições)`, partitions };
  }

  if (scheme === "linux-uefi") {
    return {
      schemeLabel: "Linux com UEFI (EFI + swap + raiz)",
      partitions: [
        { label: "EFI (boot)", role: "boot", displayFsType: "FAT32", partedFsType: "fat32", start: "1MiB", end: "513MiB", mkfsCmd: "mkfs.fat", mkfsArgs: ["-F32"], espFlag: true, device: partName(device, 1), fixedBytes: EFI_BYTES },
        { label: "swap", role: "swap", displayFsType: "swap", partedFsType: "linux-swap", start: "513MiB", end: "4609MiB", mkfsCmd: "mkswap", mkfsArgs: [], device: partName(device, 2), fixedBytes: SWAP_BYTES },
        { label: `raiz (${rootType})`, role: "data", displayFsType: rootType.toUpperCase(), partedFsType: rootType, start: "4609MiB", end: "100%", mkfsCmd: rootType === "ext4" ? "mkfs.ext4" : `mkfs.${rootType}`, mkfsArgs: rootType === "ext4" ? ["-F"] : [], device: partName(device, 3), fixedBytes: null }
      ]
    };
  }

  if (scheme === "windows-uefi") {
    return {
      schemeLabel: "Windows com UEFI (EFI + principal NTFS)",
      partitions: [
        { label: "EFI (boot)", role: "boot", displayFsType: "FAT32", partedFsType: "fat32", start: "1MiB", end: "513MiB", mkfsCmd: "mkfs.fat", mkfsArgs: ["-F32"], espFlag: true, device: partName(device, 1), fixedBytes: EFI_BYTES },
        { label: "principal (NTFS)", role: "data", displayFsType: "NTFS", partedFsType: "ntfs", start: "513MiB", end: "100%", mkfsCmd: "mkfs.ntfs", mkfsArgs: ["-f"], device: partName(device, 2), fixedBytes: null }
      ]
    };
  }

  // "single" — um volume só ocupando o disco inteiro, pra uso como dado/
  // armazenamento (não serve pra instalar sistema operacional).
  return {
    schemeLabel: "Volume único (dados)",
    partitions: [
      { label: `dado (${rootType})`, role: "data", displayFsType: rootType.toUpperCase(), partedFsType: rootType === "exfat" ? "ntfs" : rootType, start: "0%", end: "100%", mkfsCmd: rootType === "exfat" ? "mkfs.exfat" : `mkfs.${rootType}`, mkfsArgs: rootType === "ext4" ? ["-F"] : [], device: partName(device, 1), fixedBytes: null }
    ]
  };
}

// Preenche a % de cada partição em relação ao disco inteiro, só pro
// desenho visual (barra proporcional). Três casos por partição:
// `fixedBytes` (EFI/swap, tamanho fixo em MiB), `percentHint` (esquema
// personalizado, cada partição já sabe sua fatia exata) e o resto (a
// "raiz"/"principal"/"dado" dos esquemas de sempre, que fica com o que
// sobrar dividido entre as partições sem tamanho definido).
function withVisualPercent(partitions, diskSizeBytes) {
  if (!diskSizeBytes) return partitions.map(p => ({ ...p, percentOfDisk: null, sizeBytes: p.fixedBytes || null }));
  const fixedTotal = partitions.reduce((sum, p) => sum + (p.fixedBytes || 0), 0);
  const hintTotalBytes = partitions.reduce((sum, p) => sum + (p.percentHint != null ? Math.round((diskSizeBytes * p.percentHint) / 100) : 0), 0);
  const remainderPartitions = partitions.filter(p => !p.fixedBytes && p.percentHint == null);
  const remainderBytes = Math.max(0, diskSizeBytes - fixedTotal - hintTotalBytes);
  const remainderShare = remainderPartitions.length ? Math.round(remainderBytes / remainderPartitions.length) : 0;
  return partitions.map(p => {
    if (p.percentHint != null) {
      const sizeBytes = Math.round((diskSizeBytes * p.percentHint) / 100);
      return { ...p, sizeBytes, percentOfDisk: Math.max(1, Math.round(p.percentHint)) };
    }
    const sizeBytes = p.fixedBytes || remainderShare;
    return { ...p, sizeBytes, percentOfDisk: Math.max(1, Math.round((sizeBytes / diskSizeBytes) * 100)) };
  });
}

// --- Comandos por etapa --------------------------------------------------
// Separado em três listas em vez de uma só: "apagar" nunca cria nem
// formata nada, "criar" nunca apaga nem formata, "formatar" nunca apaga
// nem cria — cada botão da tela dispara só a lista certa.

function buildDeleteCommands(device) {
  return [
    { cmd: "wipefs", args: ["-a", device], label: "Apagando assinaturas antigas" },
    { cmd: "parted", args: ["-s", device, "mklabel", "gpt"], label: "Criando tabela de partições GPT vazia" },
    { cmd: "partprobe", args: [device], label: "Avisando o sistema que as partições antigas sumiram" },
    { cmd: "udevadm", args: ["settle", "--timeout=10"], label: "Aguardando o sistema confirmar o disco limpo" }
  ];
}

function buildCreateCommands(device, described) {
  const commands = [];
  described.partitions.forEach((p, i) => {
    commands.push({ cmd: "parted", args: ["-s", device, "mkpart", "primary", p.partedFsType, p.start, p.end], label: `Criando partição "${p.label}"` });
    if (p.espFlag) {
      commands.push({ cmd: "parted", args: ["-s", device, "set", String(i + 1), "esp", "on"], label: `Marcando "${p.label}" como partição de boot EFI` });
    }
  });
  // Sem isso, o kernel às vezes continua enxergando a tabela de partições
  // antiga (os nós /dev/sdXN novos não aparecem a tempo) e os `mkfs`
  // da etapa seguinte tanto podem falhar quanto formatar o nó errado —
  // validado contra hardware real.
  commands.push({ cmd: "partprobe", args: [device], label: "Avisando o sistema sobre as partições novas" });
  commands.push({ cmd: "udevadm", args: ["settle", "--timeout=10"], label: "Aguardando o sistema reconhecer as partições novas" });
  return commands;
}

function buildFormatCommands(described) {
  return described.partitions.map(p => ({ cmd: p.mkfsCmd, args: [...p.mkfsArgs, p.device], label: `Formatando "${p.label}" (${p.device})` }));
}

function buildPlan(device, scheme, fsType, phase, partitionCount, customSizesBytes) {
  const normalizedScheme = SCHEMES.has(scheme) ? scheme : "single";
  const normalizedPhase = PHASES.has(phase) ? phase : "delete";
  const described = describeScheme(device, normalizedScheme, fsType, partitionCount, customSizesBytes);

  let commands;
  if (normalizedPhase === "delete") commands = buildDeleteCommands(device);
  else if (normalizedPhase === "create") commands = buildCreateCommands(device, described);
  else commands = buildFormatCommands(described);

  return { device, phase: normalizedPhase, scheme: normalizedScheme, schemeLabel: described.schemeLabel, partitions: described.partitions, commands };
}

function planToPreviewLines(plan) {
  return plan.commands.map(c => `${c.cmd} ${c.args.join(" ")}`);
}

function requiredTools(plan) {
  if (plan.phase === "delete") return ["wipefs", "parted", "partprobe", "udevadm"];
  if (plan.phase === "create") return ["parted", "partprobe", "udevadm"];
  return [...new Set(plan.partitions.map(p => p.mkfsCmd))];
}

// Reconfere na hora se o disco está livre pra mexer nessa etapa
// específica, E se as ferramentas que ela precisa estão instaladas —
// chamado tanto no preview (só informativo) quanto, de novo, bem antes
// de executar. Também devolve o tamanho do disco (pro desenho visual).
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
    .map(bd => ({ device: `/dev/${bd.name}`, name: bd.name, fsType: bd.fsType || "?", sizeBytes: bd.size || 0, mount: bd.mount || null }));
  const exists = diskEntry || existingPartitions.length > 0;
  if (!exists) {
    return { eligible: false, reason: "Disco não encontrado no servidor.", diskSizeBytes: null, existingPartitions: [] };
  }
  const diskSizeBytes = diskEntry?.size || null;

  const missingTools = requiredTools(plan).filter(tool => !toolExists(tool));
  if (missingTools.length) {
    return {
      eligible: false,
      reason: `Ferramenta(s) não instalada(s) neste servidor, necessária(s) pra essa etapa: ${missingTools.join(", ")}. Instale antes de continuar (ex.: pacotes "parted", "dosfstools", "ntfs-3g", "util-linux", conforme a ferramenta faltando).`,
      diskSizeBytes,
      existingPartitions
    };
  }

  if (plan.phase === "delete") {
    const mountedPartition = existingPartitions.find(p => p.mount);
    if (mountedPartition) {
      return {
        eligible: false,
        reason: `O disco tem uma partição montada em "${mountedPartition.mount}" — desmonte tudo antes (isso nunca é feito automaticamente).`,
        diskSizeBytes,
        existingPartitions
      };
    }
    const busyPartition = existingPartitions
      .map(p => ({ ...p, holders: partitionHolders(p.name) }))
      .find(p => p.holders.length > 0);
    if (busyPartition) {
      return {
        eligible: false,
        reason: `A partição ${busyPartition.device} está em uso por outro dispositivo do kernel (${busyPartition.holders.join(", ")}) — provavelmente um mapeamento LUKS ou um array RAID aberto de uma formatação anterior que nunca foi fechado. Identifique com "dmsetup ls --target crypt" (LUKS) ou "cat /proc/mdstat" (RAID) e feche com "cryptsetup close <nome>" ou "mdadm --stop /dev/mdX", depois tente apagar de novo.`,
        diskSizeBytes,
        existingPartitions
      };
    }
    return { eligible: true, reason: null, diskSizeBytes, existingPartitions };
  }

  if (plan.phase === "create") {
    if (existingPartitions.length > 0) {
      return {
        eligible: false,
        reason: `O disco ainda tem ${existingPartitions.length} partição(ões) — apague as partições existentes antes de criar novas (etapa 1).`,
        diskSizeBytes,
        existingPartitions
      };
    }
    // Esquema personalizado com tamanho explícito por partição — confere
    // se a soma não passa do disco antes de deixar prosseguir (senão o
    // `parted` ia só recusar a última partição no meio da execução).
    const fixedTotal = plan.partitions.reduce((sum, p) => sum + (p.fixedBytes || 0), 0);
    if (diskSizeBytes && fixedTotal > diskSizeBytes) {
      return {
        eligible: false,
        reason: `A soma dos tamanhos informados (${(fixedTotal / (1024 ** 3)).toFixed(1)} GB) passa do tamanho do disco (${(diskSizeBytes / (1024 ** 3)).toFixed(1)} GB) — diminua algum valor.`,
        diskSizeBytes,
        existingPartitions
      };
    }
    return { eligible: true, reason: null, diskSizeBytes, existingPartitions };
  }

  // "format" — as partições alvo (geradas por essa etapa "criar") precisam
  // já existir de verdade no servidor agora, e não podem estar montadas.
  const targetNames = plan.partitions.map(p => p.device.replace(/^\/dev\//, ""));
  const missing = targetNames.filter(n => !blockDevices.some(bd => bd.name === n));
  if (missing.length) {
    return {
      eligible: false,
      reason: `Partição(ões) esperada(s) não encontrada(s): ${missing.map(n => "/dev/" + n).join(", ")} — rode "Criar partição" primeiro (etapa 2).`,
      diskSizeBytes,
      existingPartitions
    };
  }
  const mountedTarget = blockDevices.find(bd => targetNames.includes(bd.name) && bd.mount);
  if (mountedTarget) {
    return {
      eligible: false,
      reason: `A partição /dev/${mountedTarget.name} está montada em "${mountedTarget.mount}" — desmonte antes de formatar.`,
      diskSizeBytes,
      existingPartitions
    };
  }
  return { eligible: true, reason: null, diskSizeBytes, existingPartitions };
}

async function previewPartition(device, scheme, fsType, phase, partitionCount, customSizesBytes) {
  const plan = buildPlan(device, scheme, fsType, phase, partitionCount, customSizesBytes);
  const eligibility = await checkEligibility(device, plan);
  const partitionsWithPercent = withVisualPercent(plan.partitions, eligibility.diskSizeBytes);
  return {
    eligible: eligibility.eligible,
    reason: eligibility.reason,
    device,
    phase: plan.phase,
    scheme: plan.scheme,
    schemeLabel: plan.schemeLabel,
    // Partições que JÁ existem no disco agora — mostradas pra deixar
    // explícito que elas serão apagadas (disco usado) ou que o disco já
    // está vazio (sem nenhuma, disco novo/já limpo), sem precisar adivinhar.
    existingPartitions: eligibility.existingPartitions || [],
    diskSizeBytes: eligibility.diskSizeBytes,
    partitions: partitionsWithPercent.map(p => ({ label: p.label, role: p.role, device: p.device, percentOfDisk: p.percentOfDisk, sizeBytes: p.sizeBytes, fsType: p.displayFsType })),
    // "install": o esquema deixa a estrutura que um instalador de SO
    // espera (ainda precisa rodar o instalador de verdade depois).
    // "storage": o disco fica pronto pra usar direto — como dado de
    // aplicação específica ou só backup, sem nenhum SO envolvido.
    purpose: (plan.scheme === "linux-uefi" || plan.scheme === "windows-uefi") ? "install" : "storage",
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

async function startPartitionExecution(device, scheme, fsType, phase, partitionCount, customSizesBytes) {
  const plan = buildPlan(device, scheme, fsType, phase, partitionCount, customSizesBytes);
  const eligibility = await checkEligibility(device, plan);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason || "Disco não elegível pra essa etapa.");
  }

  cleanupOldJobs();
  const jobId = crypto.randomUUID();
  const job = {
    jobId,
    device,
    phase: plan.phase,
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
        // Mostra o stderr/stdout de verdade (não só "falhou") — é o que
        // diferencia "disco ocupado por LUKS aberto" de qualquer outro
        // erro pra quem estiver olhando a tela, sem precisar de SSH.
        const detail = String(err.stderr || err.stdout || err.message || err).trim();
        job.log.push({ command: `${step.cmd} ${step.args.join(" ")}`, ok: false, error: detail });
        job.status = "error";
        job.error = `Falhou em "${step.label}": ${detail}`;
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
  const { jobId: id, device, phase, scheme, status, currentStep, totalSteps, currentLabel, percent, log, error } = job;
  return { jobId: id, device, phase, scheme, status, currentStep, totalSteps, currentLabel, percent, log, error };
}

module.exports = { previewPartition, startPartitionExecution, getPartitionJobStatus, CONFIRM_PHRASE };
