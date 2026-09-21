import ContactListItem from "../../models/ContactListItem";
import CheckContactNumber from "../WbotServices/CheckNumber";
import logger from "../../utils/logger";

interface Request {
  contactListId: number;
  companyId: number;
}

interface Response {
  total: number;
  corrected: number;
  unchanged: number;
  invalid: number;
}

const isValidationInfraUnavailable = (error: any): boolean => {
  const message = String(error?.message || "");
  return (
    message.includes("ERR_NO_DEF_WAPP_FOUND") ||
    message.includes("ERR_WAPP_CHECK_CONTACT")
  );
};

// Reprocessa a checagem de WhatsApp de todos os itens de uma lista já
// importada — sem precisar reimportar a planilha do zero. Criado depois de
// um bug real (ver CheckNumber.ts) em que números brasileiros de celular
// sem o 9º dígito (12 dígitos) foram aceitos como válidos numa importação
// anterior ao fix; essa ação corrige os que já estão salvos, chamando de
// novo o WhatsApp com a ordem de candidatos já corrigida (ver
// docs/MANUAL_TECNICO.md).
const RevalidateNumbersService = async ({
  contactListId,
  companyId
}: Request): Promise<Response> => {
  const items = await ContactListItem.findAll({
    where: { contactListId, companyId, isGroup: false }
  });

  let corrected = 0;
  let unchanged = 0;
  let invalid = 0;

  for (const item of items) {
    const previousNumber = item.number;
    try {
      const response = await CheckContactNumber(item.number, companyId);
      const nextNumber = String(response || "")
        .split("@")[0]
        .replace(/[^\d-]/g, "");

      item.isWhatsappValid = true;
      item.number = nextNumber;
      await item.save();

      if (nextNumber !== previousNumber) {
        corrected += 1;
        logger.info(
          `[RevalidateNumbers] contactListItem=${item.id} corrigido: ${previousNumber} -> ${nextNumber}`
        );
      } else {
        unchanged += 1;
      }
    } catch (error: any) {
      if (isValidationInfraUnavailable(error)) {
        // Sem conexão WhatsApp disponível pra checar agora — mantém como
        // estava, não marca como inválido por causa de uma falha temporária.
        unchanged += 1;
        continue;
      }
      item.isWhatsappValid = false;
      await item.save();
      invalid += 1;
    }
  }

  return {
    total: items.length,
    corrected,
    unchanged,
    invalid
  };
};

export default RevalidateNumbersService;
