import PromptFiles from "../../models/PromptFiles";

interface Request {
  companyId: number;
}

const ListService = async ({
  companyId
}: Request): Promise<PromptFiles[]> => {
  const files = await PromptFiles.findAll({
    where: { companyId },
    order: [["name", "ASC"]]
  });

  return files;
};

export default ListService;
