import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureHRAccess from "../services/HRService/EnsureHRAccess";
import * as EmployeeDependentService from "../services/EmployeeService/EmployeeDependentService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureHRAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_HR_MODULE_ACCESS", 403);
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { employeeId } = req.params;

  const records = await EmployeeDependentService.list(employeeId, companyId);
  return res.status(200).json(records);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { employeeId } = req.params;

  const record = await EmployeeDependentService.create(employeeId, req.body, companyId);
  return res.status(200).json(record);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { employeeId, id } = req.params;

  const record = await EmployeeDependentService.update(employeeId, id, req.body, companyId);
  return res.status(200).json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { employeeId, id } = req.params;

  await EmployeeDependentService.remove(employeeId, id, companyId);
  return res.status(200).json({ message: "Dependent deleted" });
};
