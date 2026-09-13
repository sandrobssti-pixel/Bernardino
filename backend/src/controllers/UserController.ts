// ARQUIVO COMPLETO: backend/src/controllers/UserController.ts

import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import CheckSettingsHelper from "../helpers/CheckSettings";
import AppError from "../errors/AppError";

import CreateUserService from "../services/UserServices/CreateUserService";
import ListUsersService from "../services/UserServices/ListUsersService";
import UpdateUserService from "../services/UserServices/UpdateUserService";
import ShowUserService from "../services/UserServices/ShowUserService";
import DeleteUserService from "../services/UserServices/DeleteUserService";
import SimpleListService from "../services/UserServices/SimpleListService";
import CreateCompanyService from "../services/CompanyService/CreateCompanyService";
import SendWelcomeEmail from "../helpers/SendWelcomeEmail";
import { useDate } from "../utils/useDate";
import ShowCompanyService from "../services/CompanyService/ShowCompanyService";
import { tryGetWbot } from "../libs/wbot";
import FindCompaniesWhatsappService from "../services/CompanyService/FindCompaniesWhatsappService";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import CompaniesSettings from "../models/CompaniesSettings";
import Whatsapp from "../models/Whatsapp";
import { verifyMessage } from "../services/WbotServices/wbotMessageListener";
import User from "../models/User";
import Company from "../models/Company";

import { head } from "lodash";
import ToggleChangeWidthService from "../services/UserServices/ToggleChangeWidthService";
import GetGlobalConfig from "../helpers/GetGlobalConfig";
import APIShowEmailUserService from "../services/UserServices/APIShowEmailUserService";
import Setting from "../models/Setting";
import fs from "fs";
import path from "path";
import multer from "multer";
import logger from "../utils/logger";
import { isValidCpfCnpj, sanitizeDigits } from "../services/BillingProviders/utils";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

const normalizeSignupPhoneToJid = (value: any): string | null => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;

  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  if (withCountry.length < 12 || withCountry.length > 13) return null;

  return `${withCountry}@s.whatsapp.net`;
};

const getWhitelabelSystemName = async (): Promise<string> => {
  const setting = await Setting.findOne({
    where: {
      companyId: 1,
      key: "appName"
    }
  });

  return String(setting?.value || "").trim() || "sistema";
};

const getWelcomeWhatsappEnabled = async (): Promise<boolean> => {
  const setting = await Setting.findOne({
    where: {
      companyId: 1,
      key: "WELCOME_WHATSAPP_ENABLED"
    },
    order: [["updatedAt", "DESC"], ["id", "DESC"]]
  });

  return String(setting?.value || "enabled").toLowerCase() === "enabled";
};

