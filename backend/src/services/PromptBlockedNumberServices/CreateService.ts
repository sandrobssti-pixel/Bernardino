import * as Yup from "yup";

import AppError from "../../errors/AppError";
import PromptBlockedNumber from "../../models/PromptBlockedNumber";

interface Request {
  companyId: number;
  number: string;
  label?: string;
}

const CreateService = async ({
  companyId,
  number,
  label
}: Request): Promise<PromptBlockedNumber> => {
  const normalizedNumber = String(number || "").replace(/\D/g, "");

  const schema = Yup.object().shape({
    number: Yup.string().required().min(8, "Número inválido.")
  });

  try {
    await schema.validate({ number: normalizedNumber });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const existing = await PromptBlockedNumber.findOne({
    where: { companyId, number: normalizedNumber }
  });

  if (existing) {
    throw new AppError("Esse número já está na lista.");
  }

  const blockedNumber = await PromptBlockedNumber.create({
    companyId,
    number: normalizedNumber,
    label: (label || "").trim() || null
  });

  return blockedNumber;
};

export default CreateService;
