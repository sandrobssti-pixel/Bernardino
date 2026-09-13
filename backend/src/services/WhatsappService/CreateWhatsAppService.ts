import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import Company from "../../models/Company";
import Plan from "../../models/Plan";
import AssociateWhatsappQueue from "./AssociateWhatsappQueue";
import Baileys from "../../models/Baileys"; // ❗️ 1. IMPORTAR O MODEL BAILEYS
import validateImportMessagesWindow from "./validateImportMessagesWindow";

interface Request {
  name: string;
  color?: string | null;
  companyId: number;
  queueIds?: number[];
  greetingMessage?: string;
  complationMessage?: string;
  outOfHoursMessage?: string;
  ratingMessage?: string;
  ratingThanksMessage?: string;
  status?: string;
  isDefault?: boolean;
  token?: string;
  provider?: string;
  wuzapiUrl?: string;
  wuzapiToken?: string;
  facebookUserId?: string;
  facebookUserToken?: string;
  tokenMeta?: string;
  channel?: string;
  facebookPageUserId?: string;
  maxUseBotQueues?: string;
  timeUseBotQueues?: string;
  expiresTicket?: number;
  allowGroup?: boolean;
  sendIdQueue?: number;
  timeSendQueue?: number;
  timeInactiveMessage?: string;
  inactiveMessage?: string;
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
  promptId?: number;
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

interface Response {
  whatsapp: Whatsapp;
  oldDefaultWhatsapp: Whatsapp | null;
}

const CreateWhatsAppService = async ({
  name,
  color,
  status = "OPENING",
  queueIds = [],
  greetingMessage,
  complationMessage,
  outOfHoursMessage,
  isDefault = false,
  companyId,
  token = "",
  provider = "beta",
  wuzapiUrl,
  wuzapiToken,
  facebookUserId,
  facebookUserToken,
  facebookPageUserId,
  tokenMeta,
  channel = "whatsapp",
  maxUseBotQueues,
  timeUseBotQueues,
  expiresTicket,
  allowGroup = false,
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
  promptId,
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
}: Request): Promise<Response> => {
  const normalizedColor =
    typeof color === "string" && color.trim() !== "" ? color.trim() : null;

  if (!queueIdImportMessages) {
    queueIdImportMessages = null;
  }

  const normalizedChannel = String(channel || "").toLowerCase();
  const isOfficialChannel = normalizedChannel === "whatsapp_oficial";

  validateImportMessagesWindow(importOldMessages, importRecentMessages);

  if (isOfficialChannel) {
    const requiredOfficialFields = {
      phone_number_id,
      waba_id,
      send_token,
      business_id,
      phone_number
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

  const company = await Company.findOne({
    where: {
      id: companyId
    },
    include: [{ model: Plan, as: "plan" }]
  });

  if (company !== null) {
    const whatsappCount = await Whatsapp.count({
      where: {
        companyId,
        channel: channel
      }
    });

    if (whatsappCount >= company.plan.connections) {
      throw new AppError(
        `Número máximo de conexões já alcançado: ${whatsappCount}`
      );
    }
  }

  const schema = Yup.object().shape({
    name: Yup.string()
      .required()
      .min(2)
      .test(
        "Check-name",
        "Esse nome já está sendo utilizado por outra conexão",
        async value => {
          if (!value) return false;
          const nameExists = await Whatsapp.findOne({
            where: { name: value, channel: channel, companyId }
          });
          return !nameExists;
        }
      ),
    isDefault: Yup.boolean().required(),
    color: Yup.string()
      .nullable()
      .test("Check-color", "Cor da conexão inválida", value => {
        if (!value) return true;
        const colorTestRegex = /^#[0-9a-f]{3,6}$/i;
        return colorTestRegex.test(value);
      })
  });

  try {
    await schema.validate({ name, status, isDefault, color: normalizedColor });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const whatsappFound = await Whatsapp.findOne({ where: { companyId } });

  isDefault = channel === "whatsapp" ? !whatsappFound : false;

  let oldDefaultWhatsapp: Whatsapp | null = null;

  if (channel === "whatsapp" && isDefault) {
    oldDefaultWhatsapp = await Whatsapp.findOne({
      where: { isDefault: true, companyId, channel: channel }
    });
    if (oldDefaultWhatsapp) {
      await oldDefaultWhatsapp.update({ isDefault: false, companyId });
    }
  }

  if (queueIds.length > 1 && !greetingMessage) {
    throw new AppError("ERR_WAPP_GREETING_REQUIRED");
  }

  if (token !== null && token !== "") {
    const tokenSchema = Yup.object().shape({
      token: Yup.string()
        .required()
        .min(2)
        .test(
          "Check-token",
          "This whatsapp token is already used.",
          async value => {
            if (!value) return false;
            const tokenExists = await Whatsapp.findOne({
              where: { token: value, channel: channel }
            });
            return !tokenExists;
          }
        )
    });

    try {
      await tokenSchema.validate({ token });
    } catch (err: any) {
      throw new AppError(err.message);
    }
  }

  const whatsapp = await Whatsapp.create(
    {
      name,
      color: normalizedColor,
      status,
      greetingMessage,
      complationMessage,
      outOfHoursMessage,
      ratingMessage,
      ratingThanksMessage,
      isDefault,
      companyId,
      token,
      provider,
      wuzapiUrl,
      wuzapiToken,
      proxyUrl: proxyUrl || null,
      channel,
      facebookUserId,
      facebookUserToken,
      facebookPageUserId,
      tokenMeta,
      maxUseBotQueues,
      timeUseBotQueues,
      expiresTicket,
      allowGroup,
      timeSendQueue,
      sendIdQueue,
      timeInactiveMessage,
      inactiveMessage,
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
      promptId,
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
      webchatAllowedDomains,
      webchatSettings,
      webchatActive: webchatActive !== undefined ? webchatActive : true
    },
    { include: ["queues"] }
  );

  if (
    channel === "whatsapp" &&
    String(provider || "").toLowerCase() !== "wuzapi"
  ) {
    await Baileys.create({
      whatsappId: whatsapp.id,
      companyId: whatsapp.companyId
    });
  }

  await AssociateWhatsappQueue(whatsapp, queueIds);

  return { whatsapp, oldDefaultWhatsapp };
};

export default CreateWhatsAppService;
