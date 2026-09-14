// ARQUIVO: backend/src/controllers/GlobalConfigController.ts

import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { hash } from "bcryptjs";
import AppError from "../errors/AppError";
import GetGlobalConfig from "../helpers/GetGlobalConfig";
import SendWelcomeEmail from "../helpers/SendWelcomeEmail";
import Company from "../models/Company";
import Setting from "../models/Setting";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";
import { Op } from "sequelize";
import moment from "moment";
import logger from "../utils/logger";
import { getWbot } from "../libs/wbot";
import { syncWuzapiUsersWebhooks } from "../services/WuzapiServices/wuzapiClient";
import FinancialSummaryService from "../services/InvoicesService/FinancialSummaryService";
import ListAllCompaniesInvoicesService from "../services/InvoicesService/ListAllCompaniesInvoicesService";

const persistSettingValue = async (
  companyId: number,
  key: string,
  value: unknown
): Promise<void> => {
  if (typeof value === "undefined" || value === null) {
    return;
  }

  const normalizedValue = String(value);
  const settings = await Setting.findAll({
    where: { companyId, key },
    order: [["updatedAt", "DESC"], ["id", "DESC"]]
  });

  const [current, ...duplicates] = settings;

  if (current) {
    await current.update({ value: normalizedValue });
  } else {
    await Setting.create({
      companyId,
      key,
      value: normalizedValue
    } as any);
  }

  if (duplicates.length > 0) {
    await Setting.destroy({
      where: {
        id: duplicates.map(setting => setting.id)
      }
    });
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user as any;

  const config = await GetGlobalConfig(companyId);

  // 🔒 Usuários sem permissão de config global só recebem os toggles de canal
  // (usados pela tela de Conexões), nunca os segredos (tokens, senhas, etc.)
  if (!hasGlobalConfigPermission(req)) {
    return res.status(200).json({
      channelWhatsappBaileysEnabled: config.channelWhatsappBaileysEnabled,
      channelWhatsappWuzapiEnabled: config.channelWhatsappWuzapiEnabled,
      channelWhatsappOfficialEnabled: config.channelWhatsappOfficialEnabled,
      channelFacebookEnabled: config.channelFacebookEnabled,
      channelInstagramEnabled: config.channelInstagramEnabled,
      channelWebchatEnabled: config.channelWebchatEnabled
    });
  }

  return res.status(200).json(config);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  // pegamos tudo em "any" pra não brigar com o TS
  const { companyId, profile } = req.user as any;
  const isSuper = !!(req.user as any)?.super;

  // ✅ Permite: super OU admin da empresa 1
  if (!req.user || (!isSuper && !(profile === "admin" && Number(companyId) === 1))) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const {
    mpAccessToken,
    paymentGateway,
    asaasApiKey,
    asaasWebhookSecret,
    efiClientId,
    efiClientSecret,
    efiCertificate,
    efiCertificatePassphrase,
    efiPixKey,
    efiSandbox,
    pushinPayToken,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPass,
    smtpFrom,
    welcomeEmailEnabled,
    welcomeWhatsappEnabled,
    welcomeEmailSubject,
    welcomeEmailTemplate,
    trialExpiration,
    masterAccessPassword,
    clearMasterAccessPassword,
    wuzapiBaseUrl,
    wuzapiAdminToken,
    wuzapiDbPassword,
    wuzapiConfigFile,
    billingDueEmailEnabled,
    billingDueWhatsappEnabled,
    billingDueDaysBefore,
    billingDueEmailSubject,
    billingDueEmailTemplate,
    billingDueWhatsappTemplate,
    billingOverdueEmailEnabled,
    billingOverdueWhatsappEnabled,
    billingOverdueIntervalDays,
    billingOverdueEmailSubject,
    billingOverdueEmailTemplate,
    billingOverdueWhatsappTemplate,
    channelWhatsappBaileysEnabled,
    channelWhatsappWuzapiEnabled,
    channelWhatsappOfficialEnabled,
    channelFacebookEnabled,
    channelInstagramEnabled,
    channelWebchatEnabled,
    signupRequireCpfCnpj,

    // ✅ NOVOS CAMPOS DE LOGIN / BRANDING
    loginLogo,
    loginBackground,
    loginWhatsapp
  } = req.body;

  const normalizedGateway = String(paymentGateway || "").toLowerCase();
  const normalizedAsaasKey = String(asaasApiKey || "").trim();
  const normalizedAsaasWebhookSecret = String(asaasWebhookSecret || "").trim();

  if (normalizedGateway === "asaas") {
    if (!normalizedAsaasKey) {
      throw new AppError(
        "Para usar Asaas, informe a API Key em Meios de Pagamento.",
        400
      );
    }

    if (!normalizedAsaasWebhookSecret) {
      throw new AppError(
        "Para usar Asaas, informe o Token de Webhook em Meios de Pagamento.",
        400
      );
    }
  }

  const normalizedEfiClientId = String(efiClientId || "").trim();
  const normalizedEfiClientSecret = String(efiClientSecret || "").trim();
  const normalizedEfiCertificate = String(efiCertificate || "").trim();
  const normalizedEfiPixKey = String(efiPixKey || "").trim();
  const normalizedPushinPayToken = String(pushinPayToken || "").trim();

  if (normalizedGateway === "efi") {
    if (!normalizedEfiClientId || !normalizedEfiClientSecret) {
      throw new AppError(
        "Para usar EFI Bank, informe Client ID e Client Secret em Meios de Pagamento.",
        400
      );
    }

    if (!normalizedEfiCertificate) {
      throw new AppError(
        "Para usar EFI Bank, informe o certificado (base64) em Meios de Pagamento.",
        400
      );
    }

    if (!normalizedEfiPixKey) {
      throw new AppError(
        "Para usar EFI Bank, informe a Chave Pix em Meios de Pagamento.",
        400
      );
    }

    try {
      Buffer.from(normalizedEfiCertificate, "base64");
    } catch {
      throw new AppError("Certificado EFI inválido — não é um base64 válido.", 400);
    }
  }

  if (normalizedGateway === "pushinpay") {
    if (!normalizedPushinPayToken) {
      throw new AppError(
        "Para usar Pushin Pay, informe o Token em Meios de Pagamento.",
        400
      );
    }
  }

  const company = await Company.findByPk(companyId);

  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  // --- Atualiza MP + SMTP na Company (igual já foi feito) ---
  if (typeof mpAccessToken !== "undefined") {
    (company as any).mpAccessToken = mpAccessToken;
  }
  if (typeof paymentGateway !== "undefined") {
    (company as any).paymentGateway = paymentGateway;
  }
  if (typeof asaasApiKey !== "undefined") {
    (company as any).asaasApiKey = normalizedAsaasKey;
  }
  if (typeof asaasWebhookSecret !== "undefined") {
    (company as any).asaasWebhookSecret = normalizedAsaasWebhookSecret;
  }
  if (typeof efiClientId !== "undefined") {
    (company as any).efiClientId = normalizedEfiClientId;
  }
  if (typeof efiClientSecret !== "undefined") {
    (company as any).efiClientSecret = normalizedEfiClientSecret;
  }
  if (typeof efiCertificate !== "undefined") {
    (company as any).efiCertificate = normalizedEfiCertificate;
  }
  if (typeof efiCertificatePassphrase !== "undefined") {
    (company as any).efiCertificatePassphrase = String(efiCertificatePassphrase || "");
  }
  if (typeof efiPixKey !== "undefined") {
    (company as any).efiPixKey = normalizedEfiPixKey;
  }
  if (typeof efiSandbox !== "undefined") {
    (company as any).efiSandbox = Boolean(efiSandbox);
  }
  if (typeof pushinPayToken !== "undefined") {
    (company as any).pushinPayToken = normalizedPushinPayToken;
  }
  if (typeof smtpHost !== "undefined") {
    (company as any).smtpHost = smtpHost;
  }
  if (typeof smtpPort !== "undefined") {
    (company as any).smtpPort = smtpPort;
  }
  if (typeof smtpSecure !== "undefined") {
    (company as any).smtpSecure = smtpSecure;
  }
  if (typeof smtpUser !== "undefined") {
    (company as any).smtpUser = smtpUser;
  }
  if (typeof smtpPass !== "undefined") {
    (company as any).smtpPass = smtpPass;
  }
  if (typeof smtpFrom !== "undefined") {
    (company as any).smtpFrom = smtpFrom;
  }

  // --- TrialExpiration: grava também na Company + Setting global + process.env ---
  if (typeof trialExpiration !== "undefined") {
    const numericTrial = parseInt(String(trialExpiration), 10);

    if (!Number.isNaN(numericTrial) && numericTrial > 0) {
      // salva na Company (pra GetGlobalConfig enxergar)
      (company as any).trialExpiration = numericTrial;

      // 🔥 Limpa todos os APP_TRIALEXPIRATION antigos
      await Setting.destroy({
        where: { companyId: 1, key: "APP_TRIALEXPIRATION" }
      });

      // Cria um único registro novo com o valor atual
      await Setting.create({
        companyId: 1,
        key: "APP_TRIALEXPIRATION",
        value: String(numericTrial)
      } as any);

      // Atualiza o valor em runtime também (usado no UserController, etc.)
      process.env.APP_TRIALEXPIRATION = String(numericTrial);
    }
  }

  await company.save();

  // === NOVO: salvar logo, capa e WhatsApp do login em Settings ===
  await persistSettingValue(companyId, "LOGIN_LOGO_URL", loginLogo);
  await persistSettingValue(companyId, "LOGIN_BACKGROUND_URL", loginBackground);
  await persistSettingValue(companyId, "LOGIN_WHATSAPP_URL", loginWhatsapp);
  await persistSettingValue(companyId, "WELCOME_EMAIL_ENABLED", welcomeEmailEnabled);
  await persistSettingValue(companyId, "WELCOME_WHATSAPP_ENABLED", welcomeWhatsappEnabled);
  await persistSettingValue(companyId, "WELCOME_EMAIL_SUBJECT", welcomeEmailSubject);
  await persistSettingValue(companyId, "WELCOME_EMAIL_TEMPLATE", welcomeEmailTemplate);
  await persistSettingValue(companyId, "WUZAPI_BASE_URL", wuzapiBaseUrl);
  await persistSettingValue(companyId, "WUZAPI_ADMIN_TOKEN", wuzapiAdminToken);
  await persistSettingValue(companyId, "WUZAPI_DB_PASSWORD", wuzapiDbPassword);
  await persistSettingValue(companyId, "WUZAPI_CONFIG_FILE", wuzapiConfigFile);
  await persistSettingValue(companyId, "BILLING_DUE_EMAIL_ENABLED", billingDueEmailEnabled);
  await persistSettingValue(companyId, "BILLING_DUE_WHATSAPP_ENABLED", billingDueWhatsappEnabled);
  await persistSettingValue(companyId, "BILLING_DUE_DAYS_BEFORE", billingDueDaysBefore);
  await persistSettingValue(companyId, "BILLING_DUE_EMAIL_SUBJECT", billingDueEmailSubject);
  await persistSettingValue(companyId, "BILLING_DUE_EMAIL_TEMPLATE", billingDueEmailTemplate);
  await persistSettingValue(companyId, "BILLING_DUE_WHATSAPP_TEMPLATE", billingDueWhatsappTemplate);
  await persistSettingValue(companyId, "BILLING_OVERDUE_EMAIL_ENABLED", billingOverdueEmailEnabled);
  await persistSettingValue(companyId, "BILLING_OVERDUE_WHATSAPP_ENABLED", billingOverdueWhatsappEnabled);
  await persistSettingValue(companyId, "BILLING_OVERDUE_INTERVAL_DAYS", billingOverdueIntervalDays);
  await persistSettingValue(companyId, "BILLING_OVERDUE_EMAIL_SUBJECT", billingOverdueEmailSubject);
  await persistSettingValue(companyId, "BILLING_OVERDUE_EMAIL_TEMPLATE", billingOverdueEmailTemplate);
  await persistSettingValue(companyId, "BILLING_OVERDUE_WHATSAPP_TEMPLATE", billingOverdueWhatsappTemplate);
  await persistSettingValue(companyId, "CHANNEL_WHATSAPP_BAILEYS_ENABLED", channelWhatsappBaileysEnabled);
  await persistSettingValue(companyId, "CHANNEL_WHATSAPP_WUZAPI_ENABLED", channelWhatsappWuzapiEnabled);
  await persistSettingValue(companyId, "CHANNEL_WHATSAPP_OFFICIAL_ENABLED", channelWhatsappOfficialEnabled);
  await persistSettingValue(companyId, "CHANNEL_FACEBOOK_ENABLED", channelFacebookEnabled);
  await persistSettingValue(companyId, "CHANNEL_INSTAGRAM_ENABLED", channelInstagramEnabled);
  await persistSettingValue(companyId, "CHANNEL_WEBCHAT_ENABLED", channelWebchatEnabled);
  await persistSettingValue(companyId, "SIGNUP_REQUIRE_CPFCNPJ", signupRequireCpfCnpj);

  try {
    logger.info("[WUZAPI_WEBHOOK_SYNC] disparando sincronização após salvar configuração global");
    const result = await syncWuzapiUsersWebhooks(true);
    if (result.reason) {
      logger.warn(`[WUZAPI_WEBHOOK_SYNC] não executado: ${result.reason}`);
    } else {
      logger.info(
        `[WUZAPI_WEBHOOK_SYNC] concluído | checked=${result.checked} | updated=${result.updated} | skipped=${result.skipped} | errors=${result.errors}`
      );
    }
  } catch (error: any) {
    logger.warn(
      `[WUZAPI_WEBHOOK_SYNC] erro ao sincronizar webhooks após salvar configuração global: ${
        error?.message || error
      }`
    );
  }

  if (clearMasterAccessPassword === true) {
    await persistSettingValue(companyId, "SUPER_ADMIN_MASTER_PASSWORD_HASH", "");
  } else if (
    typeof masterAccessPassword === "string" &&
    masterAccessPassword.trim().length > 0
  ) {
    const hashedMasterPassword = await hash(masterAccessPassword.trim(), 8);
    await persistSettingValue(
      companyId,
      "SUPER_ADMIN_MASTER_PASSWORD_HASH",
      hashedMasterPassword
    );
  }

  const config = await GetGlobalConfig(companyId);
  return res.status(200).json(config);
};

// 🔹 NOVO: upload de arquivos (logo/capa) para o login
export const uploadBrandingImage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, profile } = req.user as any;
  const isSuper = !!(req.user as any)?.super;

  if (!req.user || (!isSuper && !(profile === "admin" && Number(companyId) === 1))) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  if (!req.file) {
    throw new AppError("ERR_NO_FILE", 400);
  }

  const { field } = req.body;

  if (!["loginLogo", "loginBackground"].includes(field)) {
    throw new AppError("ERR_INVALID_FIELD", 400);
  }

  /**
   * Aqui assumo que o multer já está configurado com `dest: 'public/'`
   * ou algo como `public/branding`.
   *
   * Exemplos de caminhos possíveis:
   *  - public/branding/1699999999999-logo.png
   *  - public/1699999999999-capa.jpg
   */
  const originalPath = req.file.path || "";
  // normaliza para começar em "public/..."
  const relativePath = originalPath.replace(/.*public[\\/]/, "public/").replace(/\\/g, "/");

  // Vamos devolver uma URL relativa; o frontend prefixa com REACT_APP_BACKEND_URL
  return res.status(200).json({
    field,
    url: `/${relativePath}`
  });
};

