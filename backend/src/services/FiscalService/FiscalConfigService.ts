import FiscalConfig from "../../models/FiscalConfig";

interface FiscalConfigData {
  taxRegime?: string;
  stateRegistration?: string;
  stateRegistrationExempt?: boolean;
  municipalRegistration?: string;
  cnae?: string;
  cityCode?: string;
  gatewayProvider?: string;
  gatewayTokenSandbox?: string;
  gatewayTokenProduction?: string;
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
): Promise<FiscalConfig> => {
  const config = await show(companyId);
  await config.update(data);
  return config;
};
