import AppError from "../../errors/AppError";
import CompaniesSettings from "../../models/CompaniesSettings";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import logger from "../../utils/logger";
import ContactWallet from "../../models/ContactWallet";

interface ExtraInfo extends ContactCustomField {
  name: string;
  value: string;
}

interface Wallet {
  walletId: number | string;
  contactId: number | string;
  companyId: number | string;
}
interface Request {
  name: string;
  number: string;
  email?: string;
  profilePicUrl?: string;
  acceptAudioMessage?: boolean;
  active?: boolean;
  companyId: number;
  extraInfo?: ExtraInfo[];
  remoteJid?: string;
  wallets?: null | number[] | string[];
  birthDate?: Date | string | null;
}

const normalizeBirthDate = (value?: Date | string | null): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value.split("T")[0];
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const CreateContactService = async ({
  name,
  number,
  email = "",
  acceptAudioMessage,
  active,
  companyId,
  extraInfo = [],
  remoteJid = "",
  wallets,
  birthDate
}: Request): Promise<Contact> => {

  const numberExists = await Contact.findOne({
    where: { number, companyId }
  });
  if (numberExists) {

    throw new AppError("ERR_DUPLICATED_CONTACT");
  }

  const settings = await CompaniesSettings.findOne({
    where: {
      companyId
    }
  })

  const { acceptAudioMessageContact } = settings;

  const parsedBirthDate = normalizeBirthDate(birthDate);

  const contact = await Contact.create(
    {
      name,
      number,
      email,
      acceptAudioMessage: acceptAudioMessageContact === 'enabled' ? true : false,
      active,
      extraInfo,
      companyId,
      remoteJid,
      birthDate: parsedBirthDate
    },
    {
      include: ["extraInfo",
        {
          association: "wallets",
          attributes: ["id", "name"]
        }]
    }
  );

  if (wallets) {
    await ContactWallet.destroy({
      where: {
        companyId,
        contactId: contact.id
      }
    });

    const contactWallets: Wallet[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wallets.forEach((wallet: any) => {
      contactWallets.push({
        walletId: !wallet.id ? wallet : wallet.id,
        contactId: contact.id,
        companyId
      });
    });

    await ContactWallet.bulkCreate(contactWallets);
  }
  return contact;

};

export default CreateContactService;
