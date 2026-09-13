import { Request, Response } from "express";
import AppError from "../errors/AppError";
import fs from "fs";
import GetTicketWbot from "../helpers/GetTicketWbot";
import formatBody from "../helpers/Mustache";
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import { getIO } from "../libs/socket";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import Queue from "../models/Queue";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";
import path from "path";
import mime from "mime-types";
import { isNil } from "lodash";
import { Mutex } from "async-mutex";

import ListMessagesService from "../services/MessageServices/ListMessagesService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import DeleteWhatsAppMessage from "../services/WbotServices/DeleteWhatsAppMessage";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import CreateMessageService from "../services/MessageServices/CreateMessageService";
import { buildWebchatPublicUrl } from "../helpers/BuildWebchatPublicUrl";
import SendWhatsAppOficialMessage from "../services/WhatsAppOficial/SendWhatsAppOficialMessage";
import { sendFacebookMessageMedia } from "../services/FacebookServices/sendFacebookMessageMedia";
import sendFaceMessage from "../services/FacebookServices/sendFacebookMessage";
import ShowPlanCompanyService from "../services/CompanyService/ShowPlanCompanyService";
import ListMessagesServiceAll from "../services/MessageServices/ListMessagesServiceAll";
import ShowContactService from "../services/ContactServices/ShowContactService";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import Contact from "../models/Contact";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import CompaniesSettings from "../models/CompaniesSettings";
import {
  verifyMessageFace,
  verifyMessageMedia
} from "../services/FacebookServices/facebookMessageListener";
import EditWhatsAppMessage from "../services/MessageServices/EditWhatsAppMessage";
import CheckContactNumber from "../services/WbotServices/CheckNumber";
import type { proto } from "baileys";
import SendWhatsAppReaction from "../services/WbotServices/SendWhatsAppReaction";
import TranscribeAudioMessageService from "../services/MessageServices/TranscribeAudioMessageService";
import ImproveTicketReplyService from "../services/MessageServices/ImproveTicketReplyService";
import ShowMessageService, {
  GetWhatsAppFromMessage
} from "../services/MessageServices/ShowMessageService";
import { dynamicImport } from "../utils/dynamicImport";
import WhatsAppOfficialTemplate from "../models/WhatsAppOfficialTemplate";
import {
  IMetaMessageTemplate,
  IMetaMessageTemplateComponents
} from "../libs/whatsAppOficial/IWhatsAppOficial.interfaces";
import {
  assertOfficialTemplateSupported,
  buildOfficialTemplateComponents,
  buildOfficialTemplatePreview,
  getComponentPlaceholderMaxIndex,
  getHeaderFormat,
  isMediaHeaderFormat
} from "../utils/officialTemplate";

let baileysMod: typeof import("baileys") | null = null;
async function getBaileys() {
  if (!baileysMod) baileysMod = await dynamicImport("baileys");
  return baileysMod;
}

// Nó binário exigido pelo WhatsApp para renderizar mensagens interactiveMessage
// com nativeFlowMessage (botões de copiar, URL, ligar, PIX). Sem ele o servidor
// não processa a mensagem como interativa.
const NATIVE_FLOW_INTERACTIVE_NODES = [
  {
    tag: "biz",
    attrs: {},
    content: [
      {
        tag: "interactive",
        attrs: { type: "native_flow", v: "1" },
        content: [
          {
            tag: "native_flow",
            attrs: { v: "9", name: "mixed" }
          }
        ]
      }
    ]
  }
];

type IndexQuery = {
  pageNumber: string;
  ticketTrakingId: string;
  selectedQueues?: string;
  searchParam?: string;
  readOnly?: string;
};

interface TokenPayload {
  id: string;
  username: string;
  profile: string;
  companyId: number;
  iat: number;
  exp: number;
}

type MessageData = {
  body: string;
  fromMe: boolean;
  read: boolean;
  quotedMsg?: Message;
  number?: string;
  isPrivate?: string;
  hiddenMentionAll?: boolean | string;
  isSticker?: string;
  vCard?: Contact;
  location?: {
    latitude: number | string;
    longitude: number | string;
    name?: string;
    address?: string;
  };
};

type SendOfficialTemplatePayload = {
  templateIdMeta: string;
  languageCode?: string;
  headerVariables?: string[];
  bodyVariables?: string[];
  components?: IMetaMessageTemplateComponents[];
  quotedMsg?: Message;
};

const parseMaybeJson = <T>(value: unknown, fallback: T): T => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const normalizeLocationPayload = (rawLocation: any) => {
  if (!rawLocation) {
    return null;
  }

  const parsedLocation =
    typeof rawLocation === "string"
      ? JSON.parse(rawLocation)
      : rawLocation;

  const latitude = Number(parsedLocation?.latitude);
  const longitude = Number(parsedLocation?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new AppError("Coordenadas de localização inválidas", 400);
  }

  return {
    latitude,
    longitude,
    name: String(parsedLocation?.name || "").trim() || undefined,
    address: String(parsedLocation?.address || "").trim() || undefined
  };
};

// Função utilitária para extrair o campo body de mensagens
const extractMessageBody = (
  msg: any,
  fallback: string = "Mensagem interativa"
): string => {
  if (msg.message?.interactiveMessage?.body?.text) {
    return msg.message.interactiveMessage.body.text;
  }
  if (msg.message?.listMessage?.description) {
    return msg.message.listMessage.description;
  }
  if (
    msg.message?.interactiveMessage?.nativeFlowMessage?.buttons[0]
      ?.buttonParamsJson
  ) {
    try {
      const params = JSON.parse(
        msg.message.interactiveMessage.nativeFlowMessage.buttons[0]
          .buttonParamsJson
      );
      return (
        params.order?.items[0]?.name || params.display_text || fallback
      );
    } catch {
      return fallback;
    }
  }
  return msg.message?.conversation || fallback;
};

// Função para gerar IDs únicos
const generateRandomCode = (length: number = 11): string => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }
  return code;
};

// Função para formatar número de telefone
const formatPhoneNumber = (number: string): string => {
  if (!number) {
    throw new AppError("Número não fornecido", 400);
  }

  // Remove todos os caracteres não numéricos
  let cleaned = number.replace(/\D/g, "");

  // Se o número já começar com 55 e tiver o DDD, apenas valida
  if (cleaned.startsWith("55") && cleaned.length >= 12) {
    return cleaned;
  }

  // Se não tiver código do país, adiciona 55 (Brasil)
  if (!cleaned.startsWith("55") && cleaned.length >= 10) {
    cleaned = "55" + cleaned;
  }

  // Valida o comprimento do número
  if (cleaned.length < 12 || cleaned.length > 13) {
    throw new AppError(
      `Número de contato inválido: ${number}. Formato esperado: 55DDDNUMERO (12-13 dígitos)`,
      400
    );
  }

  return cleaned;
};

// Função para validar e formatar número para WhatsApp
const validateAndFormatWhatsAppNumber = (number: string): string => {
  const formattedNumber = formatPhoneNumber(number);

  // Verifica se o número tem o formato correto
  if (!/^55\d{10,11}$/.test(formattedNumber)) {
    throw new AppError(
      `Número de WhatsApp inválido: ${number}. Use o formato: 5531999999999`,
      400
    );
  }

  return formattedNumber;
};

