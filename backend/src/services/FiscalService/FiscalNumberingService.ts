import AppError from "../../errors/AppError";
import FiscalNumberingInvalidation from "../../models/FiscalNumberingInvalidation";
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
  const result = await fn(series, numberStart, numberEnd, justification, config);

  // Só grava quando o gateway confirma — "não desce inutilizações
  // registrada" (v2.3.119) era porque a listagem dependia só de
  // `GET /v2/nfe/inutilizacoes` na Focus NFe (endpoint reconstruído por
  // conhecimento geral, nunca confirmado contra a doc oficial — ver
  // FocusNFeService.ts), que na prática não devolvia nada. Agora a lista
  // vem do nosso próprio banco, igual já é feito pro FiscalDocument.
  if (result.ok) {
    const raw = (result as any).raw;
    await FiscalNumberingInvalidation.create({
      series,
      numberStart,
      numberEnd,
      justification,
      protocol: String((raw as any)?.numero_protocolo || (raw as any)?.protocolo || ""),
      status: String((raw as any)?.status || "ok"),
      environment: FiscalConfigService.isProductionActive(config) ? "production" : "sandbox",
      raw: raw || null,
      companyId
    } as any);
  }

  return result;
};

export const list = async (companyId: number): Promise<FiscalNumberingInvalidation[]> =>
  FiscalNumberingInvalidation.findAll({
    where: { companyId },
    order: [["createdAt", "DESC"]]
  });
