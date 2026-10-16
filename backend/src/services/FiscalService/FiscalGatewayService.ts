import Sale from "../../models/Sale";
import Company from "../../models/Company";
import FiscalConfig from "../../models/FiscalConfig";
import AppError from "../../errors/AppError";
import * as FocusNFeService from "./FocusNFeService";
import { FocusEmitResult } from "./FocusNFeService";

// Dispatcher de gateway de emissão fiscal — pedido do cliente pra poder
// ESCOLHER o gateway em vez de ficar travado num só (FiscalConfig.gatewayProvider
// já existia desde a Fase 3, mas nada usava de verdade além de "focusnfe"
// hardcoded). Ver docs/MANUAL_TECNICO.md.
//
// Pra adicionar um gateway novo: criar um arquivo com as mesmas três
// funções (emit/getStatus/cancel, mesma assinatura de FocusNFeService),
// registrar aqui em `GATEWAYS` e em `SUPPORTED_GATEWAYS` — nenhum outro
// lugar do sistema precisa mudar (FiscalDocumentService já chama só por
// `getGateway(config.gatewayProvider)`).
export interface FiscalGatewayAdapter {
  emit(
    type: string,
    sale: Sale,
    company: Company,
    config: FiscalConfig
  ): Promise<{ externalRef: string; result: FocusEmitResult }>;
  getStatus(type: string, externalRef: string, config: FiscalConfig): Promise<FocusEmitResult>;
  cancel(
    type: string,
    externalRef: string,
    justification: string,
    config: FiscalConfig
  ): Promise<{ ok: boolean; errorMessage: string }>;
  // As cinco abaixo são opcionais — nem todo gateway tem equivalente pra
  // cada uma (ex.: carta de correção só existe no modelo de NF-e). Quem
  // chama precisa checar se o método existe antes de usar
  // (`gateway.sendByEmail?.(...)`) e tratar a ausência como
  // ERR_FISCAL_FEATURE_NOT_SUPPORTED_BY_GATEWAY.
  emitCorrectionLetter?(
    type: string,
    externalRef: string,
    correctionText: string,
    config: FiscalConfig
  ): Promise<{ ok: boolean; errorMessage: string }>;
  sendByEmail?(
    type: string,
    externalRef: string,
    emails: string[],
    config: FiscalConfig
  ): Promise<{ ok: boolean; errorMessage: string }>;
  previewDanfe?(
    sale: Sale,
    company: Company,
    config: FiscalConfig
  ): Promise<{ ok: boolean; pdf: Buffer | null; errorMessage: string }>;
  invalidateNumbering?(
    series: string,
    numberStart: number,
    numberEnd: number,
    justification: string,
    config: FiscalConfig
  ): Promise<{ ok: boolean; errorMessage: string; raw: unknown }>;
  listInvalidations?(config: FiscalConfig): Promise<unknown[]>;
}

const GATEWAYS: Record<string, FiscalGatewayAdapter> = {
  focusnfe: FocusNFeService
};

// Exposto também pro frontend (GET /fiscal/gateways) montar o seletor sem
// precisar hardcodar a lista lá — qualquer gateway novo registrado aqui já
// aparece na tela sem mudança nenhuma de frontend.
export const SUPPORTED_GATEWAYS = [{ value: "focusnfe", label: "Focus NFe" }];

export const getGateway = (provider: string): FiscalGatewayAdapter => {
  const gateway = GATEWAYS[provider];
  if (!gateway) {
    throw new AppError("ERR_FISCAL_GATEWAY_NOT_SUPPORTED");
  }
  return gateway;
};

// Helper pros métodos opcionais da interface acima — lança um erro padrão
// em vez de cada service repetir o mesmo `if (!gateway.x) throw ...`.
export function requireFeature<K extends keyof FiscalGatewayAdapter>(
  gateway: FiscalGatewayAdapter,
  feature: K
): NonNullable<FiscalGatewayAdapter[K]> {
  const fn = gateway[feature];
  if (!fn) {
    throw new AppError("ERR_FISCAL_FEATURE_NOT_SUPPORTED_BY_GATEWAY");
  }
  return fn as NonNullable<FiscalGatewayAdapter[K]>;
}