const safeParseDataJson = (value: string | null | undefined): Record<string, any> => {
  if (!value || typeof value !== "string") {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const attachSenderMetadataToMessage = async ({
  companyId,
  wid,
  senderId,
  senderName
}: {
  companyId: number;
  wid?: string;
  senderId: number;
  senderName: string;
}) => {
  if (!wid) return;

  const maxAttempts = 10;
  const delayMs = 250;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const message = await Message.findOne({
      where: {
        wid,
        companyId
      }
    });

    if (message) {
      const currentJson = safeParseDataJson(message.dataJson);
      const updatedDataJson = JSON.stringify({
        ...currentJson,
        __sentByUserId: senderId,
        __sentByUserName: senderName
      });

      await message.update({ dataJson: updatedDataJson });
      return;
    }

    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
};

const emitOutgoingMessageFallback = async ({
  companyId,
  wid
}: {
  companyId: number;
  wid?: string;
}) => {
  if (!wid) return;

  const maxAttempts = 8;
  const delayMs = 250;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const message = await Message.findOne({
      where: {
        wid,
        companyId
      },
      include: [
        "contact",
        {
          model: Ticket,
          as: "ticket",
          include: [
            {
              model: Contact,
              attributes: [
                "id",
                "name",
                "number",
                "email",
                "profilePicUrl",
                "acceptAudioMessage",
                "active",
                "urlPicture",
                "companyId"
              ],
              include: ["extraInfo", "tags"]
            },
            {
              model: Queue,
              attributes: ["id", "name", "color"]
            },
            {
              model: Whatsapp,
              attributes: ["id", "name", "color", "groupAsTicket", "channel", "provider"]
            },
            {
              model: User,
              attributes: ["id", "name"]
            }
          ]
        },
        {
          model: Message,
          as: "quotedMsg",
          include: ["contact"]
        }
      ]
    });

    if (message) {
      const io = getIO();
      io.of(String(companyId)).emit(`company-${companyId}-appMessage`, {
        action: "create",
        message,
        ticket: message.ticket,
        contact: message.ticket?.contact
      });
      return;
    }

    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
};

const persistWuzapiOutgoingMessage = async ({
  ticket,
  sentMessage,
  senderId,
  senderName,
  body,
  mediaType,
  media,
  quotedMsg,
  isForwarded = false
}: {
  ticket: Ticket;
  sentMessage: any;
  senderId: number;
  senderName: string;
  body: string;
  mediaType?: string;
  media?: Express.Multer.File;
  quotedMsg?: Message;
  isForwarded?: boolean;
}) => {
  const wid =
    String(sentMessage?.key?.id || sentMessage?.id || "").trim() ||
    `WUZOUT${Date.now()}${generateRandomCode(6)}`;

  const existing = await Message.findOne({
    where: {
      wid,
      companyId: ticket.companyId
    }
  });
  if (existing) return;

  const messageId = String(sentMessage?.key?.id || sentMessage?.id || "").trim() || wid;
  const remoteJid =
    String(sentMessage?.key?.remoteJid || (ticket as any)?.contact?.remoteJid || "").trim() ||
    undefined;

  const dataJson = JSON.stringify({
    key: {
      id: messageId,
      fromMe: true,
      remoteJid
    },
    message: sentMessage?.message || { conversation: String(body || "") },
    __sentByUserId: senderId,
    __sentByUserName: senderName,
    isForwarded: !!isForwarded
  });

  const messageData: any = {
    wid,
    messageId,
    ticketId: ticket.id,
    quotedMsgId: quotedMsg?.id || null,
    body: body || "",
    fromMe: true,
    read: true,
    ack: 2,
    isForwarded: !!isForwarded,
    remoteJid,
    dataJson,
    channel: "whatsapp"
  };

  if (mediaType) {
    messageData.mediaType = mediaType;
  }

  if (media) {
    messageData.mediaUrl = media.filename;
    messageData.mediaType = mediaType || String(media.mimetype || "document").split("/")[0];
  }

  await CreateMessageService({
    companyId: ticket.companyId,
    messageData
  });
};

// Adicionar reação
export const addReaction = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { messageId } = req.params;
    const { type } = req.body;
    const { companyId, id } = req.user;
    const reactionText = String(type || "").trim();

    const message = await Message.findByPk(messageId);
    if (!message) {
      throw new AppError("Mensagem não encontrada", 404);
    }

    const ticket = await Ticket.findByPk(message.ticketId, {
      include: ["contact", "whatsapp"]
    });
    if (!ticket) {
      throw new AppError("Ticket não encontrado", 404);
    }

    let reactionResult: any;

    if (String(ticket.channel || "").toLowerCase() === "whatsapp_oficial") {
      reactionResult = await SendWhatsAppOficialMessage({
        body: reactionText,
        ticket,
        type: "reaction",
        quotedMsg: message
      });
    } else {
      reactionResult = await SendWhatsAppReaction({
        messageId,
        ticket,
        reactionType: reactionText
      });
    }

    const isWuzapiTicket =
      ticket.channel === "whatsapp" &&
      String((ticket as any)?.whatsapp?.provider || "").toLowerCase() === "wuzapi";

    if (isWuzapiTicket && reactionText) {
      const alreadyStoredReaction = await Message.findOne({
        where: {
          companyId,
          ticketId: ticket.id,
          quotedMsgId: message.id,
          fromMe: true,
          mediaType: "reactionMessage",
          body: reactionText
        }
      });

      if (!alreadyStoredReaction) {
        const senderUser = await User.findByPk(Number(id), {
          attributes: ["name"]
        });
        const senderName = senderUser?.name || "Atendente";
        const remoteJid =
          String(message.remoteJid || (ticket as any)?.contact?.remoteJid || "").trim() ||
          undefined;
        const quotedProviderId =
          String((message as any)?.messageId || message.wid || message.id || "").trim();
        const reactionWid = `WUZREACT${Date.now()}${generateRandomCode(6)}`;

        const messageData = {
          wid: reactionWid,
          ticketId: ticket.id,
          quotedMsgId: message.id,
          body: reactionText,
          fromMe: true,
          mediaType: "reactionMessage",
          read: true,
          ack: 2,
          remoteJid,
          dataJson: JSON.stringify({
            key: {
              id: reactionWid,
              fromMe: true,
              remoteJid
            },
            message: {
              reactionMessage: {
                text: reactionText,
                key: {
                  id: quotedProviderId,
                  fromMe: Boolean(message.fromMe),
                  remoteJid
                }
              }
            },
            __sentByUserId: Number(id),
            __sentByUserName: senderName
          }),
          channel: "whatsapp"
        };

        await CreateMessageService({
          companyId,
          messageData
        });
      }
    }

    const io = getIO();
    io.to(message.ticketId.toString()).emit(
      `company-${companyId}-appMessage`,
      {
        action: "update",
        message
      }
    );

    return res.status(200).json({
      message: "Reação adicionada com sucesso!",
      reactionResult
    });
  } catch (error) {
    console.error("Erro ao adicionar reação:", error);
    if (error instanceof AppError) {
      return res
        .status(error.statusCode)
        .json({ message: error.message });
    }
    return res.status(500).json({
      message: "Erro ao adicionar reação",
      error: String(error)
    });
  }
};

