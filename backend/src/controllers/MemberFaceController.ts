import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureMembersAccess from "../services/MemberService/EnsureMembersAccess";
import * as MemberFaceService from "../services/MemberService/MemberFaceService";
import * as MemberPortalService from "../services/MemberService/MemberPortalService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureMembersAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_MEMBERS_MODULE_ACCESS", 403);
  }
};

export const setFaceDescriptor = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;
  const { descriptor } = req.body;

  const record = await MemberFaceService.setFaceDescriptor(id, companyId, descriptor);
  return res.status(200).json({ id: record.id, faceEnrolled: true });
};

export const checkIn = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { descriptor } = req.body;

  const result = await MemberFaceService.checkIn(companyId, descriptor);
  return res.status(200).json(result);
};

export const listCheckIns = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { memberId, pageNumber } = req.query as { memberId?: string; pageNumber?: string };

  const result = await MemberFaceService.listCheckIns({ companyId, memberId, pageNumber });
  return res.status(200).json(result);
};

export const listPendingHabitualidade = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const result = await MemberFaceService.listPendingHabitualidade(companyId);
  return res.status(200).json(result);
};

export const validateCheckIn = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId, id: userId } = req.user;
  const { id } = req.params;
  const { status } = req.body;

  const record = await MemberFaceService.validateCheckIn(id, companyId, Number(userId), status);
  return res.status(200).json(record);
};

// Gera o PIN de acesso do Portal do Associado — SEMPRE dentro da
// administração do clube (ensureAccess, mesmo gate do resto do módulo).
// O PIN em texto puro só aparece nesta resposta; depois disso, só o
// hash fica guardado.
export const generatePortalPin = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const result = await MemberPortalService.generatePortalPin(id, companyId);
  return res.status(200).json(result);
};
