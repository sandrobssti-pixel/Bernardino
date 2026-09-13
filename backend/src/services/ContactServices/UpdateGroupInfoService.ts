import AppError from "../../errors/AppError";
import { getWbot } from "../../libs/wbot";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import { isGroupAdminRequiredError } from "../../helpers/CheckGroupAdmin";
import logger from "../../utils/logger";

interface Request {
  contactId: string;
  companyId: string | number;
  subject?: string;
  description?: string;
}

const UpdateGroupInfoService = async ({
  contactId,
  companyId,
  subject,
  description
}: Request): Promise<Contact> => {
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
    if (typeof subject === "string" && subject.trim()) {
      await (wbot as any).groupUpdateSubject(jid, subject.trim());
    }

    if (typeof description === "string") {
      await (wbot as any).groupUpdateDescription(jid, description);
    }
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.warn(
      {
        jid,
        message: error?.message,
        statusCode: error?.output?.statusCode,
        data: error?.data
      },
      "[UpdateGroupInfoService] erro ao atualizar grupo"
    );
    if (isGroupAdminRequiredError(error)) {
      throw new AppError("ERR_GROUP_ADMIN_REQUIRED", 403);
    }
    throw new AppError("ERR_WAPP_GROUP_UPDATE_FAILED", 500);
  }

  if (typeof subject === "string" && subject.trim()) {
    await contact.update({ name: subject.trim() });
    await contact.reload();
  }

  return contact;
};

export default UpdateGroupInfoService;