const getFrontendAppUrl = (): string => {
  const value = String(process.env.FRONTEND_URL || "").trim();
  return value.replace(/\/+$/, "");
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const addBrNinthDigitVariants = (n: string): string[] => {
  const variants = new Set<string>();
  variants.add(n);

  if (!n.startsWith("55")) return Array.from(variants);

  if (n.length === 13) {
    const ddi = n.substring(0, 2);
    const ddd = n.substring(2, 4);
    const firstLocalDigit = n.substring(4, 5);
    const local8 = n.slice(-8);
    if (firstLocalDigit === "9") {
      variants.add(`${ddi}${ddd}${local8}`);
    }
  } else if (n.length === 12) {
    const ddi = n.substring(0, 2);
    const ddd = n.substring(2, 4);
    const local8 = n.slice(-8);
    variants.add(`${ddi}${ddd}9${local8}`);
  }

  return Array.from(variants);
};

// Obtém a sessão viva (Baileys ou Wuzapi). Para Wuzapi, se a sessão não
// estiver em memória, tenta iniciá-la sob demanda (mesmo padrão do GetTicketWbot).
const getSignupWbotWithLazyStart = async (whatsapp: Whatsapp): Promise<any> => {
  let wbot = tryGetWbot(whatsapp.id, whatsapp.companyId);
  const isWuzapi = String((whatsapp as any)?.provider || "").toLowerCase() === "wuzapi";

  if (!wbot && isWuzapi) {
    try {
      const { StartWhatsAppSession } = await import(
        "../services/WbotServices/StartWhatsAppSession"
      );
      await StartWhatsAppSession(whatsapp, whatsapp.companyId);
      for (let i = 0; i < 5; i++) {
        await sleep(300);
        wbot = tryGetWbot(whatsapp.id, whatsapp.companyId);
        if (wbot) break;
      }
    } catch (err) {
      logger.error("[USER_STORE] failed to lazy-start session for welcome message", {
        whatsappId: whatsapp.id,
        provider: (whatsapp as any)?.provider,
        message: (err as Error)?.message
      });
    }
  }

  if (!wbot) {
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }

  return wbot;
};

// Confirma, via onWhatsApp (Baileys) / POST /user/check (Wuzapi), que o número
// informado no cadastro realmente existe no WhatsApp antes de enviar às cegas.
const resolveVerifiedSignupJid = async (wbot: any, phone: string): Promise<string | null> => {
  if (typeof wbot?.onWhatsApp !== "function") return null;

  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;

  const candidates = addBrNinthDigitVariants(withCountry);

  for (const candidate of candidates) {
    try {
      const [result] = (await wbot.onWhatsApp(`${candidate}@s.whatsapp.net`)) || [];
      if (result?.exists && result?.jid) {
        return String(result.jid);
      }
    } catch (err) {
      logger.error("[USER_STORE] onWhatsApp check failed for welcome message candidate", {
        candidate,
        message: (err as Error)?.message
      });
    }
  }

  return null;
};

const persistSignupWelcomeMessage = async ({
  whatsappId,
  phone,
  body
}: {
  whatsappId: number;
  phone: string;
  body: string;
}): Promise<void> => {
  const whatsapp = await Whatsapp.findByPk(whatsappId);
  if (!whatsapp) {
    throw new AppError("ERR_NO_DEF_WAPP_FOUND");
  }

  const wbot = await getSignupWbotWithLazyStart(whatsapp);

  const verifiedJid = await resolveVerifiedSignupJid(wbot, phone);
  if (!verifiedJid) {
    throw new AppError("ERR_WAPP_INVALID_CONTACT");
  }

  const sentMessage = await wbot.sendMessage(verifiedJid, { text: body });

  if (!sentMessage?.message) {
    sentMessage.message = { conversation: body };
  }

  const destinationNumber = verifiedJid.split("@")[0].replace(/\D/g, "");
  if (!destinationNumber) return;

  const contact = await CreateOrUpdateContactService({
    name: destinationNumber,
    number: destinationNumber,
    profilePicUrl: "",
    isGroup: false,
    companyId: whatsapp.companyId,
    whatsappId: whatsapp.id,
    remoteJid: verifiedJid,
    wbot
  });

  const settings = await CompaniesSettings.findOne({
    where: { companyId: whatsapp.companyId }
  });

  const ticket = await FindOrCreateTicketService(
    contact,
    whatsapp,
    0,
    whatsapp.companyId,
    null,
    null,
    null,
    whatsapp.channel,
    null,
    false,
    settings,
    false,
    false
  );

  const ticketContact = (ticket as any)?.contact || contact;
  await verifyMessage(sentMessage, ticket, ticketContact);
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;
  const { companyId, profile } = req.user;

  const { users, count, hasMore } = await ListUsersService({
    searchParam,
    pageNumber,
    companyId,
    profile
  });

  return res.json({ users, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  logger.info("[USER_STORE] create user request received", {
    hasUser: !!req.user,
    actorId: req.user?.id,
    actorCompanyId: req.user?.companyId,
    actorProfile: req.user?.profile,
    bodyCompanyId: req.body?.companyId,
    email: req.body?.email,
    name: req.body?.name
  });

  const {
    email,
    password,
    name,
    phone,
    document,
    profile,
    companyId: bodyCompanyId,
    queueIds,
    companyName,
    planId,
    startWork,
    endWork,
    whatsappId,
    allTicket,
    defaultTheme,
    defaultMenu,
    allowGroup,
    allHistoric,
    allUserChat,
    userClosePendingTicket,
    canDeleteTickets,
    showDashboard,
    defaultTicketsManagerWidth = 550,
    allowRealTime,
    allowConnections,
    canViewAllContacts, // <<< NOVO: permissão
    blockMultipleLogins,
    birthDate
  } = req.body;
  let userCompanyId: number | null = null;

  const { dateToClient } = useDate();

  if (req.user !== undefined) {
    const { companyId: cId } = req.user;
    userCompanyId = cId;
  }

  const isSignupRequest = req.path === "/signup" || req.originalUrl.endsWith("/auth/signup");

  if (
    isSignupRequest &&
    (await CheckSettingsHelper("userCreation")) === "disabled"
  ) {
    throw new AppError("ERR_USER_CREATION_DISABLED", 403);
  } else if (!isSignupRequest && req.user?.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  if (process.env.DEMO === "ON") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const normalizedDocument = sanitizeDigits(document);

  if (isSignupRequest) {
    const globalConfig = await GetGlobalConfig();
    const requiresCpfCnpj =
      String(globalConfig.signupRequireCpfCnpj || "disabled").toLowerCase() === "enabled";

    if (requiresCpfCnpj) {
      if (!normalizedDocument) {
        throw new AppError("CPF/CNPJ é obrigatório no cadastro.", 400);
      }

      if (!isValidCpfCnpj(normalizedDocument)) {
        throw new AppError("CPF/CNPJ informado é inválido.", 400);
      }
    } else if (normalizedDocument && !isValidCpfCnpj(normalizedDocument)) {
      throw new AppError("CPF/CNPJ informado é inválido.", 400);
    }
  }

  const companyUser = bodyCompanyId || userCompanyId;

  if (!companyUser) {
    const strongPasswordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!password || !strongPasswordRegex.test(password)) {
      throw new AppError(
        "A senha deve ter no mínimo 8 caracteres, incluindo letras e números.",
        400
      );
    }

    const globalConfig = await GetGlobalConfig();
    const trialDays = parseInt(globalConfig.trialExpiration || "3", 10);

    const dataNowMoreTrialDays = new Date();
    dataNowMoreTrialDays.setDate(dataNowMoreTrialDays.getDate() + trialDays);

    const date = dataNowMoreTrialDays.toISOString().split("T")[0];

    const companyData = {
      name: companyName,
      email: email,
      phone: phone,
      planId: planId,
      status: true,
      dueDate: date,
      recurrence: "",
      document: normalizedDocument || "",
      paymentMethod: "",
      password: password,
      companyUserName: name,
      startWork: startWork,
      endWork: endWork,
      defaultTheme: "light",
      defaultMenu: "closed",
      allowGroup: false,
      allHistoric: false,
      userClosePendingTicket: "enabled",
      showDashboard: "disabled",
      defaultTicketsManagerWidth: 550,
      allowRealTime: "disabled",
      allowConnections: "disabled"
    };

    const createdCompany = await CreateCompanyService(companyData);

    try {
      await SendWelcomeEmail({
        to: email,
        name,
        email,
        password,
        companyName,
        dueDate: dateToClient(date),
        companyId: 1
      });
    } catch (error) {
      console.log("Não consegui enviar o email de boas-vindas");
    }

    try {
      const company = await ShowCompanyService(1);
      const whatsappCompany = await FindCompaniesWhatsappService(company.id);
      const systemName = await getWhitelabelSystemName();
      const frontendAppUrl = getFrontendAppUrl();
      const welcomeWhatsappEnabled = await getWelcomeWhatsappEnabled();
      const connectedWhatsapps = (whatsappCompany?.whatsapps || []).filter((connection: any) => {
        const status = String(connection?.status || "").toUpperCase();
        const channel = String(connection?.channel || "").toLowerCase();
        return status === "CONNECTED" && channel === "whatsapp";
      });
      const preferredConnection =
        connectedWhatsapps.find(
          (connection: any) => String(connection?.provider || "").toLowerCase() === "wuzapi"
        ) || connectedWhatsapps[0];
      const destinationJid = normalizeSignupPhoneToJid(phone);

      logger.info("[USER_STORE] welcome whatsapp message check", {
        welcomeWhatsappEnabled,
        connectedWhatsappsCount: connectedWhatsapps.length,
        preferredConnectionId: preferredConnection?.id,
        preferredConnectionProvider: preferredConnection?.provider,
        phone,
        destinationJid
      });

      if (welcomeWhatsappEnabled && preferredConnection && destinationJid) {
        const whatsappId = preferredConnection.id;

        const body = `Olá, *${name}*! 👋\n\nSeu cadastro na *${systemName}* foi realizado com sucesso! 🚀\n\nAgora você já pode começar a usar o sistema e organizar seus atendimentos de forma profissional.\n\n*📌 Dados de acesso:*\n• *Empresa:* ${companyName}\n• *E-mail:* ${email}\n• *Senha:* ${password}\n\n*🔗 Acesse sua conta:*\n👉 ${frontendAppUrl || "URL do frontend não configurada"}\n\n*⏳ Período de teste gratuito:*\nVálido até *${dateToClient(
          date
        )}*`;

        await persistSignupWelcomeMessage({
          whatsappId,
          phone,
          body
        });

        logger.info("[USER_STORE] welcome whatsapp message sent", {
          whatsappId,
          destinationJid
        });
      } else {
        logger.info("[USER_STORE] welcome whatsapp message skipped", {
          reason: !welcomeWhatsappEnabled
            ? "disabled_in_settings"
            : !preferredConnection
            ? "no_connected_whatsapp_found"
            : "invalid_destination_jid",
          phone
        });
      }
    } catch (error) {
      logger.error("[USER_STORE] failed to send welcome whatsapp message", {
        phone,
        message: (error as Error)?.message,
        stack: (error as Error)?.stack
      });
    }

    return res.status(200).json(createdCompany);
  }

  if (companyUser) {
    logger.info("[USER_STORE] creating user for company", {
      companyUser,
      email,
      name
    });

    const user = await CreateUserService({
      email,
      password,
      name,
      profile,
      companyId: companyUser,
      queueIds,
      startWork,
      endWork,
      whatsappId,
      allTicket,
      defaultTheme,
      defaultMenu,
      allowGroup,
      allHistoric,
      allUserChat,
      userClosePendingTicket,
      canDeleteTickets,
      showDashboard,
      defaultTicketsManagerWidth,
      allowRealTime,
      allowConnections,
      canViewAllContacts: !!canViewAllContacts, // <<< coerção booleana
      blockMultipleLogins:
        typeof blockMultipleLogins === "undefined"
          ? true
          : !!blockMultipleLogins,
      birthDate
    });

    if (userCompanyId) {
      const io = getIO();
      io.of(userCompanyId.toString()).emit(`company-${userCompanyId}-user`, {
        action: "create",
        user
      });
    }

    logger.info("[USER_STORE] user created successfully", {
      id: user?.id,
      companyUser,
      email
    });

    try {
      const company = await Company.findByPk(Number(companyUser));
      await SendWelcomeEmail({
        to: email,
        name,
        email,
        password,
        companyName: company?.name || "",
        dueDate: company?.dueDate || "",
        companyId: Number(companyUser)
      });
    } catch (error) {
      console.log("Não consegui enviar o email de boas-vindas");
    }

    return res.status(200).json(user);
  }

  // fallback (nunca chega aqui)
  return res.status(400).json({ error: "Bad request" });
};

// backend/src/controllers/UserController.ts

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { userId } = req.params;
  const { companyId } = req.user;

  const user = await ShowUserService(userId, companyId);

  // LOG útil de depuração
  console.log(
    "DADOS DO USUÁRIO SENDO ENVIADOS PARA O FRONTEND:",
    user.toJSON()
  );

  return res.status(200).json(user);
};

export const showEmail = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { email } = req.params;

  const user = await APIShowEmailUserService(email);

  return res.status(200).json(user);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (process.env.DEMO === "ON") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { id: requestUserId, companyId, profile } = req.user;
  const { userId } = req.params;
  const userData = req.body;

  // PERMISSÃO: se não for admin, só pode alterar o próprio perfil
  if (profile !== "admin" && Number(userId) !== Number(requestUserId)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  // Segurança extra: usuário comum não pode alterar permissões sensíveis.
  if (profile !== "admin") {
    delete userData.canViewAllContacts;
    delete userData.canDeleteTickets;
  }

  // coerção booleana se vier "1"/"0" ou true/false
  if (Object.prototype.hasOwnProperty.call(userData, "canViewAllContacts")) {
    userData.canViewAllContacts = !!userData.canViewAllContacts;
  }
  if (Object.prototype.hasOwnProperty.call(userData, "blockMultipleLogins")) {
    userData.blockMultipleLogins = !!userData.blockMultipleLogins;
  }

  // Super admin (empresa 1) pode alterar usuários de qualquer empresa:
  // busca o companyId real do usuário alvo para não falhar na validação de escopo.
  let targetCompanyId = companyId;
  if (companyId === 1) {
    const targetUser = await User.findByPk(+userId, { attributes: ["companyId"] });
    if (targetUser) targetCompanyId = targetUser.companyId;
  }

  const user = await UpdateUserService({
    userData,
    userId,
    companyId: targetCompanyId,
    requestUserId: +requestUserId
  });

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-user`, {
    action: "update",
    user
  });

  return res.status(200).json(user);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { userId } = req.params;
  const { companyId, profile } = req.user;

  if (profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  if (process.env.DEMO === "ON") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const user = await User.findOne({
    where: { id: userId }
  });

  if (!user || companyId !== user.companyId) {
    return res
      .status(400)
      .json({ error: "Você não possui permissão para acessar este recurso!" });
  } else {
    await DeleteUserService(userId, companyId);

    const io = getIO();
    io.of(String(companyId)).emit(`company-${companyId}-user`, {
      action: "delete",
      userId
    });

    return res.status(200).json({ message: "User deleted" });
  }
};

export const list = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.query;
  const { companyId: userCompanyId } = req.user;

  const users = await SimpleListService({
    companyId: companyId ? +companyId : userCompanyId
  });

  return res.status(200).json(users);
};

export const mediaUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { userId } = req.params;
  const { companyId, id: requesterId, profile } = req.user;
  const files = req.files as Express.Multer.File[];
  const file = head(files);

  // PERMISSÃO: só o próprio usuário ou admin pode trocar a foto
  if (profile !== "admin" && Number(userId) !== Number(requesterId)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  try {
    let user = await User.findByPk(userId);
    if (!user) throw new AppError("User not found", 404);

    if (!file) throw new AppError("Arquivo não enviado.", 400);

    user.profileImage = file.filename.replace("/", "-");
    await user.save();

    user = await ShowUserService(userId, companyId);

    const io = getIO();
    io.of(String(companyId)).emit(`company-${companyId}-user`, {
      action: "update",
      user
    });

    return res.status(200).json({ user, message: "Imagem atualizada" });
  } catch (err: any) {
    throw new AppError(err.message);
  }
};

export const toggleChangeWidht = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { userId } = req.params;
  const { defaultTicketsManagerWidth } = req.body;

  const { companyId } = req.user;
  const user = await ToggleChangeWidthService({
    userId,
    defaultTicketsManagerWidth
  });

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-user`, {
    action: "update",
    user
  });

  return res.status(200).json(user);
};

export const getUserCreationStatus = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const setting = await Setting.findOne({
      where: {
        companyId: 1,
        key: "userCreation"
      }
    });

    if (!setting) {
      return res.status(200).json({ userCreation: "disabled" }); // Valor padrão
    }

    return res.status(200).json({ userCreation: setting.value });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Failed to fetch user creation status" });
  }
};

export const updateLanguage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { userId } = req.params;
    const { language } = req.body;
    const { profile } = req.user;

    // Validação básica do idioma
    const validLanguages = ["pt-BR", "en", "es", "tr"];
    if (!language || !validLanguages.includes(language)) {
      return res.status(400).json({
        error: "Invalid language. Must be one of: pt-BR, en, es, tr"
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Apenas admins podem alterar o idioma.
    if (profile !== "admin") {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }

    await user.update({ language });
    return res.status(200).json({ id: user.id, language: user.language });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Configuração do multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.resolve(__dirname, "..", "..", "public", "avatar");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const fileName = `${Date.now()}-${file.fieldname}${ext}`;
    cb(null, fileName);
  }
});

export const upload = multer({ storage });

export const uploadAvatar = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const userId = req.params.userId;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "Arquivo não enviado." });
  }

  try {
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    user.profileImage = `avatar/${file.filename}`;
    await user.save();

    return res
      .status(200)
      .json({ success: true, profileImage: user.profileImage });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao salvar imagem." });
  }
};
