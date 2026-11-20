import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureFinancialAccess from "../services/FinanceService/EnsureFinancialAccess";
import * as FinanceAmmoVolumeService from "../services/FinanceService/FinanceAmmoVolumeService";
import * as FinanceWeaponUnitService from "../services/FinanceService/FinanceWeaponUnitService";

// Corrige dado antigo deixado pelo bug corrigido na v2.3.318 (excluir
// venda confirmada direto não devolvia estoque) — ver comentário em
// FinanceService/FiscalService/SaleService.ts:remove. Só Admin, mesmo
// padrão de outras ações de manutenção do módulo.
export const repairOrphanedStock = async (req: Request, res: Response): Promise<Response> => {
  const allowed = await EnsureFinancialAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_FINANCIAL_MODULE_ACCESS", 403);
  }

  const user = req.user as any;
  if (user.profile !== "admin" && !user.super) {
    throw new AppError("ERR_FINANCE_AMMO_DELETE_ADMIN_ONLY", 403);
  }

  const { companyId } = req.user;

  const ammoVolumesFixed = await FinanceAmmoVolumeService.repairOrphanedFromDeletedSales(companyId);
  const weaponUnitsFixed = await FinanceWeaponUnitService.repairOrphanedFromDeletedSales(companyId);

  return res.status(200).json({ ammoVolumesFixed, weaponUnitsFixed });
};
