import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureFiscalAccess from "../services/FiscalService/EnsureFiscalAccess";
import * as SaleService from "../services/FiscalService/SaleService";
import * as FiscalConfigService from "../services/FiscalService/FiscalConfigService";
import * as FiscalDocumentService from "../services/FiscalService/FiscalDocumentService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureFiscalAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_FISCAL_MODULE_ACCESS", 403);
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { searchParam, pageNumber, status, startDate, endDate } = req.query as {
    searchParam?: string;
    pageNumber?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  };

  const result = await SaleService.list({ companyId, searchParam, pageNumber, status, startDate, endDate });
  return res.status(200).json(result);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await SaleService.show(id, companyId);
  return res.status(200).json(record);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const record = await SaleService.create(req.body, companyId);
  return res.status(200).json(record);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await SaleService.update(id, req.body, companyId);
  return res.status(200).json(record);
};

// Emissão automática do documento fiscal ao confirmar a venda — só dispara
// se a empresa configurou um "tipo de documento padrão" em Configuração
// Fiscal; senão o fluxo continua 100% manual (botões em SaleDetailModal),
// como já era antes dessa feature. Fica no CONTROLLER (não dentro de
// SaleService.confirm) de propósito: FiscalDocumentService já importa
// SaleService, então SaleService importar FiscalDocumentService de volta
// criaria um import circular. Nunca deve bloquear a confirmação da venda —
// a conta a receber precisa ser criada independente do gateway fiscal
// estar configurado, fora do ar, ou dar erro.
export const confirm = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await SaleService.confirm(id, companyId);

  let fiscalAutoEmit: { attempted: boolean; success: boolean; type?: string; errorMessage?: string } = {
    attempted: false,
    success: false
  };

  try {
    const config = await FiscalConfigService.show(companyId);
    if (config.defaultDocumentType && FiscalConfigService.getActiveGatewayToken(config)) {
      fiscalAutoEmit = { attempted: true, success: false, type: config.defaultDocumentType };
      await FiscalDocumentService.emit(record.id, config.defaultDocumentType, companyId);
      fiscalAutoEmit.success = true;
    }
  } catch (err) {
    fiscalAutoEmit.errorMessage = err instanceof Error ? err.message : "ERR_FISCAL_AUTO_EMIT_FAILED";
    console.error(`[SaleController] falha na emissão automática da venda #${id}:`, err);
  }

  return res.status(200).json({ ...record.toJSON(), fiscalAutoEmit });
};

export const cancel = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await SaleService.cancel(id, companyId);
  return res.status(200).json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  await SaleService.remove(id, companyId);
  return res.status(200).json({ message: "Sale deleted" });
};
