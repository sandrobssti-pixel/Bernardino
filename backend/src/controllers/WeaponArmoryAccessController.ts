import { Request, Response } from "express";
import { GetWeaponArmoryAccessStatus } from "../services/WeaponArmoryService/EnsureWeaponArmoryAccess";

// Usado pelo frontend pra decidir se mostra o menu/página do Serviço
// Armaria — mesmo padrão do WeaponDispatchAccessController.
export const show = async (req: Request, res: Response): Promise<Response> => {
  const status = await GetWeaponArmoryAccessStatus(req.user as any);
  return res.status(200).json(status);
};
