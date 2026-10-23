import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureFiscalAccess from "../services/FiscalService/EnsureFiscalAccess";
import * as FiscalNumberingService from "../services/FiscalService/FiscalNumberingService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureFiscalAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_FISCAL_MODULE_ACCESS", 403);
  }
};

export const invalidate = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const result = await FiscalNumberingService.invalidate(req.body, companyId);
  return res.status(200).json(result);
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const list = await FiscalNumberingService.list(companyId);
  return res.status(200).json(list);
};
