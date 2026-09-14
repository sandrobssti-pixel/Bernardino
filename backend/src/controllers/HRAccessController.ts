import { Request, Response } from "express";
import { GetHRAccessStatus } from "../services/HRService/EnsureHRAccess";

// Usado pelo frontend pra decidir se mostra o menu/página de RH — mesmo
// padrão do FinanceAccessController/FiscalAccessController.
export const show = async (req: Request, res: Response): Promise<Response> => {
  const status = await GetHRAccessStatus(req.user as any);
  return res.status(200).json(status);
};
