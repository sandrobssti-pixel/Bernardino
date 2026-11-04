import { Request, Response } from "express";
import AppError from "../errors/AppError";
import * as PayrollTableService from "../services/PayrollService/PayrollTableService";

// Administração das tabelas de INSS/IRRF — só Master (`user.super`),
// mesmo padrão de GlobalConfigController.ts (painel exclusivo do
// Master, nenhum Admin de empresa-cliente tem acesso).
const ensureMaster = (req: Request): void => {
  const isSuper = !!(req.user as any)?.super;
  if (!req.user || !isSuper) {
    throw new AppError("ERR_PAYROLL_TABLE_MASTER_ONLY", 403);
  }
};

export const indexInss = async (req: Request, res: Response): Promise<Response> => {
  ensureMaster(req);
  const records = await PayrollTableService.listInssTables();
  return res.status(200).json(records);
};

export const storeInss = async (req: Request, res: Response): Promise<Response> => {
  ensureMaster(req);
  const record = await PayrollTableService.createInssTable(req.body);
  return res.status(200).json(record);
};

export const indexIrrf = async (req: Request, res: Response): Promise<Response> => {
  ensureMaster(req);
  const records = await PayrollTableService.listIrrfTables();
  return res.status(200).json(records);
};

export const storeIrrf = async (req: Request, res: Response): Promise<Response> => {
  ensureMaster(req);
  const record = await PayrollTableService.createIrrfTable(req.body);
  return res.status(200).json(record);
};
