import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureFiscalAccess from "../services/FiscalService/EnsureFiscalAccess";
import * as FiscalDocumentService from "../services/FiscalService/FiscalDocumentService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureFiscalAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_FISCAL_MODULE_ACCESS", 403);
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

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  await FiscalDocumentService.remove(id, companyId);
  return res.status(200).json({ message: "FISCAL_DOCUMENT_DELETED" });
};

export const cancel = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;
  const { justification } = req.body;

  const document = await FiscalDocumentService.cancel(id, justification, companyId);
  return res.status(200).json(document);
};

export const correctionLetter = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;
  const { text } = req.body;

  const result = await FiscalDocumentService.emitCorrectionLetter(id, text, companyId);
  return res.status(200).json(result);
};

export const sendEmail = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;
  const { emails } = req.body;

  const result = await FiscalDocumentService.sendByEmail(id, emails, companyId);
  return res.status(200).json(result);
};

// Devolve o PDF direto (não é JSON) — pré-visualização antes de emitir de
// verdade, não cria FiscalDocument nenhum.
export const previewDanfe = async (req: Request, res: Response): Promise<Response | void> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { saleId } = req.params;

  const result = await FiscalDocumentService.previewDanfe(saleId, companyId);

  if (!result.ok || !result.pdf) {
    return res.status(502).json({ error: result.errorMessage });
  }

  res.setHeader("Content-Type", "application/pdf");
  res.send(result.pdf);
};
