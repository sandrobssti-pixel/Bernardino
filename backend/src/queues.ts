import * as Sentry from "@sentry/node";
import BullQueue from "bull";
import { MessageData, SendMessage } from "./helpers/SendMessage";
import Whatsapp from "./models/Whatsapp";
import logger from "./utils/logger";
import moment from "moment";
import Schedule from "./models/Schedule";
import { Op, QueryTypes, Sequelize } from "sequelize";
import GetDefaultWhatsApp from "./helpers/GetDefaultWhatsApp";
import Campaign from "./models/Campaign";
import Queues from "./models/Queue";
import ContactList from "./models/ContactList";
import ContactListItem from "./models/ContactListItem";
import { isEmpty, isNil, isArray } from "lodash";
import CampaignSetting from "./models/CampaignSetting";
import CampaignShipping from "./models/CampaignShipping";
import GetWhatsappWbot from "./helpers/GetWhatsappWbot";
import sequelize from "./database";
import { getMessageOptions } from "./services/WbotServices/SendWhatsAppMedia";
import { getIO } from "./libs/socket";
import path from "path";
import User from "./models/User";
import Company from "./models/Company";
import Contact from "./models/Contact";
import Queue from "./models/Queue";
import { ClosedAllOpenTickets } from "./services/WbotServices/wbotClosedTickets";
import { runSlaMonitor } from "./services/SupervisorPanelService/SlaMonitorService";
import Ticket from "./models/Ticket";
import ShowContactService from "./services/ContactServices/ShowContactService";
import UserQueue from "./models/UserQueue";
import ShowTicketService from "./services/TicketServices/ShowTicketService";
import SendWhatsAppMessage from "./services/WbotServices/SendWhatsAppMessage";
import UpdateTicketService from "./services/TicketServices/UpdateTicketService";
import { addSeconds, differenceInSeconds } from "date-fns";
import { GetWhatsapp } from "./helpers/GetWhatsapp";
const CronJob = require("cron").CronJob;
import CompaniesSettings from "./models/CompaniesSettings";
import {
  verifyMediaMessage,
  verifyMessage
} from "./services/WbotServices/wbotMessageListener";
import FindOrCreateTicketService from "./services/TicketServices/FindOrCreateTicketService";
import CreateLogTicketService from "./services/TicketServices/CreateLogTicketService";
import formatBody from "./helpers/Mustache";
import TicketTag from "./models/TicketTag";
import Tag from "./models/Tag";
import Plan from "./models/Plan";
import Invoices from "./models/Invoices";
import parseCurrencyValue from "./helpers/parseCurrencyValue";
import Setting from "./models/Setting";
import GetGlobalConfig from "./helpers/GetGlobalConfig";
import SendWelcomeEmail from "./helpers/SendWelcomeEmail";
import { getWbot } from "./libs/wbot";
import CreateMessageService from "./services/MessageServices/CreateMessageService";
// NOVO: Importações necessárias para a funcionalidade
import ShowFileService from "./services/FileServices/ShowService";
import Files from "./models/Files";
import OfficialCampaign from "./models/OfficialCampaign";
import OfficialCampaignShipping from "./models/OfficialCampaignShipping";
import SendWhatsAppOficialMessage from "./services/WhatsAppOficial/SendWhatsAppOficialMessage";
import mime from "mime-types";
import {
  assertOfficialTemplateSupported,
  buildOfficialTemplateComponents,
  buildOfficialTemplatePreview
} from "./utils/officialTemplate";
import { normalizeCampaignContactNumber } from "./utils/normalizeCampaignContactNumber";

const connection = process.env.REDIS_URI || "";
const limiterMax = process.env.REDIS_OPT_LIMITER_MAX || 1;
const limiterDuration = process.env.REDIS_OPT_LIMITER_DURATION || 3000;

interface ProcessCampaignData {
  id: number;
  delay: number;
}

interface CampaignSettings {
  messageInterval: number;
  longerIntervalAfter: number;
  greaterInterval: number;
  variables: any[];
}

interface PrepareContactData {
  contactId: number;
  campaignId: number;
  delay: number;
  variables: any[];
}

interface DispatchCampaignData {
  campaignId: number;
  campaignShippingId: number;
  contactListItemId: number;
}

interface ProcessOfficialCampaignData {
  id: number;
  delay: number;
}

interface PrepareOfficialContactData {
  contactId: number;
  officialCampaignId: number;
  delay: number;
}

interface DispatchOfficialCampaignData {
  officialCampaignId: number;
  officialCampaignShippingId: number;
  contactListItemId: number;
}

export const userMonitor = new BullQueue("UserMonitor", connection);
export const scheduleMonitor = new BullQueue("ScheduleMonitor", connection);
export const sendScheduledMessages = new BullQueue(
  "SendSacheduledMessages",
  connection
);
export const campaignQueue = new BullQueue("CampaignQueue", connection);
export const queueMonitor = new BullQueue("QueueMonitor", connection);

export const messageQueue = new BullQueue("MessageQueue", connection, {
  limiter: {
    max: limiterMax as number,
    duration: limiterDuration as number
  }
});

let isProcessing = false;
let isOfficialProcessing = false;

async function handleSendMessage(job) {
  try {
    const { data } = job;

    const whatsapp = await Whatsapp.findByPk(data.whatsappId);

    if (whatsapp === null) {
      throw Error("Whatsapp não identificado");
    }

    const messageData: MessageData = data.data;

    await SendMessage(whatsapp, messageData);
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("MessageQueue -> SendMessage: error", e.message);
    throw e;
  }
}

async function handleVerifySchedules(job) {
  try {
    // Janela alinhada ao intervalo de verificação (60s, via setInterval).
    // Antes a janela olhava só 30s para a frente a partir de "agora", o
    // que funcionava enquanto essa checagem rodava por um cron do Bull
    // alinhado ao segundo 0 de cada minuto. Com o setInterval nativo (que
    // não é alinhado ao relógio), o disparo desse job passou a cair em
    // um segundo aleatório dentro do minuto, e agendamentos com sendAt no
    // minuto "cheio" (segundos = 00, como são criados pelo formulário)
    // podiam nunca cair dentro da janela de 30s — ficando presos para
    // sempre em status PENDENTE. Agora a janela também olha para trás,
    // cobrindo com folga o intervalo de 60s entre checagens.
    const { count, rows: schedules } = await Schedule.findAndCountAll({
      where: {
        status: "PENDENTE",
        sentAt: null,
        sendAt: {
          [Op.gte]: moment()
            .subtract(65, "seconds")
            .format("YYYY-MM-DD HH:mm:ss"),
          [Op.lte]: moment().format("YYYY-MM-DD HH:mm:ss")
        }
      },
      include: [
        { model: Contact, as: "contact" },
        { model: User, as: "user", attributes: ["name"] }
      ],
      distinct: true,
      subQuery: false
    });

    if (count > 0) {
      for (const schedule of schedules) {
        await schedule.update({
          status: "AGENDADA"
        });
        await sendScheduledMessages.add(
          "SendMessage",
          { schedule },
          { delay: 40000 }
        );
        logger.info(`Disparo agendado para: ${schedule.contact.name}`);
      }
    }
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("SendScheduledMessage -> Verify: error", e.message);
    throw e;
  }
}

