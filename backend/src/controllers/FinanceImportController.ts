import { Request, Response } from "express";
import fs from "fs";
import { head } from "lodash";
import AppError from "../errors/AppError";
import logger from "../utils/logger";
import EnsureFinancialAccess from "../services/FinanceService/EnsureFinancialAccess";
import * as FinanceImportService from "../services/FinanceService/FinanceImportService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureFinancialAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_FINANCIAL_MODULE_ACCESS", 403);
  }
};

// Usuário comum só importa planilha se `allowImport` estiver ligado no
// cadastro dele — Admin/Master sempre pode. Checado aqui (não só escondendo
// o botão no frontend) pra não dar pra contornar batendo direto na API. Ver
// docs/MANUAL_TECNICO.md.
const ensureImportPermission = (req: Request): void => {
  const user = req.user as any;
  if (user.profile === "admin" || user.super) return;
  if (user.allowImport !== "enabled") {
    throw new AppError("ERR_NO_IMPORT_PERMISSION", 403);
  }
};

const getUploadedFile = (req: Request): Express.Multer.File => {
  const files = req.files as Express.Multer.File[];
  const file = head(files);
  if (!file) {
    throw new AppError("ERR_FINANCE_IMPORT_FILE_REQUIRED");
  }
  return file;
};

// A planilha enviada (produtos/clientes/fornecedores — pode conter dado
// comercial sensível) fica salva em `public/company{id}/`, servida
// estaticamente pelo Express — diferente do upload de mídia do chat, aqui
// não há motivo pra manter o arquivo depois de processado. Removido sempre
// no final (sucesso ou erro), pra não deixar a planilha original acessível
// por URL indefinidamente.
const removeUploadedFile = (file: Express.Multer.File): void => {
  fs.unlink(file.path, err => {
    if (err) {
      logger.warn(`[FinanceImportController] Falha ao remover planilha temporária ${file.path}: ${err.message}`);
    }
  });
};

export const importProducts = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  ensureImportPermission(req);
  const { companyId } = req.user;
  const file = getUploadedFile(req);

  try {
    const summary = await FinanceImportService.importProducts(companyId, file);
    return res.status(200).json(summary);
  } finally {
    removeUploadedFile(file);
  }
};

export const importCustomers = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  ensureImportPermission(req);
  const { companyId } = req.user;
  const file = getUploadedFile(req);

  try {
    const summary = await FinanceImportService.importCustomers(companyId, file);
    return res.status(200).json(summary);
  } finally {
    removeUploadedFile(file);
  }
};

export const importSuppliers = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  ensureImportPermission(req);
  const { companyId } = req.user;
  const file = getUploadedFile(req);

  try {
    const summary = await FinanceImportService.importSuppliers(companyId, file);
    return res.status(200).json(summary);
  } finally {
    removeUploadedFile(file);
  }
};

const sendXlsxBuffer = (res: Response, buffer: Buffer, filename: string): Response => {
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.status(200).send(buffer);
};

export const productTemplate = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const buffer = FinanceImportService.buildProductTemplate();
  return sendXlsxBuffer(res, buffer, "modelo-importacao-produtos.xlsx");
};

export const customerTemplate = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const buffer = FinanceImportService.buildCustomerTemplate();
  return sendXlsxBuffer(res, buffer, "modelo-importacao-clientes.xlsx");
};
