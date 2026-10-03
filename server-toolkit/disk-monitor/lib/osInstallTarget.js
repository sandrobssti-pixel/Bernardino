const { execFileSync } = require("child_process");
const si = require("systeminformation");

// Depois que o disco foi criado/formatado, o técnico escolhe pra que
// serve: "vou instalar sistema operacional" ou "backup/aplicação/dado".
// Isso NÃO conecta automaticamente com o instalador que vai rodar
// depois — tecnicamente impossível: o instalador (Windows Setup, Ubuntu,
// etc.) roda de dentro do pendrive como um sistema operacional à parte,
// e o disk-monitor já não está mais executando nesse momento (a máquina
// saiu do SO onde ele roda). O que este módulo faz de verdade, pra
// aproximar o resultado do que foi pedido:
//
// 1. ROTULAR a partição (sistema de arquivos já escolhido/formatado) com
//    um nome identificável — ex. "OSINSTALL" — pra aparecer destacada
//    na tela de particionamento do instalador quando o técnico rodar
//    ele manualmente. Ação imediata, de baixo risco (só muda o rótulo
//    de uma partição que o próprio técnico acabou de formatar).
// 2. Gerar (nunca executar) um `autounattend.xml` pra instalação
//    automática do Windows — só texto, o técnico copia manualmente pro
//    MESMO pendrive do instalador. Isso sim faz o Windows Setup pular a
//    pergunta de "em qual partição instalar".
//
// IMPORTANTE sobre o autounattend.xml — risco real, não hipotético: o
// "DiskID" que o Windows PE usa pra identificar o disco (0, 1, 2...) é a
// ORDEM DE ENUMERAÇÃO dele naquele boot específico, que pode mudar
// dependendo de cabo SATA, ordem de boot na BIOS/UEFI, modo do
// controlador (AHCI/RAID) — não é garantido bater com o que este
// servidor vê como "primeiro disco" agora. Por isso o arquivo gerado
// SEMPRE vem com um aviso pra conferir o disco certo (por modelo/
// série/tamanho) via "Shift+F10 -> diskpart -> list disk" ANTES de
// deixar a instalação prosseguir — nunca confia cegamente no DiskID
// palpitado.

const isLinux = process.platform === "linux";

// Comando de rotulagem certo pra cada sistema de arquivos — cada um tem
// sua própria ferramenta e limite de tamanho de rótulo (por isso o
// rótulo usado por este módulo é sempre curto, cabe em todos).
const LABEL_COMMANDS = {
  ext4: (device, label) => ({ cmd: "e2label", args: [device, label] }),
  xfs: (device, label) => ({ cmd: "xfs_admin", args: ["-L", label, device] }),
  exfat: (device, label) => ({ cmd: "exfatlabel", args: [device, label] }),
  ntfs: (device, label) => ({ cmd: "ntfslabel", args: [device, label] }),
  vfat: (device, label) => ({ cmd: "fatlabel", args: [device, label] }),
  fat32: (device, label) => ({ cmd: "fatlabel", args: [device, label] })
};

function normalizeFsType(fsType) {
  return (fsType || "").toLowerCase().replace(/^fat$/, "vfat");
}

