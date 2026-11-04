import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureHRAccess from "../services/HRService/EnsureHRAccess";
import EnsureFinancialAccess from "../services/FinanceService/EnsureFinancialAccess";
import * as PayrollExpenseService from "../services/PayrollService/PayrollExpenseService";

// Lançamento da Folha em Contas a Pagar cruza os dois módulos — precisa
// ter acesso ao RH (pra ver/calcular a folha) E ao Financeiro (pra
// escrever em Contas a Pagar). RH é um add-on independente do
// Financeiro (Plan.useHR não exige Plan.useFinancial) — uma empresa pode
// ter RH sem ter Financeiro contratado, e nesse caso este endpoint
// precisa recusar, não criar uma Conta a Pagar "órfã" num módulo que a
// empresa nem tem.
const ensureAccess = async (req: Request): Promise<void> => {
  const hasHR = await EnsureHRAccess(req.user as any);
  if (!hasHR) {
    throw new AppError("ERR_NO_HR_MODULE_ACCESS", 403);
  }
  const hasFinancial = await EnsureFinancialAccess(req.user as any);
  if (!hasFinancial) {
    throw new AppError("ERR_NO_FINANCIAL_MODULE_ACCESS", 403);
  }
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { competencyMonth, competencyYear } = req.query as {
    competencyMonth?: string;
    competencyYear?: string;
  };

  const record = await PayrollExpenseService.getLaunchStatus({
    companyId,
    competencyMonth: Number(competencyMonth),
    competencyYear: Number(competencyYear)
  });
  return res.status(200).json(record);
};

export const launch = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { competencyMonth, competencyYear } = req.body;

  const record = await PayrollExpenseService.launch({
    companyId,
    competencyMonth: Number(competencyMonth),
    competencyYear: Number(competencyYear)
  });
  return res.status(200).json(record);
};
