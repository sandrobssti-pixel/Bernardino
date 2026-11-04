import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureHRAccess from "../services/HRService/EnsureHRAccess";
import * as CompanyPartnerService from "../services/CompanyPartnerService/CompanyPartnerService";
import CompanyPartner from "../models/CompanyPartner";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureHRAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_HR_MODULE_ACCESS", 403);
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { searchParam, pageNumber, partnerStatus } = req.query as {
    searchParam?: string;
    pageNumber?: string;
    partnerStatus?: string;
  };

  const result = await CompanyPartnerService.list({
    companyId,
    searchParam,
    pageNumber,
    partnerStatus
  });
  return res.status(200).json(result);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await CompanyPartnerService.show(id, companyId);
  return res.status(200).json(record);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const record = await CompanyPartnerService.create(req.body, companyId);
  return res.status(200).json(record);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await CompanyPartnerService.update(id, req.body, companyId);
  return res.status(200).json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  await CompanyPartnerService.remove(id, companyId);
  return res.status(200).json({ message: "Company partner deleted" });
};

// Foto do sócio — mesmo padrão de EmployeeController.uploadPhoto.
export const uploadPhoto = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;
  const file = req.file as Express.Multer.File | undefined;

  if (!file) {
    throw new AppError("ERR_COMPANY_PARTNER_NO_PHOTO_SENT", 400);
  }

  const record = await CompanyPartner.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_COMPANY_PARTNER_NOT_FOUND", 404);
  }

  const photoUrl = `${process.env.BACKEND_URL}/public/company${companyId}/company-partner-photos/${encodeURIComponent(
    file.filename
  )}`;
  await record.update({ photoUrl });

  return res.status(200).json({ photoUrl });
};
