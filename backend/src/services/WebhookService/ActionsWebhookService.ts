import AppError from "../../errors/AppError";
import axios from "axios";
import https from "https";
import os from "os";
import { WebhookModel } from "../../models/Webhook";
import { sendMessageFlow } from "../../controllers/MessageController";
import { IConnections, INodes } from "./DispatchWebHookService";
import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { ParsedQs } from "qs";
import CreateContactService from "../ContactServices/CreateContactService";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import ContactTag from "../../models/ContactTag";
import Queue from "../../models/Queue";
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import CreateTicketService from "../TicketServices/CreateTicketService";
import CreateTicketServiceWebhook from "../TicketServices/CreateTicketServiceWebhook";
import { SendMessage } from "../../helpers/SendMessage";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import Ticket from "../../models/Ticket";
import fs from "fs";
import GetWhatsappWbot from "../../helpers/GetWhatsappWbot";
import path from "path";
import SendWhatsAppMedia from "../WbotServices/SendWhatsAppMedia";
import SendWhatsAppMediaFlow, {
  typeSimulation
} from "../WbotServices/SendWhatsAppMediaFlow";
import { randomizarCaminho } from "../../utils/randomizador";
import { SendMessageFlow } from "../../helpers/SendMessageFlow";
import formatBody from "../../helpers/Mustache";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import ShowTicketService from "../TicketServices/ShowTicketService";
import CreateMessageService, {
  MessageData
} from "../MessageServices/CreateMessageService";
import { randomString } from "../../utils/randomCode";
import ShowQueueService from "../QueueService/ShowQueueService";
import { getIO } from "../../libs/socket";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import ShowTicketUUIDService from "../TicketServices/ShowTicketFromUUIDService";
import logger from "../../utils/logger";
import CreateLogTicketService from "../TicketServices/CreateLogTicketService";
import CompaniesSettings from "../../models/CompaniesSettings";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import { delay } from "bluebird";
import typebotListener from "../TypebotServices/typebotListener";
import { getWbot } from "../../libs/wbot";
import type { proto } from "baileys";
import { handleOpenAi } from "../IntegrationsServices/OpenAiService";
import { IOpenAi } from "../../@types/openai";
import BullQueues from "../../libs/queue";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import {
  FLOW_REENGAGEMENT_ENABLED,
  FLOW_REENGAGEMENT_QUEUE_KEY,
  buildUniqueFlowReengagementJobId,
  parseFlowReengagementSettings
} from "../../helpers/FlowReengagementSettings";
import BillingGatewayService from "../BillingProviders/BillingGatewayService";
import Whatsapp from "../../models/Whatsapp";
import { sendMessageWhatsAppOficial } from "../../libs/whatsAppOficial/whatsAppOficial.service";
import SendWhatsAppOficialMessage from "../WhatsAppOficial/SendWhatsAppOficialMessage";
import mime from "mime-types";

interface IAddContact {
  companyId: number;
  name: string;
  phoneNumber: string;
  email?: string;
  dataMore?: any;
}

const removeFlowReengagementJob = async (ticketId?: number) => {
  if (!FLOW_REENGAGEMENT_ENABLED) {
    return;
  }

  if (!ticketId) {
    return;
  }

  try {
    const queue = BullQueues.queues.find(
      item => item.name === FLOW_REENGAGEMENT_QUEUE_KEY
    );
    if (!queue) {
      return;
    }

    // Cada job agendado tem um ID único (ver buildUniqueFlowReengagementJobId),
    // então cancelar o follow-up pendente de um ticket significa varrer os
    // jobs ainda não processados (delayed/waiting) e remover os que
    // pertencem a esse ticketId, em vez de buscar por um ID fixo.
    const pendingJobs = await queue.bull.getJobs(["delayed", "wait"]);
    await Promise.all(
      pendingJobs
        .filter(job => job && Number(job.data?.ticketId) === Number(ticketId))
        .map(job => job.remove().catch(() => {}))
    );
  } catch (error) {
    logger.warn("removeFlowReengagementJob failed", error);
  }
};

const scheduleFlowReengagement = async (
  companyId: number,
  idFlowDb: number,
  ticketId?: number,
  lastFlowId?: string
) => {
  if (!FLOW_REENGAGEMENT_ENABLED) {
    return;
  }

  if (!ticketId || !lastFlowId) {
    return;
  }

  try {
    const flow = await FlowBuilderModel.findOne({
      where: {
        id: idFlowDb,
        company_id: companyId
      }
    });

    if (!flow?.flow) {
      return;
    }

    const { enabled, steps } = parseFlowReengagementSettings(
      flow.flow["settings"]
    );

    const firstStep = steps[0];

    if (!enabled || !firstStep) {
      return;
    }

    await removeFlowReengagementJob(ticketId);

    await BullQueues.add(
      FLOW_REENGAGEMENT_QUEUE_KEY,
      {
        ticketId,
        companyId,
        flowId: idFlowDb,
        lastFlowId,
        action: "message",
        stepIndex: 0
      },
      {
        delay: firstStep.minutes * 60 * 1000,
        jobId: buildUniqueFlowReengagementJobId(ticketId)
      }
    );
  } catch (error) {
    logger.warn("scheduleFlowReengagement failed", error);
  }
};

