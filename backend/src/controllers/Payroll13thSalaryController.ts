import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureHRAccess from "../services/HRService/EnsureHRAccess";
import * as Payroll13thSalaryService from "../services/PayrollService/Payroll13thSalaryService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureHRAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_HR_MODULE_ACCESS", 403);
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { employeeId, year, pageNumber } = req.query as {
    employeeId?: string;
    year?: string;
    pageNumber?: string;
  };

  const result = await Payroll13thSalaryService.list({ companyId, employeeId, year, pageNumber });
  return res.status(200).json(result);
};

export const calculate = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { employeeId, year } = req.body;

  const record = await Payroll13thSalaryService.calculateAndSave({
    companyId,
    employeeId,
    year: Number(year)
  });
  return res.status(200).json(record);
};

export const calculateAll = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { year } = req.body;

  const result = await Payroll13thSalaryService.calculateAndSaveAll({
    companyId,
    year: Number(year)
  });
  return res.status(200).json(result);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  await Payroll13thSalaryService.remove(id, companyId);
  return res.status(200).json({ message: "Payroll 13th salary deleted" });
};