// Enviar mensagem de lista
export const sendListMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { title, text, buttonText, footer, sections } = req.body;

  try {
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    const contact = await Contact.findByPk(ticket.contactId);
    if (!contact) {
      throw new AppError("Contact not found", 404);
    }

    const whatsapp = await Whatsapp.findOne({
      where: { id: ticket.whatsappId }
    });
    if (!whatsapp || !whatsapp.number) {
      throw new AppError("Número de WhatsApp não encontrado", 404);
    }

    const number = `${contact.number}@${
      ticket.isGroup ? "g.us" : "s.whatsapp.net"
    }`;
    const botNumber = whatsapp.number;
    const wbot = await GetTicketWbot(ticket);

    // Validate input
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      throw new AppError("Sections must be a non-empty array", 400);
    }
    if (
      !sections.every(
        (section: any) =>
          Array.isArray(section.rows) && section.rows.length > 0
      )
    ) {
      throw new AppError(
        "Each section must have at least one row",
        400
      );
    }

    // Format sections for Baileys MD
    const formattedSections = sections.map((section: any) => ({
      title: section.title || "Section",
      rows: section.rows.map((row: any) => ({
        rowId: row.id || generateRandomCode(10),
        title: row.title || "Option",
        description: row.description || ""
      }))
    }));

    const listMessage: proto.IMessage = {
      listMessage: {
        title: title || "Lista de Opções",
        description: text || "Selecione uma opção",
        buttonText: buttonText || "Selecionar",
        footerText: footer || "",
        sections: formattedSections,
        listType: 1 // Single-select list
      }
    };

    console.debug(
      "Sending list message:",
      JSON.stringify(listMessage, null, 2)
    );

    const newMsg = (await getBaileys()).generateWAMessageFromContent(number, listMessage, {
      userJid: botNumber
    });

    await wbot.relayMessage(number, newMsg.message, {
      messageId: newMsg.key.id!
    });

    // Preencher o campo body para salvar no banco
    const messageBody = text || title || "Lista interativa";
    const messageData = {
      wid: newMsg.key.id,
      ticketId: ticket.id,
      body: messageBody,
      fromMe: true,
      mediaType: "listMessage",
      read: true,
      ack: 1,
      remoteJid: number,
      participant: ticket.isGroup ? contact.number : "",
      dataJson: JSON.stringify(newMsg),
      ticketTrakingId: ticket.ticketTrakingId,
      companyId: ticket.companyId,
      isPrivate: false,
      isEdited: false,
      isForwarded: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await CreateMessageService({ messageData, companyId: ticket.companyId });

    return res
      .status(200)
      .json({ message: "List message sent successfully", newMsg });
  } catch (err: any) {
    console.error("Error sending list message:", err);
    throw new AppError(`Error sending list message: ${err.message}`, 500);
  }
};

// Enviar mensagem de cópia
export const sendCopyMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { title, description, buttonText, copyText } = req.body;

  try {
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }
    const contact = await Contact.findByPk(ticket.contactId);
    if (!contact) {
      throw new AppError("Contact not found", 404);
    }
    const whatsapp = await Whatsapp.findOne({
      where: { id: ticket.whatsappId }
    });
    if (!whatsapp || !whatsapp.number) {
      throw new AppError("Número de WhatsApp não encontrado", 404);
    }

    const botNumber = whatsapp.number;
    const wbot = await GetTicketWbot(ticket);
    const copyMessage = {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: {
              text: title || "Botão copiar"
            },
            footer: {
              text: description || "Botão copiar"
            },
            nativeFlowMessage: {
              buttons: [
                {
                  name: "cta_copy",
                  buttonParamsJson: JSON.stringify({
                    display_text: buttonText || "Botão copiar",
                    copy_code: copyText || "Botão copiar"
                  })
                }
              ]
            }
          }
        }
      }
    };

    const number = `${contact.number}@${
      ticket.isGroup ? "g.us" : "s.whatsapp.net"
    }`;
    const newMsg = (await getBaileys()).generateWAMessageFromContent(number, copyMessage, {
      userJid: botNumber
    });
    await wbot.relayMessage(number, newMsg.message, {
      messageId: newMsg.key.id!,
      additionalNodes: NATIVE_FLOW_INTERACTIVE_NODES
    });

    // Preencher o campo body para salvar no banco
    const messageBody = title || "Mensagem de cópia interativa";
    const messageData = {
      wid: newMsg.key.id,
      ticketId: ticket.id,
      body: messageBody,
      fromMe: true,
      mediaType: "viewOnceMessage",
      read: true,
      ack: 1,
      remoteJid: number,
      participant: ticket.isGroup ? contact.number : "",
      dataJson: JSON.stringify(newMsg),
      ticketTrakingId: ticket.ticketTrakingId,
      companyId: ticket.companyId,
      isPrivate: false,
      isEdited: false,
      isForwarded: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await CreateMessageService({ messageData, companyId: ticket.companyId });

    return res
      .status(200)
      .json({ message: "Copy message sent successfully", newMsg });
  } catch (error) {
    console.error("Erro ao enviar a mensagem de cópia:", error);
    throw new AppError("Error sending copy message", 500);
  }
};

// Enviar mensagem de chamada
export const sendCALLMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { title, description, buttonText, copyText } = req.body;

  try {
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }
    const contact = await Contact.findByPk(ticket.contactId);
    if (!contact) {
      throw new AppError("Contact not found", 404);
    }
    const whatsapp = await Whatsapp.findOne({
      where: { id: ticket.whatsappId }
    });
    if (!whatsapp || !whatsapp.number) {
      throw new AppError("Número de WhatsApp não encontrado", 404);
    }

    const botNumber = whatsapp.number;
    const wbot = await GetTicketWbot(ticket);
    const callMessage = {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: {
              text: title || "Botão de chamada"
            },
            footer: {
              text: description || "Botão de chamada"
            },
            nativeFlowMessage: {
              buttons: [
                {
                  name: "cta_call",
                  buttonParamsJson: JSON.stringify({
                    display_text: buttonText || "Botão de chamada",
                    phone_number: copyText || "Botão de chamada"
                  })
                }
              ]
            }
          }
        }
      }
    };

    const number = `${contact.number}@${
      ticket.isGroup ? "g.us" : "s.whatsapp.net"
    }`;
    const newMsg = (await getBaileys()).generateWAMessageFromContent(number, callMessage, {
      userJid: botNumber
    });
    await wbot.relayMessage(number, newMsg.message, {
      messageId: newMsg.key.id!,
      additionalNodes: NATIVE_FLOW_INTERACTIVE_NODES
    });

    // Preencher o campo body para salvar no banco
    const messageBody = title || "Mensagem de chamada interativa";
    const messageData = {
      wid: newMsg.key.id,
      ticketId: ticket.id,
      body: messageBody,
      fromMe: true,
      mediaType: "viewOnceMessage",
      read: true,
      ack: 1,
      remoteJid: number,
      participant: ticket.isGroup ? contact.number : "",
      dataJson: JSON.stringify(newMsg),
      ticketTrakingId: ticket.ticketTrakingId,
      companyId: ticket.companyId,
      isPrivate: false,
      isEdited: false,
      isForwarded: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await CreateMessageService({ messageData, companyId: ticket.companyId });

    return res
      .status(200)
      .json({ message: "Call message sent successfully", newMsg });
  } catch (error) {
    console.error("Erro ao enviar a mensagem de chamada:", error);
    throw new AppError("Error sending call message", 500);
  }
};

