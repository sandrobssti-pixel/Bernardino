import { Op } from "sequelize";
import moment from "moment-timezone";
import Contact from "../models/Contact";
import User from "../models/User";
import BirthdaySettings from "../models/BirthdaySettings";
import Company from "../models/Company";
import Whatsapp from "../models/Whatsapp";
import cache from "../libs/cache";
import GetDefaultWhatsApp from "../helpers/GetDefaultWhatsApp";
import FindOrCreateTicketService from "./TicketServices/FindOrCreateTicketService";
import SendWhatsAppMessage from "./WbotServices/SendWhatsAppMessage";
import CreateMessageService from "./MessageServices/CreateMessageService";
import logger from "../utils/logger";

type BirthdayContact = {
  id: number;
  name: string;
  age: number | null;
  birthDate: Date;
  messageSent: boolean;
};

type BirthdayUser = {
  id: number;
  name: string;
  age: number | null;
  birthDate: Date;
};

type BirthdayData = {
  users: BirthdayUser[];
  contacts: BirthdayContact[];
  settings: BirthdaySettings;
};

const TZ = "America/Sao_Paulo";

const normalizeDateOnly = (value: Date): moment.Moment =>
  moment(value).tz(TZ).startOf("day");

const calcAge = (birthDate: Date): number | null => {
  if (!birthDate) return null;
  const now = moment().tz(TZ);
  const born = normalizeDateOnly(birthDate);
  if (!born.isValid()) return null;
  return now.diff(born, "years");
};

const isBirthdayToday = (birthDate: Date): boolean => {
  const today = moment().tz(TZ);
  const born = normalizeDateOnly(birthDate);
  return born.month() === today.month() && born.date() === today.date();
};

const sentKey = (companyId: number, contactId: number): string => {
  const day = moment().tz(TZ).format("YYYYMMDD");
  return `birthday:sent:${companyId}:${contactId}:${day}`;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class BirthdayService {
  static async getBirthdaySettings(companyId: number): Promise<BirthdaySettings> {
    return BirthdaySettings.getCompanySettings(companyId);
  }

  static async updateBirthdaySettings(
    companyId: number,
    data: Partial<BirthdaySettings>
  ): Promise<BirthdaySettings> {
    const settings = await BirthdaySettings.getCompanySettings(companyId);
    await settings.update(data);
    return settings;
  }

  static async isMessageSentToday(companyId: number, contactId: number): Promise<boolean> {
    const key = sentKey(companyId, contactId);
    const exists = await cache.get(key);
    return !!exists;
  }

  static async getTodayBirthdaysForCompany(companyId: number): Promise<BirthdayData> {
    const settings = await this.getBirthdaySettings(companyId);

    const usersRaw = settings.userBirthdayEnabled
      ? await User.findAll({
          where: {
            companyId,
            birthDate: { [Op.ne]: null }
          },
          attributes: ["id", "name", "birthDate"],
          raw: true
        })
      : [];

    const users = usersRaw
      .filter((u: any) => !!u.birthDate && isBirthdayToday(u.birthDate))
      .map((u: any) => ({
        id: u.id,
        name: u.name,
        birthDate: u.birthDate,
        age: calcAge(u.birthDate)
      }));

    const contactsRaw = settings.contactBirthdayEnabled
      ? await Contact.findAll({
          where: {
            companyId,
            active: true,
            birthDate: { [Op.ne]: null }
          },
          attributes: ["id", "name", "birthDate", "number", "whatsappId", "companyId"],
          raw: true
        })
      : [];

    const contacts: BirthdayContact[] = [];
    for (const c of contactsRaw as any[]) {
      if (!c.birthDate || !isBirthdayToday(c.birthDate)) continue;
      const messageSent = await this.isMessageSentToday(companyId, c.id);
      contacts.push({
        id: c.id,
        name: c.name,
        birthDate: c.birthDate,
        age: calcAge(c.birthDate),
        messageSent
      });
    }

    return { users, contacts, settings };
  }

  static async sendBirthdayMessageToContact(
    contactId: number,
    companyId: number,
    customMessage?: string
  ): Promise<boolean> {
    try {
      const alreadySent = await this.isMessageSentToday(companyId, contactId);
      if (alreadySent) {
        throw new Error("MESSAGE_ALREADY_SENT");
      }

      const contact = await Contact.findOne({
        where: { id: contactId, companyId, active: true }
      });
      if (!contact) return false;

      const settings = await this.getBirthdaySettings(companyId);

      let whatsapp: Whatsapp | null = null;
      if (settings.whatsappId) {
        whatsapp = await Whatsapp.findOne({
          where: { id: settings.whatsappId, companyId, status: "CONNECTED" }
        });
      }
      if (!whatsapp) {
        whatsapp = await GetDefaultWhatsApp(companyId);
      }
      if (!whatsapp) return false;

      let message =
        customMessage ||
        settings.contactBirthdayMessage ||
        "🎉 Parabéns, {nome}! Feliz aniversário!";
      message = message.replace(/{nome}/g, contact.name || "Cliente");

      const ticket = await FindOrCreateTicketService(
        contact,
        whatsapp,
        0,
        companyId,
        null,
        null,
        null,
        whatsapp.channel,
        null,
        false,
        null,
        false,
        false
      );

      const sent = await SendWhatsAppMessage({
        body: `\u200e ${message}`,
        ticket
      });

      const wid = (sent as any)?.key?.id;
      if (wid) {
        await CreateMessageService({
          companyId,
          messageData: {
            wid,
            ticketId: ticket.id,
            contactId: contact.id,
            body: message,
            fromMe: true,
            read: true,
            channel: whatsapp.channel
          }
        });
      }

      await cache.set(sentKey(companyId, contactId), "1", "EX", 60 * 60 * 48);
      return true;
    } catch (error: any) {
      if (error?.message === "MESSAGE_ALREADY_SENT") throw error;
      logger.error("Birthday message send error", error);
      return false;
    }
  }

  static async processAutomaticBirthdayMessages(): Promise<void> {
    const nowTime = moment().tz(TZ).format("HH:mm:00");
    const companies = await Company.findAll({
      where: { status: true },
      attributes: ["id"],
      include: [
        {
          model: BirthdaySettings,
          as: "birthdaySettings",
          required: true,
          where: {
            contactBirthdayEnabled: true,
            sendBirthdayTime: nowTime
          }
        }
      ]
    });

    for (const company of companies) {
      const data = await this.getTodayBirthdaysForCompany(company.id);
      const intervalSeconds = Math.max(0, Number(data.settings?.sendIntervalSeconds || 0));
      for (const contact of data.contacts) {
        if (!contact.messageSent) {
          await this.sendBirthdayMessageToContact(contact.id, company.id);
          if (intervalSeconds > 0) {
            await sleep(intervalSeconds * 1000);
          }
        }
      }
    }
  }
}

export default BirthdayService;