export const removeBrandingImage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, profile } = req.user as any;
  const isSuper = !!(req.user as any)?.super;

  if (!req.user || (!isSuper && !(profile === "admin" && Number(companyId) === 1))) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { field } = req.body;

  if (!["loginLogo", "loginBackground"].includes(field)) {
    throw new AppError("ERR_INVALID_FIELD", 400);
  }

  const keyMap: Record<string, string> = {
    loginLogo: "LOGIN_LOGO_URL",
    loginBackground: "LOGIN_BACKGROUND_URL"
  };
  const settingKey = keyMap[field];

  const setting = await Setting.findOne({
    where: { companyId, key: settingKey },
    order: [["updatedAt", "DESC"], ["id", "DESC"]]
  });

  const currentValue = String(setting?.value || "");
  const publicRoot = path.resolve(__dirname, "..", "..", "public");

  // Remove arquivo físico somente quando for path local em /public/...
  if (currentValue) {
    const relativePath = currentValue
      .replace(/^\/+/, "")
      .replace(/\\/g, "/");

    if (relativePath.startsWith("public/")) {
      const absolutePath = path.resolve(__dirname, "..", "..", relativePath);
      const isInsidePublic = absolutePath.startsWith(publicRoot);

      if (isInsidePublic && fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }
  }

  await persistSettingValue(companyId, settingKey, "");

  return res.status(200).json({
    field,
    removed: true
  });
};

