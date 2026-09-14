import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureHRAccess from "../services/HRService/EnsureHRAccess";
import * as HRReportService from "../services/HRService/HRReportService";

export const summary = async (req: Request, res: Response): Promise<Response> => {
  const allowed = await EnsureHRAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_HR_MODULE_ACCESS", 403);
  }

  const { companyId } = req.user;
  const data = await HRReportService.summary(companyId);
  return res.status(200).json(data);
};
