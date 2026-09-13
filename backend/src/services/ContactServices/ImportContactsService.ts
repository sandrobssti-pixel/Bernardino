import { head } from "lodash";
import XLSX from "xlsx";
import { has } from "lodash";
import ContactListItem from "../../models/ContactListItem";
import CheckContactNumber from "../WbotServices/CheckNumber";
import logger from "../../utils/logger";
import Contact from "../../models/Contact";
// import CheckContactNumber from "../WbotServices/CheckNumber";

export async function ImportContactsService(
  companyId: number,
  file: Express.Multer.File | undefined
) {
  const normalizeBirthDate = (value: unknown): string | null => {
    if (value === null || value === undefined || value === "") return null;

    const parseExcelSerial = (serial: number): string | null => {
      if (Number.isNaN(serial)) return null;
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      excelEpoch.setUTCDate(excelEpoch.getUTCDate() + Math.floor(serial));
      const year = excelEpoch.getUTCFullYear();
      const month = String(excelEpoch.getUTCMonth() + 1).padStart(2, "0");
      const day = String(excelEpoch.getUTCDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    if (typeof value === "number") return parseExcelSerial(value);

    const stringValue = String(value).trim();
    if (!stringValue) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) return stringValue;

    const brDateMatch = stringValue.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (brDateMatch) {
      const day = String(brDateMatch[1]).padStart(2, "0");
      const month = String(brDateMatch[2]).padStart(2, "0");
      const year = brDateMatch[3];
      return `${year}-${month}-${day}`;
    }

    if (/^\d+(?:[.,]\d+)?$/.test(stringValue)) {
      const serial = Number(stringValue.replace(",", "."));
      if (!Number.isNaN(serial) && serial >= 20000 && serial <= 80000) {
        return parseExcelSerial(serial);
      }
    }

    if (/^\d{4}-\d{2}-\d{2}T/.test(stringValue)) return stringValue.split("T")[0];

    return null;
  };

  const workbook = XLSX.readFile(file?.path as string);
  const worksheet = head(Object.values(workbook.Sheets)) as any;
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 0 });

  const contacts = rows.map(row => {
    let name = "";
    let number = "";
    let email = "";
    let birthDate: string | null = null;

    if (has(row, "nome") || has(row, "Nome")) {
      name = row["nome"] || row["Nome"];
    }

    if (
      has(row, "numero") ||
      has(row, "número") ||
      has(row, "Numero") ||
      has(row, "Número")
    ) {
      number = row["numero"] || row["número"] || row["Numero"] || row["Número"];
      number = `${number}`.replace(/\D/g, "");
    }

    if (
      has(row, "email") ||
      has(row, "e-mail") ||
      has(row, "Email") ||
      has(row, "E-mail")
    ) {
      email = row["email"] || row["e-mail"] || row["Email"] || row["E-mail"];
    }

    if (
      has(row, "birthDate") ||
      has(row, "birthdate") ||
      has(row, "nascimento") ||
      has(row, "aniversario") ||
      has(row, "aniversário") ||
      has(row, "data_de_nascimento") ||
      has(row, "data de nascimento")
    ) {
      birthDate = normalizeBirthDate(
        row["birthDate"] ??
          row["birthdate"] ??
          row["nascimento"] ??
          row["aniversario"] ??
          row["aniversário"] ??
          row["data_de_nascimento"] ??
          row["data de nascimento"]
      );
    }

    return { name, number, email, birthDate, companyId };
  });


  const contactList: Contact[] = [];

  for (const contact of contacts) {
    const [newContact, created] = await Contact.findOrCreate({
      where: {
        number: `${contact.number}`,
        companyId: contact.companyId
      },
      defaults: contact
    });
    if (created) {
      contactList.push(newContact);
    }
  }

  // Verifica se existe os contatos
  // if (contactList) {
  //   for (let newContact of contactList) {
  //     try {
  //       const response = await CheckContactNumber(newContact.number, companyId);
  //       const number = response;
  //       newContact.number = number;
  //       console.log('number', number)
  //       await newContact.save();
  //     } catch (e) {
  //       logger.error(`Número de contato inválido: ${newContact.number}`);
  //     }
  //   }
  // }

  return contactList;
}
