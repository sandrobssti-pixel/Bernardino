import * as Yup from "yup";

import AppError from "../../errors/AppError";
import PromptFiles from "../../models/PromptFiles";

interface Request {
  companyId: number;
  name: string;
  description: string;
  path: string;
  mediaType: string;
  // "Resposta" (v2.3.237) — texto enviado JUNTO com o arquivo (legenda),
  // igual ao comportamento de Mensagem Rápida com anexo. Opcional.
  textContent?: string;
}

const CreateService = async ({
  companyId,
  name,
  description,
  path,
  mediaType,
  textContent
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
    mediaType,
    textContent:
      typeof textContent === "string" && textContent.trim()
        ? textContent.trim()
        : null
  });

  return promptFile;
};

export default CreateService;