export const ActionsWebhookService = async (
  whatsappId: number,
  idFlowDb: number,
  companyId: number,
  nodes: INodes[],
  connects: IConnections[],
  nextStage: string,
  dataWebhook: any,
  details: any,
  hashWebhookId: string,
  pressKey?: string,
  idTicket?: number,
  numberPhrase: "" | { number: string; name: string; email: string } = "",
  msg?: proto.IWebMessageInfo
): Promise<string> => {
  try {
    const io = getIO();
    let next = nextStage;
    console.log(
      "ActionWebhookService | 53",
      idFlowDb,
      companyId,
      nodes,
      connects,
      nextStage,
      dataWebhook,
      details,
      hashWebhookId,
      pressKey,
      idTicket,
      numberPhrase
    );

    const activeFlow = await FlowBuilderModel.findOne({
      where: {
        id: idFlowDb,
        company_id: companyId,
        active: true
      }
    });

    if (!activeFlow) {
      logger.info(
        `[FLOWBUILDER] Execução bloqueada para fluxo inativo ou inexistente (flow=${idFlowDb}, company=${companyId}).`
      );
      return "inactive";
    }

    let createFieldJsonName = "";

    const connectStatic = connects;
    if (numberPhrase === "") {
      const nameInput = details.inputs.find(item => item.keyValue === "nome");
      nameInput.data.split(",").map(dataN => {
        const lineToData = details.keysFull.find(item => item === dataN);
        let sumRes = "";
        if (!lineToData) {
          sumRes = dataN;
        } else {
          sumRes = constructJsonLine(lineToData, dataWebhook);
        }
        createFieldJsonName = createFieldJsonName + sumRes;
      });
    } else {
      createFieldJsonName = numberPhrase.name;
    }

    let numberClient = "";

    if (numberPhrase === "") {
      const numberInput = details.inputs.find(
        item => item.keyValue === "celular"
      );

      numberInput.data.split(",").map(dataN => {
        const lineToDataNumber = details.keysFull.find(item => item === dataN);
        let createFieldJsonNumber = "";
        if (!lineToDataNumber) {
          createFieldJsonNumber = dataN;
        } else {
          createFieldJsonNumber = constructJsonLine(
            lineToDataNumber,
            dataWebhook
          );
        }

        numberClient = numberClient + createFieldJsonNumber;
      });
    } else {
      numberClient = numberPhrase.number;
    }

    numberClient = removerNaoLetrasNumeros(numberClient);

    if (numberClient.substring(0, 2) === "55") {
      if (parseInt(numberClient.substring(2, 4)) >= 31) {
        if (numberClient.length === 13) {
          numberClient =
            numberClient.substring(0, 4) + numberClient.substring(5, 13);
        }
      }
    }

    let createFieldJsonEmail = "";

    if (numberPhrase === "") {
      const emailInput = details.inputs.find(item => item.keyValue === "email");
      emailInput.data.split(",").map(dataN => {
        const lineToDataEmail = details.keysFull.find(item =>
          item.endsWith("email")
        );

        let sumRes = "";
        if (!lineToDataEmail) {
          sumRes = dataN;
        } else {
          sumRes = constructJsonLine(lineToDataEmail, dataWebhook);
        }

        createFieldJsonEmail = createFieldJsonEmail + sumRes;
      });
    } else {
      createFieldJsonEmail = numberPhrase.email;
    }

    const lengthLoop = nodes.length;

    // ===== Seleção de conexão WhatsApp (respeitando whatsappId quando existir) =====
    let whatsapp: any;
    try {
      if (whatsappId) {
        // tenta a conexão específica
        whatsapp = await ShowWhatsAppService(whatsappId, companyId);
      }
      // se não encontrar/especificar, usa a padrão da empresa
      if (!whatsapp) {
        whatsapp = await GetDefaultWhatsApp(companyId);
      }
    } catch (e) {
      // fallback final para padrão
      whatsapp = await GetDefaultWhatsApp(companyId);
    }
    // ==============================================================================

    const isOfficialChannel =
      String((whatsapp as any)?.channel || "").toLowerCase() === "whatsapp_oficial";

    if (!isOfficialChannel && whatsapp.status !== "CONNECTED") {
      return;
    }

    let execCount = 0;

    let execFn = "";

    let ticket: any = null;

    let noAlterNext = false;

    if (pressKey && idTicket) {
      await removeFlowReengagementJob(idTicket);
    }

    for (var i = 0; i < lengthLoop; i++) {
      let nodeSelected: any;
      let ticketInit: Ticket;

      if (pressKey) {
        console.log("UPDATE2...");
        const normalizedPressKeyText = normalizeText(pressKey);
        if (normalizedPressKeyText === "parar" || normalizedPressKeyText === "sair") {
          console.log("UPDATE3...");
          if (idTicket) {
            console.log("UPDATE4...");
            await UpdateTicketService({
              ticketData: {
                status: "closed",
                sendFarewellMessage: true,
                amountUsedBotQueues: 0
              },
              ticketId: idTicket,
              companyId
            });
            if (ticket && ticket.id !== idTicket) {
              await UpdateTicketService({
                ticketData: {
                  status: "closed",
                  sendFarewellMessage: true,
                  amountUsedBotQueues: 0
                },
                ticketId: ticket.id,
                companyId
              });
            }
          }
          break;
        }

        if (execFn === "") {
          console.log("UPDATE5...");
          nodeSelected = nodes.filter(
            node => String(node.id) === String(next)
          )[0] || {
            type: "menu"
          };
        } else {
          console.log("UPDATE6...");
          nodeSelected = nodes.filter(
            node => String(node.id) === String(execFn)
          )[0];
        }
      } else {
        console.log("UPDATE7...");
        const otherNode = nodes.filter(
          node => String(node.id) === String(next)
        )[0];
        if (otherNode) {
          nodeSelected = otherNode;
        }
      }

      // Garante ticket carregado para nós que dependem de update/estado
      // (ex.: question, ticket, menu), mesmo quando o fluxo é disparado
      // com dataWebhook/details vazios.
      if (!ticket && idTicket) {
        ticket = await Ticket.findOne({
          where: { id: idTicket, companyId }
        });
      }

      if (nodeSelected.type === "message") {
        let msg;

        const webhook = ticket?.dataWebhook;

        if (webhook && webhook.hasOwnProperty("variables")) {
          msg = {
            body: replaceMessages(webhook.variables, nodeSelected.data.label)
          };
        } else {
          msg = {
            body: nodeSelected.data.label
          };
        }

        await sendFlowTextMessage({
          ticket,
          companyId,
          whatsapp,
          body: String(msg.body || "")
        });

        await intervalWhats("1");
      }
      console.log("273");
      if (nodeSelected.type === "typebot") {
        console.log("275");
        const wbot = getWbot(whatsapp.id);
        await typebotListener({
          wbot: wbot,
          msg,
          ticket,
          typebot: nodeSelected.data.typebotIntegration
        });
      }

      if (nodeSelected.type === "openai") {
        // ===== IA NO FLOWBUILDER =====
        // Garantimos que o ticket esteja carregado antes de usar IA,
        // pois ele será necessário depois para transferir para fila real.
        if (!ticket && idTicket) {
          ticket = await Ticket.findOne({
            where: { id: idTicket, companyId }
          });
        }

        if (!ticket) {
          logger.warn("ActionsWebhookService: ticket não encontrado para nó OpenAI", {
            idTicket,
            companyId,
            whatsappId
          });
          // se não tiver ticket, não dá pra seguir com IA nesse nó; continua fluxo
          continue;
        }

        const {
          name,
          provider,
          prompt,
          voice,
          voiceKey,
          voiceRegion,
          maxTokens,
          temperature,
          apiKey,
          queueId,
          maxMessages,
          maxResponseMessages,
          model
        } = nodeSelected.data.typebotIntegration as IOpenAi;

        const openAiSettings: IOpenAi = {
          name,
          provider,
          prompt,
          voice,
          voiceKey,
          voiceRegion,
          maxTokens,
          temperature,
          apiKey,
          queueId,
          maxMessages,
          maxResponseMessages,
          model
        };

        const contact = await Contact.findOne({
          where: { number: numberClient, companyId }
        });

        const wbot = getWbot(whatsapp.id);

        const ticketTraking = await FindOrCreateATicketTrakingService({
          ticketId: ticket.id,
          companyId,
          userId: null,
          whatsappId: whatsapp?.id
        });

        // Quando o nó recebeu uma imagem (Baileys real ou mensagem sintética
        // do canal Oficial/WuzAPI com `imageMessage` marcado), buscamos a
        // Message já persistida (pelo wid) para obter o mediaUrl real do
        // arquivo salvo em disco, permitindo que handleOpenAi leia a imagem
        // correta enviada pelo cliente em vez de tratá-la como texto genérico.
        let mediaSent: Message | undefined;
        if (msg?.message?.imageMessage && msg?.key?.id) {
          mediaSent =
            (await Message.findOne({
              where: { wid: msg.key.id, companyId }
            })) || undefined;
        }

        // 🔹 Aqui a IA é chamada. No próximo passo (OpenAiService)
        // vamos ensinar o handleOpenAi a:
        // - detectar quando o cliente pedir atendente humano
        // - e acionar a transferência de fila usando queueId / ticket.
        await handleOpenAi(
          openAiSettings,
          msg,
          wbot,
          ticket,
          contact,
          mediaSent,
          ticketTraking
        );

        // O nó de IA precisa pausar o fluxo e aguardar a próxima mensagem do
        // contato (assim como os nós "question" e "menu"), senão o loop abaixo
        // avança automaticamente para o nó conectado na saída do bloco de IA
        // (ex.: nó de fila), sobrescrevendo lastFlowId e fazendo com que a
        // resposta seguinte do contato nunca mais seja roteada para a IA.
        await ticket.update({
          userId: null,
          companyId,
          lastFlowId: nodeSelected.id,
          hashFlowId: hashWebhookId,
          flowStopped: idFlowDb.toString(),
          flowWebhook: true
        });
        break;
      }

      if (nodeSelected.type === "question") {
        const { message } = nodeSelected.data.typebotIntegration;
        // ticket aqui pode não ter as associações (contact/queue/user/etc.)
        // carregadas; busca a versão completa só para resolver as variáveis.
        const ticketForVariables = ticket?.id
          ? await ShowTicketService(ticket.id, companyId)
          : ticket;
        const bodyFila = formatBody(`${message}`, ticketForVariables);
        await sendFlowTextMessage({
          ticket,
          companyId,
          whatsapp,
          body: bodyFila
        });
        await ticket.update({
          userId: null,
          companyId: companyId,
          lastFlowId: nodeSelected.id,
          hashFlowId: hashWebhookId,
          flowStopped: idFlowDb.toString()
        });
        await scheduleFlowReengagement(
          companyId,
          idFlowDb,
          ticket.id,
          nodeSelected.id
        );
        break;
      }

      if (nodeSelected.type === "httpRequest") {
        if (!ticket && idTicket) {
          ticket = await Ticket.findOne({
            where: { id: idTicket, companyId },
            include: [{ model: Contact, as: "contact", attributes: ["id", "name"] }]
          });
        }

        const response = await executeHttpRequestNode({
          nodeSelected,
          ticket,
          companyId,
          numberClient,
          createFieldJsonName,
          createFieldJsonEmail
        });

        if (ticket?.id) {
          const currentDataWebhook = (ticket.dataWebhook || {}) as {
            variables?: Record<string, unknown>;
            [key: string]: unknown;
          };

          const nextVariables = {
            ...(currentDataWebhook.variables || {}),
            ...response.variables
          };

          await ticket.update({
            dataWebhook: {
              ...currentDataWebhook,
              variables: nextVariables,
              apiResponse: response.data
            }
          });
        }
      }

      if (nodeSelected.type === "ticket") {
        const queueCandidates = [
          nodeSelected?.data?.data?.id,
          nodeSelected?.data?.id,
          nodeSelected?.data?.queueId,
          nodeSelected?.data?.data?.queueId,
          nodeSelected?.data?.value,
          nodeSelected?.data?.data?.value
        ];

        let queueId: number | null = null;
        for (const candidate of queueCandidates) {
          const parsed = Number(candidate);
          if (Number.isFinite(parsed) && parsed > 0) {
            queueId = parsed;
            break;
          }
        }

        let queue: any = null;
        if (queueId) {
          try {
            queue = await ShowQueueService(queueId, companyId);
          } catch {
            queue = null;
          }
        }

        if (!queue) {
          const queueNameCandidate = String(
            nodeSelected?.data?.data?.name ||
              nodeSelected?.data?.name ||
              ""
          ).trim();

          if (queueNameCandidate) {
            queue = await Queue.findOne({
              where: {
                companyId,
                name: queueNameCandidate
              }
            });
          }
        }

        if (!queue) {
          logger.warn(
            `[FLOWBUILDER] Nó ticket sem fila válida (flow=${idFlowDb}, ticket=${ticket?.id || idTicket}, node=${nodeSelected?.id}, data=${JSON.stringify(nodeSelected?.data || {})})`
          );
          break;
        }

        await ticket.update({
          status: "pending",
          queueId: queue.id,
          userId: ticket.userId,
          companyId: companyId,
          flowWebhook: true,
          lastFlowId: nodeSelected.id,
          hashFlowId: hashWebhookId,
          flowStopped: idFlowDb.toString()
        });

        await FindOrCreateATicketTrakingService({
          ticketId: ticket.id,
          companyId,
          whatsappId: ticket.whatsappId,
          userId: ticket.userId
        });

        try {
          await UpdateTicketService({
            ticketData: {
              status: "pending",
              queueId: queue.id
            },
            ticketId: ticket.id,
            companyId
          });
        } catch (error: any) {
          // Não interrompe o fluxo: o ticket já foi atualizado acima e
          // o próximo nó deve continuar normalmente.
          logger.warn(
            `[FLOWBUILDER] Falha não-bloqueante ao atualizar ticket no nó de fila. flow=${idFlowDb} ticket=${ticket?.id || idTicket} queue=${queue?.id} err=${String(error?.message || error)}`
          );
        }

        try {
          await CreateLogTicketService({
            ticketId: ticket.id,
            type: "queue",
            queueId: queue.id
          });
        } catch (error: any) {
          logger.warn(
            `[FLOWBUILDER] Falha não-bloqueante ao registrar log de fila. flow=${idFlowDb} ticket=${ticket?.id || idTicket} queue=${queue?.id} err=${String(error?.message || error)}`
          );
        }

        let settings = await CompaniesSettings.findOne({
          where: {
            companyId: companyId
          }
        });

        const enableQueuePosition = settings.sendQueuePosition === "enabled";

        if (enableQueuePosition) {
          const count = await Ticket.findAndCountAll({
            where: {
              userId: null,
              status: "pending",
              companyId,
              queueId: queue.id,
              whatsappId: whatsapp.id,
              isGroup: false
            }
          });
          const qtd = count.count === 0 ? 1 : count.count;
          const msgFila = `${settings.sendQueuePositionMessage} *${qtd}*`;
          // ticket aqui pode não ter as associações (contact/queue/user/etc.)
          // carregadas; busca a versão completa só para resolver as variáveis.
          const ticketForVariables = ticket?.id
            ? await ShowTicketService(ticket.id, companyId)
            : ticket;
          const bodyFila = formatBody(`${msgFila}`, ticketForVariables);
          await sendFlowTextMessage({
            ticket,
            companyId,
            whatsapp,
            body: bodyFila
          });
        }
      }

      if (nodeSelected.type === "tag") {
        const tagCandidates = [
          nodeSelected?.data?.tagId,
          nodeSelected?.data?.id,
          nodeSelected?.data?.data?.tagId,
          nodeSelected?.data?.data?.id,
          nodeSelected?.data?.value
        ];

        let tagId: number | null = null;
        for (const candidate of tagCandidates) {
          const parsed = Number(candidate);
          if (Number.isFinite(parsed) && parsed > 0) {
            tagId = parsed;
            break;
          }
        }

        if (!tagId) {
          logger.warn(
            `[FLOWBUILDER] Nó tag sem tag válida (flow=${idFlowDb}, ticket=${ticket?.id || idTicket}, node=${nodeSelected?.id}, data=${JSON.stringify(nodeSelected?.data || {})})`
          );
        } else {
          const tag = await Tag.findOne({
            where: {
              id: tagId,
              companyId
            }
          });

          if (!tag) {
            logger.warn(
              `[FLOWBUILDER] Tag não encontrada para empresa no nó tag (flow=${idFlowDb}, ticket=${ticket?.id || idTicket}, node=${nodeSelected?.id}, tagId=${tagId})`
            );
          } else {
            let contactId = ticket?.contactId || ticket?.contact?.id;

            if (!contactId && numberClient) {
              const contact = await Contact.findOne({
                where: { number: numberClient, companyId }
              });
              contactId = contact?.id;
            }

            if (!contactId) {
              logger.warn(
                `[FLOWBUILDER] Não foi possível resolver contato no nó tag (flow=${idFlowDb}, ticket=${ticket?.id || idTicket}, node=${nodeSelected?.id}, tagId=${tag.id})`
              );
            } else {
              await ContactTag.findOrCreate({
                where: {
                  contactId,
                  tagId: tag.id
                }
              });
            }
          }
        }
      }

      if (nodeSelected.type === "billingSecondCopy") {
        if (!ticket && idTicket) {
          ticket = await Ticket.findOne({
            where: { id: idTicket, companyId },
            include: [{ model: Contact, as: "contact", attributes: ["id", "name", "number", "email"] }]
          });
        }

        const currentVariables = buildFlowVariables({
          ticket,
          numberClient,
          name: createFieldJsonName,
          email: createFieldJsonEmail
        });
        const integrationId = Number(
          nodeSelected?.data?.integrationId ||
            nodeSelected?.data?.integration?.id ||
            0
        );
        const identifierType = String(
          nodeSelected?.data?.identifierType || "cpfCnpj"
        ) as any;
        const identifierTemplate = String(
          nodeSelected?.data?.identifierTemplate ||
            nodeSelected?.data?.identifierValue ||
            ""
        ).trim();
        const resolvedIdentifierValue = renderFlowTemplate(
          identifierTemplate,
          currentVariables
        ).trim();

        let billingResult = {
          status: "integration_error",
          message: "Configuração inválida do bloco de cobrança."
        } as Awaited<ReturnType<typeof BillingGatewayService.lookupOpenBilling>>;

        if (integrationId && resolvedIdentifierValue) {
          try {
            billingResult = await BillingGatewayService.lookupOpenBilling({
              companyId,
              integrationId,
              identifierType,
              identifierValue: resolvedIdentifierValue,
              ticketId: ticket?.id,
              contactId: ticket?.contactId
            });
          } catch (billingErr: any) {
            billingResult = {
              status: "integration_error",
              message: String(billingErr?.message || "Erro ao consultar integração de cobrança.")
            } as any;
          }
        }

        logger.info("[BILLING] Resultado da consulta de cobrança", {
          status: billingResult.status,
          message: (billingResult as any).message || "",
          integrationId,
          identifierType,
          resolvedIdentifierValue: resolvedIdentifierValue ? "[preenchido]" : "[vazio]"
        });

        const variablePrefix = String(
          nodeSelected?.data?.variablePrefix || "billing"
        ).trim() || "billing";
        const nextBillingVariables = buildBillingVariables(
          billingResult,
          variablePrefix
        );

        if (ticket?.id) {
          const currentDataWebhook = (ticket.dataWebhook || {}) as {
            variables?: Record<string, unknown>;
            [key: string]: unknown;
          };

          await ticket.update({
            dataWebhook: {
              ...currentDataWebhook,
              variables: {
                ...(currentDataWebhook.variables || {}),
                ...nextBillingVariables
              }
            }
          });
        }

        const messageTemplates = {
          success:
            nodeSelected?.data?.messages?.success ||
            nodeSelected?.data?.successMessage ||
            "",
          customer_not_found:
            nodeSelected?.data?.messages?.customerNotFound ||
            nodeSelected?.data?.customerNotFoundMessage ||
            "",
          no_open_billing:
            nodeSelected?.data?.messages?.noOpenBilling ||
            nodeSelected?.data?.noOpenBillingMessage ||
            "",
          invalid_document:
            nodeSelected?.data?.messages?.invalidDocument ||
            nodeSelected?.data?.invalidDocumentMessage ||
            "",
          integration_error:
            nodeSelected?.data?.messages?.integrationError ||
            nodeSelected?.data?.integrationErrorMessage ||
            ""
        } as Record<string, string>;

        const renderedVariables = {
          ...currentVariables,
          ...nextBillingVariables
        };
        const messageTemplate = String(
          messageTemplates[billingResult.status] || ""
        ).trim();

        if (messageTemplate && ticket?.id) {
          const renderedMessage = renderFlowTemplate(messageTemplate, renderedVariables);
          await sendFlowTextMessage({
            ticket,
            companyId,
            whatsapp,
            body: renderedMessage
          });
        }

        const sendBilletPdf = Boolean(nodeSelected?.data?.sendBilletPdf);
        if (
          sendBilletPdf &&
          billingResult.status === "success" &&
          ticket?.id
        ) {
          const pdfUrl = String(
            (billingResult as any).billing?.pdfUrl ||
              (billingResult as any).billing?.billetUrl ||
              (billingResult as any).billing?.invoiceUrl ||
              ""
          ).trim();

          logger.info("[BILLING] Tentando enviar PDF do boleto", { pdfUrl, ticketId: ticket?.id, channel: ticket?.channel });
          if (pdfUrl) {
            try {
              await sendFlowDocumentFromUrl({
                ticket,
                companyId,
                pdfUrl,
                fileName: "boleto.pdf",
                caption: ""
              });
              logger.info("[BILLING] PDF do boleto enviado com sucesso", { pdfUrl, ticketId: ticket?.id });
            } catch (pdfErr: any) {
              logger.warn("[BILLING] Falha ao enviar PDF do boleto", {
                pdfUrl,
                err: String(pdfErr?.message || pdfErr)
              });
            }
          } else {
            logger.warn("[BILLING] pdfUrl vazia, PDF não enviado", { billing: billingResult.billing });
          }
        }

        noAlterNext = true;
        next =
          resolveConnectionTarget(
            connects,
            String(nodeSelected.id),
            String(billingResult.status)
          ) || "";
      }

      if (nodeSelected.type === "kanban") {
        const action = String(nodeSelected?.data?.action || "enter").toLowerCase();

        const kanbanTags = await Tag.findAll({
          where: {
            companyId,
            kanban: 1
          },
          attributes: ["id"]
        });
        const kanbanTagIds = kanbanTags.map(item => Number(item.id)).filter(Boolean);

        const clearKanbanFromTicket = async () => {
          if (!ticket?.id || kanbanTagIds.length === 0) return;
          await TicketTag.destroy({
            where: {
              ticketId: ticket.id,
              tagId: kanbanTagIds
            }
          });
        };

        if (action === "remove") {
          await clearKanbanFromTicket();
        } else {
          const tagCandidates = [
            nodeSelected?.data?.tagId,
            nodeSelected?.data?.id,
            nodeSelected?.data?.data?.tagId,
            nodeSelected?.data?.data?.id,
            nodeSelected?.data?.value
          ];

          let tagId: number | null = null;
          for (const candidate of tagCandidates) {
            const parsed = Number(candidate);
            if (Number.isFinite(parsed) && parsed > 0) {
              tagId = parsed;
              break;
            }
          }

          if (!tagId) {
            logger.warn(
              `[FLOWBUILDER] Nó kanban sem etapa válida (flow=${idFlowDb}, ticket=${ticket?.id || idTicket}, node=${nodeSelected?.id}, data=${JSON.stringify(nodeSelected?.data || {})})`
            );
          } else {
            const tag = await Tag.findOne({
              where: {
                id: tagId,
                companyId,
                kanban: 1
              }
            });

            if (!tag) {
              logger.warn(
                `[FLOWBUILDER] Etapa de kanban não encontrada para empresa (flow=${idFlowDb}, ticket=${ticket?.id || idTicket}, node=${nodeSelected?.id}, tagId=${tagId})`
              );
            } else if (!ticket?.id) {
              logger.warn(
                `[FLOWBUILDER] Ticket ausente no nó kanban (flow=${idFlowDb}, ticket=${ticket?.id || idTicket}, node=${nodeSelected?.id}, tagId=${tag.id})`
              );
            } else {
              // Mantém uma única etapa de kanban por ticket (mesmo comportamento da tela Kanban).
              await clearKanbanFromTicket();
              await TicketTag.findOrCreate({
                where: {
                  ticketId: ticket.id,
                  tagId: tag.id
                }
              });
            }
          }
        }
      }

      if (nodeSelected.type === "switchFlow") {
        if (!ticket && idTicket) {
          ticket = await Ticket.findOne({
            where: { id: idTicket, companyId },
            include: [{ model: Contact, as: "contact", attributes: ["id", "name"] }]
          });
        }

        const selectedFlowId = Number(
          nodeSelected?.data?.flowSelected?.id || nodeSelected?.data?.flowId || 0
        );

        if (!selectedFlowId) {
          logger.warn(
            `[FLOWBUILDER] Nó switchFlow sem fluxo válido (flow=${idFlowDb}, ticket=${ticket?.id || idTicket}, node=${nodeSelected?.id})`
          );
          break;
        }

        const targetFlow = await FlowBuilderModel.findOne({
          where: {
            id: selectedFlowId,
            company_id: companyId,
            active: true
          }
        });

        if (!targetFlow?.flow) {
          logger.warn(
            `[FLOWBUILDER] Fluxo de destino não encontrado ou inativo no switchFlow (sourceFlow=${idFlowDb}, targetFlow=${selectedFlowId}, ticket=${ticket?.id || idTicket})`
          );
          break;
        }

        const targetNodes: INodes[] = Array.isArray(targetFlow.flow["nodes"])
          ? targetFlow.flow["nodes"]
          : [];
        const targetConnections: IConnections[] = Array.isArray(
          targetFlow.flow["connections"]
        )
          ? targetFlow.flow["connections"]
          : [];

        const targetStartNode =
          targetNodes.find(item => item?.type === "start") ||
          targetNodes.find(item => String(item?.id) === "1") ||
          targetNodes[0];

        if (!targetStartNode) {
          logger.warn(
            `[FLOWBUILDER] Fluxo de destino sem nó inicial no switchFlow (targetFlow=${selectedFlowId}, ticket=${ticket?.id || idTicket})`
          );
          break;
        }

        logger.info(
          `[FLOWBUILDER] switchFlow executado (sourceFlow=${idFlowDb}, targetFlow=${selectedFlowId}, ticket=${ticket?.id || idTicket})`
        );

        await ActionsWebhookService(
          whatsapp.id,
          targetFlow.id,
          companyId,
          targetNodes,
          targetConnections,
          String(targetStartNode.id),
          dataWebhook,
          details,
          hashWebhookId,
          undefined,
          ticket?.id || idTicket,
          {
            number: numberClient,
            name: createFieldJsonName,
            email: createFieldJsonEmail
          },
          msg
        );
        break;
      }

      if (nodeSelected.type === "interval") {
          // Node standalone do FlowBuilder (frontend) usa data.sec (segundos) :contentReference[oaicite:1]{index=1}
          const sec = Number(nodeSelected?.data?.sec ?? 0);

          if (Number.isFinite(sec) && sec > 0) {
            await intervalWhats(String(sec)); // intervalWhats espera string em segundos
          }
      }

      if (nodeSelected.type === "singleBlock") {
        console.log("[FLOW] singleBlock seq", nodeSelected.id, nodeSelected.data.seq);
        for (var iLoc = 0; iLoc < nodeSelected.data.seq.length; iLoc++) {
          const elementNowSelected = nodeSelected.data.seq[iLoc];

          ticket = await Ticket.findOne({
            where: { id: idTicket, companyId }
          });

          if (elementNowSelected.includes("message")) {
            const bodyFor = nodeSelected.data.elements.filter(
              item => item.number === elementNowSelected
            )[0].value;
            let msg;
            const webhook = ticket?.dataWebhook;
            if (webhook && webhook.hasOwnProperty("variables")) {
              msg = replaceMessages(webhook.variables, bodyFor);
            } else {
              msg = bodyFor;
            }
            await sendFlowTextMessage({
              ticket,
              companyId,
              whatsapp,
              body: String(msg || "")
            });
            await intervalWhats("1");
          }
          if (elementNowSelected.includes("interval")) {
            await intervalWhats(
              nodeSelected.data.elements.filter(
                item => item.number === elementNowSelected
              )[0].value
            );
          }

          if (elementNowSelected.includes("img")) {
            const mediaPath = String(
              nodeSelected.data.elements.filter(
                item => item.number === elementNowSelected
              )[0].value || ""
            );
            const mediaFullPath =
              process.env.BACKEND_URL === "https://localhost:8090"
                ? `${__dirname.split("src")[0].split("\\").join("/")}public/${mediaPath}`
                : `${__dirname.split("dist")[0].split("\\").join("/")}public/${mediaPath}`;
            const mediaFile = mediaPath.split("/").pop() || mediaPath;

            const ticketDetails = ticket?.id
              ? await ShowTicketService(ticket.id, companyId)
              : null;
            const isOfficialChannel =
              String(ticketDetails?.channel || "").toLowerCase() ===
              "whatsapp_oficial";

            let sentMessage;
            if (isOfficialChannel && ticketDetails) {
              sentMessage = await SendWhatsAppOficialMessage({
                body: "",
                ticket: ticketDetails,
                type: "image",
                media: {
                  path: mediaFullPath,
                  originalname: mediaFile,
                  filename: mediaFile,
                  mimetype: (mime.lookup(mediaFullPath) as string) || "image/jpeg"
                } as unknown as Express.Multer.File
              });
            } else {
              await typeSimulation(ticket, "composing");
              sentMessage = await SendMessage(whatsapp, {
                number: numberClient,
                body: "",
                mediaPath: mediaFullPath
              });
            }

            if (ticketDetails) {
              await persistWuzapiFlowMessage({
                whatsapp,
                ticket: ticketDetails,
                companyId,
                body: mediaFile,
                sentMessage,
                mediaType: "image",
                mediaUrl: mediaPath
              });
            }
            await intervalWhats("1");
          }

          if (elementNowSelected.includes("audio")) {
            const mediaValue = String(
              nodeSelected.data.elements.filter(
                item => item.number === elementNowSelected
              )[0].value || ""
            );
            const mediaDirectory =
              process.env.BACKEND_URL === "https://localhost:8090"
                ? `${__dirname.split("src")[0].split("\\").join("/")}public/${mediaValue}`
                : `${__dirname.split("dist")[0].split("\\").join("/")}public/${mediaValue}`;
            const isRecord = nodeSelected.data.elements.filter(
              item => item.number === elementNowSelected
            )[0].record;
            const ticketInt = await Ticket.findOne({
              where: { id: ticket.id }
            });

            const ticketDetails = await ShowTicketService(ticketInt.id, companyId);
            const isOfficialChannel =
              String(ticketDetails?.channel || "").toLowerCase() ===
              "whatsapp_oficial";

            if (isOfficialChannel) {
              const mediaFile = mediaValue.split("/").pop() || mediaValue;
              await SendWhatsAppOficialMessage({
                body: "",
                ticket: ticketDetails,
                type: "audio",
                media: {
                  path: mediaDirectory,
                  originalname: mediaFile,
                  filename: mediaFile,
                  mimetype: (mime.lookup(mediaDirectory) as string) || "audio/ogg"
                } as unknown as Express.Multer.File
              });
            } else {
              await typeSimulation(ticket, "recording");
              await SendWhatsAppMediaFlow({
                media: mediaDirectory,
                ticket: ticketInt,
                isRecord
              });
            }
            await intervalWhats("1");
          }
          if (elementNowSelected.includes("video")) {
            const mediaValue = String(
              nodeSelected.data.elements.filter(
                item => item.number === elementNowSelected
              )[0].value || ""
            );
            const mediaDirectory =
              process.env.BACKEND_URL === "https://localhost:8090"
                ? `${__dirname.split("src")[0].split("\\").join("/")}public/${mediaValue}`
                : `${__dirname.split("dist")[0].split("\\").join("/")}public/${mediaValue}`;
            const ticketInt = await Ticket.findOne({
              where: { id: ticket.id }
            });

            const ticketDetails = await ShowTicketService(ticketInt.id, companyId);
            const isOfficialChannel =
              String(ticketDetails?.channel || "").toLowerCase() ===
              "whatsapp_oficial";

            if (isOfficialChannel) {
              const mediaFile = mediaValue.split("/").pop() || mediaValue;
              await SendWhatsAppOficialMessage({
                body: "",
                ticket: ticketDetails,
                type: "video",
                media: {
                  path: mediaDirectory,
                  originalname: mediaFile,
                  filename: mediaFile,
                  mimetype: (mime.lookup(mediaDirectory) as string) || "video/mp4"
                } as unknown as Express.Multer.File
              });
            } else {
              await typeSimulation(ticket, "recording");
              await SendWhatsAppMediaFlow({
                media: mediaDirectory,
                ticket: ticketInt
              });
            }
            await intervalWhats("1");
          }

          // ---------- INÍCIO DO BLOCO ADICIONADO PARA DOCUMENTOS ----------
          if (elementNowSelected.includes("document")) {
            const mediaValue = String(
              nodeSelected.data.elements.filter(
                item => item.number === elementNowSelected
              )[0].value || ""
            );
            const mediaDirectory =
              process.env.BACKEND_URL === "https://localhost:8090"
                ? `${__dirname.split("src")[0].split("\\").join("/")}public/${mediaValue}`
                : `${__dirname.split("dist")[0].split("\\").join("/")}public/${mediaValue}`;

            const ticketInt = await Ticket.findOne({
              where: { id: ticket.id }
            });

            const ticketDetails = await ShowTicketService(ticketInt.id, companyId);
            const isOfficialChannel =
              String(ticketDetails?.channel || "").toLowerCase() ===
              "whatsapp_oficial";

            if (isOfficialChannel) {
              const mediaFile = mediaValue.split("/").pop() || mediaValue;
              await SendWhatsAppOficialMessage({
                body: "",
                ticket: ticketDetails,
                type: "document",
                media: {
                  path: mediaDirectory,
                  originalname: mediaFile,
                  filename: mediaFile,
                  mimetype:
                    (mime.lookup(mediaDirectory) as string) ||
                    "application/octet-stream"
                } as unknown as Express.Multer.File
              });
            } else {
              await typeSimulation(ticket, "composing");
              await SendWhatsAppMediaFlow({
                media: mediaDirectory,
                ticket: ticketInt
              });
            }

            await intervalWhats("1");
          }
          // ---------- FIM DO BLOCO ADICIONADO PARA DOCUMENTOS ----------

          // ---------- INÍCIO DO BLOCO ADICIONADO PARA DOCUMENTOS VIA URL (ex: boleto em PDF) ----------
          // Observação: usa o prefixo "pdfUrl" (e não "documentUrl") de propósito, pois o bloco
          // "document" acima usa elementNowSelected.includes("document") — um número contendo
          // a substring "document" também acionaria aquele bloco por engano.
          if (elementNowSelected.includes("pdfUrl")) {
            const elementData = nodeSelected.data.elements.filter(
              item => item.number === elementNowSelected
            )[0];
            const urlTemplate = String(elementData?.value || "").trim();
            const fileNameTemplate = String(elementData?.fileName || "documento.pdf").trim();

            const webhook = ticket?.dataWebhook;
            const currentVariables = webhook && webhook.hasOwnProperty("variables")
              ? webhook.variables
              : {};

            const resolvedUrl = replaceMessages(currentVariables, urlTemplate).trim();
            const resolvedFileName = replaceMessages(currentVariables, fileNameTemplate).trim() || "documento.pdf";
            const hasUnresolvedVariable = /\$\{[^}]+\}/.test(resolvedUrl);

            if (hasUnresolvedVariable) {
              console.log(
                "[FLOW] URL do PDF ficou com variável não resolvida — confira o mapeamento de responseVariables do node HTTP que deveria gerar essa variável",
                { urlTemplate, resolvedUrl }
              );
            } else if (resolvedUrl) {
              console.log("[FLOW] Iniciando envio de PDF via URL", {
                url: resolvedUrl,
                fileName: resolvedFileName,
                ticketId: ticket?.id,
                channel: ticket?.channel
              });
              try {
                await sendFlowDocumentFromUrl({
                  ticket,
                  companyId,
                  pdfUrl: resolvedUrl,
                  fileName: resolvedFileName,
                  caption: ""
                });
                console.log("[FLOW] Envio de PDF via URL concluído sem exceção", {
                  url: resolvedUrl,
                  ticketId: ticket?.id
                });
              } catch (docUrlErr: any) {
                console.log("[FLOW] Falha ao enviar documento via URL no singleBlock", {
                  url: resolvedUrl,
                  err: String(docUrlErr?.message || docUrlErr),
                  stack: docUrlErr?.stack
                });
              }
            } else {
              console.log("[FLOW] documentUrl sem URL resolvida, envio ignorado", {
                urlTemplate
              });
            }

            await intervalWhats("1");
          }
          // ---------- FIM DO BLOCO ADICIONADO PARA DOCUMENTOS VIA URL ----------
        }
      }

      let isRandomizer: boolean;
      if (nodeSelected.type === "randomizer") {
        const selectedRandom = randomizarCaminho(
          nodeSelected.data.percent / 100
        );
        const resultConnect = connects.filter(
          connect => String(connect.source) === String(nodeSelected.id)
        );
        if (selectedRandom === "A") {
          next = resultConnect.filter(item => item.sourceHandle === "a")[0]
            .target;
          noAlterNext = true;
        } else {
          next = resultConnect.filter(item => item.sourceHandle === "b")[0]
            .target;
          noAlterNext = true;
        }
        isRandomizer = true;
      }

      let isCondition: boolean;
      if (nodeSelected.type === "condition") {
        const conditionVariables = buildFlowVariables({
          ticket,
          numberClient,
          name: createFieldJsonName,
          email: createFieldJsonEmail
        });
        const leftValue = resolveConditionLeftValue(
          String(nodeSelected?.data?.key || ""),
          conditionVariables
        );
        const resultCondition = evaluateFlowCondition(
          leftValue,
          Number(nodeSelected?.data?.condition),
          nodeSelected?.data?.value
        );
        const resultConnect = connects.filter(
          connect => String(connect.source) === String(nodeSelected.id)
        );
        const targetHandle = resultCondition ? "a" : "b";
        const targetConnection = resultConnect.find(
          item => String(item.sourceHandle || "") === targetHandle
        );

        if (targetConnection?.target) {
          next = String(targetConnection.target);
          noAlterNext = true;
        } else {
          logger.warn(
            `[FLOWBUILDER] Nó condition sem saída '${targetHandle}' válida (flow=${idFlowDb}, ticket=${ticket?.id || idTicket}, node=${nodeSelected?.id})`
          );
          next = "";
          noAlterNext = false;
        }

        isCondition = true;
      }

      let isMenu: boolean;
      if (nodeSelected.type === "menu") {
        console.log(650, "menu");
        if (pressKey) {
          if (
            Boolean(nodeSelected?.data?.includeMainMenuOption) &&
            isMainMenuSelection(pressKey)
          ) {
            execFn = resolveMainMenuTarget(nodes, connectStatic);
          } else {
          if (
            Boolean(nodeSelected?.data?.includeExitOption) &&
            isExitSelection(pressKey)
          ) {
            await UpdateTicketService({
              ticketData: {
                status: "closed",
                sendFarewellMessage: true,
                amountUsedBotQueues: 0
              },
              ticketId: ticket.id,
              companyId
            });
            break;
          }

          const selectedOption = resolveMenuSelection(pressKey, nodeSelected);
          const selectedOptionAsNumber = Number(selectedOption);
          const menuNodeId = nodeSelected.id || next;
          const outgoingConnections = connectStatic.filter(
            connection =>
              String(connection.source) === String(menuNodeId) &&
              Boolean(connection.target)
          );

          const connectionByHandle = outgoingConnections.find(connection => {
            const sourceHandle = String(connection.sourceHandle || "");
            return sourceHandle === `a${selectedOption}` ||
              sourceHandle === String(selectedOption) ||
              sourceHandle === `option-${selectedOption}`;
          });

          if (connectionByHandle?.target) {
            execFn = connectionByHandle.target;
          } else if (
            Number.isFinite(selectedOptionAsNumber) &&
            selectedOptionAsNumber > 0 &&
            outgoingConnections.length >= selectedOptionAsNumber
          ) {
            // Fallback para fluxos antigos/importados sem sourceHandle:
            // usa a ordem das conexões do nó de menu.
            execFn = outgoingConnections[selectedOptionAsNumber - 1]?.target;
          } else {
            execFn = undefined;
          }
          }
          if (execFn === undefined) {
            break;
          }
          pressKey = "999";
          const isNodeExist = nodes.filter(
            item => String(item.id) === String(execFn)
          );
          console.log(674, "menu");
          if (isNodeExist.length > 0) {
            isMenu = isNodeExist[0].type === "menu" ? true : false;
          } else {
            isMenu = false;
          }
        } else {
          console.log(681, "menu");
          const optionsMenu = (nodeSelected?.data?.arrayOption || [])
            .map(item => `*[ ${item.number} ]* - ${item.value}`)
            .join("\n");
          const extraMenuLines: string[] = [];
          if (Boolean(nodeSelected?.data?.includeMainMenuOption)) {
            extraMenuLines.push(`*[ # ] -* ${getMainMenuOptionText(nodeSelected)}`);
          }
          if (Boolean(nodeSelected?.data?.includeExitOption)) {
            extraMenuLines.push(`*[ Sair ] -* ${getExitOptionText(nodeSelected)}`);
          }
          const extraMenuBlock =
            extraMenuLines.length > 0 ? `\n\n${extraMenuLines.join("\n")}` : "";
          const menuCreate = `${nodeSelected.data.message}

${optionsMenu}${extraMenuBlock}`;
          const webhook = ticket?.dataWebhook;
          let msg;
          if (webhook && webhook.hasOwnProperty("variables")) {
            msg = {
              body: replaceMessages(webhook.variables, menuCreate),
              number: numberClient,
              companyId: companyId
            };
          } else {
            msg = {
              body: menuCreate,
              number: numberClient,
              companyId: companyId
            };
          }
          await sendFlowTextMessage({
            ticket,
            companyId,
            whatsapp,
            body: String(msg.body || "")
          });
          await intervalWhats("1");

          if (ticket) {
            ticket = await Ticket.findOne({
              where: {
                id: ticket.id,
                whatsappId: whatsappId,
                companyId: companyId
              }
            });
          } else {
            ticket = await Ticket.findOne({
              where: {
                id: idTicket,
                whatsappId: whatsappId,
                companyId: companyId
              }
            });
          }

          if (ticket) {
            await ticket.update({
              queueId: ticket.queueId ? ticket.queueId : null,
              userId: null,
              companyId: companyId,
              flowWebhook: true,
              lastFlowId: nodeSelected.id,
              dataWebhook: dataWebhook,
              hashFlowId: hashWebhookId,
              flowStopped: idFlowDb.toString()
            });
            await scheduleFlowReengagement(
              companyId,
              idFlowDb,
              ticket.id,
              nodeSelected.id
            );
          }
          break;
        }
      }

      let isContinue = false;
        if (pressKey === "999" && execCount > 0) {
          console.log(587, "ActionsWebhookService | 587");
          pressKey = undefined;
          // Após escolher opção de menu, o próximo loop deve executar o nó
          // escolhido (execFn), e não pular direto para o próximo dele.
          if (!noAlterNext) {
          next = execFn || "";
        }
        execFn = "";
      } else {
        let result;
        if (execFn) {
          // Sempre prioriza o destino escolhido no menu (a1/a2/a3...),
          // independente do tipo do próximo nó.
          result = { target: execFn };
          isContinue = true;
          pressKey = undefined;
          execFn = "";
        } else if (isMenu) {
          result = { target: execFn };
          isContinue = true;
          pressKey = undefined;
        } else if (isCondition) {
          isCondition = false;
          result = next;
        } else if (isRandomizer) {
          isRandomizer = false;
          result = next;
        } else {
          result = connects.find(
            connect =>
              String(connect.source) === String(nodeSelected.id) &&
              Boolean(connect.target)
          );
        }
        if (typeof result === "undefined") {
          next = "";
        } else {
          if (!noAlterNext) {
            next = result?.target ? String(result.target) : "";
          }
        }
        console.log(619, "ActionsWebhookService");
      }
      if (!pressKey && !isContinue) {
        const nextNode = connects.filter(
          connect =>
            String(connect.source) === String(nodeSelected.id) &&
            Boolean(connect.target)
        ).length;
        console.log(626, "ActionsWebhookService");
        if (nextNode === 0) {
          if (String(nodeSelected?.type || "") === "ticket") {
            logger.warn(
              `[FLOWBUILDER] Nó de fila/setor sem saída conectada. Fluxo encerrado nesse nó. flow=${idFlowDb} ticket=${ticket?.id || idTicket} node=${nodeSelected?.id}`
            );
          }
          console.log(654, "ActionsWebhookService");
          await Ticket.findOne({
            where: { id: idTicket, whatsappId, companyId: companyId }
          });
          await ticket.update({
            lastFlowId: nodeSelected.id,
            hashFlowId: null,
            flowWebhook: false,
            flowStopped: idFlowDb.toString()
          });
          break;
        }
      }
      isContinue = false;
      if (next === "") {
        break;
      }
      console.log(678, "ActionsWebhookService");
      console.log("UPDATE10...");
      ticket = await Ticket.findOne({
        where: { id: idTicket, whatsappId, companyId: companyId }
      });
      if (ticket.status === "closed") {
        io.of(String(companyId))
          .emit(`company-${ticket.companyId}-ticket`, {
            action: "delete",
            ticketId: ticket.id
          });
      }
      console.log("UPDATE12...");
      await ticket.update({
        whatsappId: whatsappId,
        queueId: ticket?.queueId,
        userId: null,
        companyId: companyId,
        flowWebhook: true,
        lastFlowId: nodeSelected.id,
        hashFlowId: hashWebhookId,
        flowStopped: idFlowDb.toString()
      });
      noAlterNext = false;
      execCount++;
    }
    return "ds";
  } catch (error) {
    logger.error(error);
  }
};

