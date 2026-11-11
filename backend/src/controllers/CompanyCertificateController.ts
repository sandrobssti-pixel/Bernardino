import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureMembersAccess from "../services/MemberService/EnsureMembersAccess";
import * as CompanyCertificateService from "../services/CompanyService/CompanyCertificateService";

// Certificado digital da entidade — além do gate normal do Gerenciador
// CAC (mesmo módulo que usa isso pra assinar a Declaração de
// Filiação), exige explicitamente profile "admin": é uma chave
// privada de verdade da entidade inteira, não um dado de um associado
// só, então a barra de acesso fica mais alta de propósito.
const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureMembersAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_MEMBERS_MODULE_ACCESS", 403);
  }
  if (req.user.profile !== "admin" && !(req.user as any).super) {
    throw new AppError("ERR_COMPANY_CERTIFICATE_ADMIN_ONLY", 403);
  }
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const status = await CompanyCertificateService.getStatus(companyId);
  return res.status(200).json(status);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId, id: userId } = req.user;
  const file = req.file as Express.Multer.File | undefined;

  if (!file) {
    throw new AppError("ERR_COMPANY_CERTIFICATE_FILE_REQUIRED");
  }

  const { password } = req.body;
  const status = await CompanyCertificateService.upload(
    companyId,
    file.buffer,
    password,
    file.originalname,
    Number(userId)
  );
  return res.status(200).json(status);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  await CompanyCertificateService.remove(companyId);
  return res.status(200).json({ message: "Company certificate deleted" });
};