// Enviar mensagem de URL
export const sendURLMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { image, title, description, buttonText, copyText } = req.body;

  try {
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }
    const contact = await Contact.findByPk(ticket.contactId);
    if (!contact) {
      throw new AppError("Contact not found", 404);
    }
    const whatsapp = await Whatsapp.findOne({
      where: { id: ticket.whatsappId }
    });
    if (!whatsapp || !whatsapp.number) {
      throw new AppError("Número de WhatsApp não encontrado", 404);
    }

    const botNumber = whatsapp.number;
    const wbot = await GetTicketWbot(ticket);
    let urlMessage: proto.IMessage;

    if (image) {
      if (!image.includes("base64,")) {
        throw new AppError("Invalid base64 image format", 400);
      }
      const base64Image = image.split(",")[1];
      const imageMessageContent = await (await getBaileys()).generateWAMessageContent(
        {
          image: {
            url: `data:image/png;base64,${base64Image}`
          }
        },
        { upload: wbot.waUploadToServer! }
      );

      urlMessage = {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              body: {
                text: title || "Botão URL"
              },
              footer: {
                text: description || "Botão URL"
              },
              header: {
                imageMessage: imageMessageContent.imageMessage,
                hasMediaAttachment: true
              },
              nativeFlowMessage: {
                buttons: [
                  {
                    name: "cta_url",
                    buttonParamsJson: JSON.stringify({
                      display_text: buttonText || "Botão URL",
                      url: copyText || "https://example.com"
                    })
                  }
                ]
              }
            }
          }
        }
      };
    } else {
      urlMessage = {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              body: {
                text: title || "Botão URL"
              },
              footer: {
                text: description || "Botão URL"
              },
              nativeFlowMessage: {
                buttons: [
                  {
                    name: "cta_url",
                    buttonParamsJson: JSON.stringify({
                      display_text: buttonText || "Botão URL",
                      url: copyText || "https://example.com"
                    })
                  }
                ]
              }
            }
          }
        }
      };
    }

    const number = `${contact.number}@${
      ticket.isGroup ? "g.us" : "s.whatsapp.net"
    }`;
    const newMsg = (await getBaileys()).generateWAMessageFromContent(number, urlMessage, {
      userJid: botNumber
    });
    await wbot.relayMessage(number, newMsg.message, {
      messageId: newMsg.key.id!,
      additionalNodes: NATIVE_FLOW_INTERACTIVE_NODES
    });

    // Preencher o campo body para salvar no banco
    const messageBody = title || "Mensagem URL interativa";
    const messageData = {
      wid: newMsg.key.id,
      ticketId: ticket.id,
      body: messageBody,
      fromMe: true,
      mediaType: "viewOnceMessage",
      read: true,
      ack: 1,
      remoteJid: number,
      participant: ticket.isGroup ? contact.number : "",
      dataJson: JSON.stringify(newMsg),
      ticketTrakingId: ticket.ticketTrakingId,
      companyId: ticket.companyId,
      isPrivate: false,
      isEdited: false,
      isForwarded: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await CreateMessageService({ messageData, companyId: ticket.companyId });

    return res
      .status(200)
      .json({ message: "URL message sent successfully", newMsg });
  } catch (error) {
    console.error("Erro ao enviar a mensagem URL:", error);
    throw new AppError("Error sending URL message", 500);
  }
};

const PIX_KEY_TYPE_LABELS: Record<string, string> = {
  CNPJ: "CNPJ",
  CPF: "CPF",
  PHONE: "Celular",
  EMAIL: "E-mail",
  EVP: "Chave Aleatória"
};

// O card oficial do WhatsApp exibe o número sem o prefixo "+55" (evita virar
// link azul de telefone). O valor completo continua sendo usado no copy_code.
const formatPixKeyForDisplay = (keyType: string, key: string): string =>
  keyType === "PHONE" ? key.replace(/^\+55/, "") : key;

const generatePixReferenceId = (): string => generateRandomCode(11).toUpperCase();

const PIX_KEY_VALIDATORS: Record<string, RegExp> = {
  PHONE: /^\+55\d{10,11}$/,
  CPF: /^\d{11}$/,
  CNPJ: /^\d{14}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  EVP: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
};

// Enviar mensagem PIX
export const sendPIXMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const {
    sendkey_type: keyType,
    sendmerchant_name: merchantName,
    sendKey
  }: {
    sendkey_type: string;
    sendmerchant_name?: string;
    sendKey: string;
  } = req.body;

  try {
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    const contact = await Contact.findByPk(ticket.contactId);
    if (!contact) {
      throw new AppError("Contact not found", 404);
    }

    const whatsapp = await Whatsapp.findOne({
      where: { id: ticket.whatsappId }
    });
    if (!whatsapp || !whatsapp.number) {
      throw new AppError("Número de WhatsApp não encontrado", 404);
    }

    // Validate input
    if (!sendKey || !keyType) {
      throw new AppError("Key type and PIX key are required", 400);
    }

    const keyTypeLabel = PIX_KEY_TYPE_LABELS[keyType];
    if (!keyTypeLabel) {
      throw new AppError("Invalid PIX key type", 400);
    }

    const validator = PIX_KEY_VALIDATORS[keyType];
    if (!validator.test(sendKey)) {
      throw new AppError("Invalid PIX key format", 400);
    }

    const number = `${contact.number}@${
      ticket.isGroup ? "g.us" : "s.whatsapp.net"
    }`;
    const botNumber = whatsapp.number;

    const cardTitle = merchantName?.trim() || "Chave Pix";
    const displayKey = formatPixKeyForDisplay(keyType, sendKey);
    const cardBody = `${keyTypeLabel}: ${displayKey}`;

    const isWuzapi = String((whatsapp as any)?.provider || "").toLowerCase() === "wuzapi";

    // No app oficial do WhatsApp, compartilhar uma chave Pix gera uma mensagem
    // nativeFlowMessage com botão "payment_info" (sem header/body — o ícone,
    // rótulo "Celular:"/"CPF:" etc. e o botão "Copiar chave Pix" são desenhados
    // pelo próprio app do contato a partir desse JSON). Reproduzimos fielmente
    // essa estrutura, capturada de uma mensagem real recebida via WuzAPI.
    // O WuzAPI não tem como enviar esse tipo de botão hoje (seu endpoint só
    // aceita reply/cta_url/cta_call/copy), então usamos cta_copy nesse caso.
    const interactiveMessage = isWuzapi
      ? {
          header: { title: cardTitle },
          body: { text: cardBody },
          nativeFlowMessage: {
            buttons: [
              {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                  display_text: "Copiar chave Pix",
                  copy_code: sendKey
                })
              }
            ]
          }
        }
      : {
          nativeFlowMessage: {
            buttons: [
              {
                name: "payment_info",
                buttonParamsJson: JSON.stringify({
                  currency: "BRL",
                  reference_id: generatePixReferenceId(),
                  type: "physical-goods",
                  additional_note: "",
                  order: {
                    items: [
                      {
                        quantity: 0,
                        amount: { offset: 1, value: 0 },
                        retailer_id: `custom-item-${Math.floor(Date.now() / 1000)}`,
                        name: ""
                      }
                    ],
                    status: "payment_requested",
                    subtotal: { value: 0, offset: 1 },
                    order_type: "ORDER_WITHOUT_AMOUNT"
                  },
                  total_amount: { value: 0, offset: 1 },
                  payment_settings: [
                    {
                      pix_static_code: {
                        key_type: keyType,
                        merchant_name: cardTitle,
                        key: sendKey
                      },
                      type: "pix_static_code"
                    },
                    { type: "cards", cards: { enabled: false } }
                  ],
                  referral: "chat_attachment"
                })
              }
            ]
          }
        };

    let wid: string;
    let dataJsonToSave: any;

    if (isWuzapi) {
      const { sendWuzapiInteractiveMessage } = await import(
        "../services/WuzapiServices/wuzapiClient"
      );
      const sentMsg = await sendWuzapiInteractiveMessage({
        whatsapp,
        jidOrPhone: number,
        interactiveMessage
      });
      wid = sentMsg.key.id;
      dataJsonToSave = sentMsg;
    } else {
      const wbot = await GetTicketWbot(ticket);
      const interactiveMsg = {
        viewOnceMessage: {
          message: { interactiveMessage }
        }
      };
      const newMsg = (await getBaileys()).generateWAMessageFromContent(number, interactiveMsg, {
        userJid: botNumber
      });
      await wbot.relayMessage(number, newMsg.message, {
        messageId: newMsg.key.id!,
        additionalNodes: NATIVE_FLOW_INTERACTIVE_NODES
      });
      wid = newMsg.key.id!;
      dataJsonToSave = newMsg;
    }

    // Preencher o campo body para salvar no banco no mesmo formato usado
    // para renderizar o card de PIX recebido (ver formatInteractiveMessageBody)
    const messageBody = `[PIX]\n\n*${cardTitle}*\n\n${cardBody}\n\nCOPY::${sendKey}`;
    const messageData = {
      wid,
      ticketId: ticket.id,
      body: messageBody,
      fromMe: true,
      mediaType: "viewOnceMessage",
      read: true,
      ack: 1,
      remoteJid: number,
      participant: ticket.isGroup ? contact.number : "",
      dataJson: JSON.stringify(dataJsonToSave),
      ticketTrakingId: ticket.ticketTrakingId,
      companyId: ticket.companyId,
      isPrivate: false,
      isEdited: false,
      isForwarded: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await CreateMessageService({ messageData, companyId: ticket.companyId });

    return res
      .status(200)
      .json({ message: "Mensagem enviada com sucesso" });
  } catch (error: any) {
    console.error("Erro ao enviar a mensagem PIX:", error);
    if (error instanceof AppError) {
      return res
        .status(error.statusCode)
        .json({ message: error.message });
    }
    return res.status(500).json({
      message: "Erro interno ao enviar a mensagem PIX",
      error: String(error)
    });
  }
};

