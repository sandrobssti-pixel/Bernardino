import * as Yup from "yup";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import { head } from "lodash";

import ListContactsService from "../services/ContactServices/ListContactsService";
import CreateContactService from "../services/ContactServices/CreateContactService";
import ShowContactService from "../services/ContactServices/ShowContactService";
import UpdateContactService from "../services/ContactServices/UpdateContactService";
import DeleteContactService from "../services/ContactServices/DeleteContactService";
import GetContactService from "../services/ContactServices/GetContactService";
// IMPORTAR NOVO SERVIÇO DE DELEÇÃO EM MASSA
import BulkDeleteContactsService from "../services/ContactServices/BulkDeleteContactsService";
import BulkUpdateContactTagsService from "../services/ContactServices/BulkUpdateContactTagsService";

import CheckContactNumber from "../services/WbotServices/CheckNumber";
import CheckIsValidContact from "../services/WbotServices/CheckIsValidContact";
import GetProfilePicUrl from "../services/WbotServices/GetProfilePicUrl";
import AppError from "../errors/AppError";
import SimpleListService, {
  SearchContactParams
} from "../services/ContactServices/SimpleListService";
import ContactCustomField from "../models/ContactCustomField";
import ToggleAcceptAudioContactService from "../services/ContactServices/ToggleAcceptAudioContactService";
import BlockUnblockContactService from "../services/ContactServices/BlockUnblockContactService";
import { ImportContactsService } from "../services/ContactServices/ImportContactsService";
import NumberSimpleListService from "../services/ContactServices/NumberSimpleListService";
import CreateOrUpdateContactServiceForImport from "../services/ContactServices/CreateOrUpdateContactServiceForImport";
import UpdateContactWalletsService from "../services/ContactServices/UpdateContactWalletsService";

import FindContactTags from "../services/ContactServices/FindContactTags";
import { log } from "console";
import ToggleDisableBotContactService from "../services/ContactServices/ToggleDisableBotContactService";
import GetDefaultWhatsApp from "../helpers/GetDefaultWhatsApp";
import Contact from "../models/Contact";
import Tag from "../models/Tag";
import ContactTag from "../models/ContactTag";
import logger from "../utils/logger";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  contactTag: string;
  isGroup?: string;
};

type IndexGetContactQuery = {
  name: string;
  number: string;
};

interface ExtraInfo extends ContactCustomField {
  name: string;
  value: string;
}
interface ContactData {
  name: string;
  number: string;
  email?: string;
  extraInfo?: ExtraInfo[];
  disableBot?: boolean;
  remoteJid?: string;
  wallets?: null | number[] | string[];
  birthDate?: Date | string | null;
  whatsappId?: number | string | null;
}

const normalizeBirthDateInput = (value: unknown): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const parseExcelSerial = (serial: number): string | null => {
    if (Number.isNaN(serial)) return null;
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    excelEpoch.setUTCDate(excelEpoch.getUTCDate() + Math.floor(serial));
    const year = excelEpoch.getUTCFullYear();
    const month = String(excelEpoch.getUTCMonth() + 1).padStart(2, "0");
    const day = String(excelEpoch.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  if (typeof value === "number") {
    return parseExcelSerial(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    const brDateMatch = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (brDateMatch) {
      const day = String(brDateMatch[1]).padStart(2, "0");
      const month = String(brDateMatch[2]).padStart(2, "0");
      const year = brDateMatch[3];
      return `${year}-${month}-${day}`;
    }

    if (/^\d+(?:[.,]\d+)?$/.test(trimmed)) {
      const serial = Number(trimmed.replace(",", "."));
      if (serial >= 20000 && serial <= 80000) {
        return parseExcelSerial(serial);
      }
    }

    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      return trimmed.split("T")[0];
    }
  }

  return null;
};

export const importXls = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { number, name, email, birthDate, validateContact, tags } = req.body;
  const normalizedBirthDate = normalizeBirthDateInput(birthDate);
  const simpleNumber = String(number).replace(/[^\d.-]+/g, "");
  let validNumber = simpleNumber;

  if (validateContact === "true") {
    validNumber = await CheckContactNumber(simpleNumber, companyId);
  }
  /**
   * Código desabilitado por demora no retorno
   */
  //
  // const profilePicUrl = await GetProfilePicUrl(validNumber, companyId);
  // const defaultWhatsapp = await GetDefaultWhatsApp(companyId);

  const contactData = {
    name: name, // <--- aqui estava "name: ${name}" sem crase
    number: validNumber,
    profilePicUrl: "",
    isGroup: false,
    email,
    birthDate: normalizedBirthDate,
    companyId
    // whatsappId: defaultWhatsapp.id
  };

  const contact = await CreateOrUpdateContactServiceForImport(contactData);

  if (tags) {
    const tagList = tags.split(",").map(tag => tag.trim());

    for (const tagName of tagList) {
      try {
        let [tag, created] = await Tag.findOrCreate({
          where: { name: tagName, companyId, color: "#A4CCCC", kanban: 0 }
        });

        await ContactTag.findOrCreate({
          where: {
            contactId: contact.id,
            tagId: tag.id
          }
        });
      } catch (error) {
        logger.info("Erro ao criar Tags", error);
      }
    }
  }
  const io = getIO();

  io.of(String(companyId)).emit(`company-${companyId}-contact`, {
    action: "create",
    contact
  });

  return res.status(200).json(contact);
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const {
    searchParam,
    pageNumber,
    contactTag: tagIdsStringified,
    isGroup
  } = req.query as IndexQuery;
  const { id: userId, companyId, profile } = req.user;

  console.log("index", { companyId, userId, searchParam, profile });

  let tagsIds: number[] = [];

  if (tagIdsStringified) {
    tagsIds = JSON.parse(tagIdsStringified);
  }

  const { contacts, count, hasMore } = await ListContactsService({
    searchParam,
    pageNumber,
    companyId,
    tagsIds,
    isGroup,
    userId: Number(userId),
    profile,
    canViewAllContacts: !!(req as any).user?.canViewAllContacts
  });

  return res.json({ contacts, count, hasMore });
};

