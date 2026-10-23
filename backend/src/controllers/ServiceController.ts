import { Request, Response } from "express";
import fs from "fs";
import { head } from "lodash";
import AppError from "../errors/AppError";
import logger from "../utils/logger";
import * as ServiceService from "../services/ServiceService/ServiceService";
import * as ServiceImportService from "../services/ServiceService/ServiceImportService";
import Service from "../models/Service";

// Mesma checagem já usada em FinanceImportController.ts — usuário comum só
// importa planilha se `allowImport` estiver ligado no cadastro dele,
// Admin/Master sempre pode. Conferido aqui (não só escondendo o botão no
// frontend) pra não dar pra contornar batendo direto na API.
const ensureImportPermission = (req: Request): void => {
  const user = req.user as any;
  if (user.profile === "admin" || user.super) return;
  if (user.allowImport !== "enabled") {
    throw new AppError("ERR_NO_IMPORT_PERMISSION", 403);
  }
};

const removeUploadedFile = (file: Express.Multer.File): void => {
  fs.unlink(file.path, (err) => {
    if (err) {
      logger.warn(`[ServiceController] Falha ao remover planilha temporária ${file.path}: ${err.message}`);
    }
  });
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { searchParam, pageNumber } = req.query as { searchParam?: string; pageNumber?: string };

  const result = await ServiceService.list({ companyId, searchParam, pageNumber });
  return res.status(200).json(result);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await ServiceService.show(id, companyId);
  return res.status(200).json(record);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const record = await ServiceService.create(req.body, companyId);
  return res.status(200).json(record);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await ServiceService.update(id, req.body, companyId);
  return res.status(200).json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  await ServiceService.remove(id, companyId);
  return res.status(200).json({ message: "Service deleted" });
};

// Foto do serviço (v2.3.175) — mesmo padrão de
// FinanceProductController.uploadPhoto/WeaponDispatchClientController.
// uploadPhoto. `encodeURIComponent` no nome do arquivo — nome pode ter
// acento/espaço, sem isso o link quebra ao abrir (seção 79 do manual
// técnico).
export const uploadPhoto = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const file = req.file as Express.Multer.File | undefined;

  if (!file) {
    throw new AppError("ERR_SERVICE_NO_PHOTO_SENT", 400);
  }

  const record = await Service.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_SERVICE_NOT_FOUND", 404);
  }

  const photoUrl = `${process.env.BACKEND_URL}/public/company${companyId}/service-photos/${encodeURIComponent(
    file.filename
  )}`;
  await record.update({ photoUrl });

  return res.status(200).json({ photoUrl });
};

// Importação via planilha Excel (v2.3.179) — mesmo padrão de
// Produtos/Clientes do Financeiro, bem mais simples (só 5 campos). Ver
// ServiceImportService.ts.
export const importTemplate = async (_req: Request, res: Response): Promise<Response> => {
  const buffer = ServiceImportService.buildServiceTemplate();
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", 'attachment; filename="modelo-importacao-servicos.xlsx"');
  return res.status(200).send(buffer);
};

export const importServices = async (req: Request, res: Response): Promise<Response> => {
  ensureImportPermission(req);
  const { companyId } = req.user;
  const files = req.files as Express.Multer.File[];
  const file = head(files);

  if (!file) {
    throw new AppError("ERR_SERVICE_IMPORT_FILE_REQUIRED");
  }

  try {
    const summary = await ServiceImportService.importServices(companyId, file);
    return res.status(200).json(summary);
  } finally {
    removeUploadedFile(file);
  }
};
