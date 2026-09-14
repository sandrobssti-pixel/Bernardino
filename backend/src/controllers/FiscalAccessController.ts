import { Request, Response } from "express";
import { GetFiscalAccessStatus } from "../services/FiscalService/EnsureFiscalAccess";

// Usado pelo frontend pra decidir se mostra as abas Vendas/Configuração
// Fiscal — mesmo padrão do FinanceAccessController.
export const show = async (req: Request, res: Response): Promise<Response> => {
  const status = await GetFiscalAccessStatus(req.user as any);
  return res.status(200).json(status);
};