export const getContact = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { name, number } = req.body as IndexGetContactQuery;
  const { companyId } = req.user;

  console.log("getContact", { companyId, name, number });

  const contact = await GetContactService({
    name,
    number,
    companyId
  });

  return res.status(200).json(contact);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const newContact: ContactData = req.body;

  console.log("store", { companyId, newContact });

  const findContact = await Contact.findOne({
    where: {
      number: newContact.number.replace("-", "").replace(" ", ""),
      companyId
    }
  });
  if (findContact) {
    throw new AppError("Contact already exists");
  }

  newContact.number = newContact.number.replace("-", "").replace(" ", "");

  const schema = Yup.object().shape({
    name: Yup.string().required(),
    number: Yup.string()
      .required()
      .matches(/^\d+$/, "Invalid number format. Only numbers is allowed."),
    birthDate: Yup.date()
      .transform((value, originalValue) => (originalValue === "" ? null : value))
      .nullable()
      .notRequired()
      .max(new Date(), "Data de nascimento não pode ser no futuro")
  });

  try {
    await schema.validate(newContact);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const parsedWhatsappId =
    newContact.whatsappId !== undefined &&
    newContact.whatsappId !== null &&
    String(newContact.whatsappId) !== ""
      ? Number(newContact.whatsappId)
      : undefined;

  const validNumber = await CheckContactNumber(
    newContact.number,
    companyId,
    false,
    parsedWhatsappId
  );

  const contact = await CreateContactService({
    ...newContact,
    number: validNumber,
    companyId
  });

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-contact`, {
    action: "create",
    contact
  });

  return res.status(200).json(contact);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;

  const contact = await ShowContactService(contactId, companyId);

  return res.status(200).json(contact);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const contactData: ContactData = req.body;
  const { companyId } = req.user;
  const { contactId } = req.params;

  const existingContact = await ShowContactService(contactId, companyId);

  // Contatos originados de peers não-telefone (LID/username da Meta) já têm
  // lid/jid preenchido; nesses casos não forçamos o formato numérico do "number".
  const isNonPhoneContact = Boolean(existingContact?.lid || existingContact?.jid);

  if (typeof contactData.number === "string" && !isNonPhoneContact) {
    contactData.number = contactData.number.replace(/\D/g, "");
  }

  const schema = Yup.object().shape({
    name: Yup.string(),
    number: isNonPhoneContact
      ? Yup.string()
      : Yup.string().matches(
          /^\d+$/,
          "Invalid number format. Only numbers is allowed."
        ),
    birthDate: Yup.date()
      .transform((value, originalValue) => (originalValue === "" ? null : value))
      .nullable()
      .notRequired()
      .max(new Date(), "Data de nascimento não pode ser no futuro")
  });

  try {
    await schema.validate(contactData);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const contact = await UpdateContactService({
    contactData,
    contactId,
    companyId
  });

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-contact`, {
    action: "update",
    contact
  });

  return res.status(200).json(contact);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;

  await ShowContactService(contactId, companyId);

  await DeleteContactService(contactId);

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-contact`, {
    action: "delete",
    contactId
  });

  return res.status(200).json({ message: "Contact deleted" });
};

// NOVA FUNÇÃO: DELETAR MÚLTIPLOS CONTATOS
export const bulkRemove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactIds } = req.body as { contactIds: number[] };
  const { companyId } = req.user;

  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    throw new AppError(
      "Nenhum ID de contato fornecido para exclusão em massa.",
      400
    );
  }

  try {
    await BulkDeleteContactsService(contactIds, companyId);

    const io = getIO();

    contactIds.forEach(id => {
      io.of(String(companyId)).emit(`company-${companyId}-contact`, {
        action: "delete",
        contactId: id
      });
    });

    return res
      .status(200)
      .json({ message: `${contactIds.length} contatos deletados com sucesso.` });
  } catch (error: any) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Erro inesperado no controller bulkRemove:", error);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
};

export const bulkUpdateTags = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactIds, tagIds, action } = req.body as {
    contactIds: number[];
    tagIds: number[];
    action?: "replace" | "add" | "remove";
  };
  const { companyId } = req.user;

  const safeTagIds = Array.isArray(tagIds) ? tagIds : [];
  const safeAction = action || "replace";
  const updatedContactIds = await BulkUpdateContactTagsService(
    contactIds,
    safeTagIds,
    companyId,
    safeAction
  );

  const io = getIO();
  for (const id of updatedContactIds) {
    const contact = await ShowContactService(String(id), companyId);
    io.of(String(companyId)).emit(`company-${companyId}-contact`, {
      action: "update",
      contact
    });
  }

  return res.status(200).json({
    message: `${updatedContactIds.length} contatos atualizados com sucesso.`,
    updatedContacts: updatedContactIds.length
  });
};

export const list = async (req: Request, res: Response): Promise<Response> => {
  const { name } = req.query as unknown as SearchContactParams;
  const { companyId } = req.user;

  const contacts = await SimpleListService({ name, companyId });

  return res.json(contacts);
};

export const toggleAcceptAudio = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;
  const contact = await ToggleAcceptAudioContactService({ contactId });

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-contact`, {
    action: "update",
    contact
  });

  return res.status(200).json(contact);
};

