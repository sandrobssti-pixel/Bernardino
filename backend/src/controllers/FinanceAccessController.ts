import { Request, Response } from "express";
import { GetFinancialAccessStatus } from "../services/FinanceService/EnsureFinancialAccess";

// Usado pelo frontend pra decidir o que mostrar nas abas do módulo
// Financeiro sem precisar tentar-e-falhar em cada chamada de CRUD.
export const show = async (req: Request, res: Response): Promise<Response> => {
  const status = await GetFinancialAccessStatus(req.user as any);
  return res.status(200).json(status);
};
