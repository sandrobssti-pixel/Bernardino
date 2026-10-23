import PromptBlockedNumber from "../../models/PromptBlockedNumber";

// Usado no gatilho da IA (wbotMessageListener.ts) antes de chamar
// handleOpenAi — número sem dígitos extras (@s.whatsapp.net, :0 etc.) pra
// bater com o mesmo formato salvo em PromptBlockedNumber.number.
const IsNumberBlockedService = async (
  companyId: number,
  rawNumber: string
): Promise<boolean> => {
  const normalizedNumber = String(rawNumber || "").replace(/\D/g, "");
  if (!normalizedNumber) return false;

  const blocked = await PromptBlockedNumber.findOne({
    where: { companyId, number: normalizedNumber }
  });

  return !!blocked;
};

export default IsNumberBlockedService;