const constructJsonLine = (line: string, json: any) => {
  let valor = json;
  const chaves = line.split(".");
  if (chaves.length === 1) {
    return valor[chaves[0]];
  }
  for (const chave of chaves) {
    valor = valor[chave];
  }
  return valor;
};

function removerNaoLetrasNumeros(texto: string) {
  return texto.replace(/[^a-zA-Z0-9]/g, "");
}

const sendMessageWhats = async (
  whatsId: number,
  msg: any,
  req: Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>
) => {
  sendMessageFlow(whatsId, msg, req);
  return Promise.resolve();
};

const intervalWhats = (time: string) => {
  const seconds = parseInt(time) * 1000;
  return new Promise(resolve => setTimeout(resolve, seconds));
};

const replaceMessages = (variables, message) => {
  const interpolatedMessage = interpolateFlowString(message, variables);

  return interpolatedMessage.replace(
    /{{\s*([^{}\s]+)\s*}}/g,
    (match, key) => variables[key] || ""
  );
};

const renderFlowTemplate = (
  value: string,
  variables: Record<string, any>
): string => {
  return replaceMessages(variables, value);
};

const getNestedValue = (source: any, path: string): any => {
  if (!source || !path) return undefined;

  return String(path)
    .split(".")
    .reduce((acc, key) => {
      if (acc === null || acc === undefined) return undefined;
      return acc[key];
    }, source);
};

