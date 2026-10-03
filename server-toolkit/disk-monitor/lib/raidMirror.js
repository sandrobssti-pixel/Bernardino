const { execFileSync } = require("child_process");
const si = require("systeminformation");

// Espelhamento RAID1 do disco do SISTEMA (não um disco de dados qualquer)
// — por isso esse módulo é só leitura e geração de texto, NUNCA executa
// nada sozinho. Diferente de toda outra ação deste painel (que o próprio
// servidor executa depois de confirmação), aqui o processo real envolve
// reparticionar, criar array RAID incompleto, copiar o sistema de arquivo
// por arquivo, reconfigurar o bootloader (GRUB) e só no final apagar o
// disco original — com uma reinicialização no meio que PRECISA ser
// confirmada manualmente antes de prosseguir. Um erro em qualquer passo
// pode deixar o servidor sem conseguir ligar, sem desfazer fácil. Por
// isso isso vira um roteiro pra rodar manualmente, nunca um botão.
//
// Só cobre o layout mais comum (GPT + partição EFI + raiz ext4, sem LVM,
// sem swap separado) — qualquer outro layout recusa em vez de gerar um
// comando possivelmente errado.

const isLinux = process.platform === "linux";
// Disco candidato pode ser do mesmo tamanho do disco do sistema (espelho
// simples, disco inteiro) OU maior (sobra vira uma 3ª partição livre,
// formatada como área de backup independente — não entra no RAID).
const MIN_LEFTOVER_FOR_BACKUP_BYTES = 1024 * 1024 * 1024; // 1GiB — abaixo disso não vale a pena criar a partição extra

function parentDiskName(blockDeviceName) {
  if (!blockDeviceName) return null;
  const match = blockDeviceName.match(/^(nvme\d+n\d+|mmcblk\d+|sd[a-z]+|hd[a-z]+|vd[a-z]+|xvd[a-z]+)/);
  return match ? match[1] : blockDeviceName.replace(/\d+$/, "");
}

