import * as Yup from "yup";
import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import ShowWhatsAppService from "./ShowWhatsAppService";
import AssociateWhatsappQueue from "./AssociateWhatsappQueue";
import validateImportMessagesWindow from "./validateImportMessagesWindow";

interface WhatsappData {
  name?: string;
  color?: string | null;
  status?: string;
  session?: string;
  isDefault?: boolean;
  greetingMessage?: string;
  complationMessage?: string;
  outOfHoursMessage?: string;
  queueIds?: number[];
  token?: string;
  provider?: string;
  wuzapiUrl?: string;
  wuzapiToken?: string;
  maxUseBotQueues?: number;
  timeUseBotQueues?: string;
  expiresTicket?: string;
  allowGroup?: boolean;
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
  groupAsTicket?: string;
  importOldMessages?: string;
  importRecentMessages?: string;
  importOldMessagesGroups?: boolean;
  closedTicketsPostImported?: boolean;
  timeCreateNewTicket?: number;
  integrationId?: number;
  schedules?: any[];
  holidaySchedules?: any[];
  promptId?: number;
  requestQR?: boolean;
  collectiveVacationMessage?: string;
  collectiveVacationStart?: string;
  collectiveVacationEnd?: string;
  queueIdImportMessages?: number;
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

interface Request {
  whatsappData: WhatsappData;
  whatsappId: string;
  companyId: number;
}

interface Response {
  whatsapp: Whatsapp;
  oldDefaultWhatsapp: Whatsapp | null;
}

const UpdateWhatsAppService = async ({
  whatsappData,
  whatsappId,
  companyId
}: Request): Promise<Response> => {
  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    status: Yup.string(),
    isDefault: Yup.boolean()
  });

  const {
    name,
    color,
    status,
    isDefault,
    session,
    greetingMessage,
    complationMessage,
    outOfHoursMessage,
    queueIds = [],
    token,
    provider,
    wuzapiUrl,
    wuzapiToken,
    maxUseBotQueues = 0,
    timeUseBotQueues = 0,
    expiresTicket = 0,
    allowGroup,
    timeSendQueue = 0,
    sendIdQueue = null,
    timeInactiveMessage = 0,
    inactiveMessage,
    ratingMessage,
    ratingThanksMessage,
    maxUseBotQueuesNPS,
    expiresTicketNPS = 0,
    whenExpiresTicket,
    expiresInactiveMessage,
    groupAsTicket,
    importOldMessages,
    importRecentMessages,
    closedTicketsPostImported,
    importOldMessagesGroups,
    timeCreateNewTicket = null,
    integrationId,
    schedules,
    holidaySchedules,
    promptId,
    requestQR = false,
    collectiveVacationEnd,
    collectiveVacationMessage,
    collectiveVacationStart,
    queueIdImportMessages,
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
  } = whatsappData;

  const normalizedColor =
    typeof color === "string" && color.trim() !== "" ? color.trim() : null;

  try {
    await schema
      .shape({
        color: Yup.string()
          .nullable()
          .test("Check-color", "Cor da conexão inválida", value => {
            if (!value) return true;
            const colorTestRegex = /^#[0-9a-f]{3,6}$/i;
            return colorTestRegex.test(value);
          })
      })
      .validate({ name, status, isDefault, color: normalizedColor });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  if (queueIds.length > 1 && !greetingMessage) {
    throw new AppError("ERR_WAPP_GREETING_REQUIRED");
  }

  validateImportMessagesWindow(importOldMessages, importRecentMessages);

  let oldDefaultWhatsapp: Whatsapp | null = null;

  if (isDefault) {
    oldDefaultWhatsapp = await Whatsapp.findOne({
      where: {
        isDefault: true,
        id: { [Op.not]: whatsappId },
        companyId
      }
    });
    if (oldDefaultWhatsapp) {
      await oldDefaultWhatsapp.update({ isDefault: false });
    }
  }
  // console.log("GETTING WHATSAPP SHOW WHATSAPP 1", whatsappId, companyId)
  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);

  const resolvedChannel = String(whatsapp.channel || "").toLowerCase();
  if (resolvedChannel === "whatsapp_oficial") {
    const requiredOfficialFields = {
      phone_number_id: phone_number_id ?? whatsapp.phone_number_id,
      waba_id: waba_id ?? whatsapp.waba_id,
      send_token: send_token ?? whatsapp.send_token,
      business_id: business_id ?? whatsapp.business_id,
      phone_number: phone_number ?? whatsapp.phone_number
    };

    const missing = Object.entries(requiredOfficialFields)
      .filter(([, value]) => !String(value || "").trim())
      .map(([key]) => key);

    if (missing.length > 0) {
      throw new AppError(
        `Campos obrigatórios da API Oficial ausentes: ${missing.join(", ")}`
      );
    }
  }


  await whatsapp.update({
    name,
    color: normalizedColor,
    status,
    session,
    greetingMessage,
    complationMessage,
    outOfHoursMessage,
    isDefault,
    companyId,
    token,
    provider,
    wuzapiUrl,
    wuzapiToken,
    proxyUrl: proxyUrl !== undefined ? (proxyUrl || null) : undefined,
    maxUseBotQueues: maxUseBotQueues || 0,
    timeUseBotQueues: timeUseBotQueues || 0,
    expiresTicket: expiresTicket || 0,
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
    groupAsTicket,
    importOldMessages,
    importRecentMessages,
    closedTicketsPostImported,
    importOldMessagesGroups,
    timeCreateNewTicket,
    integrationId,
    schedules,
    holidaySchedules,
    promptId,
    collectiveVacationEnd,
    collectiveVacationMessage,
    collectiveVacationStart,
    queueIdImportMessages: queueIdImportMessages || null,
    phone_number_id,
    waba_id,
    send_token,
    business_id,
    phone_number,
    waba_webhook,
    waba_webhook_id,
    flowIdNotPhrase,
    flowIdWelcome,
    webchatAllowedDomains,
    webchatSettings,
    webchatActive
  });

  if (!requestQR) {
    await AssociateWhatsappQueue(whatsapp, queueIds);
  }

  return { whatsapp, oldDefaultWhatsapp };
};

export default UpdateWhatsAppService;
