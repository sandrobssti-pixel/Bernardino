import type { WAMessage } from "baileys";
import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

interface ReactionRequest {
  messageId: string;
  ticket: Ticket;
  reactionType: string; // Exemplo: 'like', 'heart', etc.
}

const safeParseDataJson = (value?: string | null): Record<string, any> => {
  if (!value || typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const normalizeJid = (value?: string | null): string => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || !raw.includes("@")) return "";
  const [left, domain] = raw.split("@");
  const primary = String(left || "").split(":")[0] || "";
  if (!primary || !domain) return "";
  return `${primary}@${domain}`;
};

const resolveReactionTargetJid = ({
  ticket,
  messageDataJson
}: {
  ticket: Ticket;
  messageDataJson: Record<string, any>;
}): string => {
  const keyRemote = normalizeJid(messageDataJson?.key?.remoteJid);
  if (keyRemote) return keyRemote;

  const contactRemote = normalizeJid((ticket as any)?.contact?.remoteJid);
  if (contactRemote) return contactRemote;

  const number = String((ticket as any)?.contact?.number || "").replace(/\D/g, "");
  if (!number) return "";
  return `${number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;
};

const extractProviderMessageId = (
  messageToReact: Message,
  parsedDataJson: Record<string, any>
): string => {
  const fromDataJson = String(parsedDataJson?.key?.id || "").trim();
  const fromMessageId = String((messageToReact as any)?.messageId || "").trim();
  const fromWid = String((messageToReact as any)?.wid || "").trim();
  const raw = fromDataJson || fromMessageId || fromWid;

  if (!raw) return "";
  if (raw.startsWith("me:")) return raw;

  const prefixedWidMatch = raw.match(/^wuzapi:[^:]+:(.+)$/i);
  if (prefixedWidMatch?.[1]) return String(prefixedWidMatch[1]).trim();

  return raw;
};

const SendWhatsAppReaction = async ({
  messageId,
  ticket,
  reactionType
}: ReactionRequest): Promise<WAMessage> => {
  const wbot = await GetTicketWbot(ticket);

  try {
    const messageToReact = await Message.findOne({
      where: {
        id: messageId
      }
    });

    if (!messageToReact) {
      throw new AppError("Message not found");
    }

    if (!reactionType) {
      throw new AppError("ReactionType not found");
    }

    const msgFound = safeParseDataJson(messageToReact.dataJson);
    const remoteJid = resolveReactionTargetJid({ ticket, messageDataJson: msgFound });
    const providerMessageId = extractProviderMessageId(messageToReact, msgFound);

    if (!remoteJid) {
      throw new AppError("ERR_REACTION_TARGET_NOT_FOUND");
    }
    if (!providerMessageId) {
      throw new AppError("ERR_REACTION_MESSAGE_ID_NOT_FOUND");
    }

    const reactionKey: any = {
      ...(msgFound?.key && typeof msgFound.key === "object" ? msgFound.key : {}),
      id: providerMessageId,
      remoteJid,
      fromMe:
        typeof msgFound?.key?.fromMe === "boolean"
          ? msgFound.key.fromMe
          : Boolean(messageToReact.fromMe)
    };

    // Wuzapi exige prefixo "me:" para reagir a mensagens enviadas pela própria conexão.
    if (
      String((wbot as any)?.provider || "").toLowerCase() === "wuzapi" &&
      reactionKey.fromMe === true &&
      !String(reactionKey.id).startsWith("me:")
    ) {
      reactionKey.id = `me:${reactionKey.id}`;
    }

    const msg = await wbot.sendMessage(remoteJid, {
      react: {
        text: reactionType, // O tipo de reação
        key: reactionKey // A chave da mensagem original a qual a reação se refere
      }

    });


    return msg;
  } catch (err) {
    Sentry.captureException(err);
    console.log(err);
    throw new AppError("ERR_SENDING_WAPP_REACTION");
  }
};

export default SendWhatsAppReaction;