const buildFlowVariables = ({
  ticket,
  numberClient,
  name,
  email
}: {
  ticket?: Ticket | null;
  numberClient?: string;
  name?: string;
  email?: string;
}): Record<string, any> => {
  const ticketDataWebhook = (ticket?.dataWebhook || {}) as {
    variables?: Record<string, unknown>;
    apiResponse?: unknown;
  };

  return {
    nome: ticket?.contact?.name || name || "",
    numero: ticket?.contact?.number || numberClient || "",
    email: ticket?.contact?.email || email || "",
    apiResponse: ticketDataWebhook.apiResponse,
    ...(ticketDataWebhook.variables || {})
  };
};

const buildBillingVariables = (
  result: {
    status: string;
    customer?: Record<string, unknown>;
    billing?: Record<string, unknown>;
    message?: string;
  },
  prefix: string
): Record<string, any> => {
  const safePrefix = String(prefix || "billing").trim() || "billing";
  const flat: Record<string, any> = {
    [`${safePrefix}_status`]: result.status,
    [`${safePrefix}_message`]: String(result.message || "")
  };

  const customer = result.customer || {};
  const billing = result.billing || {};

  Object.entries(customer).forEach(([key, value]) => {
    flat[`${safePrefix}_customer_${key}`] = value;
  });
  Object.entries(billing).forEach(([key, value]) => {
    flat[`${safePrefix}_${key}`] = value;
  });

  // Auto-format amount as pt-BR currency (R$ 1.234,56)
  const rawAmount = billing.amount;
  if (rawAmount !== undefined && rawAmount !== null) {
    const num = parseFloat(String(rawAmount).replace(",", "."));
    if (!isNaN(num)) {
      flat[`${safePrefix}_amount`] = `R$ ${num
        .toFixed(2)
        .replace(".", ",")
        .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
    }
  }

  // Auto-format dueDate as DD/MM/YYYY
  const rawDueDate = String(billing.dueDate || "").trim();
  if (rawDueDate) {
    const dm = rawDueDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dm) flat[`${safePrefix}_dueDate`] = `${dm[3]}/${dm[2]}/${dm[1]}`;
  }

  flat[safePrefix] = {
    status: result.status,
    message: String(result.message || ""),
    customer,
    billing
  };

  return flat;
};

const normalizeConditionValue = (value: any): string => {
  return String(value ?? "").trim();
};

const toConditionNumber = (value: any): number | null => {
  const normalized = normalizeConditionValue(value).replace(",", ".");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveConditionLeftValue = (
  key: string,
  variables: Record<string, any>
): any => {
  const trimmedKey = String(key || "").trim();
  if (!trimmedKey) return undefined;

  if (Object.prototype.hasOwnProperty.call(variables, trimmedKey)) {
    return variables[trimmedKey];
  }

  return getNestedValue(variables, trimmedKey);
};

const evaluateFlowCondition = (
  leftValue: any,
  opCode: number,
  rightValue: any
): boolean => {
  const leftNum = toConditionNumber(leftValue);
  const rightNum = toConditionNumber(rightValue);
  const useNumeric = leftNum !== null && rightNum !== null;
  const left = useNumeric
    ? leftNum
    : normalizeConditionValue(leftValue).toLowerCase();
  const right = useNumeric
    ? rightNum
    : normalizeConditionValue(rightValue).toLowerCase();

  if (opCode === 1) return left === right;
  if (opCode === 2) return left >= right;
  if (opCode === 3) return left <= right;
  if (opCode === 4) return left < right;
  if (opCode === 5) return left > right;
  return false;
};

const applyFlowFilter = (raw: string, filter: string): string => {
  const f = filter.trim().toLowerCase();

  if (f === "date") {
    const cleaned = raw.trim();
    // YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss
    const m = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return cleaned;
  }

  if (f === "currency") {
    const num = parseFloat(String(raw).replace(",", "."));
    if (isNaN(num)) return raw;
    return `R$ ${num.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  }

  if (f === "number") {
    const num = parseFloat(String(raw).replace(",", "."));
    if (isNaN(num)) return raw;
    return num.toLocaleString("pt-BR");
  }

  return raw;
};

const interpolateFlowString = (
  value: string,
  variables: Record<string, any>
): string => {
  if (!value || typeof value !== "string") return value;

  return value.replace(/\$\{([^}]+)\}/g, (match, rawKey) => {
    const parts = String(rawKey || "").trim().split("|");
    const key = parts[0].trim();
    const filter = parts[1] ? parts[1].trim() : "";

    const resolved = getNestedValue(variables, key);

    if (resolved === undefined || resolved === null) {
      return match;
    }

    const str = typeof resolved === "object" ? JSON.stringify(resolved) : String(resolved);
    return filter ? applyFlowFilter(str, filter) : str;
  });
};

const resolveConnectionTarget = (
  connections: IConnections[],
  sourceId: string,
  handleId: string
): string | undefined => {
  const normalizedHandle = String(handleId || "").trim();

  return connections.find(connection => {
    if (String(connection.source) !== String(sourceId)) return false;
    return String(connection.sourceHandle || "").trim() === normalizedHandle;
  })?.target;
};

const PDF_URL_SUFFIXES = ["?format=pdf", "?pdf=1", "?boleto=pdf", ""];

const isPdfBuffer = (data: ArrayBuffer): boolean => {
  const buf = Buffer.from(data);
  // PDF magic bytes: %PDF
  return buf.length > 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
};

const downloadPdfBuffer = async (baseUrl: string): Promise<Buffer | null> => {
  for (const suffix of PDF_URL_SUFFIXES) {
    const url = suffix
      ? baseUrl.includes("?")
        ? `${baseUrl}&${suffix.slice(1)}`
        : `${baseUrl}${suffix}`
      : baseUrl;
    try {
      const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 20000,
        maxRedirects: 5,
        headers: { Accept: "application/pdf,*/*" }
      });
      const ct = String(res.headers["content-type"] || "").toLowerCase();
      const buf = Buffer.from(res.data as ArrayBuffer);
      if (ct.includes("pdf") || isPdfBuffer(res.data)) {
        return buf;
      }
      console.log("[BILLING] URL não retornou PDF", { url, contentType: ct, size: buf.length });
    } catch (err: any) {
      console.log("[BILLING] Falha ao buscar URL de PDF", { url, err: String(err?.message || err) });
    }
  }
  return null;
};

