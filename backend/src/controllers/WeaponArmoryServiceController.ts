import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureWeaponArmoryAccess from "../services/WeaponArmoryService/EnsureWeaponArmoryAccess";
import * as WeaponArmoryServiceService from "../services/WeaponArmoryService/WeaponArmoryServiceService";
import * as WeaponDispatchClientService from "../services/WeaponDispatchService/WeaponDispatchClientService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureWeaponArmoryAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_WEAPON_ARMORY_MODULE_ACCESS", 403);
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { searchParam, pageNumber } = req.query as {
    searchParam?: string;
    pageNumber?: string;
  };

  const result = await WeaponArmoryServiceService.list({ companyId, searchParam, pageNumber });
  return res.status(200).json(result);
};

// Busca combinada em Contatos + Clientes Financeiro — reaproveita a mesma
// função já usada no Despachante Bélico (WeaponDispatchClientService.
// lookupPerson, puramente leitura/sem coupling com o módulo de origem),
// mas atrás do ensureAccess DESTE módulo (Serviço Armaria tem sua própria
// contratação de plano, independente do Despachante Bélico). Precisa vir
// ANTES de GET /weapon-armory/services/:id nas rotas.
export const lookup = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { searchParam } = req.query as { searchParam?: string };

  const results = await WeaponDispatchClientService.lookupPerson(companyId, searchParam || "");
  return res.status(200).json(results);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await WeaponArmoryServiceService.show(id, companyId);
  return res.status(200).json(record);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const record = await WeaponArmoryServiceService.create(req.body, companyId);
  return res.status(200).json(record);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await WeaponArmoryServiceService.update(id, req.body, companyId);
  return res.status(200).json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  await WeaponArmoryServiceService.remove(id, companyId);
  return res.status(200).json({ message: "WeaponArmoryService deleted" });
};

// Fotos antes/depois — `stage` ("before"/"after") vem no body como campo de
// formulário junto com os arquivos (multipart/form-data). Várias fotos por
// chamada (ver weaponArmoryPhotoUpload.ts, `.array(...)`).
export const uploadPhotos = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;
  const stage = (req.body.stage === "after" ? "after" : "before") as "before" | "after";
  const files = (req.files as Express.Multer.File[]) || [];

  if (!files.length) {
    throw new AppError("ERR_WEAPON_ARMORY_NO_PHOTO_SENT", 400);
  }

  const urls = files.map(
    (file) =>
      `${process.env.BACKEND_URL}/public/company${companyId}/weapon-armory-photos/${encodeURIComponent(
        file.filename
      )}`
  );

  const updated = await WeaponArmoryServiceService.addPhotos(id, companyId, stage, urls);
  return res.status(200).json({ photos: updated });
};

export const removePhoto = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;
  const { stage, url } = req.body as { stage: "before" | "after"; url: string };

  const updated = await WeaponArmoryServiceService.removePhoto(id, companyId, stage, url);
  return res.status(200).json({ photos: updated });
};