export const sendWelcomeEmailTest = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, profile } = req.user as any;
  const isSuper = !!(req.user as any)?.super;

  if (!req.user || (!isSuper && !(profile === "admin" && Number(companyId) === 1))) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const {
    testEmail,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPass,
    smtpFrom,
    welcomeEmailEnabled,
    welcomeEmailSubject,
    welcomeEmailTemplate
  } = req.body || {};

  if (!testEmail || !String(testEmail).includes("@")) {
    throw new AppError("Informe um e-mail de teste válido.", 400);
  }

  const sent = await SendWelcomeEmail({
    to: String(testEmail),
    name: "Usuário de Teste",
    email: String(testEmail),
    password: "Senha123",
    companyName: "Empresa de Teste",
    dueDate: "",
    loginUrl: process.env.FRONTEND_URL || "",
    companyId,
    force: true,
    configOverride: {
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPass,
      smtpFrom,
      welcomeEmailEnabled,
      welcomeEmailSubject,
      welcomeEmailTemplate
    }
  });

  if (!sent) {
    throw new AppError("Não foi possível enviar. Verifique SMTP e template.", 400);
  }

  return res.status(200).json({ message: "E-mail de teste enviado com sucesso." });
};

const replaceTemplateVars = (template: string, variables: Record<string, string>): string => {
  let output = String(template || "");
  Object.keys(variables).forEach((key) => {
    const value = variables[key] || "";
    const pattern = new RegExp(`\\{${key}\\}`, "g");
    output = output.replace(pattern, value);
  });
  return output;
};

