import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ContactList from "../../models/ContactList";
import ContactListItem from "../../models/ContactListItem";
import {
  isCampaignContactNumberFormatValid,
  normalizeCampaignContactNumber
} from "../../utils/normalizeCampaignContactNumber";

interface Request {
  contactListId: number;
  companyId: number;
  contactIds?: number[];
}

interface Response {
  imported: number;
  duplicates: number;
  invalid: number;
  totalCandidates: number;
}

const ImportSystemContactsService = async ({
  contactListId,
  companyId,
  contactIds
}: Request): Promise<Response> => {
  const list = await ContactList.findOne({
    where: {
      id: contactListId,
      companyId
    }
  });

  if (!list) {
    throw new AppError("ERR_NO_CONTACTLIST_FOUND", 404);
  }

  const whereContacts: any = { companyId };
  if (Array.isArray(contactIds) && contactIds.length > 0) {
    whereContacts.id = { [Op.in]: contactIds };
  }

  const contacts = await Contact.findAll({
    where: whereContacts,
    attributes: ["id", "name", "number", "email", "isGroup", "lid", "jid"]
  });

  let imported = 0;
  let duplicates = 0;
  let invalid = 0;

  for (const contact of contacts) {
    const normalizedNumber = normalizeCampaignContactNumber(contact.number);
    const isValidPhone = isCampaignContactNumberFormatValid(normalizedNumber);
    // Contato sem telefone válido (ex.: só conhecido por LID/username) ainda
    // pode ser incluído na lista de campanha se já tivermos lid/jid dele —
    // o disparo poderá usar esse identificador como destino.
    const hasChatKey = Boolean(contact.lid || contact.jid);

    if (!isValidPhone && !hasChatKey) {
      invalid += 1;
      continue;
    }

    const itemNumber = isValidPhone ? normalizedNumber : String(contact.number || "");

    const [record, created] = await ContactListItem.findOrCreate({
      where: {
        number: itemNumber,
        contactListId,
        companyId
      },
      defaults: {
        name: contact.name,
        number: itemNumber,
        email: contact.email || "",
        isGroup: !!contact.isGroup,
        isWhatsappValid: true,
        contactListId,
        companyId,
        lid: contact.lid || null,
        jid: contact.jid || null
      }
    });

    if (created) {
      imported += 1;
    } else {
      duplicates += 1;
      if (
        record.name !== contact.name ||
        record.email !== (contact.email || "") ||
        record.lid !== (contact.lid || null) ||
        record.jid !== (contact.jid || null)
      ) {
        await record.update({
          name: contact.name,
          email: contact.email || "",
          isGroup: !!contact.isGroup,
          lid: contact.lid || null,
          jid: contact.jid || null
        });
      }
    }
  }

  return {
    imported,
    duplicates,
    invalid,
    totalCandidates: contacts.length
  };
};

export default ImportSystemContactsService;
