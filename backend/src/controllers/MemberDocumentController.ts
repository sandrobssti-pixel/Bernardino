import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureMembersAccess from "../services/MemberService/EnsureMembersAccess";
import * as MemberDocumentService from "../services/MemberService/MemberDocumentService";

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

  const records = await MemberDocumentService.list(memberId, companyId);
  return res.status(200).json(records);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { memberId } = req.params;
  const file = req.file as Express.Multer.File | undefined;

  if (!file) {
    throw new AppError("ERR_MEMBER_NO_DOCUMENT_SENT");
  }

  const { documentType, label } = req.body;
  const weaponId = req.body.weaponId ? Number(req.body.weaponId) : null;

  const fileUrl = `${process.env.BACKEND_URL}/public/company${companyId}/member-documents/${encodeURIComponent(
    file.filename
  )}`;

  const record = await MemberDocumentService.upload(
    memberId,
    { documentType, weaponId, label, fileUrl, fileName: file.originalname },
    companyId
  );
  return res.status(200).json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  await MemberDocumentService.remove(id, companyId);
  return res.status(200).json({ message: "Member document deleted" });
};
