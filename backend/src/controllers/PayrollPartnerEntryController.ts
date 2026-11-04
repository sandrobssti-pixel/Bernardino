import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureHRAccess from "../services/HRService/EnsureHRAccess";
import * as PayrollPartnerEntryService from "../services/PayrollService/PayrollPartnerEntryService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureHRAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_HR_MODULE_ACCESS", 403);
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { partnerId, competencyMonth, competencyYear, pageNumber } = req.query as {
    partnerId?: string;
    competencyMonth?: string;
    competencyYear?: string;
    pageNumber?: string;
  };

  const result = await PayrollPartnerEntryService.list({
    companyId,
    partnerId,
    competencyMonth,
    competencyYear,
    pageNumber
  });
  return res.status(200).json(result);
};

export const calculate = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { partnerId, competencyMonth, competencyYear } = req.body;

  const record = await PayrollPartnerEntryService.calculateAndSave({
    companyId,
    partnerId,
    competencyMonth: Number(competencyMonth),
    competencyYear: Number(competencyYear)
  });
  return res.status(200).json(record);
};

export const calculateAll = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { competencyMonth, competencyYear } = req.body;

  const result = await PayrollPartnerEntryService.calculateAndSaveAll({
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

  await PayrollPartnerEntryService.remove(id, companyId);
  return res.status(200).json({ message: "Payroll partner entry deleted" });
};
