import path from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import axios from "axios";
import mime from "mime-types";
import CompaniesSettings from "../../models/CompaniesSettings";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { getIO } from "../../libs/socket";
import logger from "../../utils/logger";
import { Op } from "sequelize";
import { differenceInMilliseconds } from "date-fns";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import ShowQueueIntegrationService from "../QueueIntegrationServices/ShowQueueIntegrationService";
import SendWhatsAppOficialMessage from "./SendWhatsAppOficialMessage";
import verifyMessageOficial from "./VerifyMessageOficial";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import { FlowCampaignModel } from "../../models/FlowCampaign";
import { ActionsWebhookService } from "../WebhookService/ActionsWebhookService";
import { WebhookModel } from "../../models/Webhook";
import HandleNpsReplyService from "../TicketServices/HandleNpsReplyService";

const mimeToExtension: { [key: string]: string } = {
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "application/pdf": "pdf"
};

const FLOW_NODE_TYPES_EXPECTING_INPUT = new Set([
  "menu",
  "question",
  "openai",
  "typebot"
]);

const buildFlowInputBody = (message: IMessageReceived): string => {
  const directText = String(message?.text || "").trim();
  if (directText) return directText;

  switch (String(message?.type || "").toLowerCase()) {
    case "image":
      return "[imagem]";
    case "audio":
      return "[audio]";
    case "document":
      return "[documento]";
    case "video":
      return "[video]";
    case "sticker":
      return "[figurinha]";
    case "location":
      return "[localizacao]";
    case "contacts":
      return "[contato]";
    case "interactive":
      return "[interativo]";
    default:
      return "";
  }
};

const reserveOfficialFlowWelcomeStart = async (
  ticket: Ticket,
  flowId: number,
  firstNodeId: string
): Promise<boolean> => {
  const [affectedRows] = await Ticket.update(
    {
      flowStopped: String(flowId),
      flowWebhook: false,
      lastFlowId: firstNodeId,
      hashFlowId: null,
      dataWebhook: null
    },
    {
      where: {
        id: ticket.id,
        [Op.and]: [
          {
            [Op.or]: [{ flowStopped: null }, { flowStopped: "" }]
          },
          {
            [Op.or]: [{ lastFlowId: null }, { lastFlowId: "" }]
          },
          {
            [Op.or]: [{ flowWebhook: null }, { flowWebhook: false }]
          }
        ]
      }
    }
  );

  if (affectedRows > 0) {
    ticket.flowStopped = String(flowId);
    ticket.flowWebhook = false;
    ticket.lastFlowId = firstNodeId;
    ticket.hashFlowId = null;
    ticket.dataWebhook = null;
    return true;
  }

  await ticket.reload();
  return false;
};

