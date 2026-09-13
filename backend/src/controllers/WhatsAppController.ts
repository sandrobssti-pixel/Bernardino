import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import cacheLayer from "../libs/cache";
import { removeWbot, restartWbot } from "../libs/wbot";
import Whatsapp from "../models/Whatsapp";
import AppError from "../errors/AppError";
import DeleteBaileysService from "../services/BaileysServices/DeleteBaileysService";
import ShowCompanyService from "../services/CompanyService/ShowCompanyService";
import ShowPlanService from "../services/PlanService/ShowPlanService";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";

import CreateWhatsAppService from "../services/WhatsappService/CreateWhatsAppService";
import CloseActiveTicketsByWhatsappService from "../services/WhatsappService/CloseActiveTicketsByWhatsappService";
import DeleteWhatsAppService from "../services/WhatsappService/DeleteWhatsAppService";
import ListWhatsAppsService from "../services/WhatsappService/ListWhatsAppsService";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import UpdateWhatsAppService from "../services/WhatsappService/UpdateWhatsAppService";
import { closeTicketsImported } from "../services/WhatsappService/ImportWhatsAppMessageService";
import ShowWhatsAppServiceAdmin from "../services/WhatsappService/ShowWhatsAppServiceAdmin";
import UpdateWhatsAppServiceAdmin from "../services/WhatsappService/UpdateWhatsAppServiceAdmin";
import ListAllWhatsAppsService from "../services/WhatsappService/ListAllWhatsAppService";
import ListFilterWhatsAppsService from "../services/WhatsappService/ListFilterWhatsAppsService";
import MigrateWhatsAppOwnershipService from "../services/WhatsappService/MigrateWhatsAppOwnershipService";
import User from "../models/User";
import {
  isWuzapiProvider,
  removeWuzapiAdminUser,
  wuzapiLogoutSession
} from "../services/WuzapiServices/wuzapiClient";
import WhatsAppOfficialTemplate from "../models/WhatsAppOfficialTemplate";
import {
  CreateCompanyConnectionOficial,
  DeleteConnectionWhatsAppOficial,
  UpdateConnectionWhatsAppOficial
} from "../libs/whatsAppOficial/whatsAppOficial.service";
import {
  ICreateConnectionWhatsAppOficialCompany,
  ICreateConnectionWhatsAppOficialWhatsApp,
  IUpdateonnectionWhatsAppOficialWhatsApp
} from "../libs/whatsAppOficial/IWhatsAppOficial.interfaces";
import SyncWhatsAppOfficialTemplatesService from "../services/WhatsAppOficial/SyncWhatsAppOfficialTemplatesService";
import TestWhatsAppOficialConnectionService from "../services/WhatsAppOficial/TestWhatsAppOficialConnectionService";
import RegisterWhatsAppOficialNumberService from "../services/WhatsAppOficial/RegisterWhatsAppOficialNumberService";
import GetGlobalChannelAvailability from "../helpers/GlobalChannelAvailability";

interface WhatsappData {
  name: string;
  color?: string | null;
  queueIds: number[];
  companyId: number;
  greetingMessage?: string;
  complationMessage?: string;
  outOfHoursMessage?: string;
  status?: string;
  isDefault?: boolean;
  token?: string;
  provider?: string;
  wuzapiUrl?: string;
  wuzapiToken?: string;
  maxUseBotQueues?: string;
  timeUseBotQueues?: string;
  expiresTicket?: number;
  allowGroup?: false;
  sendIdQueue?: number;
  timeSendQueue?: number;
  timeInactiveMessage?: string;
  inactiveMessage?: string;
  ratingMessage?: string;
  ratingThanksMessage?: string;
  maxUseBotQueuesNPS?: number;
  expiresTicketNPS?: number;
  whenExpiresTicket?: string;
  expiresInactiveMessage?: string;
  importOldMessages?: string;
  importRecentMessages?: string;
  importOldMessagesGroups?: boolean;
  closedTicketsPostImported?: boolean;
  groupAsTicket?: string;
  timeCreateNewTicket?: number;
  schedules?: any[];
  integrationId?: number;
  promptId?: number;
  collectiveVacationMessage?: string;
  collectiveVacationStart?: string;
  collectiveVacationEnd?: string;
  queueIdImportMessages?: number;
  channel?: string;
  phone_number_id?: string;
  waba_id?: string;
  send_token?: string;
  business_id?: string;
  phone_number?: string;
  waba_webhook?: string;
  waba_webhook_id?: number;
  flowIdNotPhrase?: number;
  flowIdWelcome?: number;
  proxyUrl?: string;
  webchatAllowedDomains?: string;
  webchatSettings?: object;
  webchatActive?: boolean;
}