const toCurrencyLabel = (value: number): string => {
  if (Number.isNaN(Number(value))) return "R$ 0,00";
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
};

const normalizeToJid = (phone: string): string | null => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  if (withCountry.length < 12 || withCountry.length > 13) return null;
  return `${withCountry}@s.whatsapp.net`;
};

const resolveBillingSenderWhatsapp = async (): Promise<Whatsapp | null> => {
  return Whatsapp.findOne({
    where: {
      companyId: 1,
      channel: "whatsapp",
      status: {
        [Op.in]: ["CONNECTED", "connected"]
      }
    },
    order: [["id", "ASC"]]
  });
};

export const sendBillingDueEmailTest = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, profile } = req.user as any;
  const isSuper = !!(req.user as any)?.super;

  if (!req.user || (!isSuper && !(profile === "admin" && Number(companyId) === 1))) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const {
    testEmail,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPass,
    smtpFrom,
    billingDueEmailSubject,
    billingDueEmailTemplate
  } = req.body || {};

  if (!testEmail || !String(testEmail).includes("@")) {
    throw new AppError("Informe um e-mail de teste válido.", 400);
  }

  const dueDate = moment().add(3, "days").format("DD/MM/YYYY");
  const variables = {
    companyName: "Empresa de Teste",
    dueDate,
    invoiceValue: toCurrencyLabel(199.9),
    invoiceLink: process.env.FRONTEND_URL || "",
    daysToDue: "3",
    daysOverdue: "0"
  };

  const sent = await SendWelcomeEmail({
    to: String(testEmail),
    companyName: variables.companyName,
    dueDate: variables.dueDate,
    companyId,
    force: true,
    loginUrl: variables.invoiceLink,
    extraVariables: variables,
    configOverride: {
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPass,
      smtpFrom,
      welcomeEmailEnabled: "enabled",
      welcomeEmailSubject: billingDueEmailSubject,
      welcomeEmailTemplate: billingDueEmailTemplate
    }
  });

  if (!sent) {
    throw new AppError("Não foi possível enviar. Verifique SMTP e template.", 400);
  }

  return res.status(200).json({ message: "E-mail de teste de vencimento enviado com sucesso." });
};

