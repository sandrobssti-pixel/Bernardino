import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureFiscalAccess from "../services/FiscalService/EnsureFiscalAccess";
import * as FiscalConfigService from "../services/FiscalService/FiscalConfigService";

// Fiscal é um add-on separado do Financeiro (Plan.useFiscal), sempre
// exigindo o Financeiro também ativo — ver EnsureFiscalAccess.
const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureFiscalAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_FISCAL_MODULE_ACCESS", 403);
  }
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const config = await FiscalConfigService.show(companyId);
  return res.status(200).json(config);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const config = await FiscalConfigService.update(req.body, companyId);
  return res.status(200).json(config);
};
