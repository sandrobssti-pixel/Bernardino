// ARQUIVO: backend/src/helpers/GetGlobalConfig.ts

import { isNil } from "lodash";
import Company from "../models/Company";
import Setting from "../models/Setting";

export interface GlobalConfig {
  mpAccessToken: string;
  paymentGateway: string;
  asaasApiKey: string;
  asaasWebhookSecret: string;
  efiClientId: string;
  efiClientSecret: string;
  efiCertificate: string;
  efiCertificatePassphrase: string;
  efiPixKey: string;
  efiSandbox: boolean;
  pushinPayToken: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: string;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  welcomeEmailEnabled: string;
  welcomeWhatsappEnabled: string;
  welcomeEmailSubject: string;
  welcomeEmailTemplate: string;
  trialExpiration: string;

  // 🔹 NOVOS CAMPOS PARA LOGIN / BRANDING
  loginLogo: string;
  loginBackground: string;
  loginWhatsapp: string;
  hasMasterAccessPassword: boolean;
  wuzapiBaseUrl: string;
  wuzapiAdminToken: string;
  wuzapiDbPassword: string;
  wuzapiConfigFile: string;
  billingDueEmailEnabled: string;
  billingDueWhatsappEnabled: string;
  billingDueDaysBefore: string;
  billingDueEmailSubject: string;
  billingDueEmailTemplate: string;
  billingDueWhatsappTemplate: string;
  billingOverdueEmailEnabled: string;
  billingOverdueWhatsappEnabled: string;
  billingOverdueIntervalDays: string;
  billingOverdueEmailSubject: string;
  billingOverdueEmailTemplate: string;
  billingOverdueWhatsappTemplate: string;
  channelWhatsappBaileysEnabled: string;
  channelWhatsappWuzapiEnabled: string;
  channelWhatsappOfficialEnabled: string;
  channelFacebookEnabled: string;
  channelInstagramEnabled: string;
  channelWebchatEnabled: string;
  signupRequireCpfCnpj: string;
}

/**
 * Lê configurações globais da plataforma.
 *
 * Prioridade:
 * 1) Campos gravados na Company (normalmente companyId = 1, conta principal)
 * 2) Settings (APP_TRIALEXPIRATION + LOGIN_*_URL)
 * 3) Variáveis de ambiente (.env)
 */
