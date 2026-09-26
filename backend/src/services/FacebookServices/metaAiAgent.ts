import path from "path";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";
import { IOpenAi } from "../../@types/openai";
import { handleOpenAi } from "../IntegrationsServices/OpenAiService";
import ShowPromptService from "../PromptServices/ShowPromptService";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import { sendAttachmentFromUrl, sendText, showTypingIndicator } from "./graphAPI";

// Agente de IA do Instagram Direct / Facebook Messenger.
//
// O motor de IA (handleOpenAi) foi escrito para o Baileys: recebe uma "sessão"
// com sendMessage/sendPresenceUpdate e uma mensagem no formato proto do
// WhatsApp. Aqui montamos os dois em cima da Graph API da Meta — o mesmo
// truque já usado pela WuzAPI (createWuzapiSessionAdapter). Ver
// docs/MANUAL_TECNICO.md, seção 68.

// Marca invisível: o listener ignora o "echo" (is_echo) de mensagens que
// começam com ela, então a resposta da IA não é gravada duas vezes.
const BOT_MARKER = "‎";

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif"
};

const typeFromMime = (mimetype: string): string => {
  if (mimetype.includes("image")) return "image";
  if (mimetype.includes("video")) return "video";
  if (mimetype.includes("audio")) return "audio";
  return "file";
};

const toRecipientId = (jid: string): string => String(jid || "").split("@")[0];

const buildSentMessage = (jid: string, messageId: string, text: string) => ({
  key: { id: messageId, remoteJid: jid, fromMe: true },
  message: { conversation: text },
  messageTimestamp: Math.floor(Date.now() / 1000),
  status: 2
});

export const createMetaSessionAdapter = (whatsapp: Whatsapp): any => {
  const token = whatsapp.facebookUserToken;

  return {
    id: whatsapp.id,
    companyId: whatsapp.companyId,
    provider: "meta",
    channel: whatsapp.channel,
    sendMessage: async (jid: string, content: any) => {
      const text = content?.text ?? content?.caption;
      if (typeof text !== "string" || !text.trim()) {
        // Áudio (voz da IA) não é suportado aqui: o agente da Meta força
        // resposta em texto (ver handleMetaAiAgent).
        logger.warn(
          `[META_AI] conteúdo sem texto ignorado (whatsappId=${whatsapp.id}, keys=${Object.keys(content || {}).join(",")})`
        );
        return undefined;
      }

      const data: any = await sendText(
        toRecipientId(jid),
        `${BOT_MARKER}${text}`,
        token
      );

      if (!data?.message_id) {
        logger.error(
          `[META_AI] Graph API não confirmou o envio (whatsappId=${whatsapp.id}, recipient=${toRecipientId(jid)})`
        );
        return undefined;
      }

      return buildSentMessage(jid, data.message_id, text);
    },
    sendPresenceUpdate: async (presence: string, jid?: string) => {
      if (!jid) return true;
      const action =
        presence === "composing"
          ? "typing_on"
          : presence === "paused"
            ? "typing_off"
            : null;
      if (action) await showTypingIndicator(toRecipientId(jid), token, action);
      return true;
    },
    // Envio de arquivo do catálogo da IA (send_file). O arquivo fica em
    // public/company{id}/promptFiles e é servido por /public, então a Meta
    // baixa direto pela URL.
    sendMetaAttachment: async (
      jid: string,
      publicRelativePath: string,
      mimetype: string,
      caption?: string
    ) => {
      const baseUrl = String(process.env.BACKEND_URL || "").replace(/\/+$/, "");
      const url = `${baseUrl}/public/${publicRelativePath
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`;

      const data: any = await sendAttachmentFromUrl(
        toRecipientId(jid),
        url,
        typeFromMime(mimetype || ""),
        token
      );

      if (!data?.message_id) {
        throw new Error("Graph API não confirmou o envio do anexo");
      }

      const label = caption || path.basename(publicRelativePath);
      return buildSentMessage(jid, data.message_id, label);
    }
  };
};

