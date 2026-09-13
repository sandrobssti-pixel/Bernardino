import * as Yup from "yup";

import AppError from "../../errors/AppError";
import PromptFiles from "../../models/PromptFiles";

interface Request {
  companyId: number;
  name: string;
  description: string;
  path: string;
  mediaType: string;
}

const CreateService = async ({
  companyId,
  name,
  description,
  path,
  mediaType
}: Request): Promise<PromptFiles> => {
  const schema = Yup.object().shape({
    name: Yup.string().required().min(3),
    description: Yup.string().required().min(3)
  });

  try {
    await schema.validate({ name, description });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const promptFile = await PromptFiles.create({
    companyId,
    name,
    description,
    path,
    mediaType
  });

  return promptFile;
};

export default CreateService;
