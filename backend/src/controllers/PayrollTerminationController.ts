import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureHRAccess from "../services/HRService/EnsureHRAccess";
import * as PayrollTerminationService from "../services/PayrollService/PayrollTerminationService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureHRAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_HR_MODULE_ACCESS", 403);
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const records = await PayrollTerminationService.list(companyId);
  return res.status(200).json(records);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { employeeId } = req.params;

  const record = await PayrollTerminationService.show({ companyId, employeeId });
  return res.status(200).json(record);
};

export const calculate = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { employeeId, terminationType, terminationDate, noticeWorked, fgtsBalanceOverride } = req.body;

  const record = await PayrollTerminationService.calculateAndSave({
    companyId,
    employeeId,
    terminationType,
    terminationDate,
    noticeWorked,
    fgtsBalanceOverride
  });
  return res.status(200).json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  await PayrollTerminationService.remove(id, companyId);
  return res.status(200).json({ message: "Payroll termination deleted" });
};
