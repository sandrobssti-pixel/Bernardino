import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureWeaponDispatchAccess from "../services/WeaponDispatchService/EnsureWeaponDispatchAccess";
import * as WeaponDispatchClientService from "../services/WeaponDispatchService/WeaponDispatchClientService";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureWeaponDispatchAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_WEAPON_DISPATCH_MODULE_ACCESS", 403);
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { searchParam, pageNumber } = req.query as {
    searchParam?: string;
    pageNumber?: string;
  };

  const result = await WeaponDispatchClientService.list({ companyId, searchParam, pageNumber });
  return res.status(200).json(result);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await WeaponDispatchClientService.show(id, companyId);
  return res.status(200).json(record);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const record = await WeaponDispatchClientService.create(req.body, companyId);
  return res.status(200).json(record);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await WeaponDispatchClientService.update(id, req.body, companyId);
  return res.status(200).json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;

  await WeaponDispatchClientService.remove(id, companyId);
  return res.status(200).json({ message: "WeaponDispatchClient deleted" });
};

// Grava a senha do gov.br (sempre cifrada, nunca loga o valor em texto
// puro em lugar nenhum). Ver WeaponDispatchClientService.setGovPassword.
export const setGovPassword = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;
  const { password } = req.body;

  await WeaponDispatchClientService.setGovPassword(id, companyId, password);
  return res.status(200).json({ message: "Senha salva" });
};

// Lê a senha do gov.br decifrada — toda chamada aqui vira uma linha de
// auditoria (ver WeaponDispatchClientService.getGovPassword), por isso
// exige `reason` (motivo da consulta) no corpo da requisição.
export const getGovPassword = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;
  const { reason } = req.body;

  const password = await WeaponDispatchClientService.getGovPassword(
    id,
    companyId,
    +req.user.id,
    reason
  );
  return res.status(200).json({ password });
};
