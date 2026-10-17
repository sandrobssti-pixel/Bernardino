import FiscalConfig from "../../models/FiscalConfig";
import * as FocusAccountService from "./FocusAccountService";

interface FiscalConfigData {
  taxRegime?: string;
  stateRegistration?: string;
  stateRegistrationExempt?: boolean;
  municipalRegistration?: string;
  cnae?: string;
  cityCode?: string;
  emitterZipCode?: string;
  emitterStreet?: string;
  emitterNumber?: string;
  emitterComplement?: string;
  emitterNeighborhood?: string;
  emitterCity?: string;
  emitterState?: string;
  emitterPhone?: string;
  gatewayProvider?: string;
  gatewayTokenSandbox?: string;
  gatewayTokenProduction?: string;
  accountingOfficeDocument?: string;
  focusAccountToken?: string;
  focusCompanyId?: string;
  sandboxEnabled?: boolean;
  productionEnabled?: boolean;
  nfeSeries?: string;
  nfceSeries?: string;
  nfseSeries?: string;
  defaultDocumentType?: string;
  defaultCfop?: string;
  notes?: string;
  reform2027Enabled?: boolean;
}

// Pedido do cliente (v2.3.112): tirar o seletor separado "Ambiente ativo" —
// só os dois cartões Homologação/Produção, cada um com seu próprio
// liga/desliga. Qual dos dois está "ativo" pra emitir é derivado direto
// dos toggles, sem precisar de um terceiro campo pra guardar essa escolha:
// Produção ligada tem prioridade (é a opção "de verdade", e bate com o
// fluxo que o cliente descreveu — testa em Homologação, quando valida
// passa a usar Produção). Se só Homologação estiver ligada, usa ela. Se
// nenhuma estiver ligada, não tem token nenhum (tratado como gateway não
// configurado pelos callers).
export const isProductionActive = (config: FiscalConfig): boolean => !!config.productionEnabled;

// Qual das duas credenciais (Homologação/Produção) está ativa AGORA, pra
// quem só precisa saber "o token que vale neste momento" sem checar os
// dois campos/toggle na mão (FiscalDocumentService, FiscalNumberingService,
// SaleController, FocusNFeService).
export const getActiveGatewayToken = (config: FiscalConfig): string =>
  isProductionActive(config) ? config.gatewayTokenProduction : config.gatewayTokenSandbox;

// Um registro de configuração fiscal por empresa — get/upsert simples (não é
// um CRUD de lista como os outros cadastros do Financeiro), ver
// docs/MANUAL_TECNICO.md, seção 6.2.
export const show = async (companyId: number): Promise<FiscalConfig> => {
  const [config] = await FiscalConfig.findOrCreate({
    where: { companyId },
    defaults: { companyId } as any
  });
  return config;
};

export const update = async (
  data: FiscalConfigData,
  companyId: number
): Promise<{ config: FiscalConfig; accountingOfficeSync: { ok: boolean; errorMessage: string } | null }> => {
  const config = await show(companyId);
  const previousAccountingOfficeDocument = config.accountingOfficeDocument;
  await config.update(data);

  // Sincroniza com a Focus só quando o campo muda de verdade (não a cada
  // salvamento da tela inteira) — nunca deixa falha de sincronização
  // impedir o salvamento da config local (mesmo padrão já usado pra não
  // deixar o módulo fiscal travar o resto do sistema).
  let accountingOfficeSync: { ok: boolean; errorMessage: string } | null = null;
  if (
    data.accountingOfficeDocument !== undefined &&
    data.accountingOfficeDocument !== previousAccountingOfficeDocument
  ) {
    accountingOfficeSync = await FocusAccountService.updateAccountingOffice(config, data.accountingOfficeDocument);
  }

  return { config, accountingOfficeSync };
};
