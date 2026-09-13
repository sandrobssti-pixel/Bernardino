import Ticket from "../models/Ticket";
import logger from "../utils/logger";

const normalizeJid = (value?: string | null): string => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || !raw.includes("@")) return "";
  const [left, domain] = raw.split("@");
  const primary = String(left || "").split(":")[0] || "";
  if (!primary || !domain) return "";
  return `${primary}@${domain}`;
};

const toParticipantJid = (value?: string | null, domainHint?: "lid" | "s.whatsapp.net"): string => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";

  if (raw.includes("@")) {
    return normalizeJid(raw);
  }

  if (domainHint === "lid") {
    const normalized = raw.replace(/\s+/g, "");
    return normalized ? `${normalized}@lid` : "";
  }

  const digits = raw.replace(/\D/g, "");
  return digits ? `${digits}@s.whatsapp.net` : "";
};

type GroupParticipant = {
  id?: string;
  jid?: string;
  JID?: string;
  lid?: string;
  LID?: string;
  phone?: string;
  Phone?: string;
  number?: string;
  Number?: string;
};

export const buildHiddenMentionAll = async ({
  ticket,
  wbot,
  groupJid
}: {
  ticket: Ticket;
  wbot: any;
  groupJid: string;
}): Promise<string[]> => {
  if (!ticket.isGroup) return [];

  const normalizedGroupJid = normalizeJid(groupJid);
  if (!normalizedGroupJid.endsWith("@g.us")) return [];

  if (typeof wbot?.groupMetadata !== "function") {
    return [];
  }

  let metadata: any;
  try {
    metadata = await wbot.groupMetadata(normalizedGroupJid);
  } catch (error) {
    logger.warn(
      `[HIDDEN_MENTION_ALL] groupMetadata falhou | ticketId=${ticket.id} | group=${normalizedGroupJid} | error=${String(
        (error as any)?.message || error
      )}`
    );
    return [];
  }

  const participants = Array.isArray(metadata?.participants) ? metadata.participants : [];

  const ownJid = normalizeJid((wbot as any)?.user?.id || "");
  const unique = new Set<string>();

  for (const participant of participants as GroupParticipant[]) {
    const jidCandidates = [
      toParticipantJid(participant?.id),
      toParticipantJid(participant?.jid),
      toParticipantJid(participant?.JID),
      toParticipantJid(participant?.lid, "lid"),
      toParticipantJid(participant?.LID, "lid"),
      toParticipantJid(participant?.phone),
      toParticipantJid(participant?.Phone),
      toParticipantJid(participant?.number),
      toParticipantJid(participant?.Number)
    ].filter(Boolean);
    const jid = jidCandidates[0] || "";
    if (!jid) continue;
    if (jid.endsWith("@g.us") || jid === "status@broadcast") continue;
    if (ownJid && jid === ownJid) continue;
    unique.add(jid);
  }

  return Array.from(unique);
};

export default buildHiddenMentionAll;
