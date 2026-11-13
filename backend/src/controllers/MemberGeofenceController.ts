import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureMembersAccess from "../services/MemberService/EnsureMembersAccess";
import * as MemberGeofenceService from "../services/MemberService/MemberGeofenceService";

// Coordenada + raio do clube (Gerenciador CAC, Fase 4 — API de check-in
// com geofencing) — admin-only, igual ao certificado digital: define se
// a entrada de habitualidade é aprovada automaticamente, então a barra
// de acesso fica mais alta de propósito.
const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureMembersAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_MEMBERS_MODULE_ACCESS", 403);
  }
  if (req.user.profile !== "admin" && !(req.user as any).super) {
    throw new AppError("ERR_MEMBER_GEOFENCE_ADMIN_ONLY", 403);
  }
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const settings = await MemberGeofenceService.getSettings(companyId);
  return res.status(200).json(settings);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const { latitude, longitude, radiusMeters } = req.body;
  const settings = await MemberGeofenceService.updateSettings(companyId, {
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    radiusMeters: radiusMeters != null ? parseFloat(radiusMeters) : undefined
  });
  return res.status(200).json(settings);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  await MemberGeofenceService.removeSettings(companyId);
  return res.status(200).json({ message: "Member geofence settings removed" });
};
