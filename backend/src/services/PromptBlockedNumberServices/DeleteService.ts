import AppError from "../../errors/AppError";
import PromptBlockedNumber from "../../models/PromptBlockedNumber";

const DeleteService = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const blockedNumber = await PromptBlockedNumber.findOne({
    where: { id, companyId }
  });

  if (!blockedNumber) {
    throw new AppError("ERR_NO_BLOCKED_NUMBER_FOUND", 404);
  }

  await blockedNumber.destroy();
};

export default DeleteService;
