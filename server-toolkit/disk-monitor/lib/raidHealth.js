const fs = require("fs");

// Leitura da saúde de arrays mdadm (RAID por software do Linux) a partir
// de /proc/mdstat — arquivo de kernel, leitura sempre liberada pra
// qualquer usuário (não precisa de root, diferente de `mdadm --detail`,
// que exige sudo). Dá tudo que precisamos pra detectar degradação:
// quantos membros o array deveria ter vs quantos estão ativos agora, e
// se tem uma recuperação/sincronização em andamento.

// Linha de cabeçalho de um array, ex.:
//   md0 : active raid1 sda2[2] sdb2[1]
const ARRAY_LINE = /^(md\d+)\s*:\s*(\S+)\s+(\S+)\s+(.*)$/;
// Linha de tamanho/status, ex.:
//   123865088 blocks super 1.2 [2/2] [UU]
const SIZE_LINE = /^\s*(\d+)\s+blocks.*\[(\d+)\/(\d+)\]\s+\[([U_]+)\]/;
// Linha de progresso de resync/recovery, ex.:
//   [=====>...............]  resync = 25.0% (31000000/123865088) finish=15.2min speed=90000K/sec
const PROGRESS_LINE = /\[[=>.]+\]\s+(resync|recovery)\s*=\s*([\d.]+)%/;
const FINISH_TOKEN = /finish=(\S+)/;
// Membro de array, ex.: sda2[2] ou sda2[2](F) (falho) ou sda2[2](S) (spare)
const MEMBER_TOKEN = /^([a-z0-9]+)\[(\d+)\](\(F\)|\(S\))?$/;

function parseMdstat(text) {
  const lines = text.split("\n");
  const arrays = [];
  let current = null;

  for (const line of lines) {
    const arrayMatch = line.match(ARRAY_LINE);
    if (arrayMatch) {
      if (current) arrays.push(current);
      const [, name, state, level, membersStr] = arrayMatch;
      const members = membersStr
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(token => {
          const m = token.match(MEMBER_TOKEN);
          return m
            ? { device: m[1], slot: Number(m[2]), faulty: m[3] === "(F)", spare: m[3] === "(S)" }
            : { device: token, slot: null, faulty: false, spare: false };
        });
      current = {
        name,
        state,
        level,
        members,
        raidDevices: null,
        activeDevices: null,
        statusBitmap: null,
        resyncing: false,
        resyncType: null,
        resyncPercent: null,
        resyncFinish: null
      };
      continue;
    }
    if (!current) continue;

    const sizeMatch = line.match(SIZE_LINE);
    if (sizeMatch) {
      current.raidDevices = Number(sizeMatch[2]);
      current.activeDevices = Number(sizeMatch[3]);
      current.statusBitmap = sizeMatch[4];
      continue;
    }

    const progressMatch = line.match(PROGRESS_LINE);
    if (progressMatch) {
      const finishMatch = line.match(FINISH_TOKEN);
      current.resyncing = true;
      current.resyncType = progressMatch[1];
      current.resyncPercent = Number(progressMatch[2]);
      current.resyncFinish = finishMatch ? finishMatch[1] : null;
      continue;
    }
  }
  if (current) arrays.push(current);
  return arrays;
}

// `level` "raid1" é o único coberto por enquanto neste painel — não é um
// limite técnico do parser (que lê qualquer nível igual), é só pra não
// prometer suporte a RAID5/6/10 sem ter validado o significado de
// "degradado" especificamente pra eles (ex.: RAID5 tolera só 1 disco
// fora; RAID6, 2 — essa distinção não está implementada ainda).
function readRaidStatus() {
  let text;
  try {
    text = fs.readFileSync("/proc/mdstat", "utf8");
  } catch {
    // Sem /proc/mdstat (não é Linux, ou mdadm nunca foi usado nesta
    // máquina) — não é erro, é só "nada pra monitorar aqui".
    return { supported: false, arrays: [] };
  }

  const arrays = parseMdstat(text).map(a => {
    const degraded = a.raidDevices != null && a.activeDevices != null && a.activeDevices < a.raidDevices;
    const faultyMembers = a.members.filter(m => m.faulty).map(m => m.device);
    return {
      name: a.name,
      level: a.level,
      raidDevices: a.raidDevices,
      activeDevices: a.activeDevices,
      statusBitmap: a.statusBitmap,
      degraded,
      faultyMembers,
      resyncing: a.resyncing,
      resyncType: a.resyncType,
      resyncPercent: a.resyncPercent,
      resyncFinish: a.resyncFinish,
      members: a.members.map(m => ({ device: m.device, faulty: m.faulty, spare: m.spare })),
      // "healthy" exige: nenhum membro marcado falho, array não
      // degradado E nenhuma sincronização em andamento (resync em
      // andamento quer dizer que o array ainda não está 100% espelhado
      // agora, mesmo que vá ficar saudável no final).
      healthy: !degraded && faultyMembers.length === 0 && !a.resyncing
    };
  });

  return { supported: true, arrays };
}

module.exports = { readRaidStatus, parseMdstat };
