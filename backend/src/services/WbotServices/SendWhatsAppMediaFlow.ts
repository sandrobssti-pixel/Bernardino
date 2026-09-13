import type { AnyMessageContent, WAMessage, WAPresence } from "baileys";
import * as Sentry from "@sentry/node";
import fs from "fs";
import { exec } from "child_process";
import path from "path";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Ticket from "../../models/Ticket";
import mime from "mime-types";
import Contact from "../../models/Contact";
import CreateMessageService from "../MessageServices/CreateMessageService";

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  body?: string;
}

interface RequestFlow {
  media: string;
  ticket: Ticket;
  body?: string;
  isFlow?: boolean;
  isRecord?: boolean;
}

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

const processAudio = async (audio: string): Promise<string> => {
  const outputAudio = `${publicFolder}/${new Date().getTime()}.mp3`;
  return new Promise((resolve, reject) => {
    exec(
      `${ffmpegPath.path} -i ${audio} -vn -ab 128k -ar 44100 -f ipod ${outputAudio} -y`,
      (error, _stdout, _stderr) => {
        if (error) reject(error);
        //fs.unlinkSync(audio);
        resolve(outputAudio);
      }
    );
  });
};

const processAudioFile = async (audio: string): Promise<string> => {
  const outputAudio = `${publicFolder}/${new Date().getTime()}.mp3`;
  return new Promise((resolve, reject) => {
    exec(
      `${ffmpegPath.path} -i ${audio} -vn -ar 44100 -ac 2 -b:a 192k ${outputAudio}`,
      (error, _stdout, _stderr) => {
        if (error) reject(error);
        //fs.unlinkSync(audio);
        resolve(outputAudio);
      }
    );
  });
};

const nameFileDiscovery = (pathMedia: string) => {
  const spliting = pathMedia.split('/')
  const first = spliting[spliting.length - 1]
  return first.split(".")[0]
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

const normalizeRemoteJid = (value: string): string => {
  const raw = String(value || "").trim();
  if (!raw || !raw.includes("@")) return raw;
  const [left, domain] = raw.split("@");
  const primary = String(left || "").split(":")[0] || "";
  return `${primary}@${String(domain || "").toLowerCase()}`;
};

const resolveRemoteJidFromTicket = (ticket: Ticket, contact: Contact, wbot?: any): string => {
  const isWuzapi = String((wbot as any)?.provider || "").toLowerCase() === "wuzapi";

  if (isWuzapi && !ticket.isGroup) {
    const lidCandidates = [
      normalizeRemoteJid(String((contact as any)?.lid || "")),
      normalizeRemoteJid(String((ticket as any)?.lid || "")),
      normalizeRemoteJid(String(contact?.remoteJid || ""))
    ].filter(jid => jid.endsWith("@lid"));

    if (lidCandidates.length > 0) return lidCandidates[0];
  }

  const jidCandidates = [
    normalizeRemoteJid(String((contact as any)?.jid || "")),
    normalizeRemoteJid(String((ticket as any)?.jid || "")),
    normalizeRemoteJid(String(contact?.remoteJid || ""))
  ].filter(Boolean);

  if (jidCandidates.length > 0) return jidCandidates[0];

  const number = String(contact?.number || "").replace(/\D/g, "");
  if (!number) return "";
  return `${number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;
};

export const typeSimulation = async (ticket: Ticket, presence: WAPresence) => {

  const wbot = await GetTicketWbot(ticket);

  let contact = await Contact.findOne({
    where: {
      id: ticket.contactId,
    }
  });

  const targetJid = resolveRemoteJidFromTicket(ticket, contact as any, wbot);

  await wbot.sendPresenceUpdate(presence, targetJid);
  await delay(5000);
  await wbot.sendPresenceUpdate("paused", targetJid);

}

const SendWhatsAppMediaFlow = async ({
  media,
  ticket,
  body,
  isFlow = false,
  isRecord = false
}: RequestFlow): Promise<WAMessage> => {
  try {
    const wbot = await GetTicketWbot(ticket);

    const mimetype = mime.lookup(media)
    const pathMedia = media

    const typeMessage = mimetype.split("/")[0];
    const mediaName = nameFileDiscovery(media)

    let options: AnyMessageContent;

    if (typeMessage === "video") {
      options = {
        video: fs.readFileSync(pathMedia),
        caption: body,
        fileName: mediaName
        // gifPlayback: true
      };
    } else if (typeMessage === "audio") {
      console.log('record', isRecord)
      if (isRecord) {
        const convert = await processAudio(pathMedia);
        options = {
          audio: fs.readFileSync(convert),
          mimetype: typeMessage ? "audio/mp4" : mimetype,
          ptt: true
        };
      } else {
        const convert = await processAudioFile(pathMedia);
        options = {
          audio: fs.readFileSync(convert),
          mimetype: typeMessage ? "audio/mp4" : mimetype,
          ptt: false
        };
      }
    } else if (typeMessage === "document" || typeMessage === "text") {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: body,
        fileName: mediaName,
        mimetype: mimetype
      };
    } else if (typeMessage === "application") {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: body,
        fileName: mediaName,
        mimetype: mimetype
      };
    } else {
      options = {
        image: fs.readFileSync(pathMedia),
        caption: body
      };
    }

    let contact = await Contact.findOne({
      where: {
        id: ticket.contactId,
      }
    });

    const targetJid = resolveRemoteJidFromTicket(ticket, contact as any, wbot);
    if (!targetJid) {
      throw new AppError("ERR_WAPP_INVALID_CONTACT", 400);
    }

    const sentMessage = await wbot.sendMessage(
      targetJid,
      {
        ...options
      }
    );

    await ticket.update({ lastMessage: mediaName });

    const isWuzapi = String((wbot as any)?.provider || "").toLowerCase() === "wuzapi";
    if (isWuzapi) {
      const remoteJid = resolveRemoteJidFromTicket(ticket, contact as any, wbot);
      const messageId = String(sentMessage?.key?.id || `${Date.now()}`);
      const messageWid = `wuzapi:${remoteJid}:${messageId}`;
      const mediaTopLevel = typeMessage === "application" ? "document" : typeMessage;

      if (remoteJid) {
        await CreateMessageService({
          companyId: ticket.companyId,
          messageData: {
            wid: messageWid,
            messageId,
            ticketId: ticket.id,
            body: String(body || mediaName || "").trim(),
            fromMe: true,
            read: true,
            ack: 2,
            mediaType: mediaTopLevel,
            mediaUrl: media,
            remoteJid,
            dataJson: JSON.stringify({
              ...(sentMessage || {}),
              key: {
                ...(sentMessage?.key || {}),
                id: messageId,
                fromMe: true,
                remoteJid
              },
              __provider: "wuzapi",
              __flowMedia: true
            })
          }
        });
      }
    }

    return sentMessage;
  } catch (err) {
    Sentry.captureException(err);
    console.log(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMediaFlow;
