import { Op, Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";

type Request = {
  sourceWhatsappId: number;
  targetWhatsappId: number;
  companyId: number;
};

type Result = {
  sourceWhatsappId: number;
  targetWhatsappId: number;
  migratedTickets: number;
  mergedTickets: number;
  movedMessagesByTicketMerge: number;
  migratedContacts: number;
  mergedContacts: number;
  movedTicketsByContactMerge: number;
  movedMessagesByContactMerge: number;
};

const ACTIVE_TICKET_STATUSES = new Set(["open", "pending", "group", "nps", "lgpd"]);

const normalizeConnectionNumber = (value?: string | null): string => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const base = raw.includes("@") ? raw.split("@")[0] : raw;
  const digits = base.replace(/\D/g, "");
  if (digits) return digits;

  return base.toLowerCase();
};

const buildTicketMergePatch = (sourceTicket: Ticket, targetTicket: Ticket): any => {
  const patch: any = {};

  const sourceStatus = String(sourceTicket.status || "").toLowerCase();
  const targetStatus = String(targetTicket.status || "").toLowerCase();

  // Mantém ticket em atendimento quando origem está aberta.
  if (sourceStatus === "open" && targetStatus !== "open") {
    patch.status = sourceTicket.status;
  } else if (
    targetStatus === "closed" &&
    ACTIVE_TICKET_STATUSES.has(sourceStatus)
  ) {
    patch.status = sourceTicket.status;
  }

  // Preserva responsável e fila da origem quando o ticket destino não possui.
  if (sourceTicket.userId && !targetTicket.userId) {
    patch.userId = sourceTicket.userId;
  }

  if (sourceTicket.queueId && !targetTicket.queueId) {
    patch.queueId = sourceTicket.queueId;
  }

  const sourceUnread = Number(sourceTicket.unreadMessages || 0);
  const targetUnread = Number(targetTicket.unreadMessages || 0);
  if (sourceUnread > targetUnread) {
    patch.unreadMessages = sourceUnread;
  }

  if (sourceTicket.lid && !targetTicket.lid) {
    patch.lid = String(sourceTicket.lid).toLowerCase();
  }

  if (sourceTicket.jid && !targetTicket.jid) {
    patch.jid = String(sourceTicket.jid).toLowerCase();
  }

  return patch;
};

const buildContactMergePatch = (sourceContact: Contact, targetContact: Contact): any => {
  const patch: any = {};

  const sourceLid = String((sourceContact as any)?.lid || "").trim().toLowerCase();
  const targetLid = String((targetContact as any)?.lid || "").trim().toLowerCase();
  if (sourceLid && !targetLid) {
    patch.lid = sourceLid;
  }

  const sourceJid = String((sourceContact as any)?.jid || "").trim().toLowerCase();
  const targetJid = String((targetContact as any)?.jid || "").trim().toLowerCase();
  if (sourceJid && !targetJid) {
    patch.jid = sourceJid;
  }

  const sourceRemoteJid = String((sourceContact as any)?.remoteJid || "")
    .trim()
    .toLowerCase();
  const targetRemoteJid = String((targetContact as any)?.remoteJid || "")
    .trim()
    .toLowerCase();
  if (sourceRemoteJid && !targetRemoteJid) {
    patch.remoteJid = sourceRemoteJid;
  }

  return patch;
};

const findExistingTicketInTarget = async (
  sourceTicket: Ticket,
  companyId: number,
  targetWhatsappId: number,
  transaction: Transaction
): Promise<Ticket | null> => {
  const orKeys: any[] = [];
  if (sourceTicket.lid) orKeys.push({ lid: sourceTicket.lid });
  if (sourceTicket.jid) orKeys.push({ jid: sourceTicket.jid });
  if (sourceTicket.contactId) orKeys.push({ contactId: sourceTicket.contactId });

  if (orKeys.length === 0) return null;

  return Ticket.findOne({
    where: {
      companyId,
      whatsappId: targetWhatsappId,
      [Op.or]: orKeys
    },
    order: [["id", "DESC"]],
    transaction
  });
};

const findExistingContactInTarget = async (
  sourceContact: Contact,
  companyId: number,
  targetWhatsappId: number,
  transaction: Transaction
): Promise<Contact | null> => {
  const orKeys: any[] = [];
  if ((sourceContact as any)?.lid) orKeys.push({ lid: (sourceContact as any).lid });
  if ((sourceContact as any)?.jid) orKeys.push({ jid: (sourceContact as any).jid });
  if (sourceContact.number) orKeys.push({ number: sourceContact.number });

  if (orKeys.length === 0) return null;

  return Contact.findOne({
    where: {
      companyId,
      whatsappId: targetWhatsappId,
      [Op.or]: orKeys
    },
    order: [["id", "DESC"]],
    transaction
  });
};