async function handleSendScheduledMessage(job) {
  const {
    data: { schedule }
  } = job;
  let scheduleRecord: Schedule | null = null;
  let providerForLog: string | null = null;
  let whatsappStatusForLog: string | null = null;
  let destinationForLog: string | null = null;

  const resolveScheduleDestination = (scheduleData: any, whatsappData: any): string => {
    const isWuzapi =
      String(whatsappData?.provider || "").toLowerCase() === "wuzapi";
    if (!isWuzapi) {
      return String(scheduleData?.contact?.number || "");
    }

    const preferred = [
      scheduleData?.contact?.jid,
      scheduleData?.contact?.lid,
      scheduleData?.contact?.remoteJid,
      scheduleData?.contact?.number
    ].find(value => String(value || "").trim() !== "");

    return String(preferred || "");
  };

  try {
    scheduleRecord = await Schedule.findByPk(schedule.id);
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error(
      { err: e, scheduleId: schedule.id },
      `Erro ao tentar consultar agendamento: ${schedule.id}`
    );
  }

  if (scheduleRecord?.status === "CANCELADA") {
    logger.info(
      { scheduleId: schedule?.id, companyId: schedule?.companyId },
      "SendScheduledMessage -> agendamento cancelado, envio ignorado"
    );
    return;
  }

  try {
    let whatsapp;
    const messageBody = typeof schedule?.body === "string" ? schedule.body : "";
    let sentMessageRef: any = null;

    if (!isNil(schedule.whatsappId)) {
      whatsapp = await Whatsapp.findByPk(schedule.whatsappId);
    }

    if (!whatsapp) {
      whatsapp = await GetDefaultWhatsApp(schedule.companyId, schedule.whatsappId);
    }
    if (!whatsapp) {
      throw new Error(
        `Nenhuma conexão WhatsApp encontrada para companyId=${schedule.companyId} whatsappId=${schedule.whatsappId}`
      );
    }

    providerForLog = whatsapp?.provider || null;
    whatsappStatusForLog = whatsapp?.status || null;

    logger.info(
      {
        scheduleId: schedule?.id,
        companyId: schedule?.companyId,
        whatsappId: whatsapp?.id,
        provider: whatsapp?.provider,
        whatsappStatus: whatsapp?.status,
        contactId: schedule?.contactId
      },
      "SendScheduledMessage -> iniciando disparo"
    );

    if (whatsapp.status !== "CONNECTED") {
      logger.warn(
        {
          scheduleId: schedule?.id,
          companyId: schedule?.companyId,
          whatsappId: whatsapp?.id,
          whatsappStatus: whatsapp?.status
        },
        "SendScheduledMessage -> conexao whatsapp nao esta CONNECTED, envio pode falhar"
      );
    }

    let filePath = null;
    if (schedule.mediaPath) {
      filePath = path.resolve(
        "public",
        `company${schedule.companyId}`,
        schedule.mediaPath
      );
    }

    const isOfficialSchedule = whatsapp.channel === "whatsapp_oficial";

    if (schedule.openTicket === "enabled" || isOfficialSchedule) {
      let ticket = await Ticket.findOne({
        where: {
          contactId: schedule.contact.id,
          companyId: schedule.companyId,
          whatsappId: whatsapp.id,
          status: ["open", "pending"]
        }
      });

      if (!ticket)
        ticket = await Ticket.create({
          companyId: schedule.companyId,
          contactId: schedule.contactId,
          whatsappId: whatsapp.id,
          queueId: schedule.queueId,
          userId: schedule.ticketUserId,
          // Quando o disparo \u00e9 "sem abrir ticket" (openTicket disabled),
          // a API Oficial ainda precisa de um ticket como container da
          // mensagem, ent\u00e3o ele \u00e9 criado j\u00e1 fechado, sem aparecer como
          // atendimento aberto para o agente.
          status:
            schedule.openTicket === "enabled" ? schedule.statusTicket : "closed"
        });

      ticket = await ShowTicketService(ticket.id, schedule.companyId);

      let bodyMessage;

      // @ts-ignore: Unreachable code error
      if (schedule.assinar && !isNil(schedule.userId)) {
        bodyMessage = `*${schedule?.user?.name}:*\n${messageBody.trim()}`;
      } else {
        bodyMessage = messageBody.trim();
      }
      const destination = resolveScheduleDestination(schedule, whatsapp);
      destinationForLog = destination;

      if (isOfficialSchedule) {
        logger.info(
          {
            scheduleId: schedule?.id,
            destination,
            provider: providerForLog,
            mediaPath: schedule.mediaPath || null,
            openTicket: schedule.openTicket === "enabled"
          },
          "SendScheduledMessage -> chamando SendWhatsAppOficialMessage"
        );

        let media: Express.Multer.File | undefined;
        if (filePath) {
          media = {
            path: filePath,
            mimetype:
              (mime.lookup(filePath) as string) || "application/octet-stream",
            originalname: schedule.mediaName || path.basename(filePath),
            filename: path.basename(filePath)
          } as Express.Multer.File;
        }

        // formatBody() das vari\u00e1veis do sistema \u00e9 aplicado dentro de
        // SendWhatsAppOficialMessage, igual ao restante dos fluxos oficiais.
        const sentMessage = await SendWhatsAppOficialMessage({
          body: bodyMessage,
          ticket,
          type: media ? (null as any) : "text",
          media
        });
        sentMessageRef = sentMessage;
      } else {
        logger.info(
          {
            scheduleId: schedule?.id,
            destination,
            provider: providerForLog,
            mediaPath: schedule.mediaPath || null,
            openTicket: true
          },
          "SendScheduledMessage -> chamando SendMessage (com ticket)"
        );
        const sentMessage = await SendMessage(
          whatsapp,
          {
            number: destination,
            body: `\u200e${formatBody(bodyMessage, ticket)}`,
            mediaPath: filePath,
            companyId: schedule.companyId
          },
          schedule.contact.isGroup
        );
        sentMessageRef = sentMessage;

        if (schedule.mediaPath) {
          await verifyMediaMessage(
            sentMessage,
            ticket,
            ticket.contact,
            null,
            true,
            false,
            whatsapp,
            true
          );
        } else {
          await verifyMessage(
            sentMessage,
            ticket,
            ticket.contact,
            null,
            false,
            false,
            true
          );
        }
      }
    } else {
      const destination = resolveScheduleDestination(schedule, whatsapp);
      destinationForLog = destination;
      logger.info(
        {
          scheduleId: schedule?.id,
          destination,
          provider: providerForLog,
          mediaPath: schedule.mediaPath || null,
          openTicket: false
        },
        "SendScheduledMessage -> chamando SendMessage (sem ticket)"
      );
      const sentMessage = await SendMessage(
        whatsapp,
        {
          number: destination,
          body: `\u200e${messageBody}`,
          mediaPath: filePath,
          companyId: schedule.companyId
        },
        schedule.contact.isGroup
      );
      sentMessageRef = sentMessage;
    }

    if (
      schedule.valorIntervalo > 0 &&
      (isNil(schedule.contadorEnvio) ||
        schedule.contadorEnvio < schedule.enviarQuantasVezes)
    ) {
      let unidadeIntervalo;
      switch (schedule.intervalo) {
        case 1:
          unidadeIntervalo = "days";
          break;
        case 2:
          unidadeIntervalo = "weeks";
          break;
        case 3:
          unidadeIntervalo = "months";
          break;
        case 4:
          unidadeIntervalo = "minuts";
          break;
        default:
          throw new Error("Intervalo inválido");
      }

      function isDiaUtil(date) {
        const dayOfWeek = date.day();
        return dayOfWeek >= 1 && dayOfWeek <= 5; // 1 é segunda-feira, 5 é sexta-feira
      }

      function proximoDiaUtil(date) {
        let proximoDia = date.clone();
        do {
          proximoDia.add(1, "day");
        } while (!isDiaUtil(proximoDia));
        return proximoDia;
      }

      function diaUtilAnterior(date) {
        let diaAnterior = date.clone();
        do {
          diaAnterior.subtract(1, "day");
        } while (!isDiaUtil(diaAnterior));
        return diaAnterior;
      }

      const dataExistente = new Date(schedule.sendAt);
      const hora = dataExistente.getHours();
      const fusoHorario = dataExistente.getTimezoneOffset();

      let novaData = new Date(dataExistente);

      console.log(unidadeIntervalo);
      if (unidadeIntervalo !== "minuts") {
        novaData.setDate(
          novaData.getDate() +
            schedule.valorIntervalo *
              (unidadeIntervalo === "days"
                ? 1
                : unidadeIntervalo === "weeks"
                ? 7
                : 30)
        );
      } else {
        novaData.setMinutes(
          novaData.getMinutes() + Number(schedule.valorIntervalo)
        );
        console.log(novaData);
      }

      if (schedule.tipoDias === 5 && !isDiaUtil(novaData)) {
        novaData = diaUtilAnterior(novaData);
      } else if (schedule.tipoDias === 6 && !isDiaUtil(novaData)) {
        novaData = proximoDiaUtil(novaData);
      }

      novaData.setHours(hora);
      novaData.setMinutes(novaData.getMinutes() - fusoHorario);

      await scheduleRecord?.update({
        status: "PENDENTE",
        contadorEnvio: schedule.contadorEnvio + 1,
        sentAt: new Date(moment().format("YYYY-MM-DD HH:mm")),
        sendAt: new Date(
          novaData.toISOString().slice(0, 19).replace("T", " ")
        )
      });
    } else {
      await scheduleRecord?.update({
        sentAt: new Date(moment().format("YYYY-MM-DD HH:mm")),
        status: "ENVIADA"
      });
    }
    logger.info(
      {
        scheduleId: schedule?.id,
        companyId: schedule?.companyId,
        whatsappId: schedule?.whatsappId,
        provider: providerForLog,
        contactId: schedule?.contactId,
        contactName: schedule?.contact?.name,
        destination: destinationForLog,
        ticketId: scheduleRecord?.id || null,
        messageId: sentMessageRef?.key?.id || null
      },
      "SendScheduledMessage -> SendMessage: success"
    );
    sendScheduledMessages.clean(15000, "completed");
  } catch (e: any) {
    Sentry.captureException(e);
    await scheduleRecord?.update({
      status: "ERRO"
    });
    logger.error(
      {
        err: e,
        errMessage: e?.message,
        stack: e?.stack,
        scheduleId: schedule?.id,
        companyId: schedule?.companyId,
        whatsappId: schedule?.whatsappId,
        provider: providerForLog,
        whatsappStatus: whatsappStatusForLog,
        contactId: schedule?.contactId,
        destination: destinationForLog
      },
      `SendScheduledMessage -> SendMessage: error - ${e?.message}`
    );
    throw e;
  }
}

async function handleVerifyCampaigns(job) {
  if (isProcessing) {
    return;
  }

  isProcessing = true;
  try {
    await new Promise(r => setTimeout(r, 1500));

    const campaigns: { id: number; scheduledAt: string }[] =
      await sequelize.query(
        `SELECT id, "scheduledAt" FROM "Campaigns" c
        WHERE "scheduledAt" BETWEEN NOW() AND NOW() + INTERVAL '3 hour' AND status = 'PROGRAMADA'`,
        { type: QueryTypes.SELECT }
      );

    if (campaigns.length > 0) {
      logger.info(`Campanhas encontradas: ${campaigns.length}`);

      const promises = campaigns.map(async campaign => {
        try {
          await sequelize.query(
            `UPDATE "Campaigns" SET status = 'EM_ANDAMENTO' WHERE id = ${campaign.id}`
          );

          const now = moment();
          const scheduledAt = moment(campaign.scheduledAt);
          const delay = scheduledAt.diff(now, "milliseconds");
          logger.info(
            `Campanha enviada para a fila de processamento: Campanha=${campaign.id}, Delay Inicial=${delay}`
          );

          return campaignQueue.add(
            "ProcessCampaign",
            { id: campaign.id, delay },
            {
              priority: 3,
              removeOnComplete: { age: 60 * 60, count: 10 },
              removeOnFail: { age: 60 * 60, count: 10 }
            }
          );
        } catch (err: any) {
          Sentry.captureException(err);
          logger.error(
            { err, campaignId: campaign.id },
            "VerifyCampaigns -> erro ao enfileirar campanha"
          );
        }
      });

      await Promise.all(promises);

      logger.info(
        "Todas as campanhas foram processadas e adicionadas à fila."
      );
    }
  } catch (err: any) {
    Sentry.captureException(err);
    logger.error(`Error processing campaigns: ${err.message}`);
  } finally {
    isProcessing = false;
  }
}

async function handleVerifyOfficialCampaigns(job) {
  if (isOfficialProcessing) {
    return;
  }

  isOfficialProcessing = true;
  try {
    await new Promise(r => setTimeout(r, 1500));

    const campaigns: { id: number; scheduledAt: string }[] =
      await sequelize.query(
        `SELECT id, "scheduledAt" FROM "OfficialCampaigns" c
        WHERE "scheduledAt" BETWEEN NOW() AND NOW() + INTERVAL '3 hour' AND status = 'PROGRAMADA'`,
        { type: QueryTypes.SELECT }
      );

    const promises = campaigns.map(async campaign => {
      await sequelize.query(
        `UPDATE "OfficialCampaigns" SET status = 'EM_ANDAMENTO' WHERE id = ${campaign.id}`
      );

      const now = moment();
      const scheduledAt = moment(campaign.scheduledAt);
      const delay = scheduledAt.diff(now, "milliseconds");

      return campaignQueue.add(
        "ProcessOfficialCampaign",
        { id: campaign.id, delay },
        {
          priority: 3,
          removeOnComplete: { age: 60 * 60, count: 10 },
          removeOnFail: { age: 60 * 60, count: 10 }
        }
      );
    });

    await Promise.all(promises);
  } catch (err: any) {
    Sentry.captureException(err);
    logger.error(`Error processing official campaigns: ${err.message}`);
  } finally {
    isOfficialProcessing = false;
  }
}

async function getCampaign(id) {
  return await Campaign.findOne({
    where: { id },
    include: [
      {
        model: ContactList,
        as: "contactList",
        attributes: ["id", "name"],
        include: [
          {
            model: ContactListItem,
            as: "contacts",
            attributes: [
              "id",
              "name",
              "number",
              "email",
              "isWhatsappValid",
              "isGroup"
            ],
            where: { isWhatsappValid: true }
          }
        ]
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "name"]
      },
      // NOVO: Incluir a associação com Files
      {
        model: Files,
        as: "fileList"
      }
    ]
  });
}

async function getContact(id) {
  return await ContactListItem.findByPk(id, {
    attributes: ["id", "name", "number", "email", "isGroup", "lid", "jid"]
  });
}

