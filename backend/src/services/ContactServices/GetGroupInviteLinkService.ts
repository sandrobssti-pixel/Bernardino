import AppError from "../../errors/AppError";
import { getWbot } from "../../libs/wbot";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import { isGroupAdminRequiredError } from "../../helpers/CheckGroupAdmin";
import logger from "../../utils/logger";

interface Request {
  contactId: string;
  companyId: string | number;
  revoke?: boolean;
}

interface Response {
  inviteLink: string;
}

const buildInviteLink = (codeOrUrl: string): string => {
  const value = String(codeOrUrl || "").trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  return `https://chat.whatsapp.com/${value}`;
};

const GetGroupInviteLinkService = async ({
  contactId,
  companyId,
  revoke
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
    const codeOrUrl = revoke
      ? await (wbot as any).groupRevokeInvite(jid)
      : await (wbot as any).groupInviteCode(jid);

    return { inviteLink: buildInviteLink(codeOrUrl) };
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.warn(
      {
        jid,
        revoke: Boolean(revoke),
        message: error?.message,
        statusCode: error?.output?.statusCode,
        data: error?.data
      },
      "[GetGroupInviteLinkService] erro ao obter link de convite"
    );
    if (isGroupAdminRequiredError(error)) {
      throw new AppError("ERR_GROUP_ADMIN_REQUIRED", 403);
    }
    throw new AppError("ERR_WAPP_GROUP_UPDATE_FAILED", 500);
  }
};

export default GetGroupInviteLinkService;