// Transcrição de áudio
export const transcribeAudioMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { fileName } = req.params;
  const { companyId } = req.user;

  try {
    const transcribeService = new TranscribeAudioMessageService();

    const result = await transcribeService.execute(fileName, companyId);

    // Service pode retornar { error } ou { transcribedText }
    if ("error" in result) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error(`Erro ao transcrever a mensagem de áudio: ${error}`);

    if (error instanceof AppError) {
      return res
        .status(error.statusCode)
        .json({ error: error.message });
    }

    return res.status(500).json({
      error: "Erro interno ao transcrever a mensagem de áudio."
    });
  }
};

export const improveReply = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId } = req.user;
  const inputText = String(req.body?.text || "");

  try {
    await ShowTicketService(ticketId, companyId);
    const improvedText = await ImproveTicketReplyService({
      companyId,
      inputText
    });

    return res.status(200).json({ improvedText });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    return res.status(500).json({
      error: "Falha ao melhorar o texto com IA."
    });
  }
};

// Listar mensagens
export const index = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { pageNumber, selectedQueues: queueIdsStringified, searchParam, readOnly } =
    req.query as IndexQuery;
  const { companyId } = req.user;
  let queues: number[] = [];

  const user = await User.findByPk(req.user.id, {
    include: [{ model: Queue, as: "queues" }]
  });

  if (queueIdsStringified) {
    queues = JSON.parse(queueIdsStringified);
  } else {
    user!.queues.forEach(queue => {
      queues.push(queue.id);
    });
  }

  const { count, messages, ticket, hasMore } =
    await ListMessagesService({
      pageNumber,
      ticketId,
      companyId,
      queues,
      searchParam,
      user: user!
    });

  const shouldMarkAsRead = readOnly !== "true";

  if (
    shouldMarkAsRead &&
    ["whatsapp", "whatsapp_oficial"].includes(ticket.channel) &&
    ticket.whatsappId
  ) {
    await SetTicketMessagesAsRead(ticket);
  }

  return res.json({ count, messages, ticket, hasMore });
};

// Função para obter nome e extensão do arquivo
function obterNomeEExtensaoDoArquivo(url: string): string {
  const rawValue = String(url || "").trim();
  if (!rawValue) return "";

  const sourcePath = /^[a-z]+:\/\//i.test(rawValue)
    ? new URL(rawValue).pathname
    : rawValue;

  const sanitizedPath = sourcePath.split("?")[0].split("#")[0];
  return decodeURIComponent(path.basename(sanitizedPath));
}

