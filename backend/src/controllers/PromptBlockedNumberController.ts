import { Request, Response } from "express";

import ListService from "../services/PromptBlockedNumberServices/ListService";
import CreateService from "../services/PromptBlockedNumberServices/CreateService";
import DeleteService from "../services/PromptBlockedNumberServices/DeleteService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const numbers = await ListService({ companyId });

  return res.status(200).json(numbers);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { number, label } = req.body;
  const { companyId } = req.user;

  const blockedNumber = await CreateService({ companyId, number, label });

  return res.status(200).json(blockedNumber);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { blockedNumberId } = req.params;
  const { companyId } = req.user;

  await DeleteService(blockedNumberId, companyId);

  return res.status(200).json({ message: "Blocked number deleted" });
};
