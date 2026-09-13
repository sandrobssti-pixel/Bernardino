import { Request, Response } from "express";

import CreateService from "../services/PromptFilesServices/CreateService";
import ListService from "../services/PromptFilesServices/ListService";
import DeleteService from "../services/PromptFilesServices/DeleteService";
import AppError from "../errors/AppError";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const files = await ListService({ companyId });

  return res.status(200).json(files);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name, description } = req.body;
  const { companyId } = req.user;

  const uploadedFile = req.file as Express.Multer.File;

  if (!uploadedFile) {
    throw new AppError("ERR_NO_FILE_UPLOADED", 400);
  }

  const promptFile = await CreateService({
    companyId,
    name,
    description,
    path: uploadedFile.filename.replace("/", "-"),
    mediaType: uploadedFile.mimetype
  });

  return res.status(200).json(promptFile);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { promptFileId } = req.params;
  const { companyId } = req.user;

  await DeleteService(promptFileId, companyId);

  return res.status(200).json({ message: "Prompt file deleted" });
};
