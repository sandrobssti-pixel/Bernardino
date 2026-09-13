import AppError from "../../errors/AppError";
import { getWbot } from "../../libs/wbot";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import { isGroupAdminRequiredError } from "../../helpers/CheckGroupAdmin";
import logger from "../../utils/logger";

type GroupAction = "add" | "remove" | "promote" | "demote";

const VALID_ACTIONS: GroupAction[] = ["add", "remove", "promote", "demote"];

interface Request {
  contactId: string;
  companyId: string | number;
  participants: string[];
  action: GroupAction;
}

const UpdateGroupParticipantsService = async ({
  contactId,
  companyId,
  participants,
  action
}: Request): Promise<Contact> => {
  if (!companyId) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 400);
  }

  if (!VALID_ACTIONS.includes(action)) {
    throw new AppError("ERR_INVALID_GROUP_ACTION", 400);
  }

  if (!Array.isArray(participants) || participants.length === 0) {
    throw new AppError("ERR_INVALID_GROUP_ACTION", 400);
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

  const normalizedParticipants = participants.map(p =>
    String(p || "").replace(/\D/g, "")
  );

  try {
    await (wbot as any).groupParticipantsUpdate(
      jid,
      normalizedParticipants,
      action
    );
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.warn(
      {
        jid,
        action,
        message: error?.message,
        statusCode: error?.output?.statusCode,
        data: error?.data
      },
      "[UpdateGroupParticipantsService] erro ao atualizar participantes"
    );
    if (isGroupAdminRequiredError(error)) {
      throw new AppError("ERR_GROUP_ADMIN_REQUIRED", 403);
    }
    throw new AppError("ERR_WAPP_GROUP_UPDATE_FAILED", 500);
  }

  return contact;
};

export default UpdateGroupParticipantsService;
