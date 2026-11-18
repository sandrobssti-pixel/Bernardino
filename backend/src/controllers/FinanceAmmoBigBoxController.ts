import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureFinancialAccess from "../services/FinanceService/EnsureFinancialAccess";
import * as FinanceAmmoBigBoxService from "../services/FinanceService/FinanceAmmoBigBoxService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureFinancialAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_FINANCIAL_MODULE_ACCESS", 403);
  }
};

// Exclusão de caixa grande/caixinha de munição é só do Admin (pedido
// explícito do cliente: "só o adm tem poder de excluir algum campo") —
// checado aqui (não só escondendo o botão no frontend), mesmo padrão
// já usado em FinanceImportController.ensureImportPermission.
const ensureDeletePermission = (req: Request): void => {
  const user = req.user as any;
  if (user.profile === "admin" || user.super) return;
  throw new AppError("ERR_FINANCE_AMMO_DELETE_ADMIN_ONLY", 403);
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { productId } = req.params;

  const bigBoxes = await FinanceAmmoBigBoxService.list(productId, companyId);
  return res.status(200).json(bigBoxes);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { productId } = req.params;

  const bigBox = await FinanceAmmoBigBoxService.create(productId, req.body, companyId);
  return res.status(200).json(bigBox);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { productId, id } = req.params;

  const bigBox = await FinanceAmmoBigBoxService.update(id, productId, req.body, companyId);
  return res.status(200).json(bigBox);
};

export const linkMatchingVolumes = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { productId, id } = req.params;

  const linkedCount = await FinanceAmmoBigBoxService.linkMatchingVolumes(id, productId, companyId);
  return res.status(200).json({ linkedCount });
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  ensureDeletePermission(req);
  const { companyId } = req.user;
  const { productId, id } = req.params;

  await FinanceAmmoBigBoxService.remove(id, productId, companyId);
  return res.status(200).json({ message: "FinanceAmmoBigBox deleted" });
};
