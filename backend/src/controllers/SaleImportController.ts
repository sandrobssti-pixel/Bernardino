import { Request, Response } from "express";
import fs from "fs";
import { head } from "lodash";
import AppError from "../errors/AppError";
import logger from "../utils/logger";
import EnsureFiscalAccess from "../services/FiscalService/EnsureFiscalAccess";
import * as SaleImportService from "../services/FiscalService/SaleImportService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureFiscalAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_FISCAL_MODULE_ACCESS", 403);
  }
};

// Usuário comum só importa planilha se `allowImport` estiver ligado no
// cadastro dele — Admin/Master sempre pode. Mesma regra do
// FinanceImportController.ts, checada aqui (não só escondendo o botão no
// frontend) pra não dar pra contornar batendo direto na API.
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

const removeUploadedFile = (file: Express.Multer.File): void => {
  fs.unlink(file.path, err => {
    if (err) {
      logger.warn(`[SaleImportController] Falha ao remover planilha temporária ${file.path}: ${err.message}`);
    }
  });
};

export const importSales = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  ensureImportPermission(req);
  const { companyId } = req.user;
  const file = getUploadedFile(req);

  try {
    const summary = await SaleImportService.importSales(companyId, file);
    return res.status(200).json(summary);
  } finally {
    removeUploadedFile(file);
  }
};