const GetGlobalConfig = async (companyId?: number): Promise<GlobalConfig> => {
  // 1) Valores base vindos do .env
  let config: GlobalConfig = {
    mpAccessToken: process.env.MP_ACCESS_TOKEN || "",
    paymentGateway: process.env.PAYMENT_GATEWAY || "mercadopago",
    asaasApiKey: process.env.ASAAS_API_KEY || "",
    asaasWebhookSecret: process.env.ASAAS_WEBHOOK_SECRET || "",
    efiClientId: process.env.EFI_CLIENT_ID || "",
    efiClientSecret: process.env.EFI_CLIENT_SECRET || "",
    efiCertificate: process.env.EFI_CERTIFICATE || "",
    efiCertificatePassphrase: process.env.EFI_CERTIFICATE_PASSPHRASE || "",
    efiPixKey: process.env.EFI_PIX_KEY || "",
    efiSandbox: String(process.env.EFI_SANDBOX || "false").toLowerCase() === "true",
    pushinPayToken: process.env.PUSHINPAY_TOKEN || "",
    smtpHost: process.env.MAIL_HOST || "",
    smtpPort: process.env.MAIL_PORT || "",
    smtpSecure: process.env.MAIL_SECURE || "false",
    smtpUser: process.env.MAIL_USER || "",
    smtpPass: process.env.MAIL_PASS || "",
    smtpFrom: process.env.MAIL_FROM || "",
    welcomeEmailEnabled: "disabled",
    welcomeWhatsappEnabled: "enabled",
    welcomeEmailSubject: "Bem-vindo(a) à {companyName} | Seus acessos",
    welcomeEmailTemplate:
      "<div style='font-family:Arial,Helvetica,sans-serif;background:#f4f6fb;padding:24px'><table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb'><tr><td style='background:linear-gradient(135deg,#0f4c81,#136f63);padding:22px 24px;color:#ffffff'><h1 style='margin:0;font-size:20px'>Bem-vindo(a), {name}!</h1><p style='margin:8px 0 0;font-size:13px;opacity:.92'>Seu acesso foi liberado com sucesso.</p></td></tr><tr><td style='padding:24px'><p style='margin:0 0 14px;color:#1f2937;font-size:14px'>Olá, {name}. Abaixo estão os dados iniciais da sua conta:</p><table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px'><tr><td style='padding:14px 16px;color:#111827;font-size:14px;line-height:1.6'><strong>Empresa:</strong> {companyName}<br/><strong>E-mail:</strong> {email}<br/><strong>Senha provisória:</strong> {password}<br/><strong>Vencimento:</strong> {dueDate}</td></tr></table><p style='margin:16px 0 0;color:#374151;font-size:14px'>Acesse: <a href='{loginUrl}' style='color:#0f4c81;text-decoration:none'>{loginUrl}</a></p><p style='margin:18px 0 0;color:#6b7280;font-size:12px'>Por segurança, recomendamos alterar sua senha no primeiro acesso.</p></td></tr><tr><td style='padding:14px 24px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:11px'>Este é um e-mail automático da plataforma {companyName}.</td></tr></table></div>",
    trialExpiration: process.env.APP_TRIALEXPIRATION || "3",

    // defaults vazios, frontend faz fallback (/logo.png, capa padrão, etc.)
    loginLogo: "",
    loginBackground: "",
    loginWhatsapp: "",
    hasMasterAccessPassword: false,
    wuzapiBaseUrl: process.env.WUZAPI_BASE_URL || "",
    wuzapiAdminToken: process.env.WUZAPI_ADMIN_TOKEN || "",
    wuzapiDbPassword: process.env.WUZAPI_DB_PASSWORD || "",
    wuzapiConfigFile: process.env.WUZAPI_CONFIG_FILE || "",
    billingDueEmailEnabled: "disabled",
    billingDueWhatsappEnabled: "disabled",
    billingDueDaysBefore: "3",
    billingDueEmailSubject: "Lembrete: vencimento em {daysToDue} dia(s) - {companyName}",
    billingDueEmailTemplate:
      "<p>Olá, {companyName}.</p><p>Seu vencimento será em <strong>{daysToDue} dia(s)</strong> ({dueDate}).</p><p>Valor atual: <strong>{invoiceValue}</strong>.</p><p>Link da fatura: <a href='{invoiceLink}'>{invoiceLink}</a></p>",
    billingDueWhatsappTemplate:
      "Olá, {companyName}! Lembrete: sua fatura vence em {daysToDue} dia(s), na data {dueDate}. Valor: {invoiceValue}. Link: {invoiceLink}",
    billingOverdueEmailEnabled: "disabled",
    billingOverdueWhatsappEnabled: "disabled",
    billingOverdueIntervalDays: "3",
    billingOverdueEmailSubject: "Cobrança: fatura vencida - {companyName}",
    billingOverdueEmailTemplate:
      "<p>Olá, {companyName}.</p><p>Sua fatura está vencida há <strong>{daysOverdue} dia(s)</strong>.</p><p>Vencimento: {dueDate}</p><p>Valor: <strong>{invoiceValue}</strong></p><p>Link da fatura: <a href='{invoiceLink}'>{invoiceLink}</a></p>",
    billingOverdueWhatsappTemplate:
      "Olá, {companyName}. Sua fatura está vencida há {daysOverdue} dia(s). Vencimento: {dueDate}. Valor: {invoiceValue}. Link: {invoiceLink}",
    channelWhatsappBaileysEnabled: "enabled",
    channelWhatsappWuzapiEnabled: "enabled",
    channelWhatsappOfficialEnabled: "enabled",
    channelFacebookEnabled: "enabled",
    channelInstagramEnabled: "enabled",
    channelWebchatEnabled: "enabled",
    signupRequireCpfCnpj: "disabled"
  };

  // 2) Sobrescreve com o que estiver salvo na Company (global)
  const companyConfigId = companyId || 1; // normalmente a empresa 1 é a "mãe"
  try {
    const company = await Company.findByPk(companyConfigId);

    if (company) {
      const c: any = company;

      config = {
        ...config,
        mpAccessToken: !isNil(c.mpAccessToken)
          ? String(c.mpAccessToken)
          : config.mpAccessToken,
        paymentGateway:
          !isNil(c.paymentGateway) && String(c.paymentGateway).trim().length > 0
            ? String(c.paymentGateway)
            : config.paymentGateway,
        asaasApiKey: !isNil(c.asaasApiKey)
          ? String(c.asaasApiKey)
          : config.asaasApiKey,
        asaasWebhookSecret: !isNil(c.asaasWebhookSecret)
          ? String(c.asaasWebhookSecret)
          : config.asaasWebhookSecret,
        efiClientId: !isNil(c.efiClientId) ? String(c.efiClientId) : config.efiClientId,
        efiClientSecret: !isNil(c.efiClientSecret)
          ? String(c.efiClientSecret)
          : config.efiClientSecret,
        efiCertificate: !isNil(c.efiCertificate)
          ? String(c.efiCertificate)
          : config.efiCertificate,
        efiCertificatePassphrase: !isNil(c.efiCertificatePassphrase)
          ? String(c.efiCertificatePassphrase)
          : config.efiCertificatePassphrase,
        efiPixKey: !isNil(c.efiPixKey) ? String(c.efiPixKey) : config.efiPixKey,
        efiSandbox: !isNil(c.efiSandbox) ? Boolean(c.efiSandbox) : config.efiSandbox,
        pushinPayToken: !isNil(c.pushinPayToken)
          ? String(c.pushinPayToken)
          : config.pushinPayToken,
        smtpHost: !isNil(c.smtpHost) ? String(c.smtpHost) : config.smtpHost,
        smtpPort: !isNil(c.smtpPort) ? String(c.smtpPort) : config.smtpPort,
        smtpSecure: !isNil(c.smtpSecure)
          ? String(c.smtpSecure)
          : config.smtpSecure,
        smtpUser: !isNil(c.smtpUser) ? String(c.smtpUser) : config.smtpUser,
        smtpPass: !isNil(c.smtpPass) ? String(c.smtpPass) : config.smtpPass,
        smtpFrom: !isNil(c.smtpFrom) ? String(c.smtpFrom) : config.smtpFrom,

        // lê também trialExpiration salvo na Company, se existir
        trialExpiration: !isNil(c.trialExpiration)
          ? String(c.trialExpiration)
          : config.trialExpiration
      };
    }
  } catch (err) {
    console.warn("[GetGlobalConfig] Erro ao carregar Company:", err);
  }

  // 3) TrialExpiration vindo de Setting, se existir
  try {
    const setting = await Setting.findOne({
      where: { companyId: 1, key: "APP_TRIALEXPIRATION" },
      // 🔑 Pega SEMPRE o mais recente (id/updatedAt maior)
      order: [["updatedAt", "DESC"], ["id", "DESC"]]
    });

    if (setting && !isNil(setting.value)) {
      config.trialExpiration = String(setting.value);
    }
  } catch (err) {
    console.warn(
      "[GetGlobalConfig] Erro ao carregar Setting APP_TRIALEXPIRATION:",
      err
    );
  }

  // 4) 🔹 NOVO: Login logo, background e WhatsApp vindos de Settings
  try {
    const brandingSettings = await Setting.findAll({
      where: {
        companyId: companyConfigId,
        key: [
          "WELCOME_EMAIL_ENABLED",
          "WELCOME_WHATSAPP_ENABLED",
          "WELCOME_EMAIL_SUBJECT",
          "WELCOME_EMAIL_TEMPLATE",
          "LOGIN_LOGO_URL",
          "LOGIN_BACKGROUND_URL",
          "LOGIN_WHATSAPP_URL",
          "SUPER_ADMIN_MASTER_PASSWORD_HASH",
          "WUZAPI_BASE_URL",
          "WUZAPI_ADMIN_TOKEN",
          "WUZAPI_DB_PASSWORD",
          "WUZAPI_CONFIG_FILE",
          "BILLING_DUE_EMAIL_ENABLED",
          "BILLING_DUE_WHATSAPP_ENABLED",
          "BILLING_DUE_DAYS_BEFORE",
          "BILLING_DUE_EMAIL_SUBJECT",
          "BILLING_DUE_EMAIL_TEMPLATE",
          "BILLING_DUE_WHATSAPP_TEMPLATE",
          "BILLING_OVERDUE_EMAIL_ENABLED",
          "BILLING_OVERDUE_WHATSAPP_ENABLED",
          "BILLING_OVERDUE_INTERVAL_DAYS",
          "BILLING_OVERDUE_EMAIL_SUBJECT",
          "BILLING_OVERDUE_EMAIL_TEMPLATE",
          "BILLING_OVERDUE_WHATSAPP_TEMPLATE",
          "CHANNEL_WHATSAPP_BAILEYS_ENABLED",
          "CHANNEL_WHATSAPP_WUZAPI_ENABLED",
          "CHANNEL_WHATSAPP_OFFICIAL_ENABLED",
          "CHANNEL_FACEBOOK_ENABLED",
          "CHANNEL_INSTAGRAM_ENABLED",
          "CHANNEL_WEBCHAT_ENABLED",
          "SIGNUP_REQUIRE_CPFCNPJ"
        ]
      },
      order: [["updatedAt", "ASC"], ["id", "ASC"]]
    });

    const map: Record<string, string> = {};
    brandingSettings.forEach((s: any) => {
      if (!isNil(s.value) && !isNil(s.key)) {
        map[s.key] = String(s.value);
      }
    });

    config = {
      ...config,
      welcomeEmailEnabled: !isNil(map.WELCOME_EMAIL_ENABLED)
        ? map.WELCOME_EMAIL_ENABLED
        : config.welcomeEmailEnabled,
      welcomeWhatsappEnabled: !isNil(map.WELCOME_WHATSAPP_ENABLED)
        ? map.WELCOME_WHATSAPP_ENABLED
        : config.welcomeWhatsappEnabled,
      welcomeEmailSubject: !isNil(map.WELCOME_EMAIL_SUBJECT)
        ? map.WELCOME_EMAIL_SUBJECT
        : config.welcomeEmailSubject,
      welcomeEmailTemplate: !isNil(map.WELCOME_EMAIL_TEMPLATE)
        ? map.WELCOME_EMAIL_TEMPLATE
        : config.welcomeEmailTemplate,
      loginLogo: !isNil(map.LOGIN_LOGO_URL)
        ? map.LOGIN_LOGO_URL
        : config.loginLogo,
      loginBackground: !isNil(map.LOGIN_BACKGROUND_URL)
        ? map.LOGIN_BACKGROUND_URL
        : config.loginBackground,
      loginWhatsapp: !isNil(map.LOGIN_WHATSAPP_URL)
        ? map.LOGIN_WHATSAPP_URL
        : config.loginWhatsapp,
      hasMasterAccessPassword:
        !isNil(map.SUPER_ADMIN_MASTER_PASSWORD_HASH) &&
        String(map.SUPER_ADMIN_MASTER_PASSWORD_HASH).trim().length > 0,
      wuzapiBaseUrl: !isNil(map.WUZAPI_BASE_URL)
        ? map.WUZAPI_BASE_URL
        : config.wuzapiBaseUrl,
      wuzapiAdminToken: !isNil(map.WUZAPI_ADMIN_TOKEN)
        ? map.WUZAPI_ADMIN_TOKEN
        : config.wuzapiAdminToken,
      wuzapiDbPassword: !isNil(map.WUZAPI_DB_PASSWORD)
        ? map.WUZAPI_DB_PASSWORD
        : config.wuzapiDbPassword,
      wuzapiConfigFile: !isNil(map.WUZAPI_CONFIG_FILE)
        ? map.WUZAPI_CONFIG_FILE
        : config.wuzapiConfigFile,
      billingDueEmailEnabled: !isNil(map.BILLING_DUE_EMAIL_ENABLED)
        ? map.BILLING_DUE_EMAIL_ENABLED
        : config.billingDueEmailEnabled,
      billingDueWhatsappEnabled: !isNil(map.BILLING_DUE_WHATSAPP_ENABLED)
        ? map.BILLING_DUE_WHATSAPP_ENABLED
        : config.billingDueWhatsappEnabled,
      billingDueDaysBefore: !isNil(map.BILLING_DUE_DAYS_BEFORE)
        ? map.BILLING_DUE_DAYS_BEFORE
        : config.billingDueDaysBefore,
      billingDueEmailSubject: !isNil(map.BILLING_DUE_EMAIL_SUBJECT)
        ? map.BILLING_DUE_EMAIL_SUBJECT
        : config.billingDueEmailSubject,
      billingDueEmailTemplate: !isNil(map.BILLING_DUE_EMAIL_TEMPLATE)
        ? map.BILLING_DUE_EMAIL_TEMPLATE
        : config.billingDueEmailTemplate,
      billingDueWhatsappTemplate: !isNil(map.BILLING_DUE_WHATSAPP_TEMPLATE)
        ? map.BILLING_DUE_WHATSAPP_TEMPLATE
        : config.billingDueWhatsappTemplate,
      billingOverdueEmailEnabled: !isNil(map.BILLING_OVERDUE_EMAIL_ENABLED)
        ? map.BILLING_OVERDUE_EMAIL_ENABLED
        : config.billingOverdueEmailEnabled,
      billingOverdueWhatsappEnabled: !isNil(map.BILLING_OVERDUE_WHATSAPP_ENABLED)
        ? map.BILLING_OVERDUE_WHATSAPP_ENABLED
        : config.billingOverdueWhatsappEnabled,
      billingOverdueIntervalDays: !isNil(map.BILLING_OVERDUE_INTERVAL_DAYS)
        ? map.BILLING_OVERDUE_INTERVAL_DAYS
        : config.billingOverdueIntervalDays,
      billingOverdueEmailSubject: !isNil(map.BILLING_OVERDUE_EMAIL_SUBJECT)
        ? map.BILLING_OVERDUE_EMAIL_SUBJECT
        : config.billingOverdueEmailSubject,
      billingOverdueEmailTemplate: !isNil(map.BILLING_OVERDUE_EMAIL_TEMPLATE)
        ? map.BILLING_OVERDUE_EMAIL_TEMPLATE
        : config.billingOverdueEmailTemplate,
      billingOverdueWhatsappTemplate: !isNil(map.BILLING_OVERDUE_WHATSAPP_TEMPLATE)
        ? map.BILLING_OVERDUE_WHATSAPP_TEMPLATE
        : config.billingOverdueWhatsappTemplate,
      channelWhatsappBaileysEnabled: !isNil(map.CHANNEL_WHATSAPP_BAILEYS_ENABLED)
        ? map.CHANNEL_WHATSAPP_BAILEYS_ENABLED
        : config.channelWhatsappBaileysEnabled,
      channelWhatsappWuzapiEnabled: !isNil(map.CHANNEL_WHATSAPP_WUZAPI_ENABLED)
        ? map.CHANNEL_WHATSAPP_WUZAPI_ENABLED
        : config.channelWhatsappWuzapiEnabled,
      channelWhatsappOfficialEnabled: !isNil(map.CHANNEL_WHATSAPP_OFFICIAL_ENABLED)
        ? map.CHANNEL_WHATSAPP_OFFICIAL_ENABLED
        : config.channelWhatsappOfficialEnabled,
      channelFacebookEnabled: !isNil(map.CHANNEL_FACEBOOK_ENABLED)
        ? map.CHANNEL_FACEBOOK_ENABLED
        : config.channelFacebookEnabled,
      channelInstagramEnabled: !isNil(map.CHANNEL_INSTAGRAM_ENABLED)
        ? map.CHANNEL_INSTAGRAM_ENABLED
        : config.channelInstagramEnabled,
      channelWebchatEnabled: !isNil(map.CHANNEL_WEBCHAT_ENABLED)
        ? map.CHANNEL_WEBCHAT_ENABLED
        : config.channelWebchatEnabled,
      signupRequireCpfCnpj: !isNil(map.SIGNUP_REQUIRE_CPFCNPJ)
        ? map.SIGNUP_REQUIRE_CPFCNPJ
        : config.signupRequireCpfCnpj
    };
  } catch (err) {
    console.warn(
      "[GetGlobalConfig] Erro ao carregar Settings de LOGIN_*_URL:",
      err
    );
  }

  return config;
};

export default GetGlobalConfig;