// Armazenar mensagem
export const store = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const {
    body,
    quotedMsg,
    vCard,
    isPrivate = "false",
    hiddenMentionAll = false,
    location,
    isSticker = "false"
  }: MessageData =
    req.body;
  const medias = req.files as Express.Multer.File[];
  const { companyId } = req.user;
  const senderId = Number(req.user.id);
  const senderUser = await User.findByPk(senderId, {
    attributes: ["name"]
  });
  const senderName = senderUser?.name || "Atendente";

  const ticket = await ShowTicketService(ticketId, companyId);
  const shouldHiddenMentionAll =
    ticket.channel === "whatsapp" &&
    ticket.isGroup === true &&
    String(hiddenMentionAll).toLowerCase() === "true";
  const isWuzapiTicket =
    ticket.channel === "whatsapp" &&
    String((ticket as any)?.whatsapp?.provider || "").toLowerCase() === "wuzapi";

  if (
    ["whatsapp", "whatsapp_oficial"].includes(ticket.channel) &&
    ticket.whatsappId
  ) {
    await SetTicketMessagesAsRead(ticket);
  }

  try {
    if (location && isPrivate === "true") {
      throw new AppError(
        "Envio de localização não é suportado para mensagem privada",
        400
      );
    }

    if (medias) {
      await Promise.all(
        medias.map(async (media: Express.Multer.File, index) => {
          let sentMessage: any = null;

          if (ticket.channel === "whatsapp") {
            const isStickerMedia = isSticker === "true";
            sentMessage = await SendWhatsAppMedia({
              media,
              ticket,
              body: Array.isArray(body) ? body[index] : body,
              quotedMsg,
              isPrivate: isPrivate === "true",
              isForwarded: false,
              hiddenMentionAll: shouldHiddenMentionAll,
              isSticker: isStickerMedia
            });

            if (isWuzapiTicket && isPrivate !== "true") {
              const rawBody = String(Array.isArray(body) ? body[index] || "" : body || "");
              const formattedBody = rawBody ? formatBody(rawBody, ticket) : "";
              await persistWuzapiOutgoingMessage({
                ticket,
                sentMessage,
                senderId,
                senderName,
                body: formattedBody,
                mediaType: isStickerMedia ? "sticker" : undefined,
                media,
                quotedMsg,
                isForwarded: false
              });
            }

            await attachSenderMetadataToMessage({
              companyId: ticket.companyId,
              wid: sentMessage?.key?.id,
              senderId,
              senderName
            });
            await emitOutgoingMessageFallback({
              companyId: ticket.companyId,
              wid: sentMessage?.key?.id
            });
          } else if (ticket.channel === "whatsapp_oficial") {
            await SendWhatsAppOficialMessage({
              body: Array.isArray(body) ? body[index] : body,
              ticket,
              quotedMsg,
              type: null as any,
              media
            });
          }

          if (["facebook", "instagram"].includes(ticket.channel)) {
            try {
              const sentMedia = await sendFacebookMessageMedia({
                media,
                ticket,
                body: Array.isArray(body) ? body[index] : body
              });

              if (ticket.channel === "facebook") {
                await verifyMessageMedia(
                  sentMedia,
                  ticket,
                  ticket.contact,
                  true
                );
              }
            } catch (error) {
              console.error(
                "Erro ao enviar mídia para Facebook/Instagram:",
                error
              );
            }
          }

          if (ticket.channel === "webchat") {
            // Assim como no texto, não há API externa: a mídia fica
            // hospedada em public/company{id}/ (servida via /public). Salvamos
            // a URL absoluta já resolvida (buildWebchatPublicUrl) em vez de só
            // o filename: o getter Message.mediaUrl cai para caminho relativo
            // quando BACKEND_URL é localhost (assumindo mesma origem), o que
            // quebra no widget, sempre carregado num domínio de terceiro.
            const webchatBody = Array.isArray(body) ? body[index] : body;
            const messageData = {
              wid: `webchat-out-${ticket.id}-${Date.now()}-${index}`,
              ticketId: ticket.id,
              contactId: undefined,
              body: webchatBody || "",
              fromMe: true,
              read: true,
              ack: 3,
              mediaUrl: buildWebchatPublicUrl(`company${ticket.companyId}/${media.filename}`),
              mediaType: String(media.mimetype || "document").split("/")[0],
              dataJson: JSON.stringify({
                __sentByUserId: senderId,
                __sentByUserName: senderName
              }),
              isPrivate: isPrivate === "true",
              channel: "webchat"
            };

            await CreateMessageService({
              messageData,
              companyId: ticket.companyId
            });
          }

          const filePath = path.resolve(
            "public",
            `company${companyId}`,
            media.filename
          );
          if (
            fs.existsSync(filePath) &&
            isPrivate === "false" &&
            !isWuzapiTicket &&
            ticket.channel !== "webchat"
          ) {
            fs.unlinkSync(filePath);
          }
        })
      );
    } else {
      if (ticket.channel === "whatsapp" && isPrivate === "false") {
        const parsedLocation = normalizeLocationPayload(location);
        const sentMessage = await SendWhatsAppMessage({
          body,
          ticket,
          quotedMsg,
          vCard,
          location: parsedLocation,
          hiddenMentionAll: shouldHiddenMentionAll
        });

        if (isWuzapiTicket) {
          const outboundMessageAny = (sentMessage as any)?.message;
          const outboundVcard =
            outboundMessageAny?.contactMessage?.vcard ||
            outboundMessageAny?.contacts?.contacts?.[0]?.vcard ||
            "";

          const normalizedBody = !isNil(vCard)
            ? String(outboundVcard || "")
            : parsedLocation
            ? `${parsedLocation.name || parsedLocation.address || "Localização"}`
            : formatBody(String(body || ""), ticket);

          await persistWuzapiOutgoingMessage({
            ticket,
            sentMessage,
            senderId,
            senderName,
            body: normalizedBody,
            mediaType: !isNil(vCard) ? "contactMessage" : undefined,
            quotedMsg,
            isForwarded: false
          });
        }

        await attachSenderMetadataToMessage({
          companyId: ticket.companyId,
          wid: sentMessage?.key?.id,
          senderId,
          senderName
        });
        await emitOutgoingMessageFallback({
          companyId: ticket.companyId,
          wid: sentMessage?.key?.id
        });
      } else if (ticket.channel === "whatsapp_oficial" && isPrivate === "false") {
        await SendWhatsAppOficialMessage({
          body,
          ticket,
          quotedMsg,
          vCard,
          type: !isNil(vCard) ? "contacts" : "text"
        });
      } else if (ticket.channel === "whatsapp" && isPrivate === "true") {
        const messageData = {
          wid: `PVT${ticket.updatedAt.toString().replace(" ", "")}`,
          ticketId: ticket.id,
          contactId: undefined,
          body,
          fromMe: true,
          mediaType: !isNil(vCard)
            ? "contactMessage"
            : "extendedTextMessage",
          read: true,
          quotedMsgId: null,
          ack: 2,
          remoteJid: ticket.contact?.remoteJid,
          participant: null,
          dataJson: JSON.stringify({
            __sentByUserId: senderId,
            __sentByUserName: senderName
          }),
          ticketTrakingId: null,
          isPrivate: isPrivate === "true",
          companyId: ticket.companyId,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await CreateMessageService({
          messageData,
          companyId: ticket.companyId
        });
      } else if (["facebook", "instagram"].includes(ticket.channel)) {
        const sendText = await sendFaceMessage({
          body,
          ticket,
          quotedMsg
        });

        if (ticket.channel === "facebook") {
          await verifyMessageFace(
            sendText,
            body,
            ticket,
            ticket.contact,
            true
          );
        }
      } else if (ticket.channel === "webchat") {
        // Webchat não tem API externa para chamar — o visitante recebe a
        // resposta via polling no widget, então só precisamos persistir a
        // mensagem do agente, no mesmo padrão da mensagem privada do whatsapp.
        const messageData = {
          wid: `webchat-out-${ticket.id}-${Date.now()}`,
          ticketId: ticket.id,
          contactId: undefined,
          body,
          fromMe: true,
          read: true,
          ack: 3,
          quotedMsgId: null,
          dataJson: JSON.stringify({
            __sentByUserId: senderId,
            __sentByUserName: senderName
          }),
          isPrivate: isPrivate === "true",
          channel: "webchat"
        };

        await CreateMessageService({
          messageData,
          companyId: ticket.companyId
        });
      }
    }
    return res
      .status(200)
      .json({ message: "Mensagem enviada com sucesso" });
  } catch (error: any) {
    console.error("Erro ao armazenar mensagem:", error);
    return res.status(400).json({ error: error.message });
  }
};

export const sendOfficialTemplate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId } = req.user;
  const {
    templateIdMeta,
    languageCode,
    quotedMsg
  }: SendOfficialTemplatePayload = req.body;

  const headerVariables = parseMaybeJson<string[]>(req.body.headerVariables, []);
  const bodyVariables = parseMaybeJson<string[]>(req.body.bodyVariables, []);
  const components = parseMaybeJson<IMetaMessageTemplateComponents[] | undefined>(
    req.body.components,
    undefined
  );
  const headerMediaFile = req.file as Express.Multer.File | undefined;

  if (!templateIdMeta || !String(templateIdMeta).trim()) {
    throw new AppError("templateIdMeta é obrigatório", 400);
  }

  const ticket = await ShowTicketService(ticketId, companyId);
  if (String(ticket.channel || "").toLowerCase() !== "whatsapp_oficial") {
    throw new AppError("Envio por template disponível apenas para WhatsApp API Oficial", 400);
  }

  if (!ticket.whatsappId) {
    throw new AppError("Conexão oficial não encontrada para este ticket", 400);
  }

  const localTemplate = await WhatsAppOfficialTemplate.findOne({
    where: {
      whatsappId: ticket.whatsappId,
      templateIdMeta: String(templateIdMeta)
    }
  });

  if (!localTemplate) {
    throw new AppError("Template não encontrado localmente. Sincronize com a Meta e tente novamente.", 404);
  }

  if (
    localTemplate.status &&
    String(localTemplate.status).toUpperCase() !== "APPROVED"
  ) {
    throw new AppError(
      `Template indisponível para envio. Status atual: ${localTemplate.status}`,
      400
    );
  }

  const storedComponents = Array.isArray(localTemplate.components)
    ? localTemplate.components
    : [];

  assertOfficialTemplateSupported(storedComponents);

  const headerFormat = getHeaderFormat(storedComponents);
  const isMediaHeader = isMediaHeaderFormat(headerFormat);
  const requiredBodyVariables = getComponentPlaceholderMaxIndex(storedComponents, "BODY");
  const requiredHeaderVariables = isMediaHeader
    ? 0
    : getComponentPlaceholderMaxIndex(storedComponents, "HEADER");

  if (!Array.isArray(bodyVariables)) {
    throw new AppError("bodyVariables deve ser um array de textos", 400);
  }

  if (requiredBodyVariables > 0 && bodyVariables.length < requiredBodyVariables) {
    throw new AppError(
      `Quantidade insuficiente de variáveis para o body. Esperado: ${requiredBodyVariables}, recebido: ${bodyVariables.length}`,
      400
    );
  }

  if (!Array.isArray(headerVariables)) {
    throw new AppError("headerVariables deve ser um array de textos", 400);
  }

  if (requiredHeaderVariables > 0 && headerVariables.length < requiredHeaderVariables) {
    throw new AppError(
      `Quantidade insuficiente de variáveis para o header. Esperado: ${requiredHeaderVariables}, recebido: ${headerVariables.length}`,
      400
    );
  }

  let headerMediaUrl: string | undefined;

  if (isMediaHeader) {
    if (!headerMediaFile) {
      throw new AppError(
        `Este template exige um arquivo de ${headerFormat} no header.`,
        400
      );
    }

    headerMediaUrl = `${process.env.BACKEND_URL}/public/company${companyId}/${headerMediaFile.filename}`;
  }

  const templateComponents: IMetaMessageTemplateComponents[] = Array.isArray(components)
    ? components
    : buildOfficialTemplateComponents({
        components: storedComponents,
        headerVariables,
        bodyVariables,
        headerMediaUrl
      });

  const templatePayload: IMetaMessageTemplate = {
    name: localTemplate.name,
    language: {
      code: String(languageCode || localTemplate.language || "").trim()
    },
    components: templateComponents.length ? templateComponents : undefined
  };

  if (!templatePayload.language.code) {
    throw new AppError("Idioma do template não definido", 400);
  }

  await SendWhatsAppOficialMessage({
    body: "",
    ticket,
    type: "template",
    quotedMsg,
    template: templatePayload,
    bodyToSave: buildOfficialTemplatePreview({
      templateName: localTemplate.name,
      components: storedComponents,
      headerVariables,
      bodyVariables,
      headerMediaUrl
    })
  });

  return res.status(200).json({ message: "Template enviado com sucesso" });
};

