import AppError from "../../errors/AppError";
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
  gatewayEnvironment?: string;
  nfeSeries?: string;
  nfceSeries?: string;
  nfseSeries?: string;
  defaultDocumentType?: string;
  defaultCfop?: string;
  notes?: string;
}

// Qual das duas credenciais (Homologação/Produção) está ativa AGORA, pra
// quem só precisa saber "o token que vale neste momento" sem checar os
// dois campos/toggle na mão (FiscalDocumentService, FiscalNumberingService,
// SaleController, FocusNFeService).
export const getActiveGatewayToken = (config: FiscalConfig): string =>
  config.gatewayEnvironment === "production" ? config.gatewayTokenProduction : config.gatewayTokenSandbox;

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

  // Nunca deixa o "ambiente ativo" apontar pra um ambiente que está sendo
  // desligado nessa mesma atualização (ex.: desativar Produção sem trocar
  // o seletor de volta pra Homologação) — teria o efeito prático de
  // "emitir sem token nenhum" sem nenhum aviso claro do motivo. Calculado
  // ANTES de salvar, com os valores já mesclados (o que não veio em
  // `data` mantém o que já estava salvo).
  const environment = (data.gatewayEnvironment ?? config.gatewayEnvironment) === "production" ? "production" : "sandbox";
  const enabled = environment === "production" ? (data.productionEnabled ?? config.productionEnabled) : (data.sandboxEnabled ?? config.sandboxEnabled);
  if (!enabled) {
    throw new AppError("ERR_FISCAL_ENVIRONMENT_NOT_ENABLED");
  }

  await config.update(data);
  return config;
};
