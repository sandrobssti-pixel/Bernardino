import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";

interface ExtraInfo {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  isGroup: boolean;
  email?: string;
  birthDate?: Date | string | null;
  commandBot?: string;
  profilePicUrl?: string;
  extraInfo?: ExtraInfo[];
  companyId: number;
}

const normalizeBirthDate = (value?: Date | string | null): string | null | undefined => {
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

    return null;
  }
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const CreateOrUpdateContactServiceForImport = async ({
  name,
  number: rawNumber,
  profilePicUrl,
  isGroup,
  email = "",
  birthDate,
  commandBot = "",
  extraInfo = [], companyId
}: Request): Promise<Contact> => {
  const number = isGroup ? rawNumber : rawNumber.replace(/[^0-9]/g, "");
  const parsedBirthDate = normalizeBirthDate(birthDate);

  const io = getIO();
  let contact: Contact | null;

  contact = await Contact.findOne({ where: { number , companyId } });

  if (contact) {
    if (contact.companyId === null) {
      await contact.update({
        name,
        profilePicUrl,
        companyId,
        email,
        ...(parsedBirthDate !== undefined ? { birthDate: parsedBirthDate } : {})
      });
    } else {
      await contact.update({
        name,
        profilePicUrl,
        email,
        ...(parsedBirthDate !== undefined ? { birthDate: parsedBirthDate } : {})
      });
    }

      io.of(String(companyId))
  .emit(`company-${companyId}-contact`, {
      action: "update",
      contact
    });
  } else {
    contact = await Contact.create({
      name,
      companyId,
      number,
      profilePicUrl,
      email,
      birthDate: parsedBirthDate ?? null,
      commandBot,
      isGroup,
      extraInfo
    });

    io.of(String(companyId))
  .emit(`company-${companyId}-contact`, {
      action: "create",
      contact
    });
  }

  return contact;
};

export default CreateOrUpdateContactServiceForImport;
