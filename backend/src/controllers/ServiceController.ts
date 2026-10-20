import { Request, Response } from "express";
import AppError from "../errors/AppError";
import * as ServiceService from "../services/ServiceService/ServiceService";
import Service from "../models/Service";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { searchParam, pageNumber } = req.query as { searchParam?: string; pageNumber?: string };

  const result = await ServiceService.list({ companyId, searchParam, pageNumber });
  return res.status(200).json(result);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await ServiceService.show(id, companyId);
  return res.status(200).json(record);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const record = await ServiceService.create(req.body, companyId);
  return res.status(200).json(record);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await ServiceService.update(id, req.body, companyId);
  return res.status(200).json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  await ServiceService.remove(id, companyId);
  return res.status(200).json({ message: "Service deleted" });
};

// Foto do serviço (v2.3.175) — mesmo padrão de
// FinanceProductController.uploadPhoto/WeaponDispatchClientController.
// uploadPhoto. `encodeURIComponent` no nome do arquivo — nome pode ter
// acento/espaço, sem isso o link quebra ao abrir (seção 79 do manual
// técnico).
export const uploadPhoto = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const file = req.file as Express.Multer.File | undefined;

  if (!file) {
    throw new AppError("ERR_SERVICE_NO_PHOTO_SENT", 400);
  }

  const record = await Service.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_SERVICE_NOT_FOUND", 404);
  }

  const photoUrl = `${process.env.BACKEND_URL}/public/company${companyId}/service-photos/${encodeURIComponent(
    file.filename
  )}`;
  await record.update({ photoUrl });

  return res.status(200).json({ photoUrl });
};
