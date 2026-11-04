import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureHRAccess from "../services/HRService/EnsureHRAccess";
import * as PayrollVacationService from "../services/PayrollService/PayrollVacationService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureHRAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_HR_MODULE_ACCESS", 403);
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const records = await PayrollVacationService.list(companyId);
  return res.status(200).json(records);
};

export const showByEmployee = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { employeeId } = req.params;

  const result = await PayrollVacationService.showByEmployee({ companyId, employeeId });
  return res.status(200).json(result);
};

export const calculate = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { employeeId, periodNumber, vacationStartDate, daysSold } = req.body;

  const record = await PayrollVacationService.calculateAndSave({
    companyId,
    employeeId,
    periodNumber,
    vacationStartDate,
    daysSold
  });
  return res.status(200).json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  await PayrollVacationService.remove(id, companyId);
  return res.status(200).json({ message: "Payroll vacation deleted" });
};
