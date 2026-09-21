import * as Yup from "yup";
import AppError from "../../errors/AppError";
import { tryGetWbot } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import ContactList from "../../models/ContactList";
import ContactListItem from "../../models/ContactListItem";
import Contact from "../../models/Contact";
import { digitsOf } from "../../helpers/CheckGroupAdmin";

interface Request {
  whatsappId: string | number;
  companyId: string | number;
  groupIds: string[];
  mode: "participants" | "groups";
  name: string;
}

interface Response {
  contactList: ContactList;
  totalGroups: number;
  imported: number;
  duplicates: number;
  unresolved: number;
}

const groupIdFrom = (rawId: string): string =>
  String(rawId || "").split("@")[0].trim();

// Central de criação de listas por grupo: reúne, numa lista nova, ou os
// PRÓPRIOS grupos selecionados (cada um vira 1 item "grupo" — igual ao
// seletor que já existia dentro da campanha), ou os PARTICIPANTES de
// dentro deles (cada membro vira um contato individual, sem duplicar quem
// está em mais de um grupo selecionado). Criado pra tirar de dentro da
// campanha a escolha de grupo/avulso — agora só existe aqui, em Lista de
// Contatos, que passa a ser o único lugar de onde toda lista nasce (ver
// docs/MANUAL_TECNICO.md).
const ImportGroupContactsService = async ({
  whatsappId,
  companyId,
  groupIds,
  mode,
  name
}: Request): Promise<Response> => {
  if (!Array.isArray(groupIds) || groupIds.length === 0) {
    throw new AppError("ERR_NO_GROUP_SELECTED", 400);
  }

  const normalizedName = String(name || "").trim();
  const nameSchema = Yup.object().shape({
    name: Yup.string()
      .min(2, "ERR_CONTACTLIST_INVALID_NAME")
      .required("ERR_CONTACTLIST_REQUIRED")
  });
  try {
    await nameSchema.validate({ name: normalizedName });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId, companyId: Number(companyId) }
  });

  if (!whatsapp) {
    throw new AppError("ERR_NO_DEFAULT_WHATSAPP", 404);
  }

  const wbot = tryGetWbot(Number(whatsappId), Number(companyId));

  if (!wbot) {
    throw new AppError("ERR_WAPP_NOT_INITIALIZED", 400);
  }

  const contactList = await ContactList.create({
    name: normalizedName,
    companyId: Number(companyId)
  });

  let imported = 0;
  let duplicates = 0;
  let unresolved = 0;

  if (mode === "groups") {
    for (const rawGroupId of groupIds) {
      const groupId = groupIdFrom(rawGroupId);
      if (!groupId) continue;

      let subject = groupId;
      try {
        const metadata = await wbot.groupMetadata(`${groupId}@g.us`);
        subject = metadata?.subject || groupId;
      } catch {
        // segue com o id como nome se não conseguir ler os metadados
      }

      const [, created] = await ContactListItem.findOrCreate({
        where: {
          number: groupId,
          contactListId: contactList.id,
          companyId: Number(companyId)
        },
        defaults: {
          name: subject,
          number: groupId,
          email: "",
          isGroup: true,
          isWhatsappValid: true,
          contactListId: contactList.id,
          companyId: Number(companyId)
        }
      });

      if (created) imported += 1;
      else duplicates += 1;
    }

    return {
      contactList,
      totalGroups: groupIds.length,
      imported,
      duplicates,
      unresolved
    };
  }

  // mode === "participants": extrai o número de cada participante de cada
  // grupo selecionado, sem duplicar quem está em mais de um grupo.
  const seenNumbers = new Set<string>();

  for (const rawGroupId of groupIds) {
    const groupId = groupIdFrom(rawGroupId);
    if (!groupId) continue;

    let participants: any[] = [];
    try {
      const metadata = await wbot.groupMetadata(`${groupId}@g.us`);
      participants = metadata?.participants || [];
    } catch {
      continue;
    }

    for (const participant of participants) {
      const rawId = String(participant?.id || participant?.jid || "");
      const isLid = rawId.toLowerCase().endsWith("@lid");
      let numberDigits = isLid ? "" : digitsOf(rawId);

      // Participante endereçado por @lid (sem número exposto no próprio
      // grupo) — tenta resolver pelo Contact já salvo na empresa (lid ->
      // number), já que outro fluxo (mensagem trocada antes) pode ter
      // gravado esse vínculo.
      if (!numberDigits && isLid) {
        const lidKey = rawId.toLowerCase();
        const matchedContact = await Contact.findOne({
          where: { companyId: Number(companyId), lid: lidKey }
        });
        if (matchedContact?.number) {
          numberDigits = digitsOf(matchedContact.number);
        }
      }

      if (!numberDigits) {
        unresolved += 1;
        continue;
      }

      if (seenNumbers.has(numberDigits)) {
        duplicates += 1;
        continue;
      }
      seenNumbers.add(numberDigits);

      const displayName =
        participant?.name || participant?.notify || numberDigits;

      const [, created] = await ContactListItem.findOrCreate({
        where: {
          number: numberDigits,
          contactListId: contactList.id,
          companyId: Number(companyId)
        },
        defaults: {
          name: displayName,
          number: numberDigits,
          email: "",
          isGroup: false,
          isWhatsappValid: true,
          contactListId: contactList.id,
          companyId: Number(companyId)
        }
      });

      if (created) imported += 1;
    }
  }

  return {
    contactList,
    totalGroups: groupIds.length,
    imported,
    duplicates,
    unresolved
  };
};

export default ImportGroupContactsService;
