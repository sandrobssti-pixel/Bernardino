// Gerador de roteiro pra preparar um disco "not_use" do Synology (disco
// presente no NAS, mas ainda fora de qualquer pool/volume) — NUNCA
// executa nada contra o DSM, só monta o passo a passo exato pra fazer
// na própria tela do Storage Manager.
//
// Por quê roteiro manual em vez de chamar a API de criação de pool/
// volume direto: diferente da leitura de discos e do desligamento (lib/
// synologyApi.js, já validados contra um Synology real), a API de criar
// Storage Pool/Volume não foi confirmada contra hardware — não dá pra
// testar aqui. Errar um parâmetro nessa chamada é arriscado demais pra
// fazer às cegas. Mesmo princípio já usado no espelhamento RAID1 do
// disco de sistema (lib/raidMirror.js): ação de risco alto sem como
// validar vira gerador de roteiro, não execução automática — só que
// aqui o "roteiro" é clicar na tela oficial do fabricante (Storage
// Manager), não digitar comando nenhum, então o risco de errar seguindo
// ele é bem menor do que inventar uma chamada de API não testada.

const FILESYSTEMS = new Set(["btrfs", "ext4"]);

function formatSizeTB(sizeBytes) {
  if (!sizeBytes) return null;
  return (sizeBytes / 1024 ** 4).toFixed(2);
}

// `disk` é o objeto já devolvido por synologyClient.getDisks() — a
// mesma forma de dado, pra não duplicar lógica de leitura/validação de
// status em dois lugares.
function buildVolumePrepGuide(disk, filesystem) {
  if (!disk || !disk.id) {
    throw new Error("Disco não informado.");
  }
  if (disk.status !== "not_use") {
    throw new Error(
      `Esse disco já está em uso (status "${disk.status}") — esse roteiro só serve pra um disco ainda fora de qualquer pool/volume ("not_use"). ` +
      `Usar um disco que já tem dado nele pra criar um volume novo apagaria o conteúdo existente — confirme no Storage Manager antes de prosseguir.`
    );
  }
  const fs = FILESYSTEMS.has(filesystem) ? filesystem : "btrfs";
  const sizeTB = formatSizeTB(disk.sizeBytes);
  const diskLabel = `${disk.id}${disk.model ? ` (${disk.vendor ? disk.vendor + " " : ""}${disk.model})` : ""}`;

  return {
    disk: { id: disk.id, model: disk.model, vendor: disk.vendor, sizeBytes: disk.sizeBytes },
    filesystem: fs,
    warning:
      "Isso é um roteiro pra seguir manualmente na tela do DSM (Storage Manager) — o painel não executa nada " +
      "no NAS por conta própria nessa etapa. Confirme sempre, na própria tela do DSM, que o disco selecionado " +
      `é o certo (${diskLabel}) antes de clicar em "Criar" — essa é a única etapa que, se errada, apaga dado.`,
    steps: [
      {
        title: "1. Abrir o Storage Manager no DSM",
        detail: "No DSM, abra o menu principal → Storage Manager (Gestor de Armazenamento)."
      },
      {
        title: "2. Criar o grupo de armazenamento (Storage Pool)",
        detail:
          `Na aba "Storage Pool" (Grupo de Armazenamento), clique em "Create" (Criar). Escolha "Custom" ` +
          `(Personalizado) quando perguntar o tipo, e selecione SOMENTE o disco ${diskLabel}${sizeTB ? ` (${sizeTB} TB)` : ""} ` +
          `na lista — nenhum outro disco marcado.`
      },
      {
        title: "3. Tipo de RAID: Basic (sem redundância)",
        detail:
          'Quando perguntar o tipo de RAID, escolha "Basic" (Básico) — é a opção correta pra um único disco, ' +
          "sem espelhamento/paridade (não tem como ter redundância com um disco só). Confirme e finalize a " +
          "criação do Storage Pool."
      },
      {
        title: "4. Criar o volume dentro do pool novo",
        detail:
          `Depois do Storage Pool criado, vá na aba "Volume" → "Create" (Criar) → selecione o pool que ` +
          `acabou de criar no passo 2/3.`
      },
      {
        title: `5. Sistema de arquivos: ${fs === "btrfs" ? "Btrfs" : "ext4"}`,
        detail:
          fs === "btrfs"
            ? 'Escolha "Btrfs" como sistema de arquivos — é o padrão recomendado do DSM, com suporte a ' +
              "snapshots e proteção contra corrupção de dado (checksums)."
            : 'Escolha "ext4" como sistema de arquivos.'
      },
      {
        title: "6. Finalizar",
        detail:
          'Use o tamanho máximo disponível (padrão) e confirme a criação. O DSM pode levar alguns minutos ' +
          '(dependendo do tamanho do disco) fazendo a formatação em segundo plano — acompanhe o progresso ' +
          'na própria tela do Storage Manager.'
      }
    ],
    note:
      "Nenhuma pasta compartilhada é criada automaticamente nesse roteiro — se quiser uma, crie depois em " +
      '"Control Panel" → "Shared Folder" → "Create", apontando pro volume novo.'
  };
}

module.exports = { buildVolumePrepGuide };
