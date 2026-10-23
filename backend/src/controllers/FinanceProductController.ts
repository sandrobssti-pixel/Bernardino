import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureFinancialAccess from "../services/FinanceService/EnsureFinancialAccess";
import * as FinanceProductService from "../services/FinanceService/FinanceProductService";
import FinanceProduct from "../models/FinanceProduct";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureFinancialAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_FINANCIAL_MODULE_ACCESS", 403);
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { searchParam, pageNumber, type } = req.query as {
    searchParam?: string;
    pageNumber?: string;
    type?: string;
  };

  const result = await FinanceProductService.list({
    companyId,
    searchParam,
    pageNumber,
    type
  });

  return res.status(200).json(result);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await FinanceProductService.show(id, companyId);
  return res.status(200).json(record);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const record = await FinanceProductService.create(req.body, companyId);
  return res.status(200).json(record);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await FinanceProductService.update(id, req.body, companyId);
  return res.status(200).json(record);
};

// Foto do produto (v2.3.167) — mesmo padrão de
// WeaponDispatchClientController.uploadPhoto: multer já grava o arquivo
// em disco antes de chegar aqui; só falta confirmar que o produto é
// desta empresa e gravar o caminho público. `encodeURIComponent` no nome
// do arquivo — nome pode ter acento/espaço, sem isso o link quebra ao
// abrir (mesma lição de Message.ts/mediaUrl, seção 79 do manual técnico).
export const uploadPhoto = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;
  const file = req.file as Express.Multer.File | undefined;

  if (!file) {
    throw new AppError("ERR_FINANCE_PRODUCT_NO_PHOTO_SENT", 400);
  }

  const record = await FinanceProduct.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_FINANCE_PRODUCT_NOT_FOUND", 404);
  }

  const photoUrl = `${process.env.BACKEND_URL}/public/company${companyId}/finance-product-photos/${encodeURIComponent(
    file.filename
  )}`;
  await record.update({ photoUrl });

  return res.status(200).json({ photoUrl });
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  await FinanceProductService.remove(id, companyId);
  return res.status(200).json({ message: "FinanceProduct deleted" });
};
