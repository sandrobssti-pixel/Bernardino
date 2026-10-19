import FinancePaymentConfig from "../../models/FinancePaymentConfig";

interface FinancePaymentConfigData {
  mercadoPagoAccessTokenSandbox?: string;
  mercadoPagoAccessTokenProduction?: string;
  mercadoPagoWebhookSecret?: string;
  productionEnabled?: boolean;
  pixExpirationMinutes?: number;
  provider?: string;
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
// FiscalConfigService.isProductionActive/getActiveGatewayToken.
export const isProductionActive = (config: FinancePaymentConfig): boolean =>
  !!config.productionEnabled;

export const getActiveMercadoPagoToken = (config: FinancePaymentConfig): string =>
  isProductionActive(config)
    ? config.mercadoPagoAccessTokenProduction
    : config.mercadoPagoAccessTokenSandbox;

export const getActiveAsaasApiKey = (config: FinancePaymentConfig): string =>
  isProductionActive(config) ? config.asaasApiKeyProduction : config.asaasApiKeySandbox;