const handleOfficialFlowBuilder = async ({
  ticket,
  contact,
  whatsapp,
  companyId,
  message
}: {
  ticket: Ticket;
  contact: Contact;
  whatsapp: Whatsapp;
  companyId: number;
  message: IMessageReceived;
}): Promise<void> => {
  if (contact.disableBot) {
    return;
  }

  const integrationIdToUse =
    Number(ticket?.integrationId || 0) > 0
      ? Number(ticket.integrationId)
      : Number((whatsapp as any)?.integrationId || 0);

  if (!integrationIdToUse || ticket.userId || ticket.imported) {
    return;
  }

  const queueIntegration = await ShowQueueIntegrationService(integrationIdToUse, companyId);
  if (String(queueIntegration?.type || "").toLowerCase() !== "flowbuilder") {
    return;
  }

  const flowInputBody = buildFlowInputBody(message);
  const isImageMessage = String(message?.type || "").toLowerCase() === "image";
  const integrationMsg = {
    key: {
      id: String(message?.idMessage || `official-${Date.now()}`),
      fromMe: false,
      remoteJid: `${contact.number}@s.whatsapp.net`
    },
    messageTimestamp: Number(message?.timestamp || Math.floor(Date.now() / 1000)),
    message: {
      conversation: flowInputBody,
      // Marca a mensagem sintética como imagem (sem o binário, que já foi
      // persistido em disco por VerifyMessageOficial) para que o nó de IA
      // do FlowBuilder (ActionsWebhookService) consiga localizar a Message
      // real pelo wid e o handleOpenAi entre no fluxo de leitura de imagem
      // em vez de tratar "[imagem]" como texto comum.
      ...(isImageMessage
        ? {
            imageMessage: {
              mimetype: message?.mimeType || "image/jpeg",
              caption: message?.text || undefined
            }
          }
        : {})
    },
    pushName: contact.name
  } as any;

  const mountDataContact = {
    number: contact.number,
    name: contact.name,
    email: contact.email
  };

  let currentFlow: FlowBuilderModel | null = null;
  let currentNodes: any[] = [];
  let currentConnections: any[] = [];
  let currentNode: any = null;
  let currentNodeType = "";

  if (ticket.flowStopped && ticket.lastFlowId) {
    currentFlow = await FlowBuilderModel.findOne({
      where: { id: ticket.flowStopped }
    });

    currentNodes = Array.isArray((currentFlow as any)?.flow?.nodes)
      ? (currentFlow as any).flow.nodes
      : [];
    currentConnections = Array.isArray((currentFlow as any)?.flow?.connections)
      ? (currentFlow as any).flow.connections
      : [];
    currentNode = currentNodes.find(
      (node: any) => String(node?.id) === String(ticket.lastFlowId)
    );
    currentNodeType = String(currentNode?.type || "").trim().toLowerCase();

    if (
      currentNodeType &&
      !FLOW_NODE_TYPES_EXPECTING_INPUT.has(currentNodeType)
    ) {
      logger.info(
        `[WHATSAPP OFICIAL] FlowBuilder aguardando nó automático; mensagem ignorada | ticket=${ticket.id} | nodeType=${currentNodeType} | lastFlowId=${ticket.lastFlowId}`
      );
      return;
    }
  }

  if (
    currentNodeType === "question" &&
    currentFlow &&
    flowInputBody
  ) {
    const answerKey = String(
      currentNode?.data?.typebotIntegration?.answerKey || ""
    ).trim();
    const oldDataWebhook = (ticket.dataWebhook || {}) as {
      variables?: Record<string, unknown>;
      [key: string]: unknown;
    };
    const nextConnection = currentConnections.find(
      (connection: any) =>
        String(connection?.source) === String(currentNode?.id) &&
        Boolean(connection?.target)
    );
    const nextFlowId = nextConnection?.target;
    const nextDataWebhook = {
      ...oldDataWebhook,
      variables: {
        ...(oldDataWebhook?.variables || {}),
        ...(answerKey ? { [answerKey]: flowInputBody } : {})
      }
    };

    if (!nextFlowId) {
      await ticket.update({
        dataWebhook: nextDataWebhook
      });
      ticket.dataWebhook = nextDataWebhook;
      return;
    }

    await ticket.update({
      lastFlowId: String(nextFlowId),
      dataWebhook: nextDataWebhook
    });
    ticket.lastFlowId = String(nextFlowId);
    ticket.dataWebhook = nextDataWebhook;

    await ActionsWebhookService(
      whatsapp.id,
      parseInt(String(ticket.flowStopped), 10),
      ticket.companyId,
      currentNodes,
      currentConnections,
      String(nextFlowId),
      null,
      "",
      "",
      "",
      ticket.id,
      mountDataContact,
      integrationMsg
    );
    return;
  }

  if (ticket.flowWebhook) {
    let webhook: WebhookModel | null = null;
    if (ticket.hashFlowId) {
      webhook = await WebhookModel.findOne({
        where: {
          company_id: ticket.companyId,
          hash_id: ticket.hashFlowId
        }
      });
    }

    if (webhook && webhook.config["details"]) {
      const flow = await FlowBuilderModel.findOne({
        where: {
          id: webhook.config["details"].idFlow
        }
      });

      const nodes: any[] = Array.isArray((flow as any)?.flow?.nodes)
        ? (flow as any).flow.nodes
        : [];
      const connections: any[] = Array.isArray((flow as any)?.flow?.connections)
        ? (flow as any).flow.connections
        : [];

      await ActionsWebhookService(
        whatsapp.id,
        webhook.config["details"].idFlow,
        ticket.companyId,
        nodes,
        connections,
        ticket.lastFlowId,
        ticket.dataWebhook,
        webhook.config["details"],
        ticket.hashFlowId,
        flowInputBody,
        ticket.id
      );
      return;
    }
  }

  if (ticket.flowStopped && ticket.lastFlowId && currentFlow) {
    await ActionsWebhookService(
      whatsapp.id,
      parseInt(String(ticket.flowStopped), 10),
      ticket.companyId,
      currentNodes,
      currentConnections,
      ticket.lastFlowId,
      null,
      "",
      "",
      flowInputBody,
      ticket.id,
      mountDataContact,
      integrationMsg
    );
    return;
  }

  const listPhrase = await FlowCampaignModel.findAll({
    where: {
      whatsappId: whatsapp.id
    }
  });

  const matchedCampaign = listPhrase.find(item => item.phrase === flowInputBody);
  if (matchedCampaign) {
    const flow = await FlowBuilderModel.findOne({
      where: {
        id: matchedCampaign.flowId
      }
    });

    if (!flow?.active) {
      return;
    }

    const nodes: any[] = Array.isArray((flow as any)?.flow?.nodes)
      ? (flow as any).flow.nodes
      : [];
    const connections: any[] = Array.isArray((flow as any)?.flow?.connections)
      ? (flow as any).flow.connections
      : [];
    const firstNodeId = nodes?.[0]?.id;

    if (!firstNodeId) {
      return;
    }

    const reserved = await reserveOfficialFlowWelcomeStart(
      ticket,
      matchedCampaign.flowId,
      String(firstNodeId)
    );

    if (!reserved) {
      return;
    }

    await ActionsWebhookService(
      whatsapp.id,
      matchedCampaign.flowId,
      ticket.companyId,
      nodes,
      connections,
      String(firstNodeId),
      null,
      "",
      "",
      null,
      ticket.id,
      mountDataContact,
      integrationMsg
    );
    return;
  }

  const welcomeFlow = await FlowBuilderModel.findOne({
    where: {
      id: whatsapp.flowIdWelcome
    }
  });
  const hasActiveWelcomeFlow = !!welcomeFlow?.active;

  if (hasActiveWelcomeFlow && !ticket.flowStopped && !ticket.lastFlowId && !ticket.flowWebhook) {
    const nodes: any[] = Array.isArray((welcomeFlow as any)?.flow?.nodes)
      ? (welcomeFlow as any).flow.nodes
      : [];
    const connections: any[] = Array.isArray((welcomeFlow as any)?.flow?.connections)
      ? (welcomeFlow as any).flow.connections
      : [];
    const firstNodeId = nodes?.[0]?.id;

    if (firstNodeId) {
      const reserved = await reserveOfficialFlowWelcomeStart(
        ticket,
        Number(whatsapp.flowIdWelcome),
        String(firstNodeId)
      );

      if (reserved) {
        await ActionsWebhookService(
          whatsapp.id,
          Number(whatsapp.flowIdWelcome),
          ticket.companyId,
          nodes,
          connections,
          String(firstNodeId),
          null,
          {},
          "",
          undefined,
          ticket.id,
          mountDataContact,
          integrationMsg
        );
        return;
      }
    }
  }

  const previousTicket = await Ticket.findOne({
    where: {
      id: { [Op.ne]: ticket.id },
      contactId: ticket.contactId,
      companyId,
      whatsappId: whatsapp.id
    },
    order: [["updatedAt", "DESC"]]
  });

  const dateTicket = new Date(previousTicket?.updatedAt || "");
  const dateNow = new Date();
  const diffMs = Math.abs(differenceInMilliseconds(dateTicket, dateNow));
  const sixHoursMs = 6 * 60 * 60 * 1000;
  const hasPreviousTicket = !!previousTicket && previousTicket.id !== ticket.id;

  if (
    !hasActiveWelcomeFlow &&
    hasPreviousTicket &&
    diffMs >= sixHoursMs &&
    !ticket.flowStopped &&
    !ticket.lastFlowId &&
    !ticket.flowWebhook
  ) {
    const flow = await FlowBuilderModel.findOne({
      where: {
        id: whatsapp.flowIdNotPhrase
      }
    });

    if (!flow?.active) {
      return;
    }

    const nodes: any[] = Array.isArray((flow as any)?.flow?.nodes)
      ? (flow as any).flow.nodes
      : [];
    const connections: any[] = Array.isArray((flow as any)?.flow?.connections)
      ? (flow as any).flow.connections
      : [];
    const firstNodeId = nodes?.[0]?.id;

    if (!firstNodeId) {
      return;
    }

    const reserved = await reserveOfficialFlowWelcomeStart(
      ticket,
      Number(whatsapp.flowIdNotPhrase),
      String(firstNodeId)
    );

    if (!reserved) {
      return;
    }

    await ActionsWebhookService(
      whatsapp.id,
      Number(whatsapp.flowIdNotPhrase),
      ticket.companyId,
      nodes,
      connections,
      String(firstNodeId),
      null,
      "",
      "",
      null,
      ticket.id,
      mountDataContact,
      integrationMsg
    );
  }
};

