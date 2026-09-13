import { Request, Response } from "express";
import AppError from "../errors/AppError";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import ShowWhatsAppServiceAdmin from "../services/WhatsappService/ShowWhatsAppServiceAdmin";
import {
  consumeCredentialImportToken,
  createCredentialImportToken,
  importBaileysCredentials
} from "../services/BaileysServices/ImportBaileysCredentialsService";

const PUBLIC_IMPORT_PATH = "/public/whatsapp/credentials-import";

const getAuthorizedWhatsapp = async (
  whatsappId: string,
  companyId: number,
  isSuper?: boolean
) => {
  if (isSuper) {
    return ShowWhatsAppServiceAdmin(whatsappId);
  }

  return ShowWhatsAppService(whatsappId, companyId);
};

const buildImportEndpoint = (req: Request): string => {
  const configuredBaseUrl = String(process.env.BACKEND_URL || "")
    .trim()
    .replace(/\/+$/, "");

  if (configuredBaseUrl) {
    return `${configuredBaseUrl}${PUBLIC_IMPORT_PATH}`;
  }

  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host") || "";
  return host ? `${protocol}://${host}${PUBLIC_IMPORT_PATH}` : PUBLIC_IMPORT_PATH;
};

export const createToken = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId, id: userId, super: isSuper } = req.user;

  const whatsapp = await getAuthorizedWhatsapp(whatsappId, companyId, isSuper);
  const { token, expiresInSeconds } = await createCredentialImportToken(
    whatsapp,
    Number(userId)
  );

  return res.status(200).json({
    endpoint: buildImportEndpoint(req),
    token,
    expiresInSeconds,
    authHeaderHint: "Cole apenas o token no campo de auth da extensão."
  });
};

export const importManual = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId, super: isSuper } = req.user;
  const payload = req.body?.payload;

  if (!payload) {
    throw new AppError("Nenhum JSON de credenciais foi informado.", 400);
  }

  const whatsapp = await getAuthorizedWhatsapp(whatsappId, companyId, isSuper);
  const result = await importBaileysCredentials(whatsapp, payload);

  return res.status(200).json({
    message: "Credenciais importadas com sucesso. A conexão foi reiniciada.",
    meJid: result.meJid
  });
};

export const importPublic = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const authorization = String(req.headers.authorization || "").trim();
  const importToken = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : authorization || String(req.headers["x-import-token"] || "").trim();

  const tokenPayload = await consumeCredentialImportToken(importToken);
  const whatsapp = await ShowWhatsAppService(
    tokenPayload.whatsappId,
    tokenPayload.companyId
  );

  const result = await importBaileysCredentials(whatsapp, req.body);

  return res.status(200).json({
    ok: true,
    message: "Credenciais recebidas. A conexão está sendo inicializada.",
    meJid: result.meJid
  });
};