interface QueryParams {
  session?: number | string;
  channel?: string;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { session } = req.query as QueryParams;
  const whatsapps = await ListWhatsAppsService({ companyId, session });

  return res.status(200).json(whatsapps);
};

export const indexFilter = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { session, channel } = req.query as QueryParams;

  const whatsapps = await ListFilterWhatsAppsService({
    companyId,
    session,
    channel
  });

  return res.status(200).json(whatsapps);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const {
    name,
    color,
    status,
    isDefault,
    greetingMessage,
    complationMessage,
    outOfHoursMessage,
    queueIds,
    token,
    provider,
    wuzapiUrl,
    wuzapiToken,
    maxUseBotQueues,
    timeUseBotQueues,
    expiresTicket,
    allowGroup,
    timeSendQueue,
    sendIdQueue,
    timeInactiveMessage,
    inactiveMessage,
    ratingMessage,
    ratingThanksMessage,
    maxUseBotQueuesNPS,
    expiresTicketNPS,
    whenExpiresTicket,
    expiresInactiveMessage,
    importOldMessages,
    importRecentMessages,
    closedTicketsPostImported,
    importOldMessagesGroups,
    groupAsTicket,
    timeCreateNewTicket,
    schedules,
    integrationId,
    promptId,
    collectiveVacationEnd,
    collectiveVacationMessage,
    collectiveVacationStart,
    queueIdImportMessages,
    channel = "whatsapp",
    phone_number_id,
    waba_id,
    send_token,
    business_id,
    phone_number,
    waba_webhook,
    waba_webhook_id,
    flowIdNotPhrase,
    flowIdWelcome,
    proxyUrl,
    webchatAllowedDomains,
    webchatSettings,
    webchatActive
  }: WhatsappData = req.body;
  const { companyId } = req.user;

  const company = await ShowCompanyService(companyId);
  const plan = await ShowPlanService(company.planId);
  const globalChannels = await GetGlobalChannelAvailability();

  if (!plan.useWhatsapp) {
    return res.status(400).json({
      error: "Você não possui permissão para acessar este recurso!"
    });
  }

  const normalizedProvider = String(provider || "beta").toLowerCase();
  const isWuzapi = normalizedProvider === "wuzapi";
  const isWhatsAppConnection = channel === "whatsapp";

  if (isWhatsAppConnection) {
    if (isWuzapi && !globalChannels.whatsappWuzapi) {
      return res.status(400).json({
        error: "WhatsApp (wuzAPI) está desabilitado globalmente no Painel SaaS."
      });
    }

    if (!isWuzapi && !globalChannels.whatsappBaileys) {
      return res.status(400).json({
        error: "WhatsApp (Baileys) está desabilitado globalmente no Painel SaaS."
      });
    }

    if (isWuzapi && plan.useWhatsappWuzapi === false) {
      return res.status(400).json({
        error: "WhatsApp (wuzAPI) não está habilitado no plano."
      });
    }

    if (!isWuzapi && plan.useWhatsappBaileys === false) {
      return res.status(400).json({
        error: "WhatsApp (Baileys) não está habilitado no plano."
      });
    }
  }

  if (channel === "whatsapp_oficial" && !globalChannels.whatsappOfficial) {
    return res.status(400).json({
      error: "WhatsApp (API Oficial) está desabilitado globalmente no Painel SaaS."
    });
  }

  if (channel === "whatsapp_oficial" && plan.useWhatsappOficial === false) {
    return res.status(400).json({
      error: "WhatsApp (API Oficial) não está habilitado no plano."
    });
  }

  if (channel === "webchat" && !globalChannels.webchat) {
    return res.status(400).json({
      error: "Webchat está desabilitado globalmente no Painel SaaS."
    });
  }

  if (channel === "webchat" && plan.useWebchat === false) {
    return res.status(400).json({
      error: "Webchat não está habilitado no plano."
    });
  }

  console.log("================ WhatsAppController ==============");
  console.log(req.body);
  console.log("==================================================");

  // 🔹 Forçar status inicial como DESCONHECTADO, para não ficar em "CONECTANDO"
  // até o usuário clicar em "QR CODE".
  const initialStatus = status || "DISCONNECTED";

  const { whatsapp, oldDefaultWhatsapp } = await CreateWhatsAppService({
    name,
    color,
    status: initialStatus,
    isDefault,
    greetingMessage,
    complationMessage,
    outOfHoursMessage,
    queueIds,
    companyId,
    token,
    provider,
    wuzapiUrl,
    wuzapiToken,
    maxUseBotQueues,
    timeUseBotQueues,
    expiresTicket,
    allowGroup,
    timeSendQueue,
    sendIdQueue,
    timeInactiveMessage,
    inactiveMessage,
    ratingMessage,
    ratingThanksMessage,
    maxUseBotQueuesNPS,
    expiresTicketNPS,
    whenExpiresTicket,
    expiresInactiveMessage,
    importOldMessages,
    importRecentMessages,
    closedTicketsPostImported,
    importOldMessagesGroups,
    groupAsTicket,
    timeCreateNewTicket,
    schedules,
    integrationId,
    promptId,
    collectiveVacationEnd,
    collectiveVacationMessage,
    collectiveVacationStart,
    queueIdImportMessages,
    channel,
    phone_number_id,
    waba_id,
    send_token,
    business_id,
    phone_number,
    waba_webhook,
    waba_webhook_id,
    flowIdNotPhrase,
    flowIdWelcome,
    proxyUrl,
    webchatAllowedDomains,
    webchatSettings,
    webchatActive
  });

  if (whatsapp.channel === "whatsapp_oficial") {
    try {
      const companyData: ICreateConnectionWhatsAppOficialCompany = {
        companyId: String(whatsapp.companyId),
        companyName: company.name
      };

      const whatsAppData: ICreateConnectionWhatsAppOficialWhatsApp = {
        token_mult100: whatsapp.token,
        phone_number_id: whatsapp.phone_number_id,
        waba_id: whatsapp.waba_id,
        send_token: whatsapp.send_token,
        business_id: whatsapp.business_id,
        phone_number: whatsapp.phone_number,
        idEmpresaMult100: whatsapp.companyId
      };

      const { webhookLink, connectionId } = await CreateCompanyConnectionOficial({
        email: company.email,
        company: companyData,
        whatsApp: whatsAppData
      });

      if (webhookLink) {
        await whatsapp.update({
          waba_webhook: webhookLink,
          waba_webhook_id: connectionId,
          status: "CONNECTED"
        });
      }
    } catch (error: any) {
      console.error("[whatsapp_oficial] erro ao registrar conexão na API oficial:", error?.message || error);
    }
  }

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-whatsapp`, {
    action: "update",
    whatsapp
  });

  if (oldDefaultWhatsapp) {
    io.of(String(companyId)).emit(`company-${companyId}-whatsapp`, {
      action: "update",
      whatsapp: oldDefaultWhatsapp
    });
  }

  return res.status(200).json(whatsapp);
};

export const storeFacebook = async (req: Request, res: Response): Promise<Response> => {
  return res.status(410).json({
    error:
      "O fluxo legado de Facebook/Instagram foi descontinuado. Use as novas conexões Meta por empresa na tela de Conexões."
  });
};


export const show = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;
  const { session } = req.query;

  const whatsapp = await ShowWhatsAppService(whatsappId, companyId, session);

  return res.status(200).json(whatsapp);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const whatsappData = req.body;
  const { companyId } = req.user;

  const { whatsapp, oldDefaultWhatsapp } = await UpdateWhatsAppService({
    whatsappData,
    whatsappId,
    companyId
  });

  if (whatsapp.channel === "whatsapp_oficial" && whatsapp.waba_webhook_id) {
    try {
      const payload: IUpdateonnectionWhatsAppOficialWhatsApp = {
        token_mult100: whatsapp.token,
        phone_number_id: whatsapp.phone_number_id,
        waba_id: whatsapp.waba_id,
        send_token: whatsapp.send_token,
        business_id: whatsapp.business_id,
        phone_number: whatsapp.phone_number
      };
      await UpdateConnectionWhatsAppOficial(whatsapp.waba_webhook_id, payload);
    } catch (error: any) {
      console.error("[whatsapp_oficial] erro ao atualizar conexão na API oficial:", error?.message || error);
    }
  }

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-whatsapp`, {
    action: "update",
    whatsapp
  });

  if (oldDefaultWhatsapp) {
    io.of(String(companyId)).emit(`company-${companyId}-whatsapp`, {
      action: "update",
      whatsapp: oldDefaultWhatsapp
    });
  }

  return res.status(200).json(whatsapp);
};

