import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureFiscalAccess from "../services/FiscalService/EnsureFiscalAccess";
import * as FiscalConfigService from "../services/FiscalService/FiscalConfigService";
import * as FiscalGatewayService from "../services/FiscalService/FiscalGatewayService";

// Fiscal é um add-on separado do Financeiro (Plan.useFiscal), sempre
// exigindo o Financeiro também ativo — ver EnsureFiscalAccess.
const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureFiscalAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_FISCAL_MODULE_ACCESS", 403);
  }
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const config = await FiscalConfigService.show(companyId);
  return res.status(200).json(FiscalConfigService.maskConfig(config));
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const { config, accountingOfficeSync, discriminaImpostosSync } = await FiscalConfigService.update(req.body, companyId);
  return res
    .status(200)
    .json({ ...FiscalConfigService.maskConfig(config), accountingOfficeSync, discriminaImpostosSync });
};

// Testa a integração com a Resend antes de confiar nela pra mandar nota
// de verdade (v2.3.174, pedido do cliente — tela de referência que ele
// mandou tinha um "Enviar para um destinatário" próprio) — manda um
// e-mail simples, sem anexo, pro endereço informado.
export const testResendEmail = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;
  const { to, subject, message } = req.body;

  const result = await FiscalConfigService.testResendEmail(companyId, to, subject, message);
  return res.status(200).json(result);
};

// Lista os gateways de emissão suportados, pra tela de Configuração Fiscal
// montar o seletor sem hardcodar as opções no frontend.
export const gateways = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  return res.status(200).json(FiscalGatewayService.SUPPORTED_GATEWAYS);
};
