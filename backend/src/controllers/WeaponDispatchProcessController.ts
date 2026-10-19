import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureWeaponDispatchAccess from "../services/WeaponDispatchService/EnsureWeaponDispatchAccess";
import * as WeaponDispatchProcessService from "../services/WeaponDispatchService/WeaponDispatchProcessService";
import {
  WEAPON_DISPATCH_TRACKS,
  WEAPON_DISPATCH_STAGES,
  WEAPON_DISPATCH_PROCESS_TYPES
} from "../services/WeaponDispatchService/WeaponDispatchStageCatalog";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureWeaponDispatchAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_WEAPON_DISPATCH_MODULE_ACCESS", 403);
  }
};

// Catálogo fixo (trilhas/etapas/tipos de processo) — frontend usa isso
// pra montar os selects e as colunas da esteira, em vez de duplicar essa
// lista em JS. Ver WeaponDispatchStageCatalog.ts.
export const catalog = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  return res.status(200).json({
    tracks: WEAPON_DISPATCH_TRACKS,
    stages: WEAPON_DISPATCH_STAGES,
    processTypes: WEAPON_DISPATCH_PROCESS_TYPES
  });
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { track, clientId } = req.query as { track?: any; clientId?: string };

  const records = await WeaponDispatchProcessService.list({ companyId, track, clientId });
  return res.status(200).json(records);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await WeaponDispatchProcessService.show(id, companyId);
  return res.status(200).json(record);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const record = await WeaponDispatchProcessService.create(req.body, companyId);
  return res.status(200).json(record);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await WeaponDispatchProcessService.update(id, req.body, companyId);
  return res.status(200).json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  await WeaponDispatchProcessService.remove(id, companyId);
  return res.status(200).json({ message: "WeaponDispatchProcess deleted" });
};

// Mover o card na esteira — único jeito de trocar `stage` (ver
// WeaponDispatchProcessService.changeStage, nunca via `update` genérico).
export const changeStage = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;
  const { stage } = req.body;

  const record = await WeaponDispatchProcessService.changeStage(
    id,
    stage,
    companyId,
    +req.user.id
  );
  return res.status(200).json(record);
};