export const toggleWebchatActive = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { active } = req.body;
  const { companyId } = req.user;

  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);

  if (whatsapp.channel !== "webchat") {
    throw new AppError("Esta ação é exclusiva para conexões de webchat", 400);
  }

  const isActive = Boolean(active);

  // Webchat não tem sessão/QR — "status" aqui só existe para alimentar o
  // badge da coluna Status na tela de Conexões, então mantemos os dois
  // campos em sincronia com o mesmo clique.
  await whatsapp.update({
    webchatActive: isActive,
    status: isActive ? "CONNECTED" : "DISCONNECTED"
  });

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-whatsapp`, {
    action: "update",
    whatsapp
  });

  return res.status(200).json(whatsapp);
};

export const closedTickets = async (req: Request, res: Response) => {
  const { whatsappId } = req.params;

  closeTicketsImported(whatsappId);

  return res.status(200).json("whatsapp");
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId, profile } = req.user;
  const io = getIO();

  if (profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  console.log("REMOVING WHATSAPP", whatsappId);
  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);

  if (whatsapp.channel === "whatsapp") {
    await CloseActiveTicketsByWhatsappService({
      companyId,
      whatsappIds: [whatsappId]
    });

    if (!isWuzapiProvider(whatsapp)) {
      await DeleteBaileysService(whatsappId);
    } else {
      try {
        await wuzapiLogoutSession(whatsapp);
      } catch {}
      try {
        await removeWuzapiAdminUser(whatsapp);
      } catch {}
    }
    await DeleteWhatsAppService(whatsappId);
    await cacheLayer.delFromPattern(`sessions:${whatsappId}:*`);
    removeWbot(+whatsappId);

    io.of(String(companyId)).emit(`company-${companyId}-whatsapp`, {
      action: "delete",
      whatsappId: +whatsappId
    });
  }

  if (whatsapp.channel === "facebook" || whatsapp.channel === "instagram") {
    const { facebookUserToken } = whatsapp;

    const getAllSameToken = await Whatsapp.findAll({
      where: {
        companyId,
        facebookUserToken
      }
    });

    await CloseActiveTicketsByWhatsappService({
      companyId,
      whatsappIds: getAllSameToken.map(item => item.id)
    });

    await Whatsapp.destroy({
      where: {
        companyId,
        facebookUserToken
      }
    });

    for await (const whatsapp of getAllSameToken) {
      io.of(String(companyId)).emit(`company-${companyId}-whatsapp`, {
        action: "delete",
        whatsappId: whatsapp.id
      });
    }
  }

  if (whatsapp.channel === "whatsapp_oficial") {
    await CloseActiveTicketsByWhatsappService({
      companyId,
      whatsappIds: [whatsappId]
    });

    if (whatsapp.waba_webhook_id) {
      try {
        await DeleteConnectionWhatsAppOficial(whatsapp.waba_webhook_id);
      } catch {}
    }

    await DeleteWhatsAppService(whatsappId);
    io.of(String(companyId)).emit(`company-${companyId}-whatsapp`, {
      action: "delete",
      whatsappId: +whatsappId
    });
  }

  if (whatsapp.channel === "webchat") {
    await CloseActiveTicketsByWhatsappService({
      companyId,
      whatsappIds: [whatsappId]
    });

    await DeleteWhatsAppService(whatsappId);
    io.of(String(companyId)).emit(`company-${companyId}-whatsapp`, {
      action: "delete",
      whatsappId: +whatsappId
    });
  }

  return res.status(200).json({ message: "Session disconnected." });
};

export const restart = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, profile, id } = req.user;

  const user = await User.findByPk(id);
  const { allowConnections } = user;

  if (profile !== "admin" && allowConnections === "disabled") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await restartWbot(companyId);

  return res.status(200).json({ message: "Whatsapp restart." });
};

export const listAll = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { session } = req.query as QueryParams;
  const whatsapps = await ListAllWhatsAppsService({ session });
  return res.status(200).json(whatsapps);
};

export const updateAdmin = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const whatsappData = req.body;
  const { companyId } = req.user;

  const { whatsapp, oldDefaultWhatsapp } = await UpdateWhatsAppServiceAdmin({
    whatsappData,
    whatsappId,
    companyId
  });

  const io = getIO();
  io.of(String(companyId)).emit(`admin-whatsapp`, {
    action: "update",
    whatsapp
  });

  if (oldDefaultWhatsapp) {
    io.of(String(companyId)).emit(`admin-whatsapp`, {
      action: "update",
      whatsapp: oldDefaultWhatsapp
    });
  }

  return res.status(200).json(whatsapp);
};

export const removeAdmin = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;
  const io = getIO();
  console.log("REMOVING WHATSAPP ADMIN", whatsappId);
  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);

  if (whatsapp.channel === "whatsapp") {
    if (!isWuzapiProvider(whatsapp)) {
      await DeleteBaileysService(whatsappId);
    } else {
      try {
        await wuzapiLogoutSession(whatsapp);
      } catch {}
      try {
        await removeWuzapiAdminUser(whatsapp);
      } catch {}
    }
    await DeleteWhatsAppService(whatsappId);
    await cacheLayer.delFromPattern(`sessions:${whatsappId}:*`);
    removeWbot(+whatsappId);

    io.of(String(companyId)).emit(`admin-whatsapp`, {
      action: "delete",
      whatsappId: +whatsappId
    });
  }

  if (whatsapp.channel === "facebook" || whatsapp.channel === "instagram") {
    const { facebookUserToken } = whatsapp;
    const targetCompanyId = whatsapp.companyId;

    const getAllSameToken = await Whatsapp.findAll({
      where: {
        companyId: targetCompanyId,
        facebookUserToken
      }
    });

    await Whatsapp.destroy({
      where: {
        companyId: targetCompanyId,
        facebookUserToken
      }
    });

    for await (const whatsapp of getAllSameToken) {
      io.of(String(targetCompanyId)).emit(`company-${targetCompanyId}-whatsapp`, {
        action: "delete",
        whatsappId: whatsapp.id
      });
    }
  }

  if (whatsapp.channel === "whatsapp_oficial") {
    if (whatsapp.waba_webhook_id) {
      try {
        await DeleteConnectionWhatsAppOficial(whatsapp.waba_webhook_id);
      } catch {}
    }

    await DeleteWhatsAppService(whatsappId);
    io.of(String(companyId)).emit(`admin-whatsapp`, {
      action: "delete",
      whatsappId: +whatsappId
    });
  }

  if (whatsapp.channel === "webchat") {
    await DeleteWhatsAppService(whatsappId);
    io.of(String(companyId)).emit(`admin-whatsapp`, {
      action: "delete",
      whatsappId: +whatsappId
    });
  }

  return res.status(200).json({ message: "Session disconnected." });
};

export const showAdmin = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;
  const whatsapp = await ShowWhatsAppServiceAdmin(whatsappId);

  return res.status(200).json(whatsapp);
};

export const migrateOwnership = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { sourceWhatsappId, targetWhatsappId } = req.params;
  const { companyId, profile } = req.user;

  if (profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const migrationResult = await MigrateWhatsAppOwnershipService({
    sourceWhatsappId: Number(sourceWhatsappId),
    targetWhatsappId: Number(targetWhatsappId),
    companyId
  });

  return res.status(200).json(migrationResult);
};

export const syncOfficialTemplates = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const result = await SyncWhatsAppOfficialTemplatesService({
    whatsappId: Number(whatsappId),
    companyId
  });

  return res.status(200).json(result);
};

export const testOfficialConnection = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const result = await TestWhatsAppOficialConnectionService({
    whatsappId: Number(whatsappId),
    companyId
  });

  return res.status(200).json(result);
};

export const registerOfficialNumber = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const result = await RegisterWhatsAppOficialNumberService({
    whatsappId: Number(whatsappId),
    companyId
  });

  return res.status(200).json(result);
};

export const listOfficialTemplates = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);
  if (String(whatsapp.channel || "").toLowerCase() !== "whatsapp_oficial") {
    throw new AppError("A conexão informada não é WhatsApp API Oficial", 400);
  }

  const templates = await WhatsAppOfficialTemplate.findAll({
    where: { whatsappId: whatsapp.id },
    order: [["name", "ASC"]]
  });

  return res.status(200).json({ templates });
};

export const showOfficialTemplate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId, templateId } = req.params;
  const { companyId } = req.user;

  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);
  if (String(whatsapp.channel || "").toLowerCase() !== "whatsapp_oficial") {
    throw new AppError("A conexão informada não é WhatsApp API Oficial", 400);
  }

  const template = await WhatsAppOfficialTemplate.findOne({
    where: { whatsappId: whatsapp.id, templateIdMeta: String(templateId) }
  });

  if (!template) {
    throw new AppError("Template não encontrado", 404);
  }

  return res.status(200).json({ template });
};
