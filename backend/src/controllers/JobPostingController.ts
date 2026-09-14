import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureHRAccess from "../services/HRService/EnsureHRAccess";
import * as JobPostingService from "../services/HRService/JobPostingService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureHRAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_HR_MODULE_ACCESS", 403);
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { searchParam, pageNumber, status } = req.query as {
    searchParam?: string;
    pageNumber?: string;
    status?: string;
  };

  const result = await JobPostingService.list({ companyId, searchParam, pageNumber, status });
  return res.status(200).json(result);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await JobPostingService.show(id, companyId);
  return res.status(200).json(record);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const record = await JobPostingService.create(req.body, companyId);
  return res.status(200).json(record);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await JobPostingService.update(id, req.body, companyId);
  return res.status(200).json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  await JobPostingService.remove(id, companyId);
  return res.status(200).json({ message: "JobPosting deleted" });
};

// ---------------------------------------------------------------------------
// Público (sem login) — página de vagas da empresa.
// ---------------------------------------------------------------------------

export const publicIndex = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.params;
  const records = await JobPostingService.listPublicOpen(companyId);
  return res.status(200).json(records);
};

export const publicShow = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id } = req.params;
  const record = await JobPostingService.showPublic(companyId, id);
  return res.status(200).json(record);
};
