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

  let partedOut;
  try {
    partedOut = execFileSync("parted", ["-s", sysDevice, "print"], { encoding: "utf8" });
  } catch {
    throw new Error("Não foi possível ler a tabela de partições do disco do sistema (parted falhou ou não está instalado).");
  }

  if (!/Partition Table:\s*gpt/i.test(partedOut)) {
    throw new Error("Esquema de disco não suportado — este gerador só reconhece GPT, e o disco do sistema não está em GPT.");
  }

  const partLines = partedOut.split("\n").map(l => l.trim()).filter(l => /^\d+\s/.test(l));
  if (partLines.length !== 2) {
    throw new Error(
      `Layout de disco não suportado — este gerador só cobre o padrão mais comum (2 partições: EFI + raiz). ` +
      `Seu disco do sistema tem ${partLines.length} partição(ões). Layouts com LVM, swap separado ou partições ` +
      `extras precisam de orientação especializada manual, não geração automática.`
    );
  }
  if (!/boot|esp|fat32/i.test(partLines[0])) {
    throw new Error("Não foi possível confirmar a partição EFI na posição esperada (1ª partição) — layout não reconhecido.");
  }

  const sysRootPart = `${sysDevice}2`;
  const newEfiPart = `${targetDevice}1`;
  const newRootPart = `${targetDevice}2`;
  const newBackupPart = `${targetDevice}3`;
  const leftoverBytes = Math.max(0, candidate.sizeBytes - found.systemDisk.sizeBytes);
  const willHaveBackupPartition = leftoverBytes >= MIN_LEFTOVER_FOR_BACKUP_BYTES;

  const steps = [
    {
      title: "1. Clonar a tabela de partições pro disco novo (EFI + raiz, mesmo tamanho do disco do sistema)",
      commands: [`sgdisk ${sysDevice} -R ${targetDevice}`, `sgdisk -G ${targetDevice}`]
    }
  ];

  if (willHaveBackupPartition) {
    steps.push({
      title: "1b. Criar uma 3ª partição com o espaço que sobrou, pra usar como área de backup (fora do RAID)",
      commands: [`sgdisk -N 3 ${targetDevice}`, `mkfs.ext4 ${newBackupPart}`]
    });
  }

  steps.push(
    {
      title: "2. Formatar a partição EFI do disco novo",
      commands: [`mkfs.fat -F32 ${newEfiPart}`]
    },
    {
      title: "3. Criar o array RAID1 incompleto, só com o disco novo",
      commands: [`mdadm --create /dev/md0 --level=1 --raid-devices=2 missing ${newRootPart}`, `mkfs.ext4 /dev/md0`]
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
