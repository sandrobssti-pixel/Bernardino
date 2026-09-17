import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureSupervisorPanelAccess from "../services/SupervisorPanelService/EnsureSupervisorPanelAccess";
import * as SlaRuleService from "../services/SupervisorPanelService/SlaRuleService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureSupervisorPanelAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_SUPERVISOR_PANEL_ACCESS", 403);
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const records = await SlaRuleService.list(companyId);
  return res.status(200).json(records);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const record = await SlaRuleService.create(req.body, companyId);
  return res.status(200).json(record);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await SlaRuleService.update(id, req.body, companyId);
  return res.status(200).json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  await SlaRuleService.remove(id, companyId);
  return res.status(200).json({ message: "SlaRule deleted" });
};
