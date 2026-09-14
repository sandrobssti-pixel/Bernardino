import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureFinancialAccess from "../services/FinanceService/EnsureFinancialAccess";
import * as FiscalDocumentService from "../services/FiscalService/FiscalDocumentService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureFinancialAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_FINANCIAL_MODULE_ACCESS", 403);
  }
};

// Documentos fiscais são sempre listados no contexto de uma venda
// (/sales/:saleId/fiscal-documents) — não existe uma listagem "solta" de
// todas as notas da empresa por enquanto (cada venda mostra as próprias).
export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { saleId } = req.params;

  const documents = await FiscalDocumentService.list(saleId, companyId);
  return res.status(200).json(documents);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { saleId } = req.params;
  const { type } = req.body;

  const document = await FiscalDocumentService.emit(saleId, type, companyId);
  return res.status(200).json(document);
};

export const refreshStatus = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const document = await FiscalDocumentService.refreshStatus(id, companyId);
  return res.status(200).json(document);
};

export const cancel = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;
  const { justification } = req.body;

  const document = await FiscalDocumentService.cancel(id, justification, companyId);
  return res.status(200).json(document);
};