async function getOfficialCampaign(id) {
  return await OfficialCampaign.findOne({
    where: { id },
    include: [
      {
        model: ContactList,
        as: "contactList",
        attributes: ["id", "name"],
        include: [
          {
            model: ContactListItem,
            as: "contacts",
            attributes: ["id", "name", "number", "email", "isGroup"]
          }
        ]
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "name", "channel", "token", "companyId"]
      }
    ]
  });
}

async function getSettings(campaign): Promise<CampaignSettings> {
  try {
    const settings = await CampaignSetting.findAll({
      where: { companyId: campaign.companyId },
      attributes: ["key", "value"]
    });

    let messageInterval: number = 20;
    let longerIntervalAfter: number = 20;
    let greaterInterval: number = 60;
    let variables: any[] = [];

    settings.forEach(setting => {
      if (setting.key === "messageInterval") {
        messageInterval = JSON.parse(setting.value);
      }
      if (setting.key === "longerIntervalAfter") {
        longerIntervalAfter = JSON.parse(setting.value);
      }
      if (setting.key === "greaterInterval") {
        greaterInterval = JSON.parse(setting.value);
      }
      if (setting.key === "variables") {
        variables = JSON.parse(setting.value);
      }
    });

    return {
      messageInterval,
      longerIntervalAfter,
      greaterInterval,
      variables
    };
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export function parseToMilliseconds(seconds) {
  return seconds * 1000;
}

async function sleep(seconds) {
  logger.info(
    `Sleep de ${seconds} segundos iniciado: ${moment().format("HH:mm:ss")}`
  );
  return new Promise(resolve => {
    setTimeout(() => {
      logger.info(
        `Sleep de ${seconds} segundos finalizado: ${moment().format(
          "HH:mm:ss"
        )}`
      );
      resolve(true);
    }, parseToMilliseconds(seconds));
  });
}

function getCampaignValidMessages(campaign) {
  const messages = [];

  if (!isEmpty(campaign.message1) && !isNil(campaign.message1)) {
    messages.push(campaign.message1);
  }

  if (!isEmpty(campaign.message2) && !isNil(campaign.message2)) {
    messages.push(campaign.message2);
  }

  if (!isEmpty(campaign.message3) && !isNil(campaign.message3)) {
    messages.push(campaign.message3);
  }

  if (!isEmpty(campaign.message4) && !isNil(campaign.message4)) {
    messages.push(campaign.message4);
  }

  if (!isEmpty(campaign.message5) && !isNil(campaign.message5)) {
    messages.push(campaign.message5);
  }

  return messages;
}

function getCampaignValidConfirmationMessages(campaign) {
  const messages = [];

  if (
    !isEmpty(campaign.confirmationMessage1) &&
    !isNil(campaign.confirmationMessage1)
  ) {
    messages.push(campaign.confirmationMessage1);
  }

  if (
    !isEmpty(campaign.confirmationMessage2) &&
    !isNil(campaign.confirmationMessage2)
  ) {
    messages.push(campaign.confirmationMessage2);
  }

  if (
    !isEmpty(campaign.confirmationMessage3) &&
    !isNil(campaign.confirmationMessage3)
  ) {
    messages.push(campaign.confirmationMessage3);
  }

  if (
    !isEmpty(campaign.confirmationMessage4) &&
    !isNil(campaign.confirmationMessage4)
  ) {
    messages.push(campaign.confirmationMessage4);
  }

  if (
    !isEmpty(campaign.confirmationMessage5) &&
    !isNil(campaign.confirmationMessage5)
  ) {
    messages.push(campaign.confirmationMessage5);
  }

  return messages;
}

function getProcessedMessage(msg: string, variables: any[], contact: any) {
  let finalMessage = String(msg || "");
  const safeContact = contact || {};
  const safeVariables = Array.isArray(variables) ? variables : [];

  const replaceToken = (template: string, key: string, value: string): string => {
    const safeValue = String(value || "");
    const escapedKey = String(key || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return template
      .replace(new RegExp(`{{\\s*${escapedKey}\\s*}}`, "g"), safeValue)
      .replace(new RegExp(`{${escapedKey}}`, "g"), safeValue);
  };

  const contactName = String(safeContact.name || "");
  const contactFirstName = contactName.trim().split(/\s+/)[0] || "";
  const contactEmail = String(safeContact.email || "");
  const contactNumber = String(safeContact.number || "");

  finalMessage = replaceToken(finalMessage, "nome", contactName);
  finalMessage = replaceToken(finalMessage, "name", contactName);
  finalMessage = replaceToken(finalMessage, "firstName", contactFirstName);
  finalMessage = replaceToken(finalMessage, "email", contactEmail);
  finalMessage = replaceToken(finalMessage, "numero", contactNumber);
  finalMessage = replaceToken(finalMessage, "number", contactNumber);
  finalMessage = replaceToken(finalMessage, "phone", contactNumber);

  safeVariables.forEach(variable => {
    const key = String(variable?.key || "").trim();
    if (!key) return;
    finalMessage = replaceToken(finalMessage, key, String(variable?.value || ""));
  });

  return finalMessage;
}

function renderCampaignDispatchMessage({
  template,
  contact,
  ticket,
  campaign
}: {
  template: string;
  contact?: any;
  ticket?: any;
  campaign?: any;
}): string {
  const rawTemplate = String(template || "");
  if (!rawTemplate) return "";

  // 1) Resolve placeholders de contato/custom no formato {x} e {{x}}
  let rendered = getProcessedMessage(rawTemplate, [], contact || {});

  // 2) Resolve placeholders padrão Mustache (date/hour/ms/ticket/etc)
  rendered = formatBody(rendered, ticket);

  // 3) Fallbacks para cenários sem ticket aberto (evita enviar placeholder cru)
  const replaceToken = (input: string, key: string, value: string): string => {
    const escapedKey = String(key || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return String(input || "")
      .replace(new RegExp(`{{\\s*${escapedKey}\\s*}}`, "g"), String(value || ""))
      .replace(new RegExp(`{${escapedKey}}`, "g"), String(value || ""));
  };

  rendered = replaceToken(
    rendered,
    "connection",
    String(ticket?.whatsapp?.name || campaign?.whatsapp?.name || "")
  );

  // Campo não disponível na origem de contatos de campanha: mantém vazio.
  rendered = replaceToken(rendered, "CPF/CNPJ", "");

  return rendered;
}

const checkerWeek = async () => {
  const sab = moment().day() === 6;
  const dom = moment().day() === 0;

  const sabado = await CampaignSetting.findOne({
    where: { key: "sabado" }
  });

  const domingo = await CampaignSetting.findOne({
    where: { key: "domingo" }
  });

  if (sabado?.value === "false" && sab) {
    messageQueue.pause();
    return true;
  }

  if (domingo?.value === "false" && dom) {
    messageQueue.pause();
    return true;
  }

  messageQueue.resume();
  return false;
};

const checkTime = async () => {
  const startHour = await CampaignSetting.findOne({
    where: {
      key: "startHour"
    }
  });

  const endHour = await CampaignSetting.findOne({
    where: {
      key: "endHour"
    }
  });

  const hour = (startHour.value as unknown) as number;
  const endHours = (endHour.value as unknown) as number;

  const timeNow = (moment().format("HH:mm") as unknown) as number;

  if (timeNow <= endHours && timeNow >= hour) {
    messageQueue.resume();

    return true;
  }

  logger.info(
    `Envio inicia as ${hour} e termina as ${endHours}, hora atual ${timeNow} não está dentro do horário`
  );
  messageQueue.clean(0, "delayed");
  messageQueue.clean(0, "wait");
  messageQueue.clean(0, "active");
  messageQueue.clean(0, "completed");
  messageQueue.clean(0, "failed");
  messageQueue.pause();

  return false;
};

export function randomValue(min, max) {
  return Math.floor(Math.random() * max) + min;
}

async function verifyAndFinalizeCampaign(campaign) {
  const { companyId, contacts } = campaign.contactList;

  const count1 = contacts.length;

  const count2 = await CampaignShipping.count({
    where: {
      campaignId: campaign.id,
      deliveredAt: {
        [Op.ne]: null
      },
      confirmation: campaign.confirmation ? true : { [Op.or]: [null, false] }
    }
  });

  if (count1 === count2) {
    await campaign.update({ status: "FINALIZADA", completedAt: moment() });
  }

  const io = getIO();
  io.of(companyId).emit(`company-${campaign.companyId}-campaign`, {
    action: "update",
    record: campaign
  });
}

async function verifyAndFinalizeOfficialCampaign(campaign) {
  const { companyId, contacts } = campaign.contactList;
  const totalContacts = Array.isArray(contacts) ? contacts.length : 0;
  const processedContacts = await OfficialCampaignShipping.count({
    where: {
      officialCampaignId: campaign.id,
      status: {
        [Op.in]: ["ENVIADO", "FALHOU"]
      }
    }
  });

  if (totalContacts > 0 && totalContacts === processedContacts) {
    await campaign.update({ status: "FINALIZADA", completedAt: moment() });
  }

  const io = getIO();
  io.of(String(companyId)).emit(`company-${campaign.companyId}-official-campaign`, {
    action: "update",
    record: campaign
  });
}

async function handleProcessCampaign(job) {
  const { id: campaignIdForLog }: ProcessCampaignData = job.data || {};
  try {
    const { id }: ProcessCampaignData = job.data;
    const campaign = await getCampaign(id);
    if (!campaign || campaign.status !== "EM_ANDAMENTO") {
      logger.info(
        `ProcessCampaign ignorado: campanha ${id} não está EM_ANDAMENTO`
      );
      return;
    }
    if (!campaign.contactList || !isArray(campaign.contactList?.contacts) || campaign.contactList.contacts.length === 0) {
      logger.warn(
        `ProcessCampaign -> campanha ${id} nao possui contatos validos na lista (verifique isWhatsappValid)`
      );
    }
    const settings = await getSettings(campaign);
    const { contacts } = campaign.contactList;
    if (isArray(contacts)) {
      const contactData = contacts.map(contact => ({
        contactId: contact.id,
        campaignId: campaign.id,
        variables: settings.variables,
        isGroup: contact.isGroup
      }));

      const longerIntervalAfter = Number(settings.longerIntervalAfter || 0);
      // As configurações de campanha são armazenadas em segundos. Mantenha
      // essa unidade ao montar a data de cada disparo; `addSeconds` já faz a
      // conversão necessária internamente.
      const greaterInterval = Number(settings.greaterInterval || 0);
      const messageInterval = Number(settings.messageInterval || 0);

      let baseDelay = campaign.scheduledAt
        ? new Date(campaign.scheduledAt)
        : new Date();

      // Se a campanha entrou em processamento com data-base antiga,
      // normaliza para "agora" para preservar os intervalos e evitar
      // disparo imediato em massa.
      if (differenceInSeconds(baseDelay, new Date()) < 0) {
        baseDelay = new Date();
      }

      const queuePromises = [];
      for (let i = 0; i < contactData.length; i++) {
        baseDelay = addSeconds(
          baseDelay,
          i > longerIntervalAfter ? greaterInterval : messageInterval
        );

        const { contactId, campaignId, variables } = contactData[i];
        const delay = calculateDelay(baseDelay);

        const queuePromise = campaignQueue.add(
          "PrepareContact",
          { contactId, campaignId, variables, delay },
          { removeOnComplete: true }
        );
        queuePromises.push(queuePromise);
        logger.info(
          `Registro enviado pra fila de disparo: Campanha=${campaign.id};Contato=${contacts[i].name};delay=${delay}`
        );
      }
      await Promise.all(queuePromises);
    }
  } catch (err: any) {
    Sentry.captureException(err);
    logger.error(
      { err, campaignId: campaignIdForLog },
      "ProcessCampaign -> erro ao preparar contatos da campanha"
    );
  }
}

async function handleProcessOfficialCampaign(job) {
  try {
    const { id }: ProcessOfficialCampaignData = job.data;
    const campaign = await getOfficialCampaign(id);
    if (!campaign || campaign.status !== "EM_ANDAMENTO") {
      logger.info(
        `ProcessOfficialCampaign ignorado: campanha ${id} nao esta EM_ANDAMENTO`
      );
      return;
    }

    const settings = await getSettings(campaign);
    const contacts = Array.isArray(campaign?.contactList?.contacts)
      ? campaign.contactList.contacts
      : [];
    const longerIntervalAfter = Number(settings.longerIntervalAfter || 0);
    const greaterIntervalSeconds = Number(settings.greaterInterval || 0);
    const messageIntervalSeconds = Number(settings.messageInterval || 0);

    let baseDelay = campaign.scheduledAt ? new Date(campaign.scheduledAt) : new Date();
    if (differenceInSeconds(baseDelay, new Date()) < 0) {
      baseDelay = new Date();
    }

    const queuePromises = [];
    for (let i = 0; i < contacts.length; i++) {
      baseDelay = addSeconds(
        baseDelay,
        i > longerIntervalAfter ? greaterIntervalSeconds : messageIntervalSeconds
      );
      const delay = Math.max(0, baseDelay.getTime() - Date.now());

      queuePromises.push(
        campaignQueue.add(
          "PrepareOfficialCampaignContact",
          {
            contactId: contacts[i].id,
            officialCampaignId: campaign.id,
            delay
          },
          { removeOnComplete: true }
        )
      );
    }

    await Promise.all(queuePromises);
  } catch (err: any) {
    Sentry.captureException(err);
    logger.error(`ProcessOfficialCampaign -> error: ${err.message}`);
  }
}

function calculateDelay(baseDelay) {
  return Math.max(0, baseDelay.getTime() - Date.now());
}

async function handlePrepareContact(job) {
  try {
    const {
      contactId,
      campaignId,
      delay,
      variables
    }: PrepareContactData = job.data;
    const campaign = await getCampaign(campaignId);
    if (!campaign || campaign.status !== "EM_ANDAMENTO") {
      logger.info(
        `PrepareContact ignorado: campanha ${campaignId} não está EM_ANDAMENTO`
      );
      return;
    }
    const contact = await getContact(contactId);
    const campaignShipping: any = {};
    campaignShipping.number = contact.number;
    campaignShipping.contactId = contactId;
    campaignShipping.campaignId = campaignId;
    const messages = getCampaignValidMessages(campaign);

    if (messages.length >= 0) {
      const radomIndex = randomValue(0, messages.length);

      const message = getProcessedMessage(
        messages[radomIndex] || "",
        variables,
        contact
      );

      campaignShipping.message =
        message === null ? "" : `\u200c${message}`;
    }
    if (campaign.confirmation) {
      const confirmationMessages = getCampaignValidConfirmationMessages(
        campaign
      );
      if (confirmationMessages.length) {
        const radomIndex = randomValue(0, confirmationMessages.length);
        const message = getProcessedMessage(
          confirmationMessages[radomIndex] || "",
          variables,
          contact
        );
        campaignShipping.confirmationMessage = `\u200c${message}`;
      }
    }
    const [record, created] = await CampaignShipping.findOrCreate({
      where: {
        campaignId: campaignShipping.campaignId,
        contactId: campaignShipping.contactId
      },
      defaults: campaignShipping
    });

    if (
      !created &&
      record.deliveredAt === null &&
      record.confirmationRequestedAt === null
    ) {
      record.set(campaignShipping);
      await record.save();
    }

    if (
      record.deliveredAt === null &&
      record.confirmationRequestedAt === null
    ) {
      const nextJob = await campaignQueue.add(
        "DispatchCampaign",
        {
          campaignId: campaign.id,
          campaignShippingId: record.id,
          contactListItemId: contactId
        },
        {
          delay
        }
      );

      await record.update({ jobId: String(nextJob.id) });
    }

    await verifyAndFinalizeCampaign(campaign);
  } catch (err: any) {
    Sentry.captureException(err);
    logger.error(`campaignQueue -> PrepareContact -> error: ${err.message}`);
  }
}

async function handlePrepareOfficialContact(job) {
  try {
    const {
      contactId,
      officialCampaignId,
      delay
    }: PrepareOfficialContactData = job.data;

    const campaign = await getOfficialCampaign(officialCampaignId);
    if (!campaign || campaign.status !== "EM_ANDAMENTO") {
      logger.info(
        `PrepareOfficialContact ignorado: campanha ${officialCampaignId} nao esta EM_ANDAMENTO`
      );
      return;
    }

    const contact = await getContact(contactId);
    const normalizedNumber = normalizeCampaignContactNumber(contact?.number);
    if (!normalizedNumber) {
      await OfficialCampaignShipping.findOrCreate({
        where: { officialCampaignId, contactId },
        defaults: {
          officialCampaignId,
          contactId,
          number: String(contact?.number || ""),
          status: "FALHOU",
          error: "Numero de contato invalido para API Oficial"
        }
      });
      await verifyAndFinalizeOfficialCampaign(campaign);
      return;
    }

    const preview = buildOfficialTemplatePreview({
      templateName: campaign.templateName,
      components: Array.isArray(campaign.templateComponents)
        ? campaign.templateComponents
        : [],
      headerVariables: Array.isArray(campaign.headerVariables)
        ? campaign.headerVariables
        : [],
      bodyVariables: Array.isArray(campaign.bodyVariables)
        ? campaign.bodyVariables
        : []
    });

    const [record] = await OfficialCampaignShipping.findOrCreate({
      where: { officialCampaignId, contactId },
      defaults: {
        officialCampaignId,
        contactId,
        number: normalizedNumber,
        preview
      }
    });

    if (record.status === "ENVIADO") {
      await verifyAndFinalizeOfficialCampaign(campaign);
      return;
    }

    const nextJob = await campaignQueue.add(
      "DispatchOfficialCampaign",
      {
        officialCampaignId: campaign.id,
        officialCampaignShippingId: record.id,
        contactListItemId: contactId
      },
      { delay }
    );

    await record.update({
      jobId: String(nextJob.id),
      number: normalizedNumber,
      preview,
      status: "PROCESSANDO",
      error: null
    });

    await verifyAndFinalizeOfficialCampaign(campaign);
  } catch (err: any) {
    Sentry.captureException(err);
    logger.error(`PrepareOfficialContact -> error: ${err.message}`);
  }
}

async function handleReconcileOrphanedDispatches() {
  try {
    const shippings: {
      id: number;
      campaignId: number;
      contactId: number;
      jobId: string;
    }[] = await sequelize.query(
      `SELECT cs.id, cs."campaignId", cs."contactId", cs."jobId"
       FROM "CampaignShipping" cs
       INNER JOIN "Campaigns" c ON c.id = cs."campaignId"
       WHERE c.status = 'EM_ANDAMENTO'
         AND cs."deliveredAt" IS NULL
         AND cs."confirmationRequestedAt" IS NULL
         AND cs."jobId" IS NOT NULL`,
      { type: QueryTypes.SELECT }
    );

    for (const shipping of shippings) {
      const existingJob = await campaignQueue.getJob(shipping.jobId);
      // getJob só confere se o hash de dados existe no Redis, não se o
      // job está de fato em alguma fila (wait/active/delayed). Por isso
      // é preciso checar o estado real do job via getState().
      if (existingJob) {
        const state = await existingJob.getState();
        const isTracked = ["waiting", "active", "delayed", "completed", "failed"].includes(
          state
        );
        if (isTracked) continue;
      }

      logger.info(
        `Reenfileirando disparo orfao (job sumiu da fila): CampaignShipping=${shipping.id}, Campanha=${shipping.campaignId}`
      );
      const nextJob = await campaignQueue.add(
        "DispatchCampaign",
        {
          campaignId: shipping.campaignId,
          campaignShippingId: shipping.id,
          contactListItemId: shipping.contactId
        },
        {}
      );
      await sequelize.query(
        `UPDATE "CampaignShipping" SET "jobId" = '${nextJob.id}' WHERE id = ${shipping.id}`
      );
    }
  } catch (err: any) {
    Sentry.captureException(err);
    logger.error(
      `Error reconciling orphaned campaign dispatches: ${err.message}`
    );
  }
}

async function handleDispatchCampaign(job) {
  const { data } = job;
  const { campaignShippingId, campaignId }: DispatchCampaignData = data || {};
  let chatIdForLog: string | null = null;
  let providerForLog: string | null = null;
  let contactIdForLog: number | null = null;
  try {
    const campaign = await getCampaign(campaignId);
    if (!campaign || campaign.status !== "EM_ANDAMENTO") {
      logger.info(
        `DispatchCampaign ignorado: campanha ${campaignId} não está EM_ANDAMENTO`
      );
      return;
    }
    providerForLog = campaign.whatsapp?.provider || null;
    const wbot = await GetWhatsappWbot(campaign.whatsapp);

    if (!wbot) {
      logger.error(
        {
          campaignId,
          campaignShippingId,
          whatsappId: campaign.whatsappId,
          provider: providerForLog
        },
        "DispatchCampaign -> erro: wbot nao encontrado (conexao pode estar desconectada/nao inicializada)"
      );
      return;
    }

    if (!campaign.whatsapp) {
      logger.error(
        { campaignId, campaignShippingId },
        "DispatchCampaign -> erro: conexao whatsapp da campanha nao encontrada"
      );
      return;
    }

    const isWuzapiCampaign =
      String(campaign.whatsapp?.provider || "").toLowerCase() === "wuzapi";

    if (!wbot?.user?.id && !isWuzapiCampaign) {
      logger.error(
        {
          campaignId,
          campaignShippingId,
          whatsappId: campaign.whatsappId,
          provider: providerForLog,
          wbotConnected: !!wbot
        },
        "DispatchCampaign -> erro: wbot.user nao encontrado (sessao Baileys pode estar desconectada)"
      );
      return;
    }

    if (!wbot?.user?.id && isWuzapiCampaign) {
      logger.warn(
        { campaignId, campaignShippingId },
        "DispatchCampaign -> wuzapi sem user.id; seguindo com envio"
      );
    }

    logger.info(
      { campaignId, campaignShippingId, provider: providerForLog, whatsappId: campaign.whatsappId },
      "DispatchCampaign -> disparo solicitado"
    );

    const campaignShipping = await CampaignShipping.findByPk(
      campaignShippingId,
      {
        include: [{ model: ContactListItem, as: "contact" }]
      }
    );

    // Prioriza lid/jid conhecidos do contato da lista de campanha (ex.:
    // contato só identificável por LID) antes de cair para o "number" puro —
    // mesma lógica de resolveContactTargetJid usada no envio direto de ticket.
    const campaignChatKey =
      (campaignShipping.contact as any)?.lid ||
      (campaignShipping.contact as any)?.jid ||
      null;

    const chatId = campaignShipping.contact.isGroup
      ? `${campaignShipping.number}@g.us`
      : campaignChatKey || `${campaignShipping.number}@s.whatsapp.net`;

    chatIdForLog = chatId;
    contactIdForLog = campaignShipping.contactId;

    if (campaign.openTicket === "enabled") {
      const [contact] = await Contact.findOrCreate({
        where: {
          number: campaignShipping.number,
          companyId: campaign.companyId
        },
        defaults: {
          companyId: campaign.companyId,
          name: campaignShipping.contact.name,
          number: campaignShipping.number,
          email: campaignShipping.contact.email,
          whatsappId: campaign.whatsappId,
          profilePicUrl: ""
        }
      });
      const whatsapp = await Whatsapp.findByPk(campaign.whatsappId);

      let ticket = await Ticket.findOne({
        where: {
          contactId: contact.id,
          companyId: campaign.companyId,
          whatsappId: whatsapp.id,
          status: ["open", "pending"]
        }
      });

      if (!ticket)
        ticket = await Ticket.create({
          companyId: campaign.companyId,
          contactId: contact.id,
          whatsappId: whatsapp.id,
          queueId: campaign?.queueId,
          userId: campaign?.userId,
          status: campaign?.statusTicket
        });

      ticket = await ShowTicketService(ticket.id, campaign.companyId);

      if (whatsapp.status === "CONNECTED") {
        if (campaign.confirmation && campaignShipping.confirmation === null) {
          const confirmationBody = renderCampaignDispatchMessage({
            template: campaignShipping.confirmationMessage,
            contact: campaignShipping.contact,
            ticket,
            campaign
          });
          const confirmationMessage = await wbot.sendMessage(chatId, {
            text: confirmationBody
          });

          await verifyMessage(
            confirmationMessage,
            ticket,
            contact,
            null,
            true,
            false
          );

          await campaignShipping.update({
            confirmationRequestedAt: moment()
          });
        } else {
          // Verifica se existe mídia (lista de arquivos ou anexo direto).
          // Se existir, NÃO envia o texto separado para evitar duplicidade;
          // o texto será usado apenas como legenda.
          const hasFileList = !isNil(campaign.fileListId);
          const hasDirectMedia = !!campaign.mediaPath;
          const shouldSendTextOnly = !hasFileList && !hasDirectMedia;

          // Envio da mensagem de texto principal (somente quando não há mídia)
          if (
            shouldSendTextOnly &&
            campaignShipping.message &&
            campaignShipping.message.trim() !== "\u200c"
          ) {
            const messageBody = renderCampaignDispatchMessage({
              template: campaignShipping.message,
              contact: campaignShipping.contact,
              ticket,
              campaign
            });
            const sentMessage = await wbot.sendMessage(chatId, {
              text: messageBody
            });

            await verifyMessage(
              sentMessage,
              ticket,
              contact,
              null,
              true,
              false
            );
          }

          // NOVO CÓDIGO: Lógica para enviar a lista de arquivos
          if (!isNil(campaign.fileListId)) {
            try {
              const files = await ShowFileService(
                campaign.fileListId,
                campaign.companyId
              );
              const publicFolder = path.resolve(__dirname, "..", "public");
              const folder = path.resolve(
                publicFolder,
                `company${campaign.companyId}`,
                "fileList",
                String(files.id)
              );

              for (const file of files.options) {
                const filePath = path.resolve(folder, file.path);
                // Adicionamos a mensagem da lista de arquivos ("files.message") como legenda
                const options = await getMessageOptions(
                  file.name,
                  filePath,
                  String(campaign.companyId),
                  renderCampaignDispatchMessage({
                    template: files.message,
                    contact: campaignShipping.contact,
                    ticket,
                    campaign
                  })
                );
                if (Object.keys(options).length) {
                  const sentMediaMessage = await wbot.sendMessage(chatId, {
                    ...options
                  });
                  await verifyMediaMessage(
                    sentMediaMessage,
                    ticket,
                    contact,
                    null,
                    true,
                    false,
                    wbot
                  );
                }
              }
            } catch (err: any) {
              Sentry.captureException(err);
              logger.error(
                `Error sending file list media (ticket enabled): ${err.message}`
              );
            }
          }
          // FIM DO NOVO CÓDIGO

          // Lógica para anexo direto (mediaPath)
          if (campaign.mediaPath) {
            const publicFolder = path.resolve(__dirname, "..", "public");
            const filePath = path.join(
              publicFolder,
              `company${campaign.companyId}`,
              campaign.mediaPath
            );

            const options = await getMessageOptions(
              campaign.mediaName,
              filePath,
              String(campaign.companyId),
              renderCampaignDispatchMessage({
                template: campaignShipping.message,
                contact: campaignShipping.contact,
                ticket,
                campaign
              })
            );
            if (Object.keys(options).length) {
              // Para áudio, o WhatsApp não usa legenda, então enviamos o texto separado
              if (
                "mimetype" in options &&
                typeof (options as any).mimetype === "string" &&
                (options as any).mimetype.startsWith("audio/")
              ) {
                const audioBody = renderCampaignDispatchMessage({
                  template: campaignShipping.message,
                  contact: campaignShipping.contact,
                  ticket,
                  campaign
                });
                const audioMessage = await wbot.sendMessage(chatId, {
                  text: audioBody
                });

                await verifyMessage(
                  audioMessage,
                  ticket,
                  contact,
                  null,
                  true,
                  false
                );
              }
              const sentMessage = await wbot.sendMessage(chatId, {
                ...options
              });

              await verifyMediaMessage(
                sentMessage,
                ticket,
                ticket.contact,
                null,
                false,
                true,
                wbot
              );
            }
          }
        }
        await campaignShipping.update({ deliveredAt: moment() });
      } else {
        logger.warn(
          {
            campaignId,
            campaignShippingId,
            contactId: contactIdForLog,
            chatId: chatIdForLog,
            whatsappId: whatsapp.id,
            whatsappStatus: whatsapp.status
          },
          "DispatchCampaign -> mensagem NAO enviada: conexao whatsapp nao esta CONNECTED (status atual acima)"
        );
      }
    } else {
      if (campaign.confirmation && campaignShipping.confirmation === null) {
        const confirmationBody = renderCampaignDispatchMessage({
          template: campaignShipping.confirmationMessage,
          contact: campaignShipping.contact,
          campaign
        });
        await wbot.sendMessage(chatId, {
          text: confirmationBody
        });
        await campaignShipping.update({
          confirmationRequestedAt: moment()
        });
      } else {
        // Mesmo conceito do bloco acima: se houver mídia, o texto vai só na legenda
        const hasFileList = !isNil(campaign.fileListId);
        const hasDirectMedia = !!campaign.mediaPath;
        const shouldSendTextOnly = !hasFileList && !hasDirectMedia;

        // Envio da mensagem de texto principal (somente se não tiver mídia)
        if (
          shouldSendTextOnly &&
          campaignShipping.message &&
          campaignShipping.message.trim() !== "\u200c"
        ) {
          const messageBody = renderCampaignDispatchMessage({
            template: campaignShipping.message,
            contact: campaignShipping.contact,
            campaign
          });
          await wbot.sendMessage(chatId, {
            text: messageBody
          });
        }

        // NOVO CÓDIGO: Lógica para enviar a lista de arquivos
        if (!isNil(campaign.fileListId)) {
          try {
            const files = await ShowFileService(
              campaign.fileListId,
              campaign.companyId
            );
            const publicFolder = path.resolve(__dirname, "..", "public");
            const folder = path.resolve(
              publicFolder,
              `company${campaign.companyId}`,
              "fileList",
              String(files.id)
            );

            for (const file of files.options) {
              const filePath = path.resolve(folder, file.path);
              // Adicionamos a mensagem da lista de arquivos ("files.message") como legenda
              const options = await getMessageOptions(
                file.name,
                filePath,
                String(campaign.companyId),
                renderCampaignDispatchMessage({
                  template: files.message,
                  contact: campaignShipping.contact,
                  campaign
                })
              );
              if (Object.keys(options).length) {
                await wbot.sendMessage(chatId, { ...options });
              }
            }
          } catch (err: any) {
            Sentry.captureException(err);
            logger.error(
              `Error sending file list media (ticket disabled): ${err.message}`
            );
          }
        }
        // FIM DO NOVO CÓDIGO

        // Lógica para anexo direto (mediaPath)
        if (campaign.mediaPath) {
          const publicFolder = path.resolve(__dirname, "..", "public");
          const filePath = path.join(
            publicFolder,
            `company${campaign.companyId}`,
            campaign.mediaPath
          );

          const options = await getMessageOptions(
            campaign.mediaName,
            filePath,
            String(campaign.companyId),
            renderCampaignDispatchMessage({
              template: campaignShipping.message,
              contact: campaignShipping.contact,
              campaign
            })
          );
          if (Object.keys(options).length) {
            if (
              "mimetype" in options &&
              typeof (options as any).mimetype === "string" &&
              (options as any).mimetype.startsWith("audio/")
            ) {
              const audioBody = renderCampaignDispatchMessage({
                template: campaignShipping.message,
                contact: campaignShipping.contact,
                campaign
              });
              await wbot.sendMessage(chatId, {
                text: audioBody
              });
            }
            await wbot.sendMessage(chatId, { ...options });
          }
        }
      }

      await campaignShipping.update({ deliveredAt: moment() });
    }
    await verifyAndFinalizeCampaign(campaign);

    const io = getIO();
    io.of(String(campaign.companyId)).emit(
      `company-${campaign.companyId}-campaign`,
      {
        action: "update",
        record: campaign
      }
    );

    logger.info(
      { campaignId, campaignShippingId, contactId: contactIdForLog, chatId: chatIdForLog, provider: providerForLog },
      `DispatchCampaign -> mensagem enviada com sucesso para: ${campaignShipping.contact.name}`
    );
  } catch (err: any) {
    Sentry.captureException(err);
    logger.error(
      {
        err,
        campaignId,
        campaignShippingId,
        contactId: contactIdForLog,
        chatId: chatIdForLog,
        provider: providerForLog,
        stack: err?.stack
      },
      `DispatchCampaign -> erro ao enviar campanha: ${err?.message}`
    );
  }
}

const replaceCampaignContactPlaceholders = (
  value: string,
  contact: any,
  ticket?: Ticket
): string => {
  const safeValue = String(value || "");
  const fullName = String(contact?.name || "");
  const firstName = fullName.trim().split(/\s+/)[0] || "";
  const withContactPlaceholders = safeValue
    .replace(/\{\{\s*name\s*\}\}|\{\s*name\s*\}/g, fullName)
    .replace(/\{\{\s*firstName\s*\}\}|\{\s*firstName\s*\}/g, firstName)
    .replace(/\{\{\s*email\s*\}\}|\{\s*email\s*\}/g, String(contact?.email || ""))
    .replace(/\{\{\s*number\s*\}\}|\{\s*number\s*\}/g, String(contact?.number || ""));

  // Demais variáveis do sistema ({{ms}}, {{hour}}, {{protocol}}, {{queue}}, etc.)
  // usam o mesmo helper Mustache aplicado nos disparos via Baileys/WuzAPI.
  return formatBody(withContactPlaceholders, ticket);
};

async function handleDispatchOfficialCampaign(job) {
  try {
    const {
      officialCampaignId,
      officialCampaignShippingId
    }: DispatchOfficialCampaignData = job.data;

    const campaign = await getOfficialCampaign(officialCampaignId);
    if (!campaign || campaign.status !== "EM_ANDAMENTO") {
      logger.info(
        `DispatchOfficialCampaign ignorado: campanha ${officialCampaignId} nao esta EM_ANDAMENTO`
      );
      return;
    }

    if (!campaign.whatsapp) {
      throw new Error("Conexao oficial nao encontrada");
    }

    logger.info(
      { officialCampaignId, officialCampaignShippingId },
      "DispatchOfficialCampaign -> disparo solicitado"
    );

    const shipping = await OfficialCampaignShipping.findByPk(
      officialCampaignShippingId,
      { include: [{ model: ContactListItem, as: "contact" }] }
    );

    if (!shipping) {
      throw new Error("Registro de disparo oficial nao encontrado");
    }

    const contactNumber = normalizeCampaignContactNumber(shipping.number);
    if (!contactNumber) {
      await shipping.update({
        status: "FALHOU",
        error: "Numero invalido para envio"
      });
      await verifyAndFinalizeOfficialCampaign(campaign);
      return;
    }

    const [contact] = await Contact.findOrCreate({
      where: {
        number: contactNumber,
        companyId: campaign.companyId
      },
      defaults: {
        companyId: campaign.companyId,
        name: shipping.contact?.name || contactNumber,
        number: contactNumber,
        email: shipping.contact?.email || "",
        whatsappId: campaign.whatsappId,
        profilePicUrl: ""
      }
    });

    let ticket = await Ticket.findOne({
      where: {
        contactId: contact.id,
        companyId: campaign.companyId,
        whatsappId: campaign.whatsappId,
        status: ["open", "pending"]
      }
    });

    if (!ticket) {
      ticket = await Ticket.create({
        companyId: campaign.companyId,
        contactId: contact.id,
        whatsappId: campaign.whatsappId,
        status: campaign.statusTicket || "closed",
        channel: "whatsapp_oficial"
      });
    }

    ticket = await ShowTicketService(ticket.id, campaign.companyId);

    const components = Array.isArray(campaign.templateComponents)
      ? campaign.templateComponents
      : [];
    assertOfficialTemplateSupported(components);

    const resolvedHeaderVariables = Array.isArray(campaign.headerVariables)
      ? campaign.headerVariables.map(value =>
          replaceCampaignContactPlaceholders(value, shipping.contact, ticket)
        )
      : [];
    const resolvedBodyVariables = Array.isArray(campaign.bodyVariables)
      ? campaign.bodyVariables.map(value =>
          replaceCampaignContactPlaceholders(value, shipping.contact, ticket)
        )
      : [];

    const templatePayload = {
      name: campaign.templateName,
      language: { code: campaign.templateLanguage },
      components: buildOfficialTemplateComponents({
        components,
        headerVariables: resolvedHeaderVariables,
        bodyVariables: resolvedBodyVariables,
        headerMediaUrl: campaign.headerMediaUrl
      })
    };

    const preview = buildOfficialTemplatePreview({
      templateName: campaign.templateName,
      components,
      headerVariables: resolvedHeaderVariables,
      bodyVariables: resolvedBodyVariables,
      headerMediaUrl: campaign.headerMediaUrl
    });

    await SendWhatsAppOficialMessage({
      body: "",
      ticket,
      type: "template",
      template: templatePayload,
      bodyToSave: preview
    });

    await shipping.update({
      status: "ENVIADO",
      deliveredAt: moment(),
      preview,
      ticketId: ticket.id,
      error: null
    });

    await verifyAndFinalizeOfficialCampaign(campaign);

    logger.info(
      { officialCampaignId, officialCampaignShippingId, ticketId: ticket?.id },
      "DispatchOfficialCampaign -> mensagem enviada com sucesso"
    );
  } catch (err: any) {
    Sentry.captureException(err);
    logger.error(
      {
        err,
        officialCampaignId: job?.data?.officialCampaignId,
        officialCampaignShippingId: job?.data?.officialCampaignShippingId
      },
      `DispatchOfficialCampaign -> error: ${err.message} | stack: ${err.stack}`
    );

    const shippingId = job?.data?.officialCampaignShippingId;
    if (shippingId) {
      const shipping = await OfficialCampaignShipping.findByPk(shippingId);
      if (shipping) {
        await shipping.update({
          status: "FALHOU",
          error: String(err?.message || "Erro ao enviar template oficial")
        });
      }
    }

    const campaignId = job?.data?.officialCampaignId;
    if (campaignId) {
      const campaign = await getOfficialCampaign(campaignId);
      if (campaign) {
        await verifyAndFinalizeOfficialCampaign(campaign);
      }
    }
  }
}

async function handleLoginStatus(job) {
  const thresholdTime = new Date();
  thresholdTime.setMinutes(thresholdTime.getMinutes() - 5);

  await User.update(
    { online: false },
    {
      where: {
        updatedAt: { [Op.lt]: thresholdTime },
        online: true
      }
    }
  );
}

async function handleResumeTicketsOutOfHour(job) {
  try {
    const companies = await Company.findAll({
      attributes: ["id", "name"],
      where: {
        status: true
      },
      include: [
        {
          model: Whatsapp,
          attributes: ["id", "name", "status", "timeSendQueue", "sendIdQueue"],
          where: {
            timeSendQueue: { [Op.gte]: 0 },
            sendIdQueue: { [Op.not]: null }
          }
        }
      ]
    });

    companies.map(async c => {
      c.whatsapps.map(async w => {
        if (w.status === "CONNECTED") {
          var companyId = c.id;

          const moveQueue = w.timeSendQueue ? w.timeSendQueue : 0;
          const moveQueueId = w.sendIdQueue;
          const moveQueueTime = moveQueue;
          const idQueue = moveQueueId;
          const timeQueue = moveQueueTime;

          if (moveQueue >= 0) {
            if (
              !isNaN(idQueue) &&
              Number.isInteger(idQueue) &&
              !isNaN(timeQueue) &&
              Number.isInteger(timeQueue)
            ) {
              const tempoPassado = moment()
                .subtract(timeQueue, "minutes")
                .utc()
                .format();

              const { count, rows: tickets } = await Ticket.findAndCountAll({
                attributes: ["id"],
                where: {
                  status: "pending",
                  queueId: null,
                  companyId: companyId,
                  whatsappId: w.id,
                  updatedAt: {
                    [Op.lt]: tempoPassado
                  }
                },
                include: [
                  {
                    model: Contact,
                    as: "contact",
                    attributes: [
                      "id",
                      "name",
                      "number",
                      "email",
                      "profilePicUrl",
                      "acceptAudioMessage",
                      "active",
                      "disableBot",
                      "urlPicture",
                      "lgpdAcceptedAt",
                      "companyId"
                    ],
                    include: ["extraInfo", "tags"]
                  },
                  {
                    model: Queue,
                    as: "queue",
                    attributes: ["id", "name", "color"]
                  },
                  {
                    model: Whatsapp,
                    as: "whatsapp",
                    attributes: ["id", "name", "expiresTicket", "groupAsTicket"]
                  }
                ]
              });

              if (count > 0) {
                tickets.map(async ticket => {
                  await ticket.update(
                    {
                      queueId: idQueue
                    },
                    {
                      silent: true
                    }
                  );

                  const hydratedTicket = await ShowTicketService(
                    ticket.id,
                    companyId
                  );

                  const io = getIO();
                  io.of(String(companyId)).emit(
                    `company-${companyId}-ticket`,
                    {
                      action: "update",
                      ticket: hydratedTicket,
                      ticketId: hydratedTicket.id
                    }
                  );

                  logger.info(
                    `Atendimento Perdido: ${ticket.id} - Empresa: ${companyId}`
                  );
                });
              }
            } else {
              logger.info(
                `Condição não respeitada - Empresa: ${companyId}`
              );
            }
          }
        }
      });
    });
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("SearchForQueue -> VerifyQueue: error", e.message);
    throw e;
  }
}

// Evita que a mesma empresa/fila seja processada concorrentemente por
// execuções sobrepostas do job (ex.: job anterior ainda rodando quando o
// próximo tick do cron dispara), sem travar o processamento de outras
// empresas.
const verifyQueueLocks = new Set<string>();

async function handleVerifyQueue(job) {
  try {
    const companies = await Company.findAll({
      attributes: ["id", "name"],
      where: {
        status: true
      },
      include: [
        {
          model: Whatsapp,
          attributes: ["id", "name", "status", "timeSendQueue", "sendIdQueue"],
          where: {
            timeSendQueue: { [Op.gte]: 0 },
            sendIdQueue: { [Op.not]: null }
          }
        }
      ]
    });

    for (const c of companies) {
      for (const w of c.whatsapps) {
        if (w.status === "CONNECTED") {
          var companyId = c.id;

          const moveQueue = w.timeSendQueue ? w.timeSendQueue : 0;
          const moveQueueId = w.sendIdQueue;
          const moveQueueTime = moveQueue;
          const idQueue = moveQueueId;
          const timeQueue = moveQueueTime;

          if (moveQueue >= 0) {
            if (
              !isNaN(idQueue) &&
              Number.isInteger(idQueue) &&
              !isNaN(timeQueue) &&
              Number.isInteger(timeQueue)
            ) {
              const lockKey = `${companyId}-${idQueue}`;
              if (verifyQueueLocks.has(lockKey)) {
                // Já existe uma execução em andamento para essa empresa/fila
                // (ex.: job anterior ainda processando). Evita reprocessar
                // os mesmos tickets em paralelo.
                continue;
              }
              verifyQueueLocks.add(lockKey);

              try {
                const tempoPassado = moment()
                  .subtract(timeQueue, "minutes")
                  .utc()
                  .format();

                const { count, rows: tickets } = await Ticket.findAndCountAll(
                  {
                    attributes: ["id", "queueId"],
                    where: {
                      status: "pending",
                      queueId: null,
                      companyId: companyId,
                      whatsappId: w.id,
                      updatedAt: {
                        [Op.lt]: tempoPassado
                      }
                    },
                    include: [
                      {
                        model: Contact,
                        as: "contact",
                        attributes: [
                          "id",
                          "name",
                          "number",
                          "email",
                          "profilePicUrl",
                          "acceptAudioMessage",
                          "active",
                          "disableBot",
                          "urlPicture",
                          "lgpdAcceptedAt",
                          "companyId"
                        ],
                        include: ["extraInfo", "tags"]
                      },
                      {
                        model: Queue,
                        as: "queue",
                        attributes: ["id", "name", "color"]
                      },
                      {
                        model: Whatsapp,
                        as: "whatsapp",
                        attributes: [
                          "id",
                          "name",
                          "expiresTicket",
                          "groupAsTicket"
                        ]
                      }
                    ]
                  }
                );

                if (count > 0) {
                  for (const ticket of tickets) {
                    if (Number(ticket.queueId) === Number(idQueue)) {
                      // Já está na fila de destino, nada a fazer.
                      continue;
                    }

                    await ticket.update(
                      {
                        queueId: idQueue
                      },
                      {
                        silent: true
                      }
                    );

                    await CreateLogTicketService({
                      userId: null,
                      queueId: idQueue,
                      ticketId: ticket.id,
                      type: "redirect"
                    });

                    const hydratedTicket = await ShowTicketService(
                      ticket.id,
                      companyId
                    );

                    const io = getIO();
                    io.of(String(companyId)).emit(
                      `company-${companyId}-ticket`,
                      {
                        action: "update",
                        ticket: hydratedTicket,
                        ticketId: hydratedTicket.id
                      }
                    );

                    logger.info(
                      `Atendimento Perdido: ${ticket.id} - Empresa: ${companyId}`
                    );
                  }
                }
              } finally {
                verifyQueueLocks.delete(lockKey);
              }
            } else {
              logger.info(
                `Condição não respeitada - Empresa: ${companyId}`
              );
            }
          }
        }
      }
    }
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("SearchForQueue -> VerifyQueue: error", e.message);
    throw e;
  }
}
async function handleRandomUser() {
  const jobR = new CronJob("0 */2 * * * *", async () => {
    try {
      const companies = await Company.findAll({
        attributes: ["id", "name"],
        where: {
          status: true
        },
        include: [
          {
            model: Queues,
            attributes: ["id", "name", "ativarRoteador", "tempoRoteador"],
            where: {
              ativarRoteador: true,
              tempoRoteador: {
                [Op.ne]: 0
              }
            }
          }
        ]
      });

      if (companies) {
        companies.map(async c => {
          c.queues.map(async q => {
            const { count, rows: tickets } = await Ticket.findAndCountAll({
              where: {
                companyId: c.id,
                status: "pending",
                queueId: q.id
              }
            });

            const getRandomUserId = userIds => {
              const randomIndex = Math.floor(Math.random() * userIds.length);
              return userIds[randomIndex];
            };

            const findUserById = async (userId, companyId) => {
              try {
                const user = await User.findOne({
                  where: {
                    id: userId,
                    companyId
                  }
                });

                if (user && user?.profile === "user") {
                  if (user.online === true) {
                    return user.id;
                  } else {
                    return 0;
                  }
                } else {
                  return 0;
                }
              } catch (errorV: any) {
                Sentry.captureException(errorV);
                logger.error(
                  "SearchForUsersRandom -> VerifyUsersRandom: error",
                  errorV.message
                );
                throw errorV;
              }
            };

            if (count > 0) {
              for (const ticket of tickets) {
                const { queueId, userId } = ticket;
                const tempoRoteador = q.tempoRoteador;

                const userQueues = await UserQueue.findAll({
                  where: {
                    queueId: queueId
                  }
                });

                const contact = await ShowContactService(
                  ticket.contactId,
                  ticket.companyId
                );

                const userIds = userQueues.map(
                  userQueue => userQueue.userId
                );

                const tempoPassadoB = moment()
                  .subtract(tempoRoteador, "minutes")
                  .utc()
                  .toDate();
                const updatedAtV = new Date(ticket.updatedAt);

                let settings = await CompaniesSettings.findOne({
                  where: {
                    companyId: ticket.companyId
                  }
                });
                const sendGreetingMessageOneQueues =
                  settings.sendGreetingMessageOneQueues === "enabled" ||
                  false;

                if (!userId) {
                  const randomUserId = getRandomUserId(userIds);

                  if (
                    randomUserId !== undefined &&
                    (await findUserById(
                      randomUserId,
                      ticket.companyId
                    )) > 0
                  ) {
                    if (sendGreetingMessageOneQueues) {
                      const ticketToSend = await ShowTicketService(
                        ticket.id,
                        ticket.companyId
                      );

                      await SendWhatsAppMessage({
                        body: `\u200e *Assistente Virtual*:\nAguarde enquanto localizamos um atendente... Você será atendido em breve!`,
                        ticket: ticketToSend
                      });
                    }

                    await UpdateTicketService({
                      ticketData: {
                        status: "pending",
                        userId: randomUserId
                      },
                      ticketId: ticket.id,
                      companyId: ticket.companyId
                    });

                    logger.info(
                      `Ticket ID ${ticket.id} atualizado para UserId ${randomUserId} - ${ticket.updatedAt}`
                    );
                  }
                } else if (userIds.includes(userId)) {
                  if (tempoPassadoB > updatedAtV) {
                    const availableUserIds = userIds.filter(
                      id => id !== userId
                    );

                    if (availableUserIds.length > 0) {
                      const randomUserId = getRandomUserId(
                        availableUserIds
                      );

                      if (
                        randomUserId !== undefined &&
                        (await findUserById(
                          randomUserId,
                          ticket.companyId
                        )) > 0
                      ) {
                        if (sendGreetingMessageOneQueues) {
                          const ticketToSend = await ShowTicketService(
                            ticket.id,
                            ticket.companyId
                          );
                          await SendWhatsAppMessage({
                            body:
                              "*Assistente Virtual*:\nAguarde enquanto localizamos um atendente... Você será atendido em breve!",
                            ticket: ticketToSend
                          });
                        }

                        await UpdateTicketService({
                          ticketData: {
                            status: "pending",
                            userId: randomUserId
                          },
                          ticketId: ticket.id,
                          companyId: ticket.companyId
                        });

                        logger.info(
                          `Ticket ID ${ticket.id} atualizado para UserId ${randomUserId} - ${ticket.updatedAt}`
                        );
                      }
                    }
                  }
                }
              }
            }
          });
        });
      }
    } catch (e: any) {
      Sentry.captureException(e);
      logger.error(
        "SearchForUsersRandom -> VerifyUsersRandom: error",
        e.message
      );
      throw e;
    }
  });

  jobR.start();
}

async function handleProcessLanes() {
  const job = new CronJob("*/1 * * * *", async () => {
    const companies = await Company.findAll({
      include: [
        {
          model: Plan,
          as: "plan",
          attributes: ["id", "name", "useKanban"],
          where: {
            useKanban: true
          }
        }
      ]
    });
    companies.map(async c => {
      try {
        const companyId = c.id;

        const ticketTags = await TicketTag.findAll({
          include: [
            {
              model: Ticket,
              as: "ticket",
              where: {
                status: "open",
                companyId
                // fromMe removido: tickets inbound (cliente) também devem ser processados
              },
              attributes: ["id", "contactId", "updatedAt", "whatsappId"]
            },
            {
              model: Tag,
              as: "tag",
              attributes: [
                "id",
                "timeLane",
                "timeLaneUnit",
                "nextLaneId",
                "greetingMessageLane"
              ],
              where: {
                companyId,
                kanban: 1
              }
            }
          ]
        });

        if (ticketTags.length > 0) {
          for (const t of ticketTags) {
            if (
              !isNil(t?.tag.nextLaneId) &&
              t?.tag.nextLaneId > 0 &&
              t?.tag.timeLane > 0
            ) {
              const nextTag = await Tag.findByPk(t?.tag.nextLaneId);

              if (!nextTag) {
                logger.warn(`Process Lanes: nextLaneId ${t.tag.nextLaneId} not found for tag ${t.tag.id}, skipping`);
                continue;
              }

              const dataLimite = new Date();
              if (t.tag.timeLaneUnit === "minutes") {
                dataLimite.setMinutes(
                  dataLimite.getMinutes() - Number(t.tag.timeLane)
                );
              } else {
                dataLimite.setHours(
                  dataLimite.getHours() - Number(t.tag.timeLane)
                );
              }
              const dataUltimaInteracaoChamado = new Date(t.ticket.updatedAt);

              if (dataUltimaInteracaoChamado < dataLimite) {
                logger.info(`Process Lanes: moving ticket ${t.ticketId} from tag ${t.tagId} to tag ${nextTag.id}`);

                await TicketTag.destroy({
                  where: { ticketId: t.ticketId, tagId: t.tagId }
                });
                await TicketTag.create({
                  ticketId: t.ticketId,
                  tagId: nextTag.id
                });

                if (
                  !isNil(nextTag.greetingMessageLane) &&
                  nextTag.greetingMessageLane !== ""
                ) {
                  const whatsapp = await Whatsapp.findByPk(t.ticket.whatsappId);

                  if (whatsapp) {
                    const contact = await Contact.findByPk(t.ticket.contactId);
                    const ticketUpdate = await ShowTicketService(t.ticketId, companyId);

                    await SendMessage(
                      whatsapp,
                      {
                        number: contact.number,
                        body: `${formatBody(nextTag.greetingMessageLane, ticketUpdate)}`,
                        mediaPath: null,
                        companyId: companyId
                      },
                      contact.isGroup
                    );
                  }
                }
              }
            }
          }
        }
      } catch (e: any) {
        Sentry.captureException(e);
        logger.error("Process Lanes -> Verify: error", e.message);
        throw e;
      }
    });
  });
  job.start();
}

async function handleCloseTicketsAutomatic() {
  const job = new CronJob("*/1 * * * *", async () => {
    const companies = await Company.findAll({
      where: {
        status: true
      }
    });
    companies.map(async c => {
      try {
        const companyId = c.id;
        await ClosedAllOpenTickets(companyId);
      } catch (e: any) {
        Sentry.captureException(e);
        logger.error("ClosedAllOpenTickets -> Verify: error", e.message);
        throw e;
      }
    });
  });
  job.start();
}

// Painel Vigia — verifica a cada minuto se algum atendimento em aberto
// cruzou o limiar de risco/fora do prazo (ver docs/MANUAL_TECNICO.md).
async function handleSupervisorSlaMonitor() {
  const job = new CronJob("*/1 * * * *", async () => {
    const companies = await Company.findAll({
      where: {
        status: true
      }
    });
    companies.map(async c => {
      try {
        await runSlaMonitor(c.id);
      } catch (e: any) {
        Sentry.captureException(e);
        logger.error(`SupervisorSlaMonitor -> Verify: error ${e.message}`);
      }
    });
  });
  job.start();
}

async function handleWhatsapp() {
  const jobW = new CronJob(
    "* 15 3 * * *",
    async () => {
      GetWhatsapp();
      jobW.stop();
    },
    null,
    false,
    "America/Sao_Paulo"
  );
  jobW.start();
}

async function handleInvoiceCreate() {
  const job = new CronJob("0 * * * * *", async () => {
    const companies = await Company.findAll();
    companies.map(async c => {
      const dueDate = c.dueDate;
      const date = moment(dueDate).format();
      const hoje = moment(moment()).format("DD/MM/yyyy");
      const vencimento = moment(dueDate).format("DD/MM/yyyy");

      const diff = moment(vencimento, "DD/MM/yyyy").diff(
        moment(hoje, "DD/MM/yyyy")
      );
      const dias = moment.duration(diff).asDays();

      if (dias < 20) {
        const plan = await Plan.findByPk(c.planId);
        if (!plan) {
          return;
        }

        const dueDatePrefix = moment(dueDate).format("YYYY-MM-DD");
        const invoiceCount = await Invoices.count({
          where: {
            companyId: c.id,
            dueDate: {
              [Op.like]: `${dueDatePrefix}%`
            }
          }
        });

        if (invoiceCount > 0) {
          // já existe
        } else {
          const parsedAmount = parseCurrencyValue(plan.amount);
          if (parsedAmount === null) {
            logger.error(
              "InvoiceCreate -> Invalid plan amount",
              `companyId=${c.id} planId=${plan.id} amount=${plan.amount}`
            );
            return;
          }

          await Invoices.create({
            detail: plan.name,
            status: "open",
            value: parsedAmount,
            dueDate: date,
            companyId: c.id
          });
        }
      }
    });
  });
  job.start();
}

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

const normalizePhoneDigits = (value: string): string => String(value || "").replace(/\D/g, "");

const resolveBillingContactNumberCandidates = (phone: string): string[] => {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return [];

  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  const withoutCountry = withCountry.startsWith("55") ? withCountry.slice(2) : withCountry;

  return Array.from(new Set([withCountry, withoutCountry].filter(Boolean)));
};

const findOrCreateBillingContact = async (company: Company): Promise<Contact | null> => {
  const candidates = resolveBillingContactNumberCandidates(String(company.phone || ""));
  if (!candidates.length) return null;

  let contact = await Contact.findOne({
    where: {
      companyId: 1,
      number: { [Op.in]: candidates }
    }
  });

  if (contact) return contact;

  const primaryNumber = candidates[0];
  const secondaryNumber = candidates[1];
  const fallbackName = String(company.name || "Cliente").trim() || "Cliente";

  try {
    contact = await Contact.create({
      name: fallbackName,
      number: primaryNumber,
      email: "",
      isGroup: false,
      companyId: 1,
      channel: "whatsapp",
      profilePicUrl: "",
      remoteJid: `${primaryNumber}@s.whatsapp.net`,
      active: true
    } as any);
    return contact;
  } catch (_error) {
    if (!secondaryNumber) return null;
    return Contact.findOne({
      where: {
        companyId: 1,
        number: secondaryNumber
      }
    });
  }
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

const alreadySentBillingNotice = async (key: string): Promise<boolean> => {
  const existing = await Setting.findOne({
    where: {
      companyId: 1,
      key
    }
  });
  return !!existing;
};

const markBillingNoticeSent = async (key: string): Promise<void> => {
  await Setting.create({
    companyId: 1,
    key,
    value: moment().format("YYYY-MM-DD HH:mm:ss")
  } as any);
};

async function handleBillingNotifications() {
  const job = new CronJob("0 15 9 * * *", async () => {
    try {
      const config = await GetGlobalConfig(1);
      const dueEmailEnabled = String(config.billingDueEmailEnabled || "").toLowerCase() === "enabled";
      const dueWhatsappEnabled = String(config.billingDueWhatsappEnabled || "").toLowerCase() === "enabled";

      if (!dueEmailEnabled && !dueWhatsappEnabled) {
        return;
      }

      const daysBefore = Number.parseInt(String(config.billingDueDaysBefore || "3"), 10);
      const senderWhatsapp = dueWhatsappEnabled
        ? await resolveBillingSenderWhatsapp()
        : null;
      const companies = await Company.findAll({
        where: { status: true },
        attributes: ["id", "name", "email", "phone"]
      });

      const today = moment().startOf("day");

      for (const company of companies) {
        const invoice = await Invoices.findOne({
          where: {
            companyId: company.id,
            status: {
              [Op.in]: ["open", "OPEN", "pending", "PENDING"]
            }
          },
          order: [["dueDate", "ASC"]]
        });

        if (!invoice || !invoice.dueDate) continue;

        const dueDate = moment(invoice.dueDate).startOf("day");
        if (!dueDate.isValid()) continue;

        const diffDays = dueDate.diff(today, "days");
        const isDueReminder = diffDays >= 0 && diffDays === daysBefore;
        const invoiceLink = String(invoice.linkInvoice || "").trim();

        const variables = {
          companyName: String(company.name || ""),
          dueDate: dueDate.format("DD/MM/YYYY"),
          invoiceValue: toCurrencyLabel(Number(invoice.value || 0)),
          invoiceLink,
          daysToDue: String(Math.max(diffDays, 0)),
          daysOverdue: "0"
        };

        if (isDueReminder) {
          const dateKey = today.format("YYYY-MM-DD");

          if (dueEmailEnabled && String(company.email || "").includes("@")) {
            const uniqueKey = `BILLING_SENT_DUE_EMAIL:${company.id}:${invoice.id}:${dateKey}`;
            const sent = await alreadySentBillingNotice(uniqueKey);
            if (!sent) {
              await SendWelcomeEmail({
                to: String(company.email),
                companyName: variables.companyName,
                dueDate: variables.dueDate,
                companyId: 1,
                force: true,
                loginUrl: variables.invoiceLink,
                extraVariables: variables,
                configOverride: {
                  welcomeEmailEnabled: "enabled",
                  welcomeEmailSubject: config.billingDueEmailSubject,
                  welcomeEmailTemplate: config.billingDueEmailTemplate
                }
              });
              await markBillingNoticeSent(uniqueKey);
            }
          }

          if (dueWhatsappEnabled && senderWhatsapp) {
            const uniqueKey = `BILLING_SENT_DUE_WPP:${company.id}:${invoice.id}:${dateKey}`;
            const sent = await alreadySentBillingNotice(uniqueKey);
            const jid = normalizeToJid(String(company.phone || ""));
            if (!sent && jid) {
              const body = replaceTemplateVars(config.billingDueWhatsappTemplate, variables);
              const contact = await findOrCreateBillingContact(company);
              const ticket = contact
                ? await FindOrCreateTicketService(
                    contact,
                    senderWhatsapp,
                    0,
                    1,
                    null,
                    null,
                    null,
                    senderWhatsapp.channel,
                    null,
                    false,
                    null,
                    false,
                    false
                  )
                : null;

              if (ticket) {
                const sentMessage = await SendWhatsAppMessage({
                  body: `\u200e ${body}`,
                  ticket
                });

                const wid = String((sentMessage as any)?.key?.id || "").trim();
                if (wid && contact?.id) {
                  await CreateMessageService({
                    companyId: 1,
                    messageData: {
                      wid,
                      ticketId: ticket.id,
                      contactId: contact.id,
                      body,
                      fromMe: true,
                      read: true,
                      channel: senderWhatsapp.channel
                    }
                  });
                }
              } else {
                const wbot = getWbot(senderWhatsapp.id, senderWhatsapp.companyId);
                await wbot.sendMessage(jid, { text: body });
              }

              await markBillingNoticeSent(uniqueKey);
            }
          }
        }

      }
    } catch (err: any) {
      Sentry.captureException(err);
      logger.error(`BillingNotifications -> error: ${err.message}`);
    }
  });

  job.start();
}

handleInvoiceCreate();
handleBillingNotifications();
handleWhatsapp();
handleProcessLanes();
handleCloseTicketsAutomatic();
handleRandomUser();
handleSupervisorSlaMonitor();

export async function startQueueProcess() {
  logger.info("Iniciando processamento de filas");

  messageQueue.process("SendMessage", handleSendMessage);

  scheduleMonitor.process("Verify", handleVerifySchedules);

  sendScheduledMessages.process("SendMessage", handleSendScheduledMessage);

  campaignQueue.process("ProcessCampaign", handleProcessCampaign);
  campaignQueue.process("ProcessOfficialCampaign", handleProcessOfficialCampaign);

  campaignQueue.process("PrepareContact", handlePrepareContact);
  campaignQueue.process(
    "PrepareOfficialCampaignContact",
    handlePrepareOfficialContact
  );

  campaignQueue.process("DispatchCampaign", handleDispatchCampaign);
  campaignQueue.process(
    "DispatchOfficialCampaign",
    handleDispatchOfficialCampaign
  );

  userMonitor.process("VerifyLoginStatus", handleLoginStatus);

  queueMonitor.process("VerifyQueueStatus", handleVerifyQueue);

  // Mesma correção aplicada às campanhas: o job repetível do Bull para
  // verificar agendamentos ("Schedules") também trava silenciosamente
  // após um tempo. Troca por setInterval nativo do Node.
  setInterval(() => {
    handleVerifySchedules(null).catch(err => {
      Sentry.captureException(err);
      logger.error(`SendScheduledMessage -> Verify: error ${err.message}`);
    });
  }, 60000);

  // Substitui o agendamento via Bull repeatable job (que pode travar
  // silenciosamente caso o Redis reconecte ou o Bull falhe ao re-agendar
  // a próxima iteração) por um setInterval nativo do Node, que não
  // depende do estado do Redis para continuar disparando.
  setInterval(() => {
    handleVerifyCampaigns(null).catch(err => {
      Sentry.captureException(err);
      logger.error(`Error processing campaigns: ${err.message}`);
    });
  }, 20000);

  setInterval(() => {
    handleVerifyOfficialCampaigns(null).catch(err => {
      Sentry.captureException(err);
      logger.error(`Error processing official campaigns: ${err.message}`);
    });
  }, 20000);

  // Rede de segurança: o job "DispatchCampaign" (enfileirado com delay)
  // eventualmente some da fila do Bull sem nunca ser processado (bug
  // observado especificamente nessa fila/ambiente). Essa verificação
  // detecta o CampaignShipping preso e reenfileira o disparo direto.
  setInterval(() => {
    handleReconcileOrphanedDispatches().catch(err => {
      Sentry.captureException(err);
      logger.error(
        `Error reconciling orphaned campaign dispatches: ${err.message}`
      );
    });
  }, 30000);

  userMonitor.add(
    "VerifyLoginStatus",
    {},
    {
      repeat: { cron: "* * * * *", key: "verify-login" },
      removeOnComplete: true
    }
  );

  queueMonitor.add(
    "VerifyQueueStatus",
    {},
    {
      repeat: { cron: "0 * * * * *", key: "verify-queue" },
      removeOnComplete: true
    }
  );
}