export interface IReceivedWhatsppOficial {
  token: string;
  fromNumber: string;
  nameContact: string;
  companyId: number;
  message: IMessageReceived;
}

export interface IReceivedReadWhatsppOficialRead {
  messageId: string;
  companyId: number;
  token: string;
}

interface IReceivedContactPhone {
  phone?: string;
  wa_id?: string;
}

interface IReceivedContact {
  name?: {
    formatted_name?: string;
    first_name?: string;
    last_name?: string;
  };
  phones?: IReceivedContactPhone[];
  emails?: { email?: string }[];
}

export interface IMessageReceived {
  type:
    | "text"
    | "image"
    | "audio"
    | "document"
    | "video"
    | "location"
    | "contacts"
    | "sticker"
    | "order"
    | "reaction"
    | "interactive"
    | "edited";
  timestamp: number;
  idMessage: string;
  idFile?: string;
  text?: string;
  file?: string;
  mimeType?: string;
  quoteMessageId?: string;
  editedMessageId?: string;
  contacts?: IReceivedContact[];
  // Mantém o conteúdo original de mensagens interativas recebido do webhook.
  // O frontend usa estes dados para renderizar botões/listas quando o provedor
  // os disponibiliza, sem depender do texto de fallback da mensagem.
  interactive?: any;
}

