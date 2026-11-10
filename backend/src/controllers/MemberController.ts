import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureMembersAccess from "../services/MemberService/EnsureMembersAccess";
import * as MemberService from "../services/MemberService/MemberService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureMembersAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_MEMBERS_MODULE_ACCESS", 403);
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { searchParam, pageNumber } = req.query as {
    searchParam?: string;
    pageNumber?: string;
  };

  const result = await MemberService.list({ companyId, searchParam, pageNumber });
  return res.status(200).json(result);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await MemberService.show(id, companyId);
  return res.status(200).json(record);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const record = await MemberService.create(req.body, companyId);
  return res.status(200).json(record);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await MemberService.update(id, req.body, companyId);
  return res.status(200).json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  await MemberService.remove(id, companyId);
  return res.status(200).json({ message: "Member deleted" });
};

export const uploadPhoto = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;
  const file = req.file as Express.Multer.File | undefined;

  if (!file) {
    throw new AppError("ERR_MEMBER_NO_PHOTO_SENT", 400);
  }

  const photoUrl = `${process.env.BACKEND_URL}/public/company${companyId}/member-photos/${encodeURIComponent(
    file.filename
  )}`;
  const record = await MemberService.setPhoto(id, companyId, photoUrl);

  return res.status(200).json({ photoUrl, status: record.status });
};
