import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import { getWbot } from "../../libs/wbot";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import { getGroupAdminStatus, digitsOf } from "../../helpers/CheckGroupAdmin";

interface Request {
  contactId: string;
  companyId: string | number;
}

interface Response {
  subject: string;
  description?: string;
  participants: any[];
  // null = não foi possível identificar a sessão na lista de participantes
  // (ex.: grupo com addressing por LID); o frontend trata como "assume
  // permitido" e deixa o próprio WhatsApp confirmar na hora da ação.
  isAdmin: boolean | null;
}

const toLidKey = (raw: string): string | null => {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return null;
  return value.endsWith("@lid") ? value : `${value}@lid`;
};

// Enriquece participantes (que só trazem JID/LID) com o nome já salvo na
// agenda de contatos da empresa, casando por número/lid/jid — mesma lógica
// de matching usada em CreateOrUpdateContactService. Baileys também traz
// name/notify nativamente no groupMetadata; usamos como segunda opção.
const resolveParticipantNames = async (
  rawParticipants: any[],
  companyId: number
): Promise<any[]> => {
  const candidateNumbers = new Set<string>();
  const candidateLids = new Set<string>();
  const candidateJids = new Set<string>();

  rawParticipants.forEach(participant => {
    const id = String(participant?.id || participant?.jid || "")
      .trim()
      .toLowerCase();

    if (id.endsWith("@lid")) {
      candidateLids.add(id);
    } else if (id.includes("@")) {
      candidateJids.add(id);
    }

    const idDigits = digitsOf(id);
    if (idDigits) candidateNumbers.add(idDigits);

    const lidKey = toLidKey(participant?.lid);
    if (lidKey) {
      candidateLids.add(lidKey);
      const lidDigits = digitsOf(lidKey);
      if (lidDigits) candidateNumbers.add(lidDigits);
    }
  });

  const orConditions: any[] = [];
  if (candidateNumbers.size) {
    orConditions.push({ number: { [Op.in]: Array.from(candidateNumbers) } });
  }
  if (candidateLids.size) {
    orConditions.push({ lid: { [Op.in]: Array.from(candidateLids) } });
  }
  if (candidateJids.size) {
    orConditions.push({ jid: { [Op.in]: Array.from(candidateJids) } });
  }

  const nameByKey: Record<string, string> = {};

  if (orConditions.length) {
    const matchedContacts = await Contact.findAll({
      where: { companyId, [Op.or]: orConditions },
      attributes: ["name", "number", "lid", "jid"]
    });

    matchedContacts.forEach(matched => {
      if (matched.number) nameByKey[matched.number] = matched.name;
      if (matched.lid) nameByKey[String(matched.lid).toLowerCase()] = matched.name;
      if (matched.jid) nameByKey[String(matched.jid).toLowerCase()] = matched.name;
    });
  }

  return rawParticipants.map(participant => {
    const id = String(participant?.id || participant?.jid || "")
      .trim()
      .toLowerCase();
    const idDigits = digitsOf(id);
    const lidKey = toLidKey(participant?.lid);

    const resolvedName =
      (idDigits && nameByKey[idDigits]) ||
      (lidKey && nameByKey[lidKey]) ||
      (id && nameByKey[id]) ||
      participant?.name ||
      participant?.notify ||
      null;

    return { ...participant, name: resolvedName };
  });
};

const GetGroupInfoService = async ({
  contactId,
  companyId
}: Request): Promise<Response> => {
  if (!companyId) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 400);
  }

  const contact = await Contact.findOne({
    where: { id: contactId, companyId: Number(companyId) }
  });

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  if (!contact.isGroup) {
    throw new AppError("ERR_CONTACT_NOT_GROUP", 400);
  }

  const whatsapp = await Whatsapp.findOne({
    where: { id: contact.whatsappId, companyId: Number(companyId) }
  });

  if (!whatsapp) {
    throw new AppError("ERR_NO_DEFAULT_WHATSAPP", 404);
  }

  const wbot = getWbot(whatsapp.id, Number(companyId));
  const jid = `${contact.number}@g.us`;

  try {
    const { isAdmin, metadata } = await getGroupAdminStatus(wbot, jid);
    const rawParticipants = metadata?.participants || [];

    const participants = await resolveParticipantNames(
      rawParticipants,
      Number(companyId)
    );

    return {
      subject: metadata?.subject || "",
      description: metadata?.desc || metadata?.description,
      participants,
      isAdmin
    };
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("ERR_WAPP_GROUP_UPDATE_FAILED", 500);
  }
};

export default GetGroupInfoService;
