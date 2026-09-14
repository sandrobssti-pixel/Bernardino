import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureFinancialAccess from "../services/FinanceService/EnsureFinancialAccess";
import * as FinanceReceivableService from "../services/FinanceService/FinanceReceivableService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureFinancialAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_FINANCIAL_MODULE_ACCESS", 403);
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { searchParam, pageNumber, status } = req.query as {
    searchParam?: string;
    pageNumber?: string;
    status?: string;
  };

  const result = await FinanceReceivableService.list({
    companyId,
    searchParam,
    pageNumber,
    status
  });

  return res.status(200).json(result);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await FinanceReceivableService.show(id, companyId);
  return res.status(200).json(record);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const record = await FinanceReceivableService.create(req.body, companyId);
  return res.status(200).json(record);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await FinanceReceivableService.update(id, req.body, companyId);
  return res.status(200).json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  await FinanceReceivableService.remove(id, companyId);
  return res.status(200).json({ message: "FinanceReceivable deleted" });
};
