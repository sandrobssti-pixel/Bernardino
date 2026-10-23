import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import FiscalConfig from "../../models/FiscalConfig";
import * as FocusAccountService from "./FocusAccountService";
import * as ResendEmailService from "./ResendEmailService";

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
  emitterEmail?: string;
  emitterLegalName?: string;
  gatewayProvider?: string;
  gatewayTokenSandbox?: string;
  gatewayTokenProduction?: string;
  accountingOfficeDocument?: string;
  discriminaImpostos?: boolean;
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
  resendEnabled?: boolean;
  resendApiKey?: string;
  resendFromEmail?: string;
  resendFromName?: string;
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
): Promise<{
  config: FiscalConfig;
  accountingOfficeSync: { ok: boolean; errorMessage: string } | null;
  discriminaImpostosSync: { ok: boolean; errorMessage: string } | null;
}> => {
  const config = await show(companyId);
  const previousAccountingOfficeDocument = config.accountingOfficeDocument;
  const previousDiscriminaImpostos = config.discriminaImpostos;

  // "Deixe vazio para manter" (v2.3.174, tela de Configuração Fiscal) —
  // a API key da Resend nunca volta pro frontend em texto puro (ver
  // `maskConfig`, FiscalConfigController.ts), então o campo sempre chega
  // vazio no formulário quando já tem uma salva; se o usuário não mexeu
  // nele, salvar a tela inteira não pode apagar a chave que já existia.
  const payload = { ...data };
  if (!payload.resendApiKey) {
    delete payload.resendApiKey;
  }

  await config.update(payload);

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

  let discriminaImpostosSync: { ok: boolean; errorMessage: string } | null = null;
  if (
    data.discriminaImpostos !== undefined &&
    data.discriminaImpostos !== previousDiscriminaImpostos
  ) {
    discriminaImpostosSync = await FocusAccountService.updateDiscriminaImpostos(config, data.discriminaImpostos);
  }

  return { config, accountingOfficeSync, discriminaImpostosSync };
};

// Nunca manda a API key da Resend de volta pro frontend em texto puro
// (diferente do que já acontecia com `gatewayTokenSandbox`/
// `gatewayTokenProduction`, que seguem indo inteiros — não mexi nesses
// dois, só na chave nova) — `resendApiKeyConfigured` avisa a tela que já
// tem uma chave salva, sem expor o valor. Usado só pelo CONTROLLER
// (FiscalConfigController.ts); `show()`/`update()` acima continuam
// devolvendo o model de verdade, com a chave real, pro resto do backend
// (ResendEmailService etc.) usar.
export const maskConfig = (config: FiscalConfig): Record<string, unknown> => ({
  ...config.toJSON(),
  resendApiKey: "",
  resendApiKeyConfigured: !!config.resendApiKey
});

// "Enviar para um destinatário" (v2.3.174) — testa a integração Resend
// antes de confiar nela numa nota de verdade. Usa a chave JÁ SALVA
// (`show`, nunca a que vier do formulário — o campo chega sempre vazio
// pro frontend, ver `maskConfig`), então exige ter salvo a configuração
// antes de testar.
export const testResendEmail = async (
  companyId: number,
  to: string,
  subject: string,
  message: string
): Promise<{ ok: boolean; errorMessage: string }> => {
  if (!to || !to.trim()) {
    throw new AppError("ERR_RESEND_TEST_EMAIL_REQUIRED");
  }

  const config = await show(companyId);
  if (!config.resendApiKey) {
    throw new AppError("ERR_RESEND_API_KEY_NOT_CONFIGURED");
  }

  const company = await Company.findByPk(companyId);
  return ResendEmailService.sendTestEmail(
    config,
    company?.name || "",
    to.trim(),
    subject || "Teste de integração Resend — AtendeFlow",
    message || "Este é um e-mail de teste da integração com a Resend."
  );
};
