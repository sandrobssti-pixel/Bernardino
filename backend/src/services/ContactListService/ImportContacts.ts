import { head } from "lodash";
import XLSX from "xlsx";
import ContactListItem from "../../models/ContactListItem";
import CheckContactNumber from "../WbotServices/CheckNumber";
import logger from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";
import {
  isCampaignContactNumberFormatValid,
  normalizeCampaignContactNumber
} from "../../utils/normalizeCampaignContactNumber";
// import CheckContactNumber from "../WbotServices/CheckNumber";

const normalizeHeader = (value: unknown): string =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();

const getRowValueByAliases = (row: Record<string, any>, aliases: string[]): any => {
  const aliasesSet = new Set(aliases.map(normalizeHeader));

  for (const [key, value] of Object.entries(row || {})) {
    if (aliasesSet.has(normalizeHeader(key))) {
      return value;
    }
  }

  return "";
};

const getFallbackNumberFromRow = (row: Record<string, any>): string => {
  for (const value of Object.values(row || {})) {
    const normalized = normalizeCampaignContactNumber(value);
    if (/^\d{12,14}$/.test(normalized)) {
      return normalized;
    }
  }

  return "";
};

const isValidationInfraUnavailable = (error: any): boolean => {
  const message = String(error?.message || "");
  return (
    message.includes("ERR_NO_DEF_WAPP_FOUND") ||
    message.includes("ERR_WAPP_CHECK_CONTACT")
  );
};

type ImportProgress = {
  status: "running" | "done";
  total: number;
  processed: number;
  percent: number;
  imported: number;
  duplicates: number;
  invalid: number;
};

export async function ImportContacts(
  contactListId: number,
  companyId: number,
  file: Express.Multer.File | undefined,
  onProgress?: (progress: ImportProgress) => void
) {
  const workbook = XLSX.readFile(file?.path as string);
  const worksheet = head(Object.values(workbook.Sheets)) as any;
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 0 });
  const contacts = rows.map(row => {
    const rowObj = (row || {}) as Record<string, any>;
    let name = "";
    let number: unknown = "";
    let email = "";

    name = getRowValueByAliases(rowObj, ["nome", "name", "contato"]);

    number = getRowValueByAliases(rowObj, [
      "numero",
      "número",
      "telefone",
      "celular",
      "whatsapp",
      "phone",
      "telefone1",
      "fone",
      "tel"
    ]);

    number = normalizeCampaignContactNumber(number);
    if (!number) {
      number = getFallbackNumberFromRow(rowObj);
    }

    email = getRowValueByAliases(rowObj, ["email", "e-mail"]);

    return { name, number: String(number || ""), email, contactListId, companyId };
  });

  const candidates = contacts.filter(contact => Boolean(contact.number));
  const total = candidates.length;

  let processed = 0;
  let imported = 0;
  let duplicates = 0;
  let invalid = 0;

  const emitProgress = (status: "running" | "done" = "running") => {
    const percent = total > 0 ? Math.round((processed / total) * 100) : 100;
    onProgress?.({
      status,
      total,
      processed,
      percent,
      imported,
      duplicates,
      invalid
    });
  };

  emitProgress("running");

  let canCheckWhatsapp = true;
  const connectedWhatsapp = await Whatsapp.findOne({
    where: {
      companyId,
      status: "CONNECTED"
    }
  });

  if (!connectedWhatsapp) {
    canCheckWhatsapp = false;
    logger.warn(
      `[ImportContacts] Nenhuma conexão WhatsApp ativa na empresa ${companyId}. A validação onWhatsApp será ignorada nesta importação.`
    );
  }

  const contactList: ContactListItem[] = [];

  for (const contact of candidates) {
    if (!isCampaignContactNumberFormatValid(contact.number)) {
      logger.error(`Número de contato inválido: ${contact.number}`);
      invalid += 1;
      processed += 1;
      emitProgress("running");
      continue;
    }

    const [newContact, created] = await ContactListItem.findOrCreate({
      where: {
        number: `${contact.number}`,
        contactListId: contact.contactListId,
        companyId: contact.companyId
      },
      defaults: contact
    });

    if (created) {
      if (canCheckWhatsapp) {
        try {
          const response = await CheckContactNumber(newContact.number, companyId);
          newContact.isWhatsappValid = response ? true : false;
          newContact.number = String(response || "")
            .split("@")[0]
            .replace(/[^\d-]/g, "");
          await newContact.save();
        } catch (e) {
          if (isValidationInfraUnavailable(e)) {
            newContact.isWhatsappValid = true;
            await newContact.save();
            logger.warn(
              `[ImportContacts] Falha temporária na validação do WhatsApp para ${newContact.number}. Registro mantido como válido por fallback.`
            );
          } else {
            newContact.isWhatsappValid = false;
            newContact.number = String(newContact.number || "")
              .split("@")[0]
              .replace(/[^\d-]/g, "");
            await newContact.save();
            logger.error(`Número de contato inválido: ${newContact.number}`);
          }
        }
      } else {
        newContact.isWhatsappValid = true;
        await newContact.save();
      }

      imported += 1;
      contactList.push(newContact);
    } else {
      duplicates += 1;
    }

    processed += 1;
    emitProgress("running");
  }

  emitProgress("done");

  return contactList;
}
