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
// de qualquer coisa ser executada.
function describeScheme(device, scheme, fsType) {
  const rootType = FS_TYPES.has(fsType) ? fsType : "ext4";

  if (scheme === "linux-uefi") {
    return {
      schemeLabel: "Linux com UEFI (EFI + swap + raiz)",
      partitions: [
        { label: "EFI (boot)", partedFsType: "fat32", start: "1MiB", end: "513MiB", mkfsCmd: "mkfs.fat", mkfsArgs: ["-F32"], espFlag: true, device: partName(device, 1) },
        { label: "swap", partedFsType: "linux-swap", start: "513MiB", end: "4609MiB", mkfsCmd: "mkswap", mkfsArgs: [], device: partName(device, 2) },
        { label: `raiz (${rootType})`, partedFsType: rootType, start: "4609MiB", end: "100%", mkfsCmd: rootType === "ext4" ? "mkfs.ext4" : `mkfs.${rootType}`, mkfsArgs: rootType === "ext4" ? ["-F"] : [], device: partName(device, 3) }
      ]
    };
  }

  if (scheme === "windows-uefi") {
    return {
      schemeLabel: "Windows com UEFI (EFI + principal NTFS)",
      partitions: [
        { label: "EFI (boot)", partedFsType: "fat32", start: "1MiB", end: "513MiB", mkfsCmd: "mkfs.fat", mkfsArgs: ["-F32"], espFlag: true, device: partName(device, 1) },
        { label: "principal (NTFS)", partedFsType: "ntfs", start: "513MiB", end: "100%", mkfsCmd: "mkfs.ntfs", mkfsArgs: ["-f"], device: partName(device, 2) }
      ]
    };
  }

  // "single" — um volume só ocupando o disco inteiro, pra uso como dado/
  // armazenamento (não serve pra instalar sistema operacional).
  return {
    schemeLabel: "Volume único (dados)",
    partitions: [
      { label: `dado (${rootType})`, partedFsType: rootType === "exfat" ? "ntfs" : rootType, start: "0%", end: "100%", mkfsCmd: rootType === "exfat" ? "mkfs.exfat" : `mkfs.${rootType}`, mkfsArgs: rootType === "ext4" ? ["-F"] : [], device: partName(device, 1) }
    ]
  };
}

function buildPlan(device, scheme, fsType) {
  const normalizedScheme = SCHEMES.has(scheme) ? scheme : "single";
  const described = describeScheme(device, normalizedScheme, fsType);

  const commands = [
    { cmd: "wipefs", args: ["-a", device] },
    { cmd: "parted", args: ["-s", device, "mklabel", "gpt"] }
  ];
  described.partitions.forEach((p, i) => {
    commands.push({ cmd: "parted", args: ["-s", device, "mkpart", "primary", p.partedFsType, p.start, p.end] });
    if (p.espFlag) {
      commands.push({ cmd: "parted", args: ["-s", device, "set", String(i + 1), "esp", "on"] });
    }
  });
  // Sem isso, o kernel às vezes continua enxergando a tabela de partições
  // antiga (os nós /dev/sdXN novos não aparecem a tempo) e os `mkfs`
  // abaixo tanto podem falhar quanto formatar o nó errado — validado
  // contra hardware real: sem o partprobe, o disco ficava "formatado" só
  // no parted, mas o painel continuava lendo as partições antigas.
  commands.push({ cmd: "partprobe", args: [device] });
  commands.push({ cmd: "udevadm", args: ["settle", "--timeout=10"] });
  described.partitions.forEach(p => {
    commands.push({ cmd: p.mkfsCmd, args: [...p.mkfsArgs, p.device] });
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
async function checkEligibility(device, plan) {
  if (!isLinux) {
    return {
      eligible: false,
      reason: `Particionamento ainda não implementado em ${process.platform === "darwin" ? "macOS" : "Windows"} — os comandos usados aqui (wipefs/parted/mkfs) são específicos do Linux.`
    };
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
  const missingTools = requiredTools(plan).filter(tool => !toolExists(tool));
  if (missingTools.length) {
    return {
      eligible: false,
      reason: `Ferramenta(s) não instalada(s) neste servidor, necessária(s) pra esse esquema: ${missingTools.join(", ")}. Instale antes de continuar (ex.: pacotes "parted", "dosfstools", "ntfs-3g", "util-linux", conforme a ferramenta faltando).`
    };
  }
  return { eligible: true, reason: null };
}

async function previewPartition(device, scheme, fsType) {
  const plan = buildPlan(device, scheme, fsType);
  const eligibility = await checkEligibility(device, plan);
  return {
    ...eligibility,
    device,
    scheme: plan.scheme,
    schemeLabel: plan.schemeLabel,
    partitions: plan.partitions.map(p => ({ label: p.label, device: p.device })),
    commands: planToPreviewLines(plan)
  };
}

async function executePartition(device, scheme, fsType) {
  const plan = buildPlan(device, scheme, fsType);
  const eligibility = await checkEligibility(device, plan);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason || "Disco não elegível pra particionar.");
  }
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
  return { ok: true, device, scheme: plan.scheme, partitions: plan.partitions.map(p => ({ label: p.label, device: p.device })), log };
}

module.exports = { previewPartition, executePartition, CONFIRM_PHRASE };
