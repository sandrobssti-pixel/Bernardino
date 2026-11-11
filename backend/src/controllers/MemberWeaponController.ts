import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureMembersAccess from "../services/MemberService/EnsureMembersAccess";
import * as MemberWeaponService from "../services/MemberService/MemberWeaponService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureMembersAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_MEMBERS_MODULE_ACCESS", 403);
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { memberId } = req.params;

  const records = await MemberWeaponService.list(memberId, companyId);
  return res.status(200).json(records);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { memberId } = req.params;

  const record = await MemberWeaponService.create(memberId, req.body, companyId);
  return res.status(200).json(record);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await MemberWeaponService.update(id, req.body, companyId);
  return res.status(200).json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  await MemberWeaponService.remove(id, companyId);
  return res.status(200).json({ message: "Member weapon deleted" });
};
