import FinancePaymentConfig from "../../models/FinancePaymentConfig";

interface FinancePaymentConfigData {
  mercadoPagoAccessTokenSandbox?: string;
  mercadoPagoAccessTokenProduction?: string;
  mercadoPagoWebhookSecret?: string;
  pixExpirationMinutes?: number;
  mercadoPagoEnabled?: boolean;
  asaasEnabled?: boolean;
  mercadoPagoProductionEnabled?: boolean;
  asaasProductionEnabled?: boolean;
  asaasApiKeySandbox?: string;
  asaasApiKeyProduction?: string;
  asaasWebhookToken?: string;
}

// Um registro de configuração de cobrança por empresa — get/upsert simples,
// mesmo padrão de FiscalConfigService.show/update.
export const show = async (companyId: number): Promise<FinancePaymentConfig> => {
  const [config] = await FinancePaymentConfig.findOrCreate({
    where: { companyId },
    defaults: { companyId } as any
  });
  return config;
};

export const update = async (
  data: FinancePaymentConfigData,
  companyId: number
): Promise<FinancePaymentConfig> => {
  const config = await show(companyId);
  await config.update(data);
  return config;
};

// Produção ligada tem prioridade sobre Homologação — mesmo critério de
// FiscalConfigService.isProductionActive/getActiveGatewayToken, mas agora
// independente por gateway (v2.3.158 — "separa eles como um todo"): o
// painel de cada banco tem o próprio botão "Produção", sem afetar o outro.
export const isMercadoPagoProductionActive = (config: FinancePaymentConfig): boolean =>
  !!config.mercadoPagoProductionEnabled;

export const isAsaasProductionActive = (config: FinancePaymentConfig): boolean =>
  !!config.asaasProductionEnabled;

export const getActiveMercadoPagoToken = (config: FinancePaymentConfig): string =>
  isMercadoPagoProductionActive(config)
    ? config.mercadoPagoAccessTokenProduction
    : config.mercadoPagoAccessTokenSandbox;

export const getActiveAsaasApiKey = (config: FinancePaymentConfig): string =>
  isAsaasProductionActive(config) ? config.asaasApiKeyProduction : config.asaasApiKeySandbox;
