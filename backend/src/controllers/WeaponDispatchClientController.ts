import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureWeaponDispatchAccess from "../services/WeaponDispatchService/EnsureWeaponDispatchAccess";
import * as WeaponDispatchClientService from "../services/WeaponDispatchService/WeaponDispatchClientService";
import WeaponDispatchClient from "../models/WeaponDispatchClient";

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

// Foto do cliente — `weaponDispatchPhotoUpload` (multer) já grava o arquivo
// em disco antes de chegar aqui; só falta confirmar que o cliente é desta
// empresa e gravar o caminho público. `encodeURIComponent` no nome do
// arquivo ao montar a URL — nome pode ter acento/espaço (só sanitizado,
// não removido, no multer), e sem isso um link com caractere assim quebra
// na hora de abrir (mesma lição já registrada pra mídia de mensagem, ver
// Message.ts/mediaUrl e docs/MANUAL_TECNICO.md seção 79).
export const uploadPhoto = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { id } = req.params;
  const file = req.file as Express.Multer.File | undefined;

  if (!file) {
    throw new AppError("ERR_WEAPON_DISPATCH_CLIENT_NO_PHOTO_SENT", 400);
  }

  const record = await WeaponDispatchClient.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_WEAPON_DISPATCH_CLIENT_NOT_FOUND", 404);
  }

  const photoUrl = `${process.env.BACKEND_URL}/public/company${companyId}/weapon-dispatch-photos/${encodeURIComponent(
    file.filename
  )}`;
  await record.update({ photoUrl });

  return res.status(200).json({ photoUrl });
};
