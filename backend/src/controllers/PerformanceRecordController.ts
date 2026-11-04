import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureHRAccess from "../services/HRService/EnsureHRAccess";
import * as PerformanceRecordService from "../services/HRService/PerformanceRecordService";

// Base gate: RH é a porta de entrada (mesma trava de todo o resto do
// módulo). A trava PESSOAL de cada funcionário (Admin/Master ou
// `managerId`) é aplicada dentro de PerformanceRecordService — ver
// PerformanceAccessService.ts.
const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureHRAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_HR_MODULE_ACCESS", 403);
  }
};

export const indexEmployees = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const records = await PerformanceRecordService.listManageableEmployees(req.user as any, companyId);
  return res.status(200).json(records);
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { employeeId, recordType, pageNumber } = req.query as {
    employeeId?: string;
    recordType?: string;
    pageNumber?: string;
  };

  const result = await PerformanceRecordService.list(req.user as any, { companyId, employeeId, recordType, pageNumber });
  return res.status(200).json(result);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const record = await PerformanceRecordService.create(req.user as any, companyId, req.body);
  return res.status(200).json(record);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await PerformanceRecordService.update(req.user as any, id, companyId, req.body);
  return res.status(200).json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  await PerformanceRecordService.remove(req.user as any, id, companyId);
  return res.status(200).json({ message: "Performance record deleted" });
};
