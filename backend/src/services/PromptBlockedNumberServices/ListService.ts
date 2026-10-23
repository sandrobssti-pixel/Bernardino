import PromptBlockedNumber from "../../models/PromptBlockedNumber";

interface Request {
  companyId: number;
}

const ListService = async ({ companyId }: Request): Promise<PromptBlockedNumber[]> => {
  const numbers = await PromptBlockedNumber.findAll({
    where: { companyId },
    order: [["createdAt", "DESC"]]
  });

  return numbers;
};

export default ListService;
