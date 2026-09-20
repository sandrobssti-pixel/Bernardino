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

const NAME_ALIASES = ["nome", "name", "contato"];
const NUMBER_ALIASES = [
  "numero",
  "número",
  "telefone",
  "celular",
  "whatsapp",
  "phone",
  "telefone1",
  "fone",
  "tel"
];
const EMAIL_ALIASES = ["email", "e-mail"];

// Planilhas de terceiros raramente usam "nome"/"telefone" literalmente (ex.:
// "atirador", "cliente", "sócio"...). Quando nenhum alias bate, cai pra
// primeira coluna da planilha como nome — sempre existe e normalmente é
// o identificador da linha (ver docs/MANUAL_TECNICO.md).
const getNameFromRow = (row: Record<string, any>): string => {
  const byAlias = getRowValueByAliases(row, NAME_ALIASES);
  if (byAlias) return String(byAlias);

  const firstKey = Object.keys(row || {})[0];
  return firstKey ? String(row[firstKey] ?? "") : "";
};

// Todas as colunas da planilha que não foram usadas como nome/número/e-mail
// ficam guardadas em ContactListItem.extraData, só pra uso interno (nunca
// vai pra campanha, que só usa o número normalizado).
const getExtraDataFromRow = (row: Record<string, any>): Record<string, any> => {
  const usedAliases = new Set(
    [...NAME_ALIASES, ...NUMBER_ALIASES, ...EMAIL_ALIASES].map(normalizeHeader)
  );

  const extra: Record<string, any> = {};
  for (const [key, value] of Object.entries(row || {})) {
    if (usedAliases.has(normalizeHeader(key))) continue;
    if (value === null || value === undefined || value === "") continue;
    extra[key] = value instanceof Date ? value.toISOString() : value;
  }
  return extra;
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

    const name = getNameFromRow(rowObj);

    let number: unknown = getRowValueByAliases(rowObj, NUMBER_ALIASES);
    number = normalizeCampaignContactNumber(number);
    if (!number) {
      number = getFallbackNumberFromRow(rowObj);
    }

    const email = getRowValueByAliases(rowObj, EMAIL_ALIASES);
    const extraData = getExtraDataFromRow(rowObj);

    return {
      name,
      number: String(number || ""),
      email,
      contactListId,
      companyId,
      extraData: Object.keys(extraData).length > 0 ? extraData : null
    };
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
      // Reimportação da mesma planilha (ex.: lista de inadimplentes
      // atualizada todo mês) — atualiza nome/e-mail/dados extras (status,
      // vigência etc.) do contato já existente, sem mexer no número nem na
      // validação de WhatsApp já feitas.
      await newContact.update({
        name: contact.name || newContact.name,
        email: contact.email || newContact.email,
        extraData: contact.extraData ?? newContact.extraData
      });
      duplicates += 1;
    }

    processed += 1;
    emitProgress("running");
  }

  emitProgress("done");

  return contactList;
}
