import { Mutex } from "async-mutex";
import { differenceInMilliseconds } from "date-fns";
import { head, isNil } from "lodash";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import CreateMessageService from "../MessageServices/CreateMessageService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import ShowQueueIntegrationService from "../QueueIntegrationServices/ShowQueueIntegrationService";
import CompaniesSettings from "../../models/CompaniesSettings";
import { sendWebchatText } from "./sendWebchatMessage";
import { ActionsWebhookWebchatService } from "./ActionsWebhookWebchatService";
import { sayChatbotWebchat } from "./sayChatbotWebchat";

// Um mutex por visitante evita que duas requisições simultâneas do widget
// (ex.: duplo clique em "enviar" ou reconexão automática) criem dois
// tickets/contatos diferentes para o mesmo visitante, no mesmo padrão já
// usado pelo listener do Facebook.
const visitorMutexes = new Map<string, Mutex>();
const getVisitorMutex = (key: string): Mutex => {
  let mutex = visitorMutexes.get(key);
  if (!mutex) {
    mutex = new Mutex();
    visitorMutexes.set(key, mutex);
  }
  return mutex;
};

const buildVisitorNumber = (visitorId: string): string => `webchat-${visitorId}`;

const mountDataContact = (contact: Contact) => ({
  number: contact.number,
  name: contact.name,
  email: contact.email
});

// Dispara o flow de boas-vindas (contato novo) ou o flow de "reengajamento"
// (contato antigo voltando após >=6h) — mesma regra usada por
// facebookMessageListener.ts (flowbuilderIntegration), só que aqui é
// avaliado uma vez por início de sessão do widget, não por mensagem.
const triggerSessionFlow = async (
  ticket: Ticket,
  whatsapp: Whatsapp,
  companyId: number,
  contact: Contact,
  isFirstMsg: Ticket | null
): Promise<void> => {
  if (contact.disableBot || isNil(whatsapp.integrationId)) return;

  const integration = await ShowQueueIntegrationService(whatsapp.integrationId, companyId);
  if (integration?.type !== "flowbuilder") return;

  if (!isFirstMsg) {
    if (isNil(whatsapp.flowIdWelcome)) return;
    const flow = await FlowBuilderModel.findOne({ where: { id: whatsapp.flowIdWelcome } });
    if (!flow?.active) return;

    const nodes = flow.flow["nodes"];
    const connections = flow.flow["connections"];

    await ActionsWebhookWebchatService(
      whatsapp,
      whatsapp.flowIdWelcome,
      companyId,
      nodes,
      connections,
      nodes[0].id,
      null,
      "",
      "",
      null,
      ticket.id,
      mountDataContact(contact)
    );
    return;
  }

  const diffMs = Math.abs(
    differenceInMilliseconds(new Date(isFirstMsg.updatedAt), new Date())
  );
  const sixHoursMs = 6 * 60 * 60 * 1000;
  if (diffMs < sixHoursMs || isNil(whatsapp.flowIdNotPhrase)) return;

  const flow = await FlowBuilderModel.findOne({ where: { id: whatsapp.flowIdNotPhrase } });
  if (!flow?.active) return;

  const nodes = flow.flow["nodes"];
  const connections = flow.flow["connections"];

  await ActionsWebhookWebchatService(
    whatsapp,
    whatsapp.flowIdNotPhrase,
    companyId,
    nodes,
    connections,
    nodes[0].id,
    null,
    "",
    "",
    null,
    ticket.id,
    mountDataContact(contact)
  );
};

interface FindOrCreateVisitorTicketParams {
  whatsapp: Whatsapp;
  companyId: number;
  visitorId: string;
  name?: string;
  phone?: string;
}

export const findOrCreateVisitorTicket = async ({
  whatsapp,
  companyId,
  visitorId,
  name,
  phone
}: FindOrCreateVisitorTicketParams): Promise<{ ticket: Ticket; contact: Contact }> => {
  const mutex = getVisitorMutex(`${whatsapp.id}:${visitorId}`);

  return mutex.runExclusive(async () => {
    const contact = await CreateOrUpdateContactService({
      name: name?.trim() || phone?.trim() || "Visitante",
      number: buildVisitorNumber(visitorId),
      isGroup: false,
      companyId,
      channel: "webchat",
      whatsappId: whatsapp.id
    });

    // Precisa ser buscado ANTES de FindOrCreateTicketService: é o sinal de
    // "esse contato já teve algum ticket antes" (mesmo padrão usado em
    // facebookMessageListener.ts) — usado para decidir welcome x reengajamento.
    const isFirstMsg = await Ticket.findOne({
      where: { contactId: contact.id, companyId },
      order: [["id", "DESC"]]
    });

    const settings = await CompaniesSettings.findOne({ where: { companyId } });

    const ticket = await FindOrCreateTicketService(
      contact,
      whatsapp,
      0,
      companyId,
      0,
      0,
      null,
      "webchat",
      null,
      false,
      settings
    );

    await FindOrCreateATicketTrakingService({
      ticketId: ticket.id,
      companyId,
      whatsappId: whatsapp.id,
      userId: ticket.userId
    });

    await triggerSessionFlow(ticket, whatsapp, companyId, contact, isFirstMsg);

    return { ticket, contact };
  });
};

interface RegisterVisitorMessageParams {
  ticket: Ticket;
  whatsapp: Whatsapp;
  companyId: number;
  body: string;
}

