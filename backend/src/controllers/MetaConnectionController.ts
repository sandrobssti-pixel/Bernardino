import { randomBytes } from "crypto";
import { Request, Response } from "express";
import * as Yup from "yup";
import AppError from "../errors/AppError";
import MetaConnection from "../models/MetaConnection";
import Prompt from "../models/Prompt";
import SyncMetaConnectionRuntimeService, {
  RemoveMetaConnectionRuntimeService
} from "../services/MetaConnectionServices/SyncMetaConnectionRuntimeService";

const allowedChannels = ["facebook", "instagram", "meta"] as const;

const buildCallbackUrl = (id: number | string): string => {
  const baseUrl = String(process.env.BACKEND_URL || "").trim().replace(/\/+$/, "");
  return baseUrl ? `${baseUrl}/webhook/meta/${id}` : `/webhook/meta/${id}`;
};

const generateVerifyToken = (): string => randomBytes(18).toString("hex");

const ensureConnectionsPermission = (req: Request): void => {
  const { profile, allowConnections } = req.user as any;

  if (profile !== "admin" && allowConnections === "disabled") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
};

const serializeConnection = (connection: MetaConnection) => {
  const raw = connection.toJSON() as Record<string, any>;
  return {
    ...raw,
    callbackUrl: buildCallbackUrl(connection.id)
  };
};

// Agente de IA da conexão: aceita vazio/null (desliga a IA) ou o id de um
// prompt da própria empresa.
const resolvePromptId = async (
  value: unknown,
  companyId: number
): Promise<number | null> => {
  if (value === undefined || value === null || value === "") return null;

  const promptId = Number(value);
  if (!Number.isInteger(promptId) || promptId <= 0) {
    throw new AppError("ERR_META_CONNECTION_INVALID_PROMPT", 400);
  }

  const prompt = await Prompt.findOne({ where: { id: promptId, companyId } });
  if (!prompt) {
    throw new AppError("ERR_META_CONNECTION_INVALID_PROMPT", 400);
  }

  return promptId;
};

const upsertSchema = Yup.object().shape({
  channel: Yup.string()
    .oneOf([...allowedChannels])
    .required(),
  name: Yup.string().min(2).max(100).required(),
  appId: Yup.string().nullable(),
  appSecret: Yup.string().nullable(),
  verifyToken: Yup.string().min(6).nullable(),
  pageId: Yup.string().nullable(),
  pageAccessToken: Yup.string().nullable(),
  instagramBusinessAccountId: Yup.string().nullable(),
  businessId: Yup.string().nullable(),
  status: Yup.string().nullable(),
  isActive: Yup.boolean().nullable(),
  metadata: Yup.object().nullable()
});

export const index = async (req: Request, res: Response): Promise<Response> => {
  ensureConnectionsPermission(req);
  const { companyId } = req.user;

  const connections = await MetaConnection.findAll({
    where: { companyId },
    order: [["updatedAt", "DESC"], ["id", "DESC"]]
  });

  return res.status(200).json(connections.map(serializeConnection));
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  ensureConnectionsPermission(req);
  const { companyId } = req.user;
  const payload = {
    ...req.body,
    verifyToken: req.body?.verifyToken || generateVerifyToken(),
    promptId: await resolvePromptId(req.body?.promptId, companyId),
    companyId
  };

  try {
    await upsertSchema.validate(payload);
  } catch (error: any) {
    throw new AppError(error.message, 400);
  }

  const duplicate = await MetaConnection.findOne({
    where: {
      companyId,
      name: payload.name
    }
  });

  if (duplicate) {
    throw new AppError("Já existe uma conexão Meta com esse nome nesta empresa.", 409);
  }

  const connection = await MetaConnection.create(payload);
  await SyncMetaConnectionRuntimeService(connection);
  return res.status(201).json(serializeConnection(connection));
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  ensureConnectionsPermission(req);
  const { companyId } = req.user;
  const { metaConnectionId } = req.params;

  const connection = await MetaConnection.findOne({
    where: { id: metaConnectionId, companyId }
  });

  if (!connection) {
    throw new AppError("ERR_META_CONNECTION_NOT_FOUND", 404);
  }

  return res.status(200).json(serializeConnection(connection));
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  ensureConnectionsPermission(req);
  const { companyId } = req.user;
  const { metaConnectionId } = req.params;

  const connection = await MetaConnection.findOne({
    where: { id: metaConnectionId, companyId }
  });

  if (!connection) {
    throw new AppError("ERR_META_CONNECTION_NOT_FOUND", 404);
  }

  const payload = {
    ...req.body,
    verifyToken: req.body?.verifyToken || connection.verifyToken || generateVerifyToken(),
    promptId:
      req.body?.promptId === undefined
        ? connection.promptId ?? null
        : await resolvePromptId(req.body.promptId, companyId)
  };

  try {
    await upsertSchema.validate(payload);
  } catch (error: any) {
    throw new AppError(error.message, 400);
  }

  const duplicate = await MetaConnection.findOne({
    where: {
      companyId,
      name: payload.name
    }
  });

  if (duplicate && duplicate.id !== connection.id) {
    throw new AppError("Já existe uma conexão Meta com esse nome nesta empresa.", 409);
  }

  await connection.update(payload);
  await SyncMetaConnectionRuntimeService(connection);
  return res.status(200).json(serializeConnection(connection));
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  ensureConnectionsPermission(req);
  const { companyId } = req.user;
  const { metaConnectionId } = req.params;

  const connection = await MetaConnection.findOne({
    where: { id: metaConnectionId, companyId }
  });

  if (!connection) {
    throw new AppError("ERR_META_CONNECTION_NOT_FOUND", 404);
  }

  await RemoveMetaConnectionRuntimeService(connection);
  await connection.destroy();
  return res.status(200).json({ message: "Meta connection deleted." });
};
