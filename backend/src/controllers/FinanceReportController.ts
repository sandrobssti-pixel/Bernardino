import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureFinancialAccess from "../services/FinanceService/EnsureFinancialAccess";
import * as FinanceReportService from "../services/FinanceService/FinanceReportService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureFinancialAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_FINANCIAL_MODULE_ACCESS", 403);
  }
};

export const summary = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const result = await FinanceReportService.getSummary(companyId);
  return res.status(200).json(result);
};

export const cashFlow = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const months = Number.parseInt(String(req.query.months || "6"), 10) || 6;

  const result = await FinanceReportService.getCashFlow(companyId, months);
  return res.status(200).json(result);
};

export const expensesByCategory = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const result = await FinanceReportService.getExpensesByCategory(companyId);
  return res.status(200).json(result);
};
