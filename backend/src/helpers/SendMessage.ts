import Whatsapp from "../models/Whatsapp";
import GetWhatsappWbot from "./GetWhatsappWbot";
import formatBody from "./Mustache";

import { getMessageOptions } from "../services/WbotServices/SendWhatsAppMedia";

export type MessageData = {
  number: number | string;
  body: string;
  mediaPath?: string;
  companyId?: number;
  mediaName?: string;
};

const normalizeChatId = (number: number | string, isGroup: boolean): string => {
  const raw = String(number || "").trim();
  if (!raw) return raw;

  const suffix = isGroup ? "g.us" : "s.whatsapp.net";
  if (raw.includes("@")) {
    const [left, domain] = raw.split("@");
    const primaryIdRaw = String(left || "").split(":")[0] || "";
    const normalizedDomain = String(domain || suffix).toLowerCase();
    const primaryId = isGroup
      ? primaryIdRaw.replace(/[^\d-]/g, "")
      : primaryIdRaw.replace(/\D/g, "");
    return `${primaryId}@${normalizedDomain}`;
  }

  const normalizedNumber = isGroup
    ? raw.replace(/[^\d-]/g, "")
    : raw.replace(/\D/g, "");

  return `${normalizedNumber}@${suffix}`;
};

const stringifyError = (err: any): string => {
  try {
    return JSON.stringify(err?.response?.data || err);
  } catch {
    return String(err);
  }
};

export const SendMessage = async (
  whatsapp: Whatsapp,
  messageData: MessageData,
  isGroup: boolean = false

): Promise<any> => {
  try {
    const wbot = await GetWhatsappWbot(whatsapp);
    const normalizedChatId = normalizeChatId(messageData.number, !!isGroup);
    const companyId = messageData?.companyId ? messageData.companyId.toString(): null;

    const sendToChat = async (chatId: string) => {
      if (messageData.mediaPath) {
        const options = await getMessageOptions(
          messageData.mediaName,
          messageData.mediaPath,
          companyId,
          messageData.body,
        );
        if (options) {
          return await wbot.sendMessage(chatId, {
            ...options
          });
        }
        return undefined;
      }

      const body = formatBody(`${messageData.body}`);
      const sent = await wbot.sendMessage(chatId, { text: body });

      // Alguns adapters (ex.: wuzapi) retornam apenas key/timestamp.
      // Garantimos conteúdo mínimo para persistência posterior.
      if (!sent?.message) {
        sent.message = { conversation: body };
      }

      return sent;
    };

    try {
      const message = await sendToChat(normalizedChatId);
      return message;
    } catch (firstError: any) {
      const firstDetails = stringifyError(firstError).toLowerCase();
      const isWuzapi = String((whatsapp as any)?.provider || "").toLowerCase() === "wuzapi";
      const canRetryAsLid =
        isWuzapi &&
        !isGroup &&
        normalizedChatId.endsWith("@s.whatsapp.net") &&
        firstDetails.includes("no lid found");

      if (canRetryAsLid) {
        const lidChatId = normalizedChatId.replace(/@s\.whatsapp\.net$/i, "@lid");
        const message = await sendToChat(lidChatId);
        return message;
      }

      throw firstError;
    }
  } catch (err: any) {
    if (err instanceof Error) {
      throw err;
    }

    const details = stringifyError(err);

    throw new Error(details || "UNKNOWN_SEND_MESSAGE_ERROR");
  }
};
