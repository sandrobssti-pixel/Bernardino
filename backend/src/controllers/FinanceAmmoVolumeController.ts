import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureFinancialAccess from "../services/FinanceService/EnsureFinancialAccess";
import * as FinanceAmmoVolumeService from "../services/FinanceService/FinanceAmmoVolumeService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureFinancialAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_FINANCIAL_MODULE_ACCESS", 403);
  }
};

// Exclusão de caixinha de munição é só do Admin (pedido explícito do
// cliente: "só o adm tem poder de excluir algum campo") — checado
// aqui (não só escondendo o botão no frontend), mesmo padrão já usado
// em FinanceImportController.ensureImportPermission e em
// FinanceAmmoBigBoxController (v2.3.300).
const ensureDeletePermission = (req: Request): void => {
  const user = req.user as any;
  if (user.profile === "admin" || user.super) return;
  throw new AppError("ERR_FINANCE_AMMO_DELETE_ADMIN_ONLY", 403);
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { productId } = req.params;

  const volumes = await FinanceAmmoVolumeService.list(productId, companyId);
  return res.status(200).json(volumes);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { productId } = req.params;

  const volume = await FinanceAmmoVolumeService.create(productId, req.body, companyId);
  return res.status(200).json(volume);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { productId, id } = req.params;

  const volume = await FinanceAmmoVolumeService.update(id, productId, req.body, companyId);
  return res.status(200).json(volume);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  ensureDeletePermission(req);
  const { companyId } = req.user;
  const { productId, id } = req.params;
  // `force=true` (só chega aqui depois do Admin confirmar explicitamente
  // num segundo clique no frontend) desvincula o item de venda antigo
  // em vez de bloquear — ver comentário completo em
  // FinanceAmmoVolumeService.remove.
  const force = String(req.query.force || "").toLowerCase() === "true";

  await FinanceAmmoVolumeService.remove(id, productId, companyId, force);
  return res.status(200).json({ message: "FinanceAmmoVolume deleted" });
};