// Monta vCard(s) no mesmo formato usado pelos fluxos Baileys/WuzAPI
// (mediaType "contactMessage", body iniciando em "BEGIN:VCARD"), a partir
// do array de contatos recebido no payload da API Oficial.
export const buildVcardFromContacts = (
  contacts?: IReceivedContact[]
): string => {
  if (!Array.isArray(contacts) || contacts.length === 0) return "";

  return contacts
    .map(contact => {
      const name =
        contact?.name?.formatted_name ||
        [contact?.name?.first_name, contact?.name?.last_name]
          .filter(Boolean)
          .join(" ") ||
        "";

      const phoneEntry = contact?.phones?.[0];
      const rawPhone = String(phoneEntry?.wa_id || phoneEntry?.phone || "").replace(
        /\D/g,
        ""
      );
      const email = contact?.emails?.[0]?.email;

      const lines = ["BEGIN:VCARD", "VERSION:3.0"];
      lines.push(`N:;${name};;;`);
      lines.push(`FN:${name}`);
      if (rawPhone) {
        lines.push(`TEL;type=CELL;type=VOICE;waid=${rawPhone}:+${rawPhone}`);
      }
      if (email) {
        lines.push(`EMAIL:${email}`);
      }
      lines.push("END:VCARD");

      return lines.join("\n");
    })
    .join("\n");
};

