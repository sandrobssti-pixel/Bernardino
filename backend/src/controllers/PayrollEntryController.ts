import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureHRAccess from "../services/HRService/EnsureHRAccess";
import * as PayrollEntryService from "../services/PayrollService/PayrollEntryService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureHRAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_HR_MODULE_ACCESS", 403);
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { employeeId, competencyMonth, competencyYear, pageNumber } = req.query as {
    employeeId?: string;
    competencyMonth?: string;
    competencyYear?: string;
    pageNumber?: string;
  };

  const result = await PayrollEntryService.list({
    companyId,
    employeeId,
    competencyMonth,
    competencyYear,
    pageNumber
  });
  return res.status(200).json(result);
};

export const calculate = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { employeeId, competencyMonth, competencyYear } = req.body;

  const record = await PayrollEntryService.calculateAndSave({
    companyId,
    employeeId,
    competencyMonth: Number(competencyMonth),
    competencyYear: Number(competencyYear)
  });
  return res.status(200).json(record);
};

export const calculateAll = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { competencyMonth, competencyYear } = req.body;

  const result = await PayrollEntryService.calculateAndSaveAll({
    companyId,
    competencyMonth: Number(competencyMonth),
    competencyYear: Number(competencyYear)
  });
  return res.status(200).json(result);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  await PayrollEntryService.remove(id, companyId);
  return res.status(200).json({ message: "Payroll entry deleted" });
};
