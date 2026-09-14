import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureFinancialAccess from "../services/FinanceService/EnsureFinancialAccess";
import * as FiscalConfigService from "../services/FiscalService/FiscalConfigService";

// Fiscal reaproveita o mesmo gate de acesso do Financeiro (Plan.useFinancial
// já cobre "cadastros, custos, relatórios, fiscal, contábil, RH" — ver
// comentário no model Plan) em vez de um flag de plano próprio.
const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureFinancialAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_FINANCIAL_MODULE_ACCESS", 403);
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
