import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsurePaymentAccess from "../services/FinanceService/EnsurePaymentAccess";
import * as FinancePaymentConfigService from "../services/FinanceService/FinancePaymentConfigService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsurePaymentAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_PAYMENT_MODULE_ACCESS", 403);
  }
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const config = await FinancePaymentConfigService.show(companyId);
  return res.status(200).json(config);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const config = await FinancePaymentConfigService.update(req.body, companyId);
  return res.status(200).json(config);
};
