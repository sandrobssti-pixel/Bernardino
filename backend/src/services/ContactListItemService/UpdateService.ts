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
  id: number | string;
  name: string;
  number: string;
  email?: string;
}

const isValidationInfraUnavailable = (error: any): boolean => {
  const message = String(error?.message || "");
  return (
    message.includes("ERR_NO_DEF_WAPP_FOUND") ||
    message.includes("ERR_WAPP_CHECK_CONTACT")
  );
};

const UpdateService = async (data: Data): Promise<ContactListItem> => {
  const { id, name, number, email } = data;
  const normalizedNumber = normalizeCampaignContactNumber(number);

  const record = await ContactListItem.findByPk(id);

  if (!record) {
    throw new AppError("ERR_NO_CONTACTLISTITEM_FOUND", 404);
  }

  if (!isCampaignContactNumberFormatValid(normalizedNumber)) {
    throw new AppError(
      "Número inválido. Use o formato: código do país + DDD + número (8 ou 9 dígitos). Ex.: 5511999999999",
      400
    );
  }

  await record.update({
    name,
    number: normalizedNumber,
    email
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
      `[ContactListItem/Update] Sem WhatsApp conectado para empresa ${record.companyId}. Validação do número será feita por fallback de formato.`
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
        `[ContactListItem/Update] Falha temporária na validação do WhatsApp para ${record.number}. Registro mantido como válido por fallback.`
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

export default UpdateService;