const MigrateWhatsAppOwnershipService = async ({
  sourceWhatsappId,
  targetWhatsappId,
  companyId
}: Request): Promise<Result> => {
  if (!sourceWhatsappId || !targetWhatsappId) {
    throw new AppError("ERR_INVALID_WHATSAPP_IDS", 400);
  }
  if (sourceWhatsappId === targetWhatsappId) {
    throw new AppError("ERR_SOURCE_TARGET_SAME", 400);
  }

  const source = await Whatsapp.findOne({
    where: { id: sourceWhatsappId, companyId, channel: "whatsapp" }
  });
  const target = await Whatsapp.findOne({
    where: { id: targetWhatsappId, companyId, channel: "whatsapp" }
  });

  if (!source || !target) {
    throw new AppError("ERR_WHATSAPP_NOT_FOUND", 404);
  }

  const sourceNumber = normalizeConnectionNumber(source.number);
  const targetNumber = normalizeConnectionNumber(target.number);

  if (!sourceNumber || !targetNumber || sourceNumber !== targetNumber) {
    throw new AppError("ERR_WHATSAPP_NUMBER_MISMATCH", 400);
  }

  const sequelize = Whatsapp.sequelize;
  if (!sequelize) {
    throw new AppError("ERR_DB_NOT_INITIALIZED", 500);
  }

  const result: Result = {
    sourceWhatsappId,
    targetWhatsappId,
    migratedTickets: 0,
    mergedTickets: 0,
    movedMessagesByTicketMerge: 0,
    migratedContacts: 0,
    mergedContacts: 0,
    movedTicketsByContactMerge: 0,
    movedMessagesByContactMerge: 0
  };

  await sequelize.transaction(async (transaction: Transaction) => {
    const sourceTickets = await Ticket.findAll({
      where: {
        companyId,
        whatsappId: sourceWhatsappId
      },
      order: [["id", "ASC"]],
      transaction
    });

    for (const sourceTicket of sourceTickets) {
      const targetTicket = await findExistingTicketInTarget(
        sourceTicket,
        companyId,
        targetWhatsappId,
        transaction
      );

      if (targetTicket && targetTicket.id !== sourceTicket.id) {
        const patch = buildTicketMergePatch(sourceTicket, targetTicket);
        if (Object.keys(patch).length > 0) {
          await targetTicket.update(patch, { transaction });
        }

        const [movedMessages] = await Message.update(
          { ticketId: targetTicket.id },
          {
            where: { companyId, ticketId: sourceTicket.id },
            transaction
          }
        );

        result.movedMessagesByTicketMerge += Number(movedMessages || 0);
        result.mergedTickets += 1;

        await sourceTicket.destroy({ transaction });
        continue;
      }

      await sourceTicket.update({ whatsappId: targetWhatsappId }, { transaction });
      result.migratedTickets += 1;
    }

    const sourceContacts = await Contact.findAll({
      where: {
        companyId,
        whatsappId: sourceWhatsappId
      },
      order: [["id", "ASC"]],
      transaction
    });

    for (const sourceContact of sourceContacts) {
      const targetContact = await findExistingContactInTarget(
        sourceContact,
        companyId,
        targetWhatsappId,
        transaction
      );

      if (targetContact && targetContact.id !== sourceContact.id) {
        const patch = buildContactMergePatch(sourceContact, targetContact);
        if (Object.keys(patch).length > 0) {
          await targetContact.update(patch, { transaction });
        }

        const [movedTickets] = await Ticket.update(
          { contactId: targetContact.id },
          {
            where: { companyId, contactId: sourceContact.id },
            transaction
          }
        );

        const [movedMessages] = await Message.update(
          { contactId: targetContact.id },
          {
            where: { companyId, contactId: sourceContact.id },
            transaction
          }
        );

        result.movedTicketsByContactMerge += Number(movedTickets || 0);
        result.movedMessagesByContactMerge += Number(movedMessages || 0);
        result.mergedContacts += 1;

        await sourceContact.destroy({ transaction });
        continue;
      }

      await sourceContact.update({ whatsappId: targetWhatsappId }, { transaction });
      result.migratedContacts += 1;
    }
  });

  return result;
};

export default MigrateWhatsAppOwnershipService;
