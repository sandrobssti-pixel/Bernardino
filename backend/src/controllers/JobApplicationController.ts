import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureHRAccess from "../services/HRService/EnsureHRAccess";
import * as JobApplicationService from "../services/HRService/JobApplicationService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureHRAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_HR_MODULE_ACCESS", 403);
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { jobPostingId, status, pageNumber } = req.query as {
    jobPostingId?: string;
    status?: string;
    pageNumber?: string;
  };

  const result = await JobApplicationService.list({ companyId, jobPostingId, status, pageNumber });
  return res.status(200).json(result);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await JobApplicationService.show(id, companyId);
  return res.status(200).json(record);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await JobApplicationService.update(id, req.body, companyId);
  return res.status(200).json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  await JobApplicationService.remove(id, companyId);
  return res.status(200).json({ message: "JobApplication deleted" });
};

export const hire = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const result = await JobApplicationService.hire(id, companyId);
  return res.status(200).json(result);
};

// ---------------------------------------------------------------------------
// Público (sem login) — envio de candidatura.
// ---------------------------------------------------------------------------

export const publicStore = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id } = req.params;
  const file = req.file as Express.Multer.File | undefined;

  if (!file) {
    throw new AppError("ERR_JOB_APPLICATION_RESUME_REQUIRED");
  }

  const resumeUrl = `company${companyId}/resumes/${file.filename}`;

  const record = await JobApplicationService.createPublic(companyId, id, req.body, resumeUrl);
  return res.status(200).json({ id: record.id, message: "Candidatura enviada com sucesso." });
};
