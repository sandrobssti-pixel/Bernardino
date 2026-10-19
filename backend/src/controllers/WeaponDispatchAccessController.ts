import { Request, Response } from "express";
import { GetWeaponDispatchAccessStatus } from "../services/WeaponDispatchService/EnsureWeaponDispatchAccess";

// Usado pelo frontend pra decidir se mostra o menu/página do Despachante
// Bélico — mesmo padrão do FinanceAccessController/HRAccessController.
export const show = async (req: Request, res: Response): Promise<Response> => {
  const status = await GetWeaponDispatchAccessStatus(req.user as any);
  return res.status(200).json(status);
};