function toolExists(tool) {
  try {
    execFileSync("which", [tool], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

// Ferramentas que o roteiro inteiro vai precisar — conferidas ANTES de
// gerar o texto, não no meio da execução manual. `mdadm` em especial
// raramente vem instalado por padrão numa VPS (RAID não é uso comum),
// e descobrir isso no passo 3, já com a tabela de partições do disco
// novo reescrita, é pior do que descobrir antes de começar.
const REQUIRED_TOOLS = ["sgdisk", "partprobe", "udevadm", "mkfs.fat", "mkfs.ext4", "mdadm", "rsync", "blkid", "chroot"];

async function getSystemDisk(systemMountPath) {
  const blockDevices = await si.blockDevices().catch(() => []);
  const rootPartition = blockDevices.find(bd => bd.mount === systemMountPath);
  if (!rootPartition) return null;
  const parentName = parentDiskName(rootPartition.name);
  const parentDisk = blockDevices.find(bd => bd.name === parentName && bd.type === "disk");
  return parentDisk ? { device: `/dev/${parentName}`, sizeBytes: parentDisk.size || 0 } : null;
}

async function findMirrorCandidates(systemMountPath) {
  if (!isLinux) {
    return { supported: false, reason: "Só implementado em Linux por enquanto.", candidates: [] };
  }
  const sysDisk = await getSystemDisk(systemMountPath);
  if (!sysDisk) {
    return { supported: false, reason: "Não foi possível identificar o disco do sistema.", candidates: [] };
  }

  const blockDevices = await si.blockDevices().catch(() => []);
  const disks = blockDevices.filter(bd => bd.type === "disk" && `/dev/${bd.name}` !== sysDisk.device);

  // Tolerância pra baixo (discos "do mesmo tamanho" variam ~1-2% entre
  // fabricantes) — pra cima não tem limite, o que sobrar vira partição
  // de backup.
  const minAcceptableSize = sysDisk.sizeBytes * 0.98;

  const candidates = disks
    .filter(d => sysDisk.sizeBytes > 0 && (d.size || 0) >= minAcceptableSize)
    .map(d => {
      const mountedPartition = blockDevices.find(bd => parentDiskName(bd.name) === d.name && bd.mount);
      const leftoverBytes = Math.max(0, (d.size || 0) - sysDisk.sizeBytes);
      return {
        device: `/dev/${d.name}`,
        sizeBytes: d.size || 0,
        leftoverBytes,
        willHaveBackupPartition: leftoverBytes >= MIN_LEFTOVER_FOR_BACKUP_BYTES,
        eligible: !mountedPartition,
        reason: mountedPartition ? `Tem uma partição montada em "${mountedPartition.mount}" — desmonte antes.` : null
      };
    });

  return { supported: true, systemDisk: sysDisk, candidates };
}

async function buildMirrorRunbook(targetDevice, systemMountPath) {
  if (!isLinux) throw new Error("Só implementado em Linux por enquanto.");

  const found = await findMirrorCandidates(systemMountPath);
  if (!found.supported) throw new Error(found.reason);
  const candidate = found.candidates.find(c => c.device === targetDevice);
  if (!candidate) throw new Error("Disco não encontrado entre os candidatos elegíveis (tamanho incompatível ou não existe mais).");
  if (!candidate.eligible) throw new Error(candidate.reason);

  const sysDevice = found.systemDisk.device;

  // `-m` (modo máquina) em vez do texto normal do `parted` — o texto
  // normal é traduzido conforme o LANG/LC_ALL do servidor ("Partition
  // Table: gpt" vira outra coisa em português/espanhol/etc.), então o
  // regex em inglês podia falhar mesmo num disco GPT de verdade,
  // relatando "não suportado" por engano. O modo máquina é sempre em
  // campos fixos separados por ":", nunca traduzido.
  let partedOut;
  try {
    partedOut = execFileSync("parted", ["-m", "-s", sysDevice, "unit", "B", "print"], { encoding: "utf8" });
  } catch {
    throw new Error("Não foi possível ler a tabela de partições do disco do sistema (parted falhou ou não está instalado).");
  }

  const lines = partedOut.split("\n").map(l => l.trim()).filter(Boolean);
  // lines[0] é sempre "BYT;" (cabeçalho fixo do modo máquina); lines[1]
  // é a linha do disco: device:tamanho:tipo:tam-setor-lógico:tam-setor-
  // físico:TABELA:modelo;  — campo 5 (índice 5) é o tipo de tabela.
  const diskFields = (lines[1] || "").replace(/;\s*$/, "").split(":");
  const tableType = (diskFields[5] || "").toLowerCase();
  if (tableType !== "gpt") {
    throw new Error(
      `Esquema de disco não suportado — este gerador só reconhece GPT, e o disco do sistema está em "${tableType || "desconhecido"}". ` +
      `Se o disco for GPT de verdade e esse erro insistir, confirme rodando "sudo parted -m ${sysDevice} unit B print" direto no servidor.`
    );
  }

  // Linhas de partição no modo máquina: "N:início:fim:tamanho:fs:nome:flags;"
  const partLines = lines.slice(2).filter(l => /^\d+:/.test(l));
  if (partLines.length !== 2) {
    throw new Error(
      `Layout de disco não suportado — este gerador só cobre o padrão mais comum (2 partições: EFI + raiz). ` +
      `Seu disco do sistema tem ${partLines.length} partição(ões). Layouts com LVM, swap separado ou partições ` +
      `extras precisam de orientação especializada manual, não geração automática.`
    );
  }
  const firstPartFields = partLines[0].replace(/;\s*$/, "").split(":");
  const firstPartFsType = (firstPartFields[4] || "").toLowerCase();
  const firstPartFlags = (firstPartFields[6] || "").toLowerCase();
  if (!/boot|esp/.test(firstPartFlags) && !/fat/.test(firstPartFsType)) {
    throw new Error("Não foi possível confirmar a partição EFI na posição esperada (1ª partição) — layout não reconhecido.");
  }

  const missingTools = REQUIRED_TOOLS.filter(tool => !toolExists(tool));
  if (missingTools.length) {
    throw new Error(
      `Ferramenta(s) não instalada(s) neste servidor, necessária(s) pro roteiro inteiro: ${missingTools.join(", ")}. ` +
      `Instale antes de gerar o roteiro (ex.: "apt install mdadm gdisk rsync dosfstools parted") — ` +
      `melhor descobrir isso agora do que no meio do procedimento, já com o disco novo reparticionado.`
    );
  }

  const sysRootPart = `${sysDevice}2`;
  const newEfiPart = `${targetDevice}1`;
  const newRootPart = `${targetDevice}2`;
  const newBackupPart = `${targetDevice}3`;
  const leftoverBytes = Math.max(0, candidate.sizeBytes - found.systemDisk.sizeBytes);
  const willHaveBackupPartition = leftoverBytes >= MIN_LEFTOVER_FOR_BACKUP_BYTES;

  const steps = [
    {
      // sgdisk -e corrige o cabeçalho de backup do GPT quando o disco
      // novo tem um número de setores levemente diferente do disco de
      // origem (comum até entre discos do "mesmo tamanho" — fabricantes
      // variam uns poucos setores); partprobe+udevadm settle garantem
      // que o kernel reconheça as partições novas antes do próximo
      // passo tentar usá-las — sem isso, o mkfs seguinte pode falhar ou
      // mexer no nó errado (mesmo problema já visto na ferramenta de
      // particionar comum).
      title: "1. Clonar a tabela de partições pro disco novo (EFI + raiz, mesmo tamanho do disco do sistema)",
      commands: [
        `sgdisk ${sysDevice} -R ${targetDevice}`,
        `sgdisk -G ${targetDevice}`,
        `sgdisk -e ${targetDevice}`,
        `partprobe ${targetDevice}`,
        `udevadm settle`
      ]
    }
  ];

  if (willHaveBackupPartition) {
    steps.push({
      title: "1b. Criar uma 3ª partição com o espaço que sobrou, pra usar como área de backup (fora do RAID)",
      commands: [`sgdisk -N 3 ${targetDevice}`, `partprobe ${targetDevice}`, `udevadm settle`, `mkfs.ext4 ${newBackupPart}`]
    });
  }

  steps.push(
    {
      title: "2. Formatar a partição EFI do disco novo",
      commands: [`mkfs.fat -F32 ${newEfiPart}`]
    },
    {
      title: "3. Criar o array RAID1 incompleto, só com o disco novo",
      commands: [
        `# Se a partição já tiver sido formatada antes (ex.: teste anterior), o mdadm pergunta`,
        `# algo como "appears to contain an ext4 filesystem... Continue creating array? y" — responda "y",`,
        `# é esperado, estamos substituindo por uma partição RAID de verdade.`,
        `mdadm --create /dev/md0 --level=1 --raid-devices=2 missing ${newRootPart}`,
        `mkfs.ext4 /dev/md0`
      ]
    },
    {
      title: "4a. Parar os containers Docker antes de copiar (evita cópia inconsistente de dados sendo escritos agora)",
      commands: [
        `# Rode isso em cada stack que estiver de pé (ex.: AtendeFlow, Seafile) — ajuste os caminhos do docker-compose.yml:`,
        `docker compose -f /caminho/docker-compose.yml down`,
        `# Confirme que não sobrou nada rodando:`,
        `docker ps`
      ]
    },
    {
      title: "4b. Copiar o sistema atual pro array novo (com os containers parados)",
      commands: [
        `mkdir -p /mnt/newroot`,
        `mount /dev/md0 /mnt/newroot`,
        `rsync -axHAWXS --numeric-ids --exclude=/dev --exclude=/proc --exclude=/sys --exclude=/tmp --exclude=/run --exclude=/mnt --exclude=/media --exclude=/lost+found ${systemMountPath} /mnt/newroot/`
      ]
    },
    {
      title: "5. Ajustar fstab, initramfs e instalar o bootloader nos dois discos (dentro de um chroot)",
      commands: [
        `mount --bind /dev /mnt/newroot/dev && mount --bind /proc /mnt/newroot/proc && mount --bind /sys /mnt/newroot/sys`,
        `chroot /mnt/newroot blkid -s UUID -o value /dev/md0   # anote esse UUID`,
        `# edite /mnt/newroot/etc/fstab trocando a linha da raiz pra: UUID=<anotado>  /  ext4  defaults  0  1`,
        `mdadm --detail --scan >> /mnt/newroot/etc/mdadm/mdadm.conf`,
        `chroot /mnt/newroot update-initramfs -u`,
        `chroot /mnt/newroot grub-install ${sysDevice}`,
        `chroot /mnt/newroot grub-install ${targetDevice}`,
        `chroot /mnt/newroot update-grub`
      ]
    },
    {
      title: "6. Reiniciar e CONFIRMAR que o sistema ligou a partir do RAID — NÃO prossiga sem confirmar",
      commands: [`reboot`, `# depois de ligar: cat /proc/mdstat   (precisa mostrar md0 ativo)`]
    },
    {
      title: "6b. Religar os containers Docker que foram parados no passo 4a",
      commands: [`docker compose -f /caminho/docker-compose.yml up -d`, `docker ps   # confirme que tudo voltou`]
    },
    {
      title: "7. Só depois de confirmado o boot: apagar o disco original e adicioná-lo ao array",
      commands: [`mdadm --manage /dev/md0 --add ${sysRootPart}`, `watch cat /proc/mdstat   # acompanhar a sincronização`]
    },
    {
      title: "8. (Opcional) Montar a partição de backup",
      commands: willHaveBackupPartition
        ? [`mkdir -p /mnt/backup`, `echo "${newBackupPart}  /mnt/backup  ext4  defaults,nofail  0  2" | sudo tee -a /etc/fstab`, `mount -a`]
        : [`# Esse disco não sobrou espaço suficiente pra partição de backup extra — pulado.`]
    }
  );

  return {
    systemDisk: sysDevice,
    targetDisk: targetDevice,
    willHaveBackupPartition,
    backupPartition: willHaveBackupPartition ? newBackupPart : null,
    warning:
      "Procedimento de múltiplas etapas com reinicialização no meio. Execute manualmente, " +
      "um passo de cada vez, com mídia de resgate (live USB) disponível. O painel NUNCA executa isso sozinho. " +
      "Depois que os dois discos estiverem sincronizados no array (passo 7), eles ficam EQUIVALENTES dentro do " +
      "RAID1 — não existe uma etapa separada de 'tornar um principal e o outro secundário', os dois já funcionam " +
      "como espelho um do outro a partir daí.",
    steps
  };
}

module.exports = { findMirrorCandidates, buildMirrorRunbook };
