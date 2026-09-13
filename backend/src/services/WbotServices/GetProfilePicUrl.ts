import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";
import Contact from "../../models/Contact";

const buildNoPictureUrl = (): string => {
  const frontendUrl = (process.env.FRONTEND_URL || "").trim().replace(/\/+$/, "");
  if (!frontendUrl) return "/nopicture.png";
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(frontendUrl)) {
    return "/nopicture.png";
  }
  return `${frontendUrl}/nopicture.png`;
};

const GetProfilePicUrl = async (
  number: string,
  companyId: number,
  contact?: Contact,
  highRes = false,
): Promise<string> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(companyId);

  const wbot = getWbot(defaultWhatsapp.id);

  let profilePicUrl: string;
  try {
    profilePicUrl = await wbot.profilePictureUrl(
      contact && contact.isGroup ? contact.remoteJid : `${number}@s.whatsapp.net`,
      highRes ? "image" : "preview"
    );
  } catch (error) {
    profilePicUrl = buildNoPictureUrl();
  }

  return profilePicUrl;
};

export default GetProfilePicUrl;
