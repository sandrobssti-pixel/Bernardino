import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureFinancialAccess from "../services/FinanceService/EnsureFinancialAccess";
import * as FinanceWeaponUnitService from "../services/FinanceService/FinanceWeaponUnitService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureFinancialAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_FINANCIAL_MODULE_ACCESS", 403);
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { productId } = req.params;

  const units = await FinanceWeaponUnitService.list(productId, companyId);
  return res.status(200).json(units);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { productId } = req.params;

  const unit = await FinanceWeaponUnitService.create(productId, req.body, companyId);
  return res.status(200).json(unit);
};

// Cadastro em lote (colar lista de números de série) — Etapa 1.
export const storeBulk = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { productId } = req.params;
  const { serialNumbers } = req.body as { serialNumbers: string[] };

  const result = await FinanceWeaponUnitService.createBulk(productId, serialNumbers || [], companyId);
  return res.status(200).json(result);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { productId, id } = req.params;

  const unit = await FinanceWeaponUnitService.update(id, productId, req.body, companyId);
  return res.status(200).json(unit);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { productId, id } = req.params;

  await FinanceWeaponUnitService.remove(id, productId, companyId);
  return res.status(200).json({ message: "FinanceWeaponUnit deleted" });
};

// Busca pra Venda e pra qualquer tela que precise achar uma arma pelo
// nome do modelo, SKU ou número de série — ver FinanceWeaponUnitService.search.
export const search = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { searchParam } = req.query as { searchParam?: string };

  const units = await FinanceWeaponUnitService.search({ companyId, searchParam });
  return res.status(200).json(units);
};