async function applyPartitionLabel(device, fsType, label) {
  if (!isLinux) {
    throw new Error("Rotular partição ainda só implementado em Linux.");
  }
  const shortName = (device || "").replace(/^\/dev\//, "");
  if (!shortName) throw new Error("Partição não informada.");

  // Reconfere na hora — mesmo espírito do resto do módulo: nunca confia
  // no que a tela mandou, sempre olha o estado real do servidor antes.
  const blockDevices = await si.blockDevices().catch(() => []);
  const partition = blockDevices.find(bd => bd.name === shortName && bd.type === "part");
  if (!partition) throw new Error("Partição não encontrada no servidor.");
  if (partition.mount) throw new Error(`Partição está montada em "${partition.mount}" — desmonte antes de rotular.`);

  const normalized = normalizeFsType(fsType);
  const builder = LABEL_COMMANDS[normalized];
  if (!builder) {
    throw new Error(`Rotulagem não suportada pra sistema de arquivos "${fsType}".`);
  }
  const { cmd, args } = builder(device, label);
  try {
    execFileSync("which", [cmd], { stdio: "pipe" });
  } catch {
    throw new Error(`Ferramenta "${cmd}" não instalada neste servidor — necessária pra rotular partição ${normalized}.`);
  }
  try {
    execFileSync(cmd, args, { encoding: "utf8", timeout: 30000 });
  } catch (err) {
    const detail = String(err.stderr || err.stdout || err.message || err).trim();
    throw new Error(`Falhou ao rotular (${cmd}): ${detail}`);
  }
  return { ok: true, device, label, command: `${cmd} ${args.join(" ")}` };
}

// Só MONTA o texto do autounattend.xml — nunca escreve em disco nenhum,
// nunca toca no pendrive. O técnico copia esse conteúdo manualmente pra
// raiz do MESMO pendrive de instalação do Windows.
function buildWindowsAutounattendXml({ diskModel, diskSizeGB, diskSerial, partitionLabel, diskId, partitionId }) {
  const resolvedDiskId = Number.isInteger(diskId) ? diskId : 0;
  // Número da partição dentro do disco (não confundir com DiskID, que é
  // o disco inteiro) — pro esquema "Windows com UEFI" gerado por este
  // painel, a partição 1 é sempre a EFI e a 2 é sempre a principal
  // (NTFS), então o padrão aqui é 2. Só muda se o chamador mandar outro
  // valor explicitamente (ex.: layout diferente).
  const resolvedPartitionId = Number.isInteger(partitionId) ? partitionId : 2;
  const safetyComment = `
  ====================================================================
  CONFIRA ANTES DE DEIXAR RODAR — o DiskID abaixo (${resolvedDiskId}) é
  um PALPITE baseado na ordem mais comum de disco único extra; a ordem
  de verdade pode mudar por cabo SATA/ordem de boot/modo do
  controlador. No instalador do Windows, antes de avançar:
    1. Pressione Shift+F10 pra abrir um prompt de comando.
    2. Digite: diskpart
    3. Digite: list disk
    4. Confira qual número de disco bate com:
         Modelo: ${diskModel || "(não informado)"}
         Número de série: ${diskSerial || "(não informado)"}
         Tamanho: ~${diskSizeGB} GB
    5. Se NÃO for o disco ${resolvedDiskId}, edite a linha <DiskID> deste
       arquivo pro número certo antes de continuar (ou cancele e rode a
       instalação manualmente, sem este arquivo).
    Digite "exit" duas vezes pra fechar o diskpart e o prompt.
  ====================================================================
  Este arquivo só cuida de apontar a instalação pra partição já criada
  e formatada (rótulo "${partitionLabel}") — ele NÃO configura conta de
  usuário, chave de produto, idioma/região nem pula a tela de rede/EULA
  do Windows além do necessário pra não perguntar a partição. O resto
  da instalação continua normal.
  `;

  return `<?xml version="1.0" encoding="utf-8"?>
<!--${safetyComment}-->
<unattend xmlns="urn:schemas-microsoft-com:unattend">
  <settings pass="windowsPE">
    <component name="Microsoft-Windows-Setup" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <DiskConfiguration>
        <Disk wcm:action="add">
          <DiskID>${resolvedDiskId}</DiskID>
          <WillWipeDisk>false</WillWipeDisk>
        </Disk>
      </DiskConfiguration>
      <ImageInstall>
        <OSImage>
          <InstallToAvailablePartition>false</InstallToAvailablePartition>
          <InstallTo>
            <DiskID>${resolvedDiskId}</DiskID>
            <!-- PartitionID conferido pelo rótulo "${partitionLabel}" no instalador -->
            <PartitionID>${resolvedPartitionId}</PartitionID>
          </InstallTo>
        </OSImage>
      </ImageInstall>
      <UserData>
        <AcceptEula>true</AcceptEula>
      </UserData>
    </component>
  </settings>
</unattend>
`;
}

module.exports = { applyPartitionLabel, buildWindowsAutounattendXml };
