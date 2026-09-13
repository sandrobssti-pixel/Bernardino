import * as Yup from "yup";
import AppError from "../../errors/AppError";
import ContactListItem from "../../models/ContactListItem";
import logger from "../../utils/logger";
import CheckContactNumber from "../WbotServices/CheckNumber";
import Whatsapp from "../../models/Whatsapp";
import {
  isCampaignContactNumberFormatValid,
  normalizeCampaignContactNumber
} from "../../utils/normalizeCampaignContactNumber";

interface Data {
  name: string;
  number: string;
  contactListId: number;
  companyId: number;
  email?: string;
}

const isValidationInfraUnavailable = (error: any): boolean => {
  const message = String(error?.message || "");
  return (
    message.includes("ERR_NO_DEF_WAPP_FOUND") ||
    message.includes("ERR_WAPP_CHECK_CONTACT")
  );
};

const CreateService = async (data: Data): Promise<ContactListItem> => {
  const { name } = data;
  const normalizedNumber = normalizeCampaignContactNumber(data.number);

  const contactListItemSchema = Yup.object().shape({
    name: Yup.string()
      .min(3, "ERR_CONTACTLISTITEM_INVALID_NAME")
      .required("ERR_CONTACTLISTITEM_REQUIRED")
  });

  try {
    await contactListItemSchema.validate({ name });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  if (!isCampaignContactNumberFormatValid(normalizedNumber)) {
    throw new AppError(
      "Número inválido. Use o formato: código do país + DDD + número (8 ou 9 dígitos). Ex.: 5511999999999",
      400
    );
  }

  const [record] = await ContactListItem.findOrCreate({
    where: {
      number: normalizedNumber,
      companyId: data.companyId,
      contactListId: data.contactListId
    },
    defaults: {
      ...data,
      number: normalizedNumber
    }
  });

  let canCheckWhatsapp = true;
  const connectedWhatsapp = await Whatsapp.findOne({
    where: {
      companyId: record.companyId,
      status: "CONNECTED"
    }
  });

  if (!connectedWhatsapp) {
    canCheckWhatsapp = false;
    logger.warn(
      `[ContactListItem/Create] Sem WhatsApp conectado para empresa ${record.companyId}. Validação do número será feita por fallback de formato.`
    );
  }

  try {
    if (canCheckWhatsapp) {
      const response = await CheckContactNumber(record.number, record.companyId);
      record.isWhatsappValid = response ? true : false;
      record.number = String(response || "")
        .split("@")[0]
        .replace(/[^\d-]/g, "");
      await record.save();
    } else {
      record.isWhatsappValid = true;
      await record.save();
    }
  } catch (e) {
    if (isValidationInfraUnavailable(e)) {
      record.isWhatsappValid = true;
      await record.save();
      logger.warn(
        `[ContactListItem/Create] Falha temporária na validação do WhatsApp para ${record.number}. Registro mantido como válido por fallback.`
      );
    } else {
      record.isWhatsappValid = false;
      record.number = String(record.number || "")
        .split("@")[0]
        .replace(/[^\d-]/g, "");
      await record.save();
      logger.error(`Número de contato inválido: ${record.number}`);
    }
  }

  return record;
};

export default CreateService;
