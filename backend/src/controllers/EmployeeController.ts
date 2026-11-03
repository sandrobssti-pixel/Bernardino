import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureHRAccess from "../services/HRService/EnsureHRAccess";
import * as EmployeeService from "../services/EmployeeService/EmployeeService";
import Employee from "../models/Employee";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureHRAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_HR_MODULE_ACCESS", 403);
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { searchParam, pageNumber, workRegime, contractStatus } = req.query as {
    searchParam?: string;
    pageNumber?: string;
    workRegime?: string;
    contractStatus?: string;
  };

  const result = await EmployeeService.list({
    companyId,
    searchParam,
    pageNumber,
    workRegime,
    contractStatus
  });
  return res.status(200).json(result);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await EmployeeService.show(id, companyId);
  return res.status(200).json(record);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const record = await EmployeeService.create(req.body, companyId);
  return res.status(200).json(record);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await EmployeeService.update(id, req.body, companyId);
  return res.status(200).json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  await EmployeeService.remove(id, companyId);
  return res.status(200).json({ message: "Employee deleted" });
};

// Foto do funcionário — mesmo padrão de ServiceController.uploadPhoto.
export const uploadPhoto = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;
  const file = req.file as Express.Multer.File | undefined;

  if (!file) {
    throw new AppError("ERR_EMPLOYEE_NO_PHOTO_SENT", 400);
  }

  const record = await Employee.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_EMPLOYEE_NOT_FOUND", 404);
  }

  const photoUrl = `${process.env.BACKEND_URL}/public/company${companyId}/employee-photos/${encodeURIComponent(
    file.filename
  )}`;
  await record.update({ photoUrl });

  return res.status(200).json({ photoUrl });
};
