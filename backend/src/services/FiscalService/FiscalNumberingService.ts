import AppError from "../../errors/AppError";
import * as FiscalConfigService from "./FiscalConfigService";
import * as FiscalGatewayService from "./FiscalGatewayService";

// Inutilização de numeração de NF-e — formaliza junto à Sefaz que uma faixa
// de números NUNCA foi usada (ex.: erro de sistema pulou um número). Não
// está ligado a nenhuma venda/FiscalDocument — é um recurso de nível
// empresa+série. Ver docs/MANUAL_TECNICO.md.
export const invalidate = async (
  data: { series: string; numberStart: number; numberEnd: number; justification: string },
  companyId: number
): Promise<{ ok: boolean; errorMessage: string; raw: unknown }> => {
  const { series, numberStart, numberEnd, justification } = data;

  if (!series) {
    throw new AppError("ERR_FISCAL_NUMBERING_SERIES_REQUIRED");
  }
  if (!numberStart || !numberEnd || numberEnd < numberStart) {
    throw new AppError("ERR_FISCAL_NUMBERING_RANGE_INVALID");
  }
  if (!justification || justification.trim().length < 15) {
    throw new AppError("ERR_FISCAL_NUMBERING_JUSTIFICATION_TOO_SHORT");
  }

  const config = await FiscalConfigService.show(companyId);
  if (!FiscalConfigService.getActiveGatewayToken(config)) {
    throw new AppError("ERR_FISCAL_GATEWAY_NOT_CONFIGURED");
  }

  const gateway = FiscalGatewayService.getGateway(config.gatewayProvider);
  const fn = FiscalGatewayService.requireFeature(gateway, "invalidateNumbering");
  return fn(series, numberStart, numberEnd, justification, config);
};

export const list = async (companyId: number): Promise<unknown[]> => {
  const config = await FiscalConfigService.show(companyId);
  if (!FiscalConfigService.getActiveGatewayToken(config)) {
    return [];
  }

  const gateway = FiscalGatewayService.getGateway(config.gatewayProvider);
  const fn = FiscalGatewayService.requireFeature(gateway, "listInvalidations");
  return fn(config);
};
