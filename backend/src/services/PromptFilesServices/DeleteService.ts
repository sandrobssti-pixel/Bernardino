import fs from "fs";
import path from "path";

import PromptFiles from "../../models/PromptFiles";
import AppError from "../../errors/AppError";

const DeleteService = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const promptFile = await PromptFiles.findOne({
    where: { id, companyId }
  });

  if (!promptFile) {
    throw new AppError("ERR_NO_PROMPT_FILE_FOUND", 404);
  }

  const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
  const filePath = path.resolve(
    publicFolder,
    `company${companyId}`,
    "promptFiles",
    promptFile.path
  );

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error("Erro ao remover arquivo físico do PromptFiles:", err);
  }

  await promptFile.destroy();
};

export default DeleteService;