export const sendBillingDueWhatsappTest = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, profile } = req.user as any;
  const isSuper = !!(req.user as any)?.super;

  if (!req.user || (!isSuper && !(profile === "admin" && Number(companyId) === 1))) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { testPhone, billingDueWhatsappTemplate } = req.body || {};
  const jid = normalizeToJid(String(testPhone || ""));
  if (!jid) {
    throw new AppError("Informe um telefone de WhatsApp válido para teste.", 400);
  }

  const senderWhatsapp = await resolveBillingSenderWhatsapp();
  if (!senderWhatsapp) {
    throw new AppError(
      "Nenhuma conexão WhatsApp conectada na empresa principal para envio do teste.",
      400
    );
  }

  const dueDate = moment().add(3, "days").format("DD/MM/YYYY");
  const variables = {
    companyName: "Empresa de Teste",
    dueDate,
    invoiceValue: toCurrencyLabel(199.9),
    invoiceLink: process.env.FRONTEND_URL || "",
    daysToDue: "3",
    daysOverdue: "0"
  };
  const body = replaceTemplateVars(String(billingDueWhatsappTemplate || ""), variables);
  const wbot = getWbot(senderWhatsapp.id, senderWhatsapp.companyId);
  await wbot.sendMessage(jid, { text: body });

  return res.status(200).json({ message: "WhatsApp de teste de vencimento enviado com sucesso." });
};