interface HandleMetaAiAgentParams {
  whatsapp: Whatsapp;
  ticket: Ticket;
  contact: Contact;
  message: any;
  mediaSent?: Message | void;
  isMenu: boolean;
}

// Converte a mensagem recebida da Meta para o formato que o handleOpenAi
// entende. Retorna null quando não há nada que a IA consiga ler.
const buildPromptMessage = (
  contact: Contact,
  message: any,
  mediaSent?: Message | void
): any | null => {
  const text = String(message?.text || "").trim();
  const attachmentType = String(message?.attachments?.[0]?.type || "").toLowerCase();

  let content: any = null;

  if (attachmentType === "image" && mediaSent) {
    const ext = String(mediaSent.mediaUrl || "").split(".").pop()?.toLowerCase() || "";
    content = {
      imageMessage: {
        mimetype: IMAGE_MIME_BY_EXT[ext] || "image/jpeg",
        caption: text || undefined
      }
    };
  } else if (attachmentType === "audio" && mediaSent) {
    content = { audioMessage: {} };
  } else if (text) {
    content = { conversation: text };
  }

  if (!content) return null;

  return {
    key: {
      id: message.mid,
      fromMe: false,
      remoteJid: contact.number
    },
    messageTimestamp: Math.floor(Date.now() / 1000),
    message: content,
    pushName: contact.name
  };
};

/**
 * Aciona o agente de IA configurado na conexão Meta (campo "Agente de IA" da
 * tela de Conexões Meta). Retorna true quando a IA assumiu a mensagem — nesse
 * caso o listener não deve seguir para fluxo/filas/chatbot.
 */
export const handleMetaAiAgent = async ({
  whatsapp,
  ticket,
  contact,
  message,
  mediaSent,
  isMenu
}: HandleMetaAiAgentParams): Promise<boolean> => {
  const promptId = Number(whatsapp?.promptId);

  const eligible =
    Number.isInteger(promptId) &&
    promptId > 0 &&
    !message?.is_echo &&
    !ticket.imported &&
    !ticket.isGroup &&
    !ticket.userId &&
    !ticket.queueId &&
    !contact.disableBot &&
    !isMenu &&
    !(ticket.flowWebhook && ticket.flowStopped);

  if (!eligible) return false;

  const promptMsg = buildPromptMessage(contact, message, mediaSent);
  if (!promptMsg) return false;

  let prompt: IOpenAi;
  try {
    const promptModel = await ShowPromptService({
      promptId,
      companyId: whatsapp.companyId
    });
    prompt = {
      ...(promptModel.toJSON() as unknown as IOpenAi),
      // Instagram/Messenger: resposta sempre em texto (voz gera áudio PTT do
      // WhatsApp, que a Graph API não aceita nesse formato).
      voice: "texto"
    };
  } catch (error: any) {
    logger.error(
      `[META_AI] prompt ${promptId} não encontrado para whatsappId=${whatsapp.id}: ${String(
        error?.message || error
      )}`
    );
    return false;
  }

  const ticketTraking = await FindOrCreateATicketTrakingService({
    ticketId: ticket.id,
    companyId: ticket.companyId,
    whatsappId: whatsapp.id,
    userId: ticket.userId
  });

  const session = createMetaSessionAdapter(whatsapp);
  const hasMedia = Boolean(
    promptMsg.message.imageMessage || promptMsg.message.audioMessage
  );

  // Sem await: o handleOpenAi espera alguns segundos para agrupar mensagens
  // seguidas do cliente ("rajada"). Se o webhook ficasse bloqueado aqui, as
  // próximas mensagens do mesmo lote só seriam gravadas depois e a IA
  // responderia cada uma separadamente.
  handleOpenAi(
    prompt,
    promptMsg,
    session,
    ticket,
    contact,
    hasMedia ? (mediaSent as Message) : undefined,
    ticketTraking
  ).catch((error: any) => {
    logger.error(
      `[META_AI] falha no agente de IA (ticket=${ticket.id}, channel=${ticket.channel}): ${String(
        error?.message || error
      )}`
    );
  });

  return true;
};
