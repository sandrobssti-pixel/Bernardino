import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import Chatbot from "../../models/Chatbot";
import User from "../../models/User";
import ShowQueueService from "../QueueService/ShowQueueService";
import ShowChatBotServices from "../ChatBotServices/ShowChatBotServices";
import ShowDialogChatBotsServices from "../DialogChatBotsServices/ShowDialogChatBotsServices";
import DeleteDialogChatBotsServices from "../DialogChatBotsServices/DeleteDialogChatBotsServices";
import CreateDialogChatBotsServices from "../DialogChatBotsServices/CreateDialogChatBotsServices";
import ShowChatBotByChatbotIdServices from "../ChatBotServices/ShowChatBotByChatbotIdServices";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import formatBody from "../../helpers/Mustache";
import { sendWebchatText } from "./sendWebchatMessage";

// Espelha ChatbotListenerFacebook.ts (sayChatbot), trocando o envio via
// graphAPI/sendText por sendWebchatText — mesma máquina de estados
// (DialogChatBots) usada pelo chatbot de submenu por fila do
// WhatsApp/Facebook, para que o comportamento configurado em
// Chatbot/Queue.chatbots seja idêntico entre canais.

const isNumeric = (value: string) => /^-?\d+$/.test(value);

const deleteAndCreateDialogStage = async (
  contact: Contact,
  chatbotId: number,
  ticket: Ticket
) => {
  try {
    await DeleteDialogChatBotsServices(contact.id);
    const bots = await ShowChatBotByChatbotIdServices(chatbotId);
    if (!bots) {
      await ticket.update({ isBot: false });
      return;
    }
    await CreateDialogChatBotsServices({
      awaiting: 1,
      contactId: contact.id,
      chatbotId,
      queueId: bots.queueId
    });
  } catch (error) {
    await ticket.update({ isBot: false });
  }
};

const sendDialog = async (
  choosenQueue: Chatbot,
  ticket: Ticket,
  companyId: number
): Promise<void> => {
  const showChatBots = await ShowChatBotServices(choosenQueue.id);
  const options = (showChatBots.options || [])
    .map((option, index) => `*${index + 1}* - ${option.name}\n`)
    .join("");

  const body = options
    ? `‎${choosenQueue.greetingMessage}\n\n${options}\n*#* Voltar para o menu principal`
    : `‎${choosenQueue.greetingMessage}`;

  await sendWebchatText(ticket, companyId, formatBody(body, ticket));
};

const assignAgentIfNeeded = async (
  choosenQueue: Chatbot,
  ticket: Ticket,
  companyId: number
): Promise<void> => {
  if (!choosenQueue.isAgent) return;

  const agent = await User.findOne({ where: { name: choosenQueue.name } });
  if (!agent) return;

  await UpdateTicketService({
    ticketData: { userId: agent.id, status: "open" },
    ticketId: ticket.id,
    companyId
  });
};

const backToMainMenu = async (
  whatsapp: Whatsapp,
  contact: Contact,
  ticket: Ticket,
  companyId: number
): Promise<void> => {
  await UpdateTicketService({
    ticketData: { queueId: null },
    ticketId: ticket.id,
    companyId
  });

  const { queues, greetingMessage } = await ShowWhatsAppService(
    whatsapp.id,
    companyId
  );

  const options = queues
    .map((queue: Queue, index: number) => `*${index + 1}* - ${queue.name}\n`)
    .join("");

  const body = formatBody(`‎${greetingMessage}\n\n${options}`, ticket);
  await sendWebchatText(ticket, companyId, body);

  await DeleteDialogChatBotsServices(contact.id);
};

export const sayChatbotWebchat = async (
  queueId: number,
  whatsapp: Whatsapp,
  ticket: Ticket,
  contact: Contact,
  body: string
): Promise<void> => {
  if (!queueId) return;

  const companyId = ticket.companyId;
  const selectedOption = String(body || "").trim();
  const getStageBot = await ShowDialogChatBotsServices(contact.id);

  if (selectedOption === "#") {
    await backToMainMenu(whatsapp, contact, ticket, companyId);
    return;
  }

  if (!getStageBot) {
    const queue = await ShowQueueService(queueId, companyId);
    const choosenQueue = queue.chatbots?.[+selectedOption - 1];

    if (!choosenQueue?.greetingMessage) {
      await DeleteDialogChatBotsServices(contact.id);
      return;
    }

    await assignAgentIfNeeded(choosenQueue, ticket, companyId);
    await deleteAndCreateDialogStage(contact, choosenQueue.id, ticket);
    await sendDialog(choosenQueue, ticket, companyId);
    return;
  }

  const selected = isNumeric(selectedOption) ? selectedOption : "1";
  const bots = await ShowChatBotServices(getStageBot.chatbotId);
  const choosenQueue = bots.options?.[+selected - 1] || bots.options?.[0];

  if (!choosenQueue?.greetingMessage) {
    await DeleteDialogChatBotsServices(contact.id);
    return;
  }

  await assignAgentIfNeeded(choosenQueue, ticket, companyId);
  await deleteAndCreateDialogStage(contact, choosenQueue.id, ticket);
  await sendDialog(choosenQueue, ticket, companyId);
};
