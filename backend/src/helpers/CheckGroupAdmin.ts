import logger from "../utils/logger";

export const digitsOf = (raw: string): string =>
  String(raw || "")
    .split("@")[0]
    .split(":")[0]
    .replace(/\D/g, "");

interface GroupAdminStatus {
  // true/false quando conseguimos identificar o participante correspondente
  // à sessão conectada na lista do grupo; null quando não foi possível
  // identificar (ex: grupo usa addressing por LID e a sessão não bate com
  // nenhum id/lid/phoneNumber conhecido) — nesse caso não bloqueamos a UI,
  // quem decide de verdade é o próprio WhatsApp na hora da ação.
  isAdmin: boolean | null;
  metadata: any;
}

// Melhor esforço: tenta achar a própria sessão na lista de participantes
// (por id, lid ou phoneNumber) e checar o campo admin. Serve só para
// mostrar/esconder controles na tela — a autorização de verdade é sempre
// imposta pelo WhatsApp na chamada real (ver isGroupAdminRequiredError).
export const getGroupAdminStatus = async (
  wbot: any,
  jid: string
): Promise<GroupAdminStatus> => {
  const metadata = await wbot.groupMetadata(jid);
  const participants = metadata?.participants || [];

  const ownCandidates = [
    digitsOf(String(wbot?.user?.id || "")),
    digitsOf(String(wbot?.user?.lid || "")),
    digitsOf(String(wbot?.user?.phoneNumber || ""))
  ].filter(Boolean);

  const own = participants.find((participant: any) => {
    const candidates = [
      digitsOf(String(participant?.id || participant?.jid || "")),
      digitsOf(String(participant?.lid || "")),
      digitsOf(String(participant?.phoneNumber || ""))
    ].filter(Boolean);
    return candidates.some(candidate => ownCandidates.includes(candidate));
  });

  const isAdmin = own
    ? own.admin === "admin" || own.admin === "superadmin"
    : null;

  logger.warn(
    {
      jid,
      wbotUserId: wbot?.user?.id,
      wbotUserLid: wbot?.user?.lid,
      wbotUserPhoneNumber: wbot?.user?.phoneNumber,
      ownCandidates,
      ownParticipantFound: own || null,
      totalParticipants: participants.length,
      isAdmin
    },
    "[GroupAdmin] checagem de admin do grupo"
  );

  return { isAdmin, metadata };
};

// A autorização real de "só admin pode" é sempre imposta pelo próprio
// WhatsApp — o Baileys propaga isso como erro (Boom 403 / "not-authorized")
// na hora da chamada. Detectamos esse padrão para mostrar uma mensagem
// amigável e correta, em vez de bloquear no cliente com base numa
// identificação de participante que pode falhar (LID/PN).
export const isGroupAdminRequiredError = (error: any): boolean => {
  if (error?.output?.statusCode === 403) return true;
  if (error?.data === 403 || error?.data === "403") return true;
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("not-authorized") ||
    message.includes("forbidden") ||
    message.includes("403")
  );
};
