import { Request, Response } from "express";
import { Op } from "sequelize";
import { randomUUID } from "crypto";
import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";
import Message from "../models/Message";
import {
  findOrCreateVisitorTicket,
  registerVisitorMessage
} from "../services/WebchatServices/webchatMessageListener";

const findWebchatConnection = async (widgetId: string): Promise<Whatsapp> => {
  if (!widgetId) {
    throw new AppError("Widget inválido", 404);
  }

  const whatsapp = await Whatsapp.findOne({
    where: { webchatWidgetId: widgetId, channel: "webchat" }
  });

  if (!whatsapp) {
    throw new AppError("Widget não encontrado", 404);
  }

  return whatsapp;
};

const buildVisitorNumber = (visitorId: string): string => `webchat-${visitorId}`;

export const config = async (req: Request, res: Response): Promise<Response> => {
  const { widgetId } = req.params;
  const whatsapp = await findWebchatConnection(widgetId);

  const settings: any = whatsapp.webchatSettings || {};

  return res.status(200).json({
    active: whatsapp.webchatActive !== false,
    name: whatsapp.name,
    subtitle: settings.subtitle || "",
    formTitle: settings.formTitle || "",
    textAboveButton: settings.textAboveButton || "",
    position: settings.position || "right",
    requireName: Boolean(settings.requireName),
    requirePhone: Boolean(settings.requirePhone),
    hideDefaultButton: Boolean(settings.hideDefaultButton),
    avatar: settings.avatar || "",
    greetingMessage: whatsapp.greetingMessage || "",
    outOfHoursMessage: whatsapp.outOfHoursMessage || "",
    appearance: settings.appearance || {},
    behavior: settings.behavior || {}
  });
};

export const startSession = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { widgetId } = req.params;
  const { visitorId: incomingVisitorId, name, phone } = req.body || {};
  const whatsapp = await findWebchatConnection(widgetId);

  if (whatsapp.webchatActive === false) {
    throw new AppError("Atendimento via webchat está desativado", 403);
  }

  const visitorId = incomingVisitorId && String(incomingVisitorId).trim()
    ? String(incomingVisitorId).trim()
    : randomUUID();

  const { ticket } = await findOrCreateVisitorTicket({
    whatsapp,
    companyId: whatsapp.companyId,
    visitorId,
    name,
    phone
  });

  return res.status(200).json({
    visitorId,
    ticketUuid: ticket.uuid
  });
};

const loadOwnedTicket = async (
  whatsapp: Whatsapp,
  visitorId: string,
  ticketUuid: string
): Promise<Ticket> => {
  const contact = await Contact.findOne({
    where: { number: buildVisitorNumber(visitorId), companyId: whatsapp.companyId }
  });

  if (!contact) {
    throw new AppError("Sessão de visitante inválida", 404);
  }

  const ticket = await Ticket.findOne({
    where: {
      uuid: ticketUuid,
      contactId: contact.id,
      whatsappId: whatsapp.id,
      companyId: whatsapp.companyId
    }
  });

  if (!ticket) {
    throw new AppError("Conversa não encontrada", 404);
  }

  return ticket;
};

export const sendMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { widgetId } = req.params;
  const { visitorId, ticketUuid, body } = req.body || {};
  const whatsapp = await findWebchatConnection(widgetId);

  if (whatsapp.webchatActive === false) {
    throw new AppError("Atendimento via webchat está desativado", 403);
  }

  if (!visitorId || !ticketUuid || !String(body || "").trim()) {
    throw new AppError("Dados da mensagem incompletos", 400);
  }

  const ticket = await loadOwnedTicket(whatsapp, String(visitorId), String(ticketUuid));

  const message = await registerVisitorMessage({
    ticket,
    whatsapp,
    companyId: whatsapp.companyId,
    body: String(body).trim()
  });

  return res.status(200).json({ message: "ok", messageId: message.id });
};

export const listMessages = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { widgetId } = req.params;
  const { visitorId, ticketUuid, after } = req.query;
  const whatsapp = await findWebchatConnection(widgetId);

  if (!visitorId || !ticketUuid) {
    throw new AppError("Parâmetros de sessão ausentes", 400);
  }

  const ticket = await loadOwnedTicket(
    whatsapp,
    String(visitorId),
    String(ticketUuid)
  );

  const afterId = after ? Number(after) : 0;

  const messages = await Message.findAll({
    where: {
      ticketId: ticket.id,
      companyId: whatsapp.companyId,
      isPrivate: false,
      ...(afterId ? { id: { [Op.gt]: afterId } } : {})
    },
    order: [["id", "ASC"]],
    limit: 100
  });

  return res.status(200).json({
    ticketStatus: ticket.status,
    messages: messages.map(message => ({
      id: message.id,
      body: message.body,
      fromMe: message.fromMe,
      mediaType: message.mediaType,
      mediaUrl: message.mediaUrl,
      createdAt: message.createdAt
    }))
  });
};