// 🔹 NOVO: endpoint público só para o branding do login
export const publicBranding = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // aqui uso a company 1 como padrão; se depois quiser multi-tenant, dá pra evoluir
    const config: any = await GetGlobalConfig(1);

    // 🔹 Valores padrão caso ainda não tenha nada salvo no banco
    const defaultLoginLogo = "/public/branding/login-logo-default.png";
    const defaultLoginBackground = "/public/branding/login-background-default.png";
    const defaultLoginWhatsapp = "https://wa.me/5511000000000";

    // Se não houver uma logo específica configurada para o login, cai para a
    // logomarca geral da empresa (a mesma exibida no menu lateral) em vez do
    // logo genérico padrão — assim, quem configura só uma logo em
    // Configurações já vê ela refletida também na tela de login.
    let loginLogo = config?.loginLogo;
    if (!loginLogo) {
      const appLogoSetting = await Setting.findOne({
        where: { companyId: 1, key: "appLogoLight" }
      });
      // appLogoLight é salvo como caminho relativo (ex.: "logo/123-arquivo.png"),
      // sem o prefixo "/public/" que o front espera para montar a URL completa.
      loginLogo = appLogoSetting?.value ? `/public/${appLogoSetting.value}` : "";
    }

    return res.status(200).json({
      loginLogo: loginLogo || defaultLoginLogo,
      loginBackground: config?.loginBackground || defaultLoginBackground,
      loginWhatsapp: config?.loginWhatsapp || defaultLoginWhatsapp,
      signupRequireCpfCnpj: config?.signupRequireCpfCnpj || "disabled"
    });
  } catch (err) {
    console.error("[GlobalConfigController.publicBranding] erro:", err);
    return res.status(500).json({ error: "ERR_GLOBAL_CONFIG" });
  }
};

const hasGlobalConfigPermission = (req: Request): boolean => {
  const { companyId, profile } = req.user as any;
  const isSuper = !!(req.user as any)?.super;

  return Boolean(req.user && (isSuper || (profile === "admin" && Number(companyId) === 1)));
};

const normalizeDueDate = (value: unknown): Date | null => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

export const dashboardSummary = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (!hasGlobalConfigPermission(req)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const onlineThreshold = new Date();
  onlineThreshold.setMinutes(onlineThreshold.getMinutes() - 5);

  const [companies, totalUsers, onlineUsers, totalConnections, activeConnections] = await Promise.all([
    Company.findAll({
      attributes: ["id", "status", "dueDate", "recurrence"]
    }),
    User.count(),
    User.count({
      where: {
        online: true,
        updatedAt: {
          [Op.gte]: onlineThreshold
        }
      }
    }),
    Whatsapp.count(),
    Whatsapp.count({
      where: {
        status: {
          [Op.in]: ["CONNECTED", "connected"]
        }
      }
    })
  ]);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let activeCompanies = 0;
  let expiredCompanies = 0;
  companies.forEach((company: any) => {
    const dueDate = normalizeDueDate(company?.dueDate);
    const isExpired = dueDate ? dueDate < now : false;

    if (isExpired) {
      expiredCompanies += 1;
      return;
    }

    if (Boolean(company?.status)) {
      activeCompanies += 1;
    }
  });

  const disconnectedConnections = Math.max(0, Number(totalConnections) - Number(activeConnections));

  return res.status(200).json({
    totalCompanies: companies.length,
    activeCompanies,
    expiredCompanies,
    totalUsers,
    onlineUsers,
    totalConnections,
    activeConnections,
    disconnectedConnections
  });
};

export const financialSummary = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (!hasGlobalConfigPermission(req)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { startDate, endDate, companyId } = req.query as any;

  const summary = await FinancialSummaryService({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    companyId: companyId ? Number(companyId) : undefined
  });

  return res.status(200).json(summary);
};

export const financialInvoices = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (!hasGlobalConfigPermission(req)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { page, pageSize, startDate, endDate, status, companyId, searchParam } =
    req.query as any;

  const result = await ListAllCompaniesInvoicesService({
    page: page ? Number(page) : 1,
    pageSize: pageSize ? Number(pageSize) : 20,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    status: status || "all",
    companyId: companyId ? Number(companyId) : undefined,
    searchParam: searchParam || undefined
  });

  return res.status(200).json(result);
};

export const financialCompanies = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (!hasGlobalConfigPermission(req)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const companies = await Company.findAll({
    attributes: ["id", "name"],
    order: [["name", "ASC"]]
  });

  return res.status(200).json(companies);
};