export const registerVisitorMessage = async ({
  ticket,
  whatsapp,
  companyId,
  body
}: RegisterVisitorMessageParams): Promise<Message> => {
  const wid = `webchat-in-${ticket.id}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const messageData = {
    wid,
    ticketId: ticket.id,
    contactId: ticket.contactId,
    body,
    fromMe: false,
    read: false,
    ack: 3,
    channel: "webchat"
  };

  // Devolvida ao controller para responder ao widget com o id real da
  // mensagem — sem isso, o widget não tem como saber a partir de qual id
  // continuar o polling e acaba renderizando a própria mensagem de novo
  // quando ela chega de volta via GET /messages (visto sobretudo na
  // primeira mensagem da sessão, quando não há nenhuma outra mensagem
  // "âncora" ainda).
  const message = await CreateMessageService({ messageData, companyId });

  await ticket.update({ lastMessage: body, unreadMessages: (ticket.unreadMessages || 0) + 1 });

  const freshTicket = await Ticket.findByPk(ticket.id);
  if (!freshTicket) return message;

  const continuedFlow = await continueActiveFlow(freshTicket, whatsapp, companyId, body);
  if (continuedFlow) return message;

  // Só dispara o chatbot de submenu (Chatbot/Queue.chatbots) quando o
  // ticket já estava numa fila ANTES desta mensagem — no mesmo turno em
  // que a fila acaba de ser escolhida, routeVisitorToQueue já mostrou o
  // submenu (se houver); a resposta a esse submenu só chega na próxima
  // mensagem, quando o ticket já tem queueId "estável".
  const hadQueueBeforeRouting = Boolean(freshTicket.queueId);

  await routeVisitorToQueue(freshTicket, whatsapp, body);

  if (hadQueueBeforeRouting && !freshTicket.userId) {
    const contact = await Contact.findByPk(freshTicket.contactId);
    if (contact && !contact.disableBot) {
      await sayChatbotWebchat(freshTicket.queueId, whatsapp, freshTicket, contact, body);
    }
  }

  return message;
};

// Se o ticket está "parado" num node do tipo menu (aguardando o visitante
// digitar uma opção), retoma o flow a partir dali — mesmo padrão de
// flowBuilderQueue em facebookMessageListener.ts.
const continueActiveFlow = async (
  ticket: Ticket,
  whatsapp: Whatsapp,
  companyId: number,
  body: string
): Promise<boolean> => {
  if (!ticket.flowStopped || ticket.userId) return false;

  const flow = await FlowBuilderModel.findOne({ where: { id: ticket.flowStopped } });
  if (!flow?.active) return false;

  const isMenu = flow.flow["nodes"].find(
    (node: any) => node.id === ticket.lastFlowId
  )?.type === "menu";

  if (!isMenu) return false;

  const contact = await Contact.findByPk(ticket.contactId);
  if (!contact || contact.disableBot) return false;

  await ActionsWebhookWebchatService(
    whatsapp,
    parseInt(ticket.flowStopped, 10),
    companyId,
    flow.flow["nodes"],
    flow.flow["connections"],
    ticket.lastFlowId,
    null,
    "",
    "",
    body,
    ticket.id,
    mountDataContact(contact)
  );

  return true;
};

// Roteamento de fila do webchat: espelha o padrão já usado em
// facebookMessageListener.ts (verifyQueue) — se só há 1 fila configurada na
// conexão, roteia direto; se houver mais, envia o menu numerado como
// mensagem do próprio sistema (o widget recebe via polling, sem precisar de
// nenhuma API externa). Só roda quando não há flow ativo interceptando.
// Monta o submenu numerado do chatbot da fila (Queue.chatbots), no mesmo
// formato usado por facebookMessageListener.ts (verifyQueue) — só existe
// quando o admin configurou pelo menos um chatbot para a fila escolhida.
const buildChatbotSubmenuText = (queue: Queue, greeting: string): string | null => {
  const chatbots = queue.chatbots;
  if (!chatbots || chatbots.length === 0) return null;

  const options = chatbots.map((bot, index) => `[${index + 1}] - ${bot.name}\n`).join("");
  return `${greeting}\n\n${options}\n[#] Voltar para o menu principal`;
};

const routeVisitorToQueue = async (
  ticket: Ticket,
  whatsappParam: Whatsapp,
  body: string
): Promise<void> => {
  if (ticket.queueId || ticket.userId) return;

  const whatsapp = await ShowWhatsAppService(whatsappParam.id, ticket.companyId);

  if (!whatsapp.queues || whatsapp.queues.length === 0) return;

  if (whatsapp.queues.length === 1) {
    const firstQueue = head(whatsapp.queues);
    await UpdateTicketService({
      ticketData: { queueId: firstQueue.id },
      ticketId: ticket.id,
      companyId: ticket.companyId
    });

    const submenu = buildChatbotSubmenuText(
      firstQueue,
      firstQueue.greetingMessage || whatsapp.greetingMessage || ""
    );
    if (submenu) {
      await sendWebchatText(ticket, ticket.companyId, submenu);
    }
    return;
  }

  const selectedOption = body?.trim();
  const chosenQueue = !isNil(selectedOption)
    ? whatsapp.queues[+selectedOption - 1]
    : undefined;

  if (chosenQueue) {
    await UpdateTicketService({
      ticketData: { queueId: chosenQueue.id },
      ticketId: ticket.id,
      companyId: ticket.companyId
    });

    const submenu = buildChatbotSubmenuText(
      chosenQueue,
      chosenQueue.greetingMessage || `Você foi direcionado para ${chosenQueue.name}.`
    );
    await sendWebchatText(
      ticket,
      ticket.companyId,
      submenu || chosenQueue.greetingMessage || `Você foi direcionado para ${chosenQueue.name}.`
    );
    return;
  }

  let options = "";
  whatsapp.queues.forEach((queue, index) => {
    options += `[${index + 1}] - ${queue.name}\n`;
  });

  const greeting = whatsapp.greetingMessage
    ? `${whatsapp.greetingMessage}\n\n${options}`
    : options;

  await sendWebchatText(ticket, ticket.companyId, greeting);
};