export const listOfficialTemplatesByTicket = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId } = req.user;

  const ticket = await ShowTicketService(ticketId, companyId);
  if (String(ticket.channel || "").toLowerCase() !== "whatsapp_oficial") {
    throw new AppError("Este ticket não pertence ao canal WhatsApp API Oficial", 400);
  }

  if (!ticket.whatsappId) {
    throw new AppError("Conexão oficial não encontrada para este ticket", 400);
  }

  const templates = await WhatsAppOfficialTemplate.findAll({
    where: {
      whatsappId: ticket.whatsappId
    },
    order: [["name", "ASC"]]
  });

  return res.status(200).json({ templates });
};

// Encaminhar mensagem
export const forwardMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { quotedMsg, signMessage, messageId, contactId } = req.body;
  const { id: userId, companyId } = req.user;
  const requestUser = await User.findByPk(userId);

  if (!messageId || !contactId) {
    return res
      .status(400)
      .json({ message: "MessageId or ContactId not found" });
  }
  const message = await ShowMessageService(messageId);
  const contact = await ShowContactService(contactId, companyId);

  if (!message) {
    return res.status(404).json({ message: "Message not found" });
  }
  if (!contact) {
    return res.status(404).json({ message: "Contact not found" });
  }

  const settings = await CompaniesSettings.findOne({ where: { companyId } });

  const whatsAppConnectionId = await GetWhatsAppFromMessage(message);
  if (!whatsAppConnectionId) {
    return res
      .status(404)
      .json({ message: "Whatsapp from message not found" });
  }

  const ticket = await ShowTicketService(
    message.ticketId,
    message.companyId
  );
  const isWuzapiTicket =
    ticket.channel === "whatsapp" &&
    String((ticket as any)?.whatsapp?.provider || "").toLowerCase() === "wuzapi";
  const senderName = requestUser?.name || "Atendente";

  const mutex = new Mutex();

  const createTicket = await mutex.runExclusive(async () => {
    const result = await FindOrCreateTicketService(
      contact,
      ticket?.whatsapp,
      0,
      ticket.companyId,
      ticket.queueId,
      requestUser!.id,
      contact.isGroup ? contact : null,
      "whatsapp",
      null,
      true,
      settings,
      false,
      false
    );

    return result;
  });

  let ticketData;

  if (isNil(createTicket?.queueId)) {
    ticketData = {
      status: createTicket.isGroup ? "group" : "open",
      userId: requestUser!.id,
      queueId: ticket.queueId
    };
  } else {
    ticketData = {
      status: createTicket.isGroup ? "group" : "open",
      userId: requestUser!.id
    };
  }

  await UpdateTicketService({
    ticketData,
    ticketId: createTicket.id,
    companyId: createTicket.companyId
  });

  let body = message.body;
  if (
    message.mediaType === "conversation" ||
    message.mediaType === "extendedTextMessage"
  ) {
    if (ticket.channel === "whatsapp_oficial") {
      await SendWhatsAppOficialMessage({
        body: `_Mensagem encaminhada_:\n ${body}`,
        ticket: createTicket,
        quotedMsg,
        type: "text"
      });
    } else {
      const sentMessage = await SendWhatsAppMessage({
        body,
        ticket: createTicket,
        quotedMsg,
        isForwarded: !message.fromMe
      });

      if (isWuzapiTicket) {
        await persistWuzapiOutgoingMessage({
          ticket: createTicket,
          sentMessage,
          senderId: Number(userId),
          senderName,
          body: String(body || ""),
          quotedMsg,
          isForwarded: !message.fromMe
        });
      }

      await attachSenderMetadataToMessage({
        companyId: createTicket.companyId,
        wid: sentMessage?.key?.id,
        senderId: Number(userId),
        senderName
      });
      await emitOutgoingMessageFallback({
        companyId: createTicket.companyId,
        wid: sentMessage?.key?.id
      });
    }
  } else {
    const rawMediaUrl = String(message.mediaUrl || "").trim();
    if (!rawMediaUrl) {
      const fallbackBody = String(message.body || "").trim();

      if (ticket.channel === "whatsapp_oficial") {
        await SendWhatsAppOficialMessage({
          body: `_Mensagem encaminhada_:\n ${fallbackBody}`,
          ticket: createTicket,
          quotedMsg,
          type: "text"
        });
      } else {
        const sentMessage = await SendWhatsAppMessage({
          body: fallbackBody,
          ticket: createTicket,
          quotedMsg,
          isForwarded: !message.fromMe
        });

        if (isWuzapiTicket) {
          await persistWuzapiOutgoingMessage({
            ticket: createTicket,
            sentMessage,
            senderId: Number(userId),
            senderName,
            body: fallbackBody,
            quotedMsg,
            isForwarded: !message.fromMe
          });
        }

        await attachSenderMetadataToMessage({
          companyId: createTicket.companyId,
          wid: sentMessage?.key?.id,
          senderId: Number(userId),
          senderName
        });
        await emitOutgoingMessageFallback({
          companyId: createTicket.companyId,
          wid: sentMessage?.key?.id
        });
      }

      return res
        .status(200)
        .json({ message: "Mensagem encaminhada com sucesso" });
    }

    const mediaUrl = rawMediaUrl.replace(`:${process.env.PORT}`, "");
    const fileName = obterNomeEExtensaoDoArquivo(mediaUrl);

    if (body === fileName) {
      body = "";
    }

    const publicFolder = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "backend",
      "public"
    );
    const filePath = path.join(
      publicFolder,
      `company${createTicket.companyId}`,
      fileName
    );

    const inferredMimeFromName = String(mime.lookup(fileName) || "").trim();
    const normalizedStoredType = String(message.mediaType || "").trim().toLowerCase();
    const resolvedMimeType =
      inferredMimeFromName ||
      (normalizedStoredType.includes("/") ? normalizedStoredType : "") ||
      (normalizedStoredType === "document"
        ? "application/octet-stream"
        : normalizedStoredType === "image"
        ? "image/jpeg"
        : normalizedStoredType === "video"
        ? "video/mp4"
        : normalizedStoredType === "audio"
        ? "audio/ogg"
        : "application/octet-stream");

    const mediaSrc = {
      fieldname: "medias",
      originalname: fileName,
      encoding: "7bit",
      mimetype: resolvedMimeType,
      filename: fileName,
      path: filePath
    } as Express.Multer.File;

    if (ticket.channel === "whatsapp_oficial") {
      await SendWhatsAppOficialMessage({
        body: `_Mensagem encaminhada_:\n ${body}`,
        ticket: createTicket,
        quotedMsg,
        type: null as any,
        media: mediaSrc
      });
    } else {
      const sentMessage = await SendWhatsAppMedia({
        media: mediaSrc,
        ticket: createTicket,
        body,
        isForwarded: !message.fromMe
      });

      if (isWuzapiTicket) {
        await persistWuzapiOutgoingMessage({
          ticket: createTicket,
          sentMessage,
          senderId: Number(userId),
          senderName,
          body: String(body || ""),
          media: mediaSrc,
          quotedMsg,
          isForwarded: !message.fromMe
        });
      }

      await attachSenderMetadataToMessage({
        companyId: createTicket.companyId,
        wid: sentMessage?.key?.id,
        senderId: Number(userId),
        senderName
      });
      await emitOutgoingMessageFallback({
        companyId: createTicket.companyId,
        wid: sentMessage?.key?.id
      });
    }
  }

  return res
    .status(200)
    .json({ message: "Mensagem encaminhada com sucesso" });
};