const parseQueueOption = (raw: string): number | null => {
  const text = String(raw || "").trim();
  if (!text) return null;
  const match = text.match(/^\D*(\d{1,3})\D*$/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
};

const sendConnectionIntegrationIfSupported = async ({
  integrationId,
  companyId,
  payload
}: {
  integrationId: number;
  companyId: number;
  payload: any;
}): Promise<void> => {
  try {
    const integration = await ShowQueueIntegrationService(integrationId, companyId);
    const type = String(integration?.type || "").toLowerCase();
    const endpoint = String((integration as any)?.urlN8N || "").trim();

    if (!endpoint) return;

    if (type === "webhook" || type === "n8n") {
      await axios.post(endpoint, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 10000
      });
      return;
    }

    logger.info(
      `[WHATSAPP OFICIAL] Integração não acionada por compatibilidade (type=${type}).`
    );
  } catch (error: any) {
    logger.error(
      `[WHATSAPP OFICIAL] Falha ao acionar integração da conexão: ${error?.message || error}`
    );
  }
};

export class ReceibedWhatsAppService {
  async getMessage(data: IReceivedWhatsppOficial) {
    try {
      const { message, fromNumber, nameContact, token } = data;
      const payloadCompanyId = Number(data?.companyId) || null;
      const traceId = String(message?.idMessage || `sem-id-${Date.now()}`);
      const tokenPrefix = String(token || "").slice(0, 6);

      logger.info(
        `[WHATSAPP OFICIAL][${traceId}] Iniciando processamento | payloadCompanyId=${String(
          payloadCompanyId || ""
        )} | from=${String(fromNumber || "")} | type=${String(message?.type || "")} | tokenPrefix=${tokenPrefix}`
      );

      if (!token || !fromNumber || !message?.idMessage) {
        logger.error(
          `[WHATSAPP OFICIAL][${traceId}] Payload inválido: token/fromNumber/idMessage ausente`
        );
        return;
      }

      let conexao =
        payloadCompanyId != null
          ? await Whatsapp.findOne({ where: { token, companyId: payloadCompanyId } })
          : null;

      if (!conexao) {
        conexao = await Whatsapp.findOne({ where: { token } });
      }

      if (!conexao) {
        logger.error(
          `[WHATSAPP OFICIAL][${traceId}] Conexão não encontrada para token recebido | payloadCompanyId=${String(
            payloadCompanyId || ""
          )} | tokenPrefix=${tokenPrefix}`
        );
        return;
      }

      const companyId = conexao.companyId;
      if (payloadCompanyId && payloadCompanyId !== companyId) {
        logger.warn(
          `[WHATSAPP OFICIAL][${traceId}] companyId divergente entre payload e conexão | payload=${payloadCompanyId} | conexao=${companyId} | whatsappId=${conexao.id}`
        );
      }

      let contact = await Contact.findOne({
        where: { number: fromNumber, companyId }
      });

      logger.info(
        `[WHATSAPP OFICIAL][${traceId}] Conexão validada | whatsappId=${conexao.id} | companyId=${companyId}`
      );

      const isTypingEvent =
        ["typing", "presence", "chatstate", "typing_on", "typing_off"].includes(
          String(message?.type || "").toLowerCase()
        ) ||
        ["typing_on", "typing_off", "composing", "paused", "available", "unavailable"].includes(
          String((message as any)?.text || "").toLowerCase().trim()
        );

      if (isTypingEvent) {
        const typingStateRaw = String(
          (message as any)?.state ||
            (message as any)?.status ||
            (message as any)?.text ||
            message?.type ||
            ""
        )
          .trim()
          .toLowerCase();

        const isTyping =
          ["typing", "typing_on", "composing", "recording"].includes(typingStateRaw) ||
          String(message?.type || "").toLowerCase() === "typing_on";

        const isStopTyping =
          ["typing_off", "paused", "available", "unavailable", "idle"].includes(typingStateRaw) ||
          String(message?.type || "").toLowerCase() === "typing_off";

        if (isTyping || isStopTyping) {
          const ticket = await Ticket.findOne({
            where: {
              companyId,
              whatsappId: conexao.id,
              contactId: contact.id,
              status: { [Op.in]: ["open", "pending", "group"] }
            },
            order: [["updatedAt", "DESC"]]
          });

          if (ticket) {
            const io = getIO();
            io.of(String(companyId)).emit(`company-${companyId}-typing`, {
              ticketId: ticket.id,
              isTyping,
              userId: null,
              companyId,
              at: new Date().toISOString()
            });
          }
        }

        return;
      }

      if (!contact) {
        contact = await Contact.create({
          name: nameContact,
          number: fromNumber,
          companyId,
          whatsappId: conexao.id
        });
        logger.info(
          `[WHATSAPP OFICIAL][${traceId}] Contato criado | contactId=${contact.id} | number=${fromNumber}`
        );
      } else {
        logger.info(
          `[WHATSAPP OFICIAL][${traceId}] Contato encontrado | contactId=${contact.id} | number=${fromNumber}`
        );
      }

      let fileName: string | null = null;

      if (message.file && message.idFile && message.mimeType) {
        const base64Data = String(message.file).replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const extension =
          mimeToExtension[message.mimeType] ||
          String(mime.extension(String(message.mimeType || "").toLowerCase()) || "bin");
        fileName = `${message.idFile}.${extension}`;

        const folder = path.resolve(__dirname, "..", "..", "..", "public", `company${companyId}`);
        if (!existsSync(folder)) {
          mkdirSync(folder, { recursive: true });
        }

        writeFileSync(path.join(folder, fileName), buffer);
        logger.info(
          `[WHATSAPP OFICIAL][${traceId}] Mídia persistida | fileName=${fileName} | mimeType=${message.mimeType}`
        );
      }

      const settings = await CompaniesSettings.findOne({ where: { companyId } });

      // Busca o último ticket do contato, independente do status, para
      // verificar se esta mensagem é a resposta da pesquisa de satisfação (NPS).
      const lastTicket = await Ticket.findOne({
        where: {
          contactId: contact.id,
          companyId,
          whatsappId: conexao.id
        },
        order: [["id", "DESC"]]
      });

      if (lastTicket) {
        const npsHandled = await HandleNpsReplyService({
          ticket: lastTicket,
          companyId: lastTicket.companyId,
          text: String(message.text || "")
        });
        if (npsHandled) {
          logger.info(
            `[WHATSAPP OFICIAL][${traceId}] Mensagem tratada como resposta de NPS | ticketId=${lastTicket.id}`
          );
          return;
        }
      }

      const ticket = await FindOrCreateTicketService(
        contact,
        conexao,
        0,
        companyId,
        null,
        null,
        null,
        "whatsapp_oficial",
        false,
        false,
        settings
      );

      logger.info(
        `[WHATSAPP OFICIAL][${traceId}] Ticket resolvido | ticketId=${ticket.id} | status=${ticket.status} | unreadAtual=${ticket.unreadMessages}`
      );

      if (message.type === "contacts") {
        logger.info(
          `[WHATSAPP OFICIAL][${traceId}] Mensagem de contato recebida | raw=${JSON.stringify(
            message.contacts || null
          )}`
        );
      }

      await ticket.update({
        lastMessage:
          message.type === "contacts" ? "Contato" : message.text || "",
        unreadMessages: (ticket.unreadMessages || 0) + 1
      });

      const connectionWithQueues = await Whatsapp.findByPk(conexao.id, {
        include: [
          {
            model: Queue,
            as: "queues",
            attributes: ["id", "name", "greetingMessage", "integrationId"]
          }
        ]
      });

      const connectionQueues = Array.isArray((connectionWithQueues as any)?.queues)
        ? ((connectionWithQueues as any).queues as Queue[])
        : [];

      let queueAssignedNow = false;
      let assignedQueue: Queue | null = null;
      let updatedDataWebhook: any = ticket.dataWebhook || null;

      if (!ticket.queueId && !ticket.userId) {
        const textBody = String(message.text || "").trim();
        const queueMenuMeta =
          updatedDataWebhook &&
          typeof updatedDataWebhook === "object" &&
          Array.isArray((updatedDataWebhook as any).__officialQueueMenuIds)
            ? (updatedDataWebhook as any)
            : null;

        if (queueMenuMeta) {
          const selectedOption = parseQueueOption(textBody);
          const queueIdsAllowed = (queueMenuMeta.__officialQueueMenuIds as any[])
            .map(item => Number(item))
            .filter(item => Number.isInteger(item) && item > 0);

          if (selectedOption && selectedOption <= queueIdsAllowed.length) {
            const selectedQueueId = queueIdsAllowed[selectedOption - 1];
            assignedQueue =
              connectionQueues.find(item => Number(item.id) === Number(selectedQueueId)) || null;

            if (assignedQueue) {
              await ticket.update({
                queueId: assignedQueue.id,
                dataWebhook: {
                  ...(updatedDataWebhook || {}),
                  __officialQueueMenuIds: null
                }
              });
              queueAssignedNow = true;
              updatedDataWebhook = {
                ...(updatedDataWebhook || {}),
                __officialQueueMenuIds: null
              };
            }
          } else if (textBody) {
            await SendWhatsAppOficialMessage({
              body: "Opção inválida. Responda com o número da fila desejada.",
              ticket,
              type: "text"
            });
          }
        }

        if (!queueAssignedNow) {
          const sendIdQueue = Number((conexao as any).sendIdQueue || 0);
          const timeSendQueue = Number((conexao as any).timeSendQueue || 0);

          if (sendIdQueue > 0 && timeSendQueue === 0) {
            assignedQueue =
              connectionQueues.find(item => Number(item.id) === sendIdQueue) || null;
            if (assignedQueue) {
              await ticket.update({ queueId: assignedQueue.id });
              queueAssignedNow = true;
            }
          } else if (connectionQueues.length === 1) {
            assignedQueue = connectionQueues[0];
            await ticket.update({ queueId: assignedQueue.id });
            queueAssignedNow = true;
          } else if (connectionQueues.length > 1 && !queueMenuMeta) {
            const optionsText = connectionQueues
              .map((queue, index) => `${index + 1} - ${queue.name}`)
              .join("\n");

            const greetingPrefix = String((conexao as any)?.greetingMessage || "").trim();
            const menuBody = greetingPrefix
              ? `${greetingPrefix}\n\nEscolha uma opção:\n${optionsText}`
              : `Escolha uma opção:\n${optionsText}`;

            await SendWhatsAppOficialMessage({
              body: menuBody,
              ticket,
              type: "text"
            });

            updatedDataWebhook = {
              ...(updatedDataWebhook || {}),
              __officialQueueMenuIds: connectionQueues.map(queue => queue.id)
            };
            await ticket.update({ dataWebhook: updatedDataWebhook });
          }
        }
      }

      if (!assignedQueue && ticket.queueId) {
        assignedQueue =
          connectionQueues.find(item => Number(item.id) === Number(ticket.queueId)) || null;
      }

      if (assignedQueue && !ticket.userId) {
        const queueIntegrationId = Number((assignedQueue as any).integrationId || 0);
        if (queueIntegrationId > 0) {
          await ticket.update({
            useIntegration: true,
            integrationId: queueIntegrationId
          });
        }
      }

      if (queueAssignedNow && assignedQueue) {
        const queueGreeting = String((assignedQueue as any)?.greetingMessage || "").trim();
        if (queueGreeting) {
          await SendWhatsAppOficialMessage({
            body: queueGreeting,
            ticket,
            type: "text"
          });
        }
      }

      if (String(message.type) === "edited") {
        const targetId = String(message.editedMessageId || message.quoteMessageId || "").trim();
        if (targetId) {
          const messageToUpdate = await Message.findOne({
            where: { companyId, ticketId: ticket.id, wid: targetId }
          });

          if (messageToUpdate) {
            const previousBody = String(messageToUpdate.body || "");
            let currentDataJson: any = {};
            try {
              currentDataJson = messageToUpdate.dataJson ? JSON.parse(messageToUpdate.dataJson) : {};
            } catch {
              currentDataJson = {};
            }

            const editedAt = new Date().toISOString();
            const editHistory = Array.isArray(currentDataJson?.__editHistory)
              ? currentDataJson.__editHistory
              : [];
            editHistory.push({
              editedAt,
              oldBody: previousBody,
              newBody: String(message.text || ""),
              provider: "whatsapp_oficial"
            });

            await messageToUpdate.update({
              isEdited: true,
              body: String(message.text || ""),
              dataJson: JSON.stringify({
                ...currentDataJson,
                __lastEditedOldBody: previousBody,
                __lastEditedNewBody: String(message.text || ""),
                __lastEditedAt: editedAt,
                __editHistory: editHistory
              })
            });

            await ticket.update({ lastMessage: String(message.text || "") });

            const io = getIO();
            io.of(String(companyId)).emit(`company-${companyId}-appMessage`, {
              action: "update",
              message: messageToUpdate
            });
            io.of(String(companyId)).emit(`company-${companyId}-ticket`, {
              action: "update",
              ticket
            });
          }
        }
        return;
      }

      await verifyMessageOficial(
        message,
        ticket,
        contact,
        companyId,
        fileName,
        fromNumber,
        data,
        message.quoteMessageId
      );

      if (
        !ticket.queueId &&
        !ticket.userId &&
        !ticket.useIntegration &&
        Number((conexao as any)?.integrationId || 0) > 0
      ) {
        await sendConnectionIntegrationIfSupported({
          integrationId: Number((conexao as any).integrationId),
          companyId,
          payload: {
            provider: "whatsapp_oficial",
            companyId,
            whatsappId: conexao.id,
            ticketId: ticket.id,
            contactId: contact.id,
            message
          }
        });
      }

      const shouldWarnAudioNotAccepted =
        String(message?.type || "").toLowerCase() === "audio" &&
        (!contact?.acceptAudioMessage ||
          String((settings as any)?.acceptAudioMessageContact || "").trim() === "disabled");

      if (shouldWarnAudioNotAccepted) {
        const audioBlockMessage = String(
          (settings as any)?.AcceptAudioMessageContactMessage ||
            "Infelizmente não conseguimos escutar nem enviar áudios por este canal de atendimento, por favor, envie uma mensagem de texto."
        ).trim();

        await SendWhatsAppOficialMessage({
          body: `\u200e*Assistente Virtual*:\n${audioBlockMessage}`,
          ticket,
          type: "text"
        });
      }

      const persistedMessage = await Message.findOne({
        where: { wid: message.idMessage, companyId }
      });

      if (!persistedMessage) {
        logger.warn(
          `[WHATSAPP OFICIAL][${traceId}] Fluxo finalizado sem localizar Message no banco | ticketId=${ticket.id} | companyId=${companyId}`
        );
      } else {
        logger.info(
          `[WHATSAPP OFICIAL][${traceId}] Mensagem persistida com sucesso | dbMessageId=${persistedMessage.id} | ticketId=${ticket.id} | companyId=${companyId}`
        );
      }

      // O ticket pode ter recebido queueId/integrationId/useIntegration em updates
      // acima; recarregamos antes de avaliar FlowBuilder para usar o estado real.
      await ticket.reload();

      await handleOfficialFlowBuilder({
        ticket,
        contact,
        whatsapp: conexao,
        companyId,
        message
      });
    } catch (error: any) {
      logger.error(`[WHATSAPP OFICIAL] Erro processando mensagem: ${error?.message || error}`);
    }
  }

  async readMessage(data: IReceivedReadWhatsppOficialRead) {
    const { messageId, token, companyId } = data;
    const traceId = String(messageId || `read-sem-id-${Date.now()}`);

    try {
      logger.info(
        `[WHATSAPP OFICIAL][${traceId}] Iniciando readMessage | companyId=${String(
          companyId || ""
        )} | tokenPrefix=${String(token || "").slice(0, 6)}`
      );

      const conexao = await Whatsapp.findOne({ where: { token, companyId } });
      if (!conexao) {
        logger.error(`[WHATSAPP OFICIAL][${traceId}] readMessage sem conexão`);
        return;
      }

      const message = await Message.findOne({ where: { wid: messageId, companyId } });
      if (!message) {
        logger.warn(`[WHATSAPP OFICIAL][${traceId}] readMessage sem Message correspondente`);
        return;
      }

      await message.update({ read: true, ack: 2 });
      logger.info(
        `[WHATSAPP OFICIAL][${traceId}] readMessage concluído | dbMessageId=${message.id} | ack=2`
      );
    } catch (error: any) {
      logger.error(`[WHATSAPP OFICIAL] Erro ao atualizar leitura da mensagem ${messageId}: ${error?.message || error}`);
    }
  }
}