const sendFlowDocumentFromUrl = async ({
  ticket,
  companyId,
  pdfUrl,
  fileName,
  caption
}: {
  ticket: any;
  companyId: number;
  pdfUrl: string;
  fileName?: string;
  caption?: string;
}): Promise<void> => {
  const channel = String(ticket?.channel || "").toLowerCase();

  console.log("[BILLING] sendFlowDocumentFromUrl chamada", { pdfUrl, channel, ticketId: ticket?.id });

  if (["facebook", "instagram"].includes(channel)) {
    console.log("[BILLING] Canal não suporta envio de PDF", { channel, ticketId: ticket?.id });
    return;
  }

  const buffer = await downloadPdfBuffer(pdfUrl);
  if (!buffer) {
    console.log("[BILLING] PDF não disponível na URL informada", { pdfUrl });
    return;
  }

  const resolvedFileName = String(fileName || "boleto.pdf").trim() || "boleto.pdf";
  const ticketDetails = await ShowTicketService(ticket.id, companyId);

  if (channel === "whatsapp_oficial") {
    const whatsappConn = await Whatsapp.findByPk(ticket.whatsappId);
    const oficalToken = String((whatsappConn as any)?.token || "");
    if (!oficalToken) {
      console.log("[BILLING] Token WABA não encontrado para envio de PDF", { whatsappId: ticket.whatsappId });
      return;
    }

    const tmpPath = path.join(os.tmpdir(), `billing_pdf_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);
    try {
      fs.writeFileSync(tmpPath, buffer);
      await sendMessageWhatsAppOficial(tmpPath, oficalToken, {
        type: "document",
        to: `+${ticketDetails.contact?.number}`,
        fileName: resolvedFileName,
        body_document: { caption: caption || "" }
      });
    } finally {
      try { fs.unlinkSync(tmpPath); } catch { /* ignora */ }
    }
    return;
  }

  // Baileys / Wuzapi — reaproveita o SendWhatsAppMediaFlow (mesmo usado pelo bloco de
  // documentos locais acima), pois ele resolve o JID correto por provider — inclusive
  // o endereçamento "@lid" exigido por conexões Wuzapi — em vez de montar
  // "${number}@s.whatsapp.net" manualmente, o que falha silenciosamente para contatos
  // que só respondem em "@lid".
  const sanitizedBaseName =
    resolvedFileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_") || "boleto";
  const tmpPath = path.join(
    os.tmpdir(),
    `${sanitizedBaseName}_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`
  );
  console.log("[BILLING] PDF baixado, enviando via SendWhatsAppMediaFlow", {
    pdfUrl,
    tmpPath,
    bufferSize: buffer.length,
    channel,
    ticketId: ticket?.id
  });
  try {
    fs.writeFileSync(tmpPath, buffer);
    await SendWhatsAppMediaFlow({
      media: tmpPath,
      ticket: ticketDetails,
      body: caption || "",
      isFlow: true
    });
    console.log("[BILLING] SendWhatsAppMediaFlow retornou com sucesso", {
      ticketId: ticket?.id
    });
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* ignora */ }
  }
};

const sendFlowTextMessage = async ({
  ticket,
  companyId,
  whatsapp,
  body
}: {
  ticket: any;
  companyId: number;
  whatsapp: any;
  body: string;
}) => {
  const trimmedBody = String(body || "").trim();
  if (!trimmedBody) return;

  const ticketDetails = await ShowTicketService(ticket.id, companyId);
  const isOfficialChannel =
    String(ticketDetails?.channel || "").toLowerCase() === "whatsapp_oficial";

  await delay(1500);
  if (!isOfficialChannel) {
    await typeSimulation(ticket, "composing");
  }

  const sentMessage = isOfficialChannel
    ? await SendWhatsAppOficialMessage({
        body: trimmedBody,
        ticket: ticketDetails,
        type: "text"
      })
    : await SendWhatsAppMessage({
        body: trimmedBody,
        ticket: ticketDetails,
        quotedMsg: null
      });

  await persistWuzapiFlowMessage({
    whatsapp,
    ticket: ticketDetails,
    companyId,
    body: trimmedBody,
    sentMessage
  });
  SetTicketMessagesAsRead(ticketDetails);
  await ticketDetails.update({
    lastMessage: trimmedBody
  });
};

const interpolateFlowPayload = (
  payload: any,
  variables: Record<string, any>
): any => {
  if (typeof payload === "string") {
    return interpolateFlowString(payload, variables);
  }

  if (Array.isArray(payload)) {
    return payload.map(item => interpolateFlowPayload(item, variables));
  }

  if (payload && typeof payload === "object") {
    return Object.keys(payload).reduce((acc, key) => {
      acc[key] = interpolateFlowPayload(payload[key], variables);
      return acc;
    }, {});
  }

  return payload;
};

const normalizeRequestBody = (
  requestBody: any,
  variables: Record<string, any>
): any => {
  if (requestBody === null || requestBody === undefined || requestBody === "") {
    return null;
  }

  if (typeof requestBody === "object") {
    return interpolateFlowPayload(requestBody, variables);
  }

  if (typeof requestBody !== "string") {
    return requestBody;
  }

  const interpolated = interpolateFlowString(requestBody, variables);
  const trimmed = interpolated.trim();

  if (!trimmed) return null;

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      logger.warn(
        `[FLOWBUILDER] Body JSON inválido em httpRequest; enviando como texto. err=${String(
          error?.message || error
        )}`
      );
      return interpolated;
    }
  }

  return interpolated;
};

const makeHttpRequest = async ({
  url,
  method,
  headers,
  body,
  queryParams,
  timeout,
  variables
}: {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
  queryParams?: Array<{ key: string; value: string }>;
  timeout?: number;
  variables: Record<string, any>;
}): Promise<{ data: any; status: number; headers: any; error?: boolean }> => {
  const interpolatedUrl = interpolateFlowString(String(url || "").trim(), variables);

  if (!interpolatedUrl) {
    return { data: { message: "Empty URL" }, status: 400, headers: {}, error: true };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(interpolatedUrl);
  } catch (error) {
    logger.warn(`[FLOWBUILDER] URL inválida em httpRequest: ${interpolatedUrl}`);
    return { data: { message: "Invalid URL" }, status: 400, headers: {}, error: true };
  }

  if (!/^https?:$/.test(parsedUrl.protocol)) {
    return {
      data: { message: "Unsupported protocol" },
      status: 400,
      headers: {},
      error: true
    };
  }

  const processedHeaders = Object.entries(headers || {}).reduce(
    (acc, [key, value]) => {
      acc[key] = interpolateFlowString(String(value || ""), variables);
      return acc;
    },
    {}
  );

  (Array.isArray(queryParams) ? queryParams : []).forEach(item => {
    const key = String(item?.key || "").trim();
    if (!key) return;

    const value = interpolateFlowString(String(item?.value || ""), variables);
    parsedUrl.searchParams.set(key, value);
  });

  const config: any = {
    url: parsedUrl.toString(),
    method: String(method || "GET").toUpperCase(),
    headers: {
      "Content-Type": "application/json",
      ...processedHeaders
    },
    timeout: Math.min(Math.max(Number(timeout) || 10000, 1000), 45000),
    httpsAgent: new https.Agent({
      rejectUnauthorized: process.env.NODE_ENV === "production"
    }),
    validateStatus: () => true
  };

  if (["POST", "PUT", "PATCH", "DELETE"].includes(config.method) && body !== null) {
    config.data = body;
  }

  try {
    const response = await axios(config);
    return {
      data: response.data,
      status: response.status,
      headers: response.headers,
      error: response.status >= 400
    };
  } catch (error: any) {
    logger.error(
      `[FLOWBUILDER] Erro ao executar httpRequest (${config.method} ${config.url}): ${String(
        error?.message || error
      )}`
    );

    return {
      data: {
        message: String(error?.message || "Request failed")
      },
      status: Number(error?.response?.status || 500),
      headers: error?.response?.headers || {},
      error: true
    };
  }
};

const executeHttpRequestNode = async ({
  nodeSelected,
  ticket,
  companyId,
  numberClient,
  createFieldJsonName,
  createFieldJsonEmail
}: {
  nodeSelected: any;
  ticket?: Ticket | null;
  companyId: number;
  numberClient: string;
  createFieldJsonName: string;
  createFieldJsonEmail: string;
}): Promise<{ data: any; variables: Record<string, any> }> => {
  const variables = buildFlowVariables({
    ticket,
    numberClient,
    name: createFieldJsonName,
    email: createFieldJsonEmail
  });

  const response = await makeHttpRequest({
    url: nodeSelected?.data?.url,
    method: nodeSelected?.data?.method || "GET",
    headers: nodeSelected?.data?.headers || {},
    body: normalizeRequestBody(nodeSelected?.data?.requestBody, variables),
    queryParams: nodeSelected?.data?.queryParams || [],
    timeout: nodeSelected?.data?.timeout || 10000,
    variables
  });

  const mappings = Array.isArray(nodeSelected?.data?.responseVariables)
    ? nodeSelected.data.responseVariables
    : [];

  const savedVariables = mappings.reduce((acc, item) => {
    const path = String(item?.path || "").trim();
    const variableName = String(item?.variableName || item?.variable || "").trim();

    if (!path || !variableName) return acc;

    const value = getNestedValue(response.data, path);
    if (value === undefined) return acc;

    acc[variableName] = value;
    return acc;
  }, {});

  const requestStatusVariable = String(nodeSelected?.data?.statusVariable || "").trim();
  if (requestStatusVariable) {
    savedVariables[requestStatusVariable] = response.status;
  }

  const requestSuccessVariable = String(
    nodeSelected?.data?.successVariable || ""
  ).trim();
  if (requestSuccessVariable) {
    savedVariables[requestSuccessVariable] = !response.error;
  }

  logger.info(
    `[FLOWBUILDER] httpRequest executado (company=${companyId}, ticket=${ticket?.id || "n/a"}, url=${String(
      nodeSelected?.data?.url || ""
    )}, status=${response.status})`
  );

  return {
    data: response.data,
    variables: savedVariables
  };
};

const isWuzapiProvider = (whatsapp: any): boolean =>
  String((whatsapp as any)?.provider || "").toLowerCase() === "wuzapi";

const normalizeRemoteJid = (value: string): string => {
  const raw = String(value || "").trim();
  if (!raw) return raw;
  if (!raw.includes("@")) return raw;
  const [left, domain] = raw.split("@");
  const primary = String(left || "").split(":")[0] || "";
  return `${primary}@${String(domain || "").toLowerCase()}`;
};

const resolveTicketRemoteJid = (ticket: any): string => {
  const isGroup = Boolean(ticket?.isGroup);
  const contactRemote = normalizeRemoteJid(String(ticket?.contact?.remoteJid || ""));
  if (contactRemote) return contactRemote;
  const number = String(ticket?.contact?.number || "").replace(/\D/g, "");
  if (!number) return "";
  return `${number}@${isGroup ? "g.us" : "s.whatsapp.net"}`;
};

const buildWuzapiMessageId = (sentMessage: any): string =>
  String(
    sentMessage?.key?.id ||
      sentMessage?.id ||
      sentMessage?.messageId ||
      randomString(24)
  ).trim();

const persistWuzapiFlowMessage = async ({
  whatsapp,
  ticket,
  companyId,
  body,
  sentMessage,
  mediaType,
  mediaUrl
}: {
  whatsapp: any;
  ticket: any;
  companyId: number;
  body: string;
  sentMessage?: any;
  mediaType?: string;
  mediaUrl?: string;
}) => {
  if (!isWuzapiProvider(whatsapp) || !ticket?.id) return;

  const remoteJid = resolveTicketRemoteJid(ticket);
  if (!remoteJid) return;

  const messageId = buildWuzapiMessageId(sentMessage);
  const wid = `wuzapi:${remoteJid}:${messageId}`;
  const textBody = String(body || "").trim();

  const messageData: MessageData = {
    wid,
    messageId,
    ticketId: ticket.id,
    body: textBody || (mediaType ? `:${mediaType}:` : ""),
    fromMe: true,
    read: true,
    ack: 2,
    mediaType,
    mediaUrl,
    remoteJid,
    dataJson: JSON.stringify(
      sentMessage || {
        key: { id: messageId, fromMe: true, remoteJid },
        message: { conversation: textBody }
      }
    )
  };

  await CreateMessageService({
    messageData,
    companyId
  });
};

const normalizeText = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const isExitSelection = (value: string | undefined) =>
  normalizeText(String(value || "")) === "sair";

const getExitOptionText = (nodeSelected: any) => {
  const raw = String(nodeSelected?.data?.exitOptionText || "").trim();
  return raw || "Encerrar atendimento";
};

const isMainMenuSelection = (value: string | undefined) =>
  String(value || "").trim() === "#";

const getMainMenuOptionText = (nodeSelected: any) => {
  const raw = String(nodeSelected?.data?.mainMenuOptionText || "").trim();
  return raw || "Retornar ao Menu Principal";
};

const resolveMainMenuTarget = (
  nodes: INodes[],
  connections: IConnections[]
): string | undefined => {
  const startNode =
    nodes.find(item => item?.type === "start") ||
    nodes.find(item => String(item?.id) === "1");

  if (!startNode) {
    return undefined;
  }

  return connections.find(
    connection => String(connection.source) === String(startNode.id)
  )?.target;
};

const resolveMenuSelection = (
  pressKey: string | undefined,
  nodeSelected: any
): string | undefined => {
  if (!pressKey) return undefined;

  const raw = String(pressKey).trim();
  if (!raw) return undefined;

  if (/^\d+$/.test(raw)) return raw;

  const numberMatch = raw.match(/\b(\d+)\b/);
  if (numberMatch?.[1]) return numberMatch[1];

  const options = nodeSelected?.data?.arrayOption || [];
  const normalizedRaw = normalizeText(raw);
  const byLabel = options.find(
    option => normalizeText(option?.value) === normalizedRaw
  );
  if (byLabel?.number !== undefined && byLabel?.number !== null) {
    return String(byLabel.number);
  }

  return undefined;
};

const replaceMessagesOld = (
  message: string,
  details: any,
  dataWebhook: any,
  dataNoWebhook?: any
) => {
  const matches = message.match(/\{([^}]+)\}/g);
  if (dataWebhook) {
    let newTxt = message.replace(/{+nome}+/, dataNoWebhook.nome);
    newTxt = newTxt.replace(/{+numero}+/, dataNoWebhook.numero);
    newTxt = newTxt.replace(/{+email}+/, dataNoWebhook.email);
    return newTxt;
  }
  if (matches && matches.includes("inputs")) {
    const placeholders = matches.map(match => match.replace(/\{|\}/g, ""));
    let newText = message;
    placeholders.map(item => {
      const value = details["inputs"].find(
        itemLocal => itemLocal.keyValue === item
      );
      const lineToData = details["keysFull"].find(itemLocal =>
        itemLocal.endsWith(`.${value.data}`)
      );
      const createFieldJson = constructJsonLine(lineToData, dataWebhook);
      newText = newText.replace(`{${item}}`, createFieldJson);
    });
    return newText;
  } else {
    return message;
  }
};
