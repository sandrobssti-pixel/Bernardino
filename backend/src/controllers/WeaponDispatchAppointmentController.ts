import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureWeaponDispatchAccess from "../services/WeaponDispatchService/EnsureWeaponDispatchAccess";
import * as WeaponDispatchAppointmentService from "../services/WeaponDispatchService/WeaponDispatchAppointmentService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureWeaponDispatchAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_WEAPON_DISPATCH_MODULE_ACCESS", 403);
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { processId } = req.params;

  const records = await WeaponDispatchAppointmentService.listByProcess(processId, companyId);
  return res.status(200).json(records);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const record = await WeaponDispatchAppointmentService.create(req.body, companyId);
  return res.status(200).json(record);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await WeaponDispatchAppointmentService.update(id, req.body, companyId);
  return res.status(200).json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  await WeaponDispatchAppointmentService.remove(id, companyId);
  return res.status(200).json({ message: "WeaponDispatchAppointment deleted" });
};