export const blockUnblock = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;
  const { active } = req.body;

  if (!companyId) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 403);
  }

  console.log("blockUnblock", { contactId, companyId, active });

  const contact = await BlockUnblockContactService({
    contactId,
    companyId,
    active
  });

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-contact`, {
    action: "update",
    contact
  });

  return res.status(200).json(contact);
};

export const upload = async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  const file: Express.Multer.File = head(files) as Express.Multer.File;
  const { companyId } = req.user;

  const response = await ImportContactsService(companyId, file);

  const io = getIO();

  io.of(String(companyId)).emit(`company-${companyId}-contact`, {
    action: "reload",
    records: response
  });

  return res.status(200).json(response);
};

export const getContactProfileURL = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { number } = req.params;
  const { companyId } = req.user;

  console.log("getContactProfileURL", { number, companyId });
  if (number) {
    const validNumber = await CheckContactNumber(number, companyId);

    const profilePicUrl = await GetProfilePicUrl(validNumber, companyId);

    const contact = await NumberSimpleListService({
      number: validNumber,
      companyId: companyId
    });

    let obj: any;
    if (contact.length > 0) {
      obj = {
        contactId: contact[0].id,
        profilePicUrl: profilePicUrl
      };
    } else {
      obj = {
        contactId: 0,
        profilePicUrl: profilePicUrl
      };
    }

    return res.status(200).json(obj);
  }

  return res.status(400).json({ error: "Número inválido" });
};

export const getContactVcard = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { name, number } = req.query as IndexGetContactQuery;
  const { companyId } = req.user;

  let vNumber: string = number;

  const numberDDI = vNumber.toString().substr(0, 2);
  const numberDDD = vNumber.toString().substr(2, 2);
  const numberUser = vNumber.toString().substr(-8, 8);

  if (numberDDD <= "30" && numberDDI === "55") {
    console.log("menor 30");
    vNumber = `${numberDDI}${numberDDD}9${numberUser}@s.whatsapp.net`;
  } else if (numberDDD > "30" && numberDDI === "55") {
    console.log("maior 30");
    vNumber = `${numberDDI}${numberDDD}${numberUser}@s.whatsapp.net`;
  } else {
    vNumber = `${number}@s.whatsapp.net`;
  }

  const contact = await GetContactService({
    name,
    number,
    companyId
  });

  return res.status(200).json(contact);
};

export const getContactTags = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;

  const contactTags = await FindContactTags({ contactId });

  let tags = false;

  if (contactTags.length > 0) {
    tags = true;
  }

  return res.status(200).json({ tags });
};

export const toggleDisableBot = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;
  const contact = await ToggleDisableBotContactService({ contactId });

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-contact`, {
    action: "update",
    contact
  });

  return res.status(200).json(contact);
};

export const updateContactWallet = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { wallets } = req.body;
  const { contactId } = req.params;
  const { companyId } = req.user;

  const contact = await UpdateContactWalletsService({
    wallets,
    contactId,
    companyId
  });

  return res.status(200).json(contact);
};

export const listWhatsapp = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { name } = req.query as unknown as SearchContactParams;
  const { companyId } = req.user;

  const contactsAll = await SimpleListService({ name, companyId });

  const contacts = contactsAll.filter(
    contact => contact.channel === "whatsapp"
  );

  return res.json(contacts);
};