// Remover mensagem
export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { messageId } = req.params;
  const { companyId } = req.user;

  const message = await DeleteWhatsAppMessage(messageId, companyId);
  const io = getIO();

  if (message.isPrivate) {
    await Message.destroy({ where: { id: message.id } });
    io.of(String(companyId)).emit(`company-${companyId}-appMessage`, {
      action: "delete",
      message
    });
  }

  io.of(String(companyId)).emit(`company-${companyId}-appMessage`, {
    action: "update",
    message
  });

  return res
    .status(200)
    .json({ message: "Mensagem removida com sucesso" });
};

// Contar mensagens
export const allMe = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const dateStart: any = req.query.dateStart;
  const dateEnd: any = req.query.dateEnd;
  const fromMe: any = req.query.fromMe;
  const { companyId } = req.user;

  const { count } = await ListMessagesServiceAll({
    companyId,
    fromMe,
    dateStart,
    dateEnd
  });

  return res.json({ count });
};

// Enviar mensagem
export const send = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const messageData: MessageData = req.body;
  const medias = req.files as Express.Multer.File[];

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new AppError("Token de autorização não fornecido", 401);
    }

    const [, token] = authHeader.split(" ");
    const whatsapp = await Whatsapp.findOne({ where: { token } });
    if (!whatsapp) {
      throw new AppError(
        "Não foi possível realizar a operação",
        404
      );
    }

    const companyId = whatsapp.companyId;
    const company = await ShowPlanCompanyService(companyId);
    const sendMessageWithExternalApi = company.plan.useExternalApi;

    if (!sendMessageWithExternalApi) {
      throw new AppError(
        "Essa empresa não tem permissão para usar a API Externa. Entre em contato com o Suporte para verificar nossos planos!",
        403
      );
    }

    if (messageData.number === undefined) {
      throw new AppError("O número é obrigatório", 400);
    }

    const numberToTest = messageData.number;
    const body = messageData.body;

    // ATENÇÃO: aqui ainda depende de como o CheckContactNumber retorna (string ou objeto).
    const CheckValidNumber = await CheckContactNumber(
      numberToTest,
      companyId
    );
    const number = (CheckValidNumber as any).replace
      ? (CheckValidNumber as any).replace(/\D/g, "")
      : String(CheckValidNumber).replace(/\D/g, "");

    console.log(
      `DEBUG - Número original: ${numberToTest}, Número formatado: ${number}`
    );

    if (medias) {
      await Promise.all(
        medias.map(async (media: Express.Multer.File) => {
          await req.app.get("queues").messageQueue.add(
            "SendMessage",
            {
              whatsappId: whatsapp.id,
              data: {
                number,
                body: media.originalname.replace("/", "-"),
                mediaPath: media.path
              }
            },
            { removeOnComplete: true, attempts: 3 }
          );
        })
      );
    } else {
      await req.app.get("queues").messageQueue.add(
        "SendMessage",
        {
          whatsappId: whatsapp.id,
          data: {
            number,
            body
          }
        },
        { removeOnComplete: true, attempts: 3 }
      );
    }
    return res.status(200).json({ mensagem: "Mensagem enviada!" });
  } catch (err: any) {
    console.error("Erro ao enviar mensagem:", err);
    if (err instanceof AppError) {
      return res
        .status(err.statusCode)
        .json({ message: err.message });
    }
    throw new AppError(
      "Não foi possível enviar a mensagem, tente novamente em alguns instantes",
      500
    );
  }
};

// Editar mensagem
export const edit = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { messageId } = req.params;
  const { companyId } = req.user;
  const { body }: MessageData = req.body;

  try {
    const { ticket, message } = await EditWhatsAppMessage({
      messageId,
      body
    });

    const io = getIO();
    io.of(String(companyId)).emit(`company-${companyId}-appMessage`, {
      action: "update",
      message
    });

    io.of(String(companyId)).emit(`company-${companyId}-ticket`, {
      action: "update",
      ticket
    });

    return res
      .status(200)
      .json({ message: "Mensagem editada com sucesso" });
  } catch (error) {
    console.error("Erro ao editar mensagem:", error);
    throw new AppError("Erro ao editar mensagem", 500);
  }
};

// Enviar mensagem em fluxo
export const sendMessageFlow = async (
  whatsappId: number,
  body: any,
  req: Request,
  files?: Express.Multer.File[]
): Promise<string> => {
  const messageData = body;
  const medias = files;

  try {
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      throw new AppError(
        "Não foi possível realizar a operação",
        404
      );
    }

    if (messageData.number === undefined) {
      throw new AppError("O número é obrigatório", 400);
    }

    const numberToTest = messageData.number;
    const msgBody = messageData.body;
    const companyId = messageData.companyId;

    const CheckValidNumber = await CheckContactNumber(
      numberToTest,
      companyId
    );
    const number = (CheckValidNumber as any).replace
      ? (CheckValidNumber as any).replace(/\D/g, "")
      : String(CheckValidNumber).replace(/\D/g, "");

    console.log(
      `DEBUG FLOW - Número original: ${numberToTest}, Número formatado: ${number}`
    );

    if (medias) {
      await Promise.all(
        medias.map(async (media: Express.Multer.File) => {
          await req.app.get("queues").messageQueue.add(
            "SendMessage",
            {
              whatsappId,
              data: {
                number,
                body: media.originalname,
                mediaPath: media.path
              }
            },
            { removeOnComplete: true, attempts: 3 }
          );
        })
      );
    } else {
      await req.app.get("queues").messageQueue.add(
        "SendMessage",
        {
          whatsappId,
          data: {
            number,
            body: msgBody
          }
        },
        { removeOnComplete: false, attempts: 3 }
      );
    }

    return "Mensagem enviada";
  } catch (err: any) {
    console.error("Erro ao enviar mensagem no fluxo:", err);
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError(
      "Não foi possível enviar a mensagem, tente novamente em alguns instantes",
      500
    );
  }
};
