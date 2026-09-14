import FiscalConfig from "../../models/FiscalConfig";

interface FiscalConfigData {
  taxRegime?: string;
  stateRegistration?: string;
  stateRegistrationExempt?: boolean;
  municipalRegistration?: string;
  cnae?: string;
  cityCode?: string;
  gatewayProvider?: string;
  gatewayToken?: string;
  gatewayEnvironment?: string;
  nfeSeries?: string;
  nfceSeries?: string;
  nfseSeries?: string;
  defaultCfop?: string;
  notes?: string;
}

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
