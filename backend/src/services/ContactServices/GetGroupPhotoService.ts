import AppError from "../../errors/AppError";
import GetProfilePicUrl from "../WbotServices/GetProfilePicUrl";
import Contact from "../../models/Contact";

interface Request {
  contactId: string;
  companyId: string | number;
}

interface Response {
  url: string;
}

const GetGroupPhotoService = async ({
  contactId,
  companyId
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

  const url = await GetProfilePicUrl(
    contact.number,
    Number(companyId),
    contact,
    true
  );

  return { url };
};

export default GetGroupPhotoService;
