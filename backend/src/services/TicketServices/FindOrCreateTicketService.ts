import { Op } from "sequelize";
import { sub } from "date-fns";

import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import ShowTicketService from "./ShowTicketService";
import FindOrCreateATicketTrakingService from "./FindOrCreateATicketTrakingService";
import { isNil } from "lodash";
import { getIO } from "../../libs/socket";
import logger from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";
import CompaniesSettings from "../../models/CompaniesSettings";
import CreateLogTicketService from "./CreateLogTicketService";
import AppError from "../../errors/AppError";
import UpdateTicketService from "./UpdateTicketService";

// interface Response {
//   ticket: Ticket;
//   // isCreated: boolean;
// }

const FindOrCreateTicketService = async (
  contact: Contact,
  whatsapp: Whatsapp,
  unreadMessages: number,
  companyId: number,
  queueId: number = null,
  userId: number = null,
  groupContact?: Contact,
  channel?: string,
  isImported?: boolean,
  isForward?: boolean,
  settings?: any,
  isTransfered?: boolean,
  isCampaign: boolean = false
): Promise<Ticket> => {
  // try {
  // let isCreated = false;

  // 🔒 Resolve de forma segura qual companyId usar (prioriza o da conexão)
  const resolvedCompanyId = whatsapp.companyId || companyId;

  if (!resolvedCompanyId) {
    logger.warn(
      `FindOrCreateTicketService: companyId não resolvido (whatsappId=${whatsapp.id}, contactId=${contact.id})`
    );
    throw new AppError("ERR_COMPANY_ID_NOT_RESOLVED");
  }

  if (whatsapp.companyId && companyId && whatsapp.companyId !== companyId) {
    logger.warn(
      `FindOrCreateTicketService: mismatch de companyId (param=${companyId}, whatsapp.companyId=${whatsapp.companyId}, whatsappId=${whatsapp.id}, contactId=${contact.id})`
    );
    // Aqui não lançamos erro para não quebrar instâncias antigas,
    // mas TODA lógica abaixo usa resolvedCompanyId.
  }

  let openAsLGPD = false;
  if (settings?.enableLGPD) {
    // adicionar lgpdMessage
    openAsLGPD =
      !isCampaign &&
      !isTransfered &&
      settings.enableLGPD === "enabled" &&
      settings.lgpdMessage !== "" &&
      (settings.lgpdConsent === "enabled" ||
        (settings.lgpdConsent === "disabled" &&
          isNil(contact?.lgpdAcceptedAt)));
  }

  const io = getIO();

  const DirectTicketsToWallets = settings?.DirectTicketsToWallets;

  // ===== ADIÇÃO: extrair lid/jid do contato/grupo como chave canônica =====
  const target = groupContact ?? contact;
  const targetContactId = target?.id;
  // Em Contact já existe remoteJid; priorizamos lid, depois jid, depois remoteJid
  const targetLid = (target as any)?.lid || null;
  const targetJid =
    (target as any)?.jid || (target as any)?.remoteJid || null;

  const findCanonicalTicketByChatKey = async (): Promise<Ticket | null> => {
    const chatKeyOr: any[] = [];

    if (targetLid) {
      chatKeyOr.push({ lid: String(targetLid).toLowerCase() });
    }

    if (targetJid) {
      chatKeyOr.push({ jid: String(targetJid).toLowerCase() });
    }

    if (chatKeyOr.length === 0) {
      return null;
    }

    return Ticket.findOne({
      where: {
        companyId: resolvedCompanyId,
        whatsappId: whatsapp.id,
        [Op.or]: chatKeyOr
      },
      order: [["id", "DESC"]]
    });
  };

  // Monta cláusula OR dinamicamente: contactId OU lid OU jid
  const orKeys: any[] = [];
  if (!isNil(targetContactId)) orKeys.push({ contactId: targetContactId });
  if (targetLid) orKeys.push({ lid: String(targetLid).toLowerCase() });
  if (targetJid) orKeys.push({ jid: String(targetJid).toLowerCase() });
  // =======================================================================

  let ticket = await Ticket.findOne({
    where: {
      status: {
        [Op.or]: ["open", "pending", "group", "nps", "lgpd"]
      },
      companyId: resolvedCompanyId,
      whatsappId: whatsapp.id,
      ...(orKeys.length > 0 ? { [Op.or]: orKeys } : {})
    },
    order: [["id", "DESC"]]
  });

  if (ticket) {
    // ===== ADIÇÃO: garantir que ticket receba lid/jid se ainda não tiver =====
    const needSyncIds =
      (!!targetLid && !ticket.lid) || (!!targetJid && !ticket.jid);

    if (needSyncIds) {
      const canonicalTicket = await findCanonicalTicketByChatKey();

      if (canonicalTicket && canonicalTicket.id !== ticket.id) {
        logger.warn(
          `FindOrCreateTicketService: ticket ${ticket.id} tentou assumir chat key já pertencente ao ticket ${canonicalTicket.id} (companyId=${resolvedCompanyId}, whatsappId=${whatsapp.id}). Reaproveitando ticket canônico.`
        );
        ticket = canonicalTicket;
      } else {
        try {
          await ticket.update({
            lid:
              ticket.lid ||
              (targetLid ? String(targetLid).toLowerCase() : null),
            jid:
              ticket.jid ||
              (targetJid ? String(targetJid).toLowerCase() : null)
          });
        } catch (error: any) {
          const isUniqueByChatKey =
            error?.name === "SequelizeUniqueConstraintError" &&
            (error?.parent?.constraint === "tickets_company_whats_chatkey_uq" ||
              String(error?.parent?.detail || "").includes("COALESCE(lid, jid)"));

          if (!isUniqueByChatKey) {
            throw error;
          }

          const ownerTicket = await findCanonicalTicketByChatKey();

          if (!ownerTicket) {
            throw error;
          }

          logger.warn(
            `FindOrCreateTicketService: conflito de lid/jid ao sincronizar ticket ${ticket.id}; reaproveitando ticket canônico ${ownerTicket.id} (companyId=${resolvedCompanyId}, whatsappId=${whatsapp.id}).`
          );
          ticket = ownerTicket;
        }
      }
    }
    // ========================================================================

    if (isCampaign) {
      await ticket.update({
        userId: userId !== ticket.userId ? ticket.userId : userId,
        queueId: queueId !== ticket.queueId ? ticket.queueId : queueId
      });
    } else {
      // Evita "touch" desnecessário em updatedAt em eventos duplicados/replay.
      // Sem esta guarda, tickets antigos podem voltar ao topo da lista.
      const shouldUpdateUnread =
        Number(ticket.unreadMessages || 0) !== Number(unreadMessages || 0);
      const shouldUpdateIsBot = ticket.isBot !== false;

      if (shouldUpdateUnread || shouldUpdateIsBot) {
        await ticket.update({ unreadMessages, isBot: false });
      }
    }

    ticket = await ShowTicketService(ticket.id, resolvedCompanyId);
    // console.log(ticket.id)

    if (!isCampaign && !isForward) {
      // Mesma lógica antiga, mas só com número + isNil (sem comparar com string)
      const hasUserFilter =
        !isNil(userId) && Number(userId) !== 0 && !ticket.isGroup;
      const hasQueueFilter =
        !isNil(queueId) && Number(queueId) !== 0;

      if (
        (hasUserFilter &&
          Number(ticket?.userId) !== Number(userId)) ||
        (hasQueueFilter &&
          Number(ticket?.queueId) !== Number(queueId))
      ) {
        throw new AppError(
          `Ticket em outro atendimento. ${
            "Atendente: " + ticket?.user?.name
          } - ${"Fila: " + ticket?.queue?.name}`
        );
      }
    }

    // isCreated = true;

    return ticket;
  }

  const timeCreateNewTicket = whatsapp.timeCreateNewTicket;

  if (!ticket && timeCreateNewTicket !== 0) {
    // @ts-ignore: Unreachable code error
    if (timeCreateNewTicket !== 0 && timeCreateNewTicket !== "0") {
      const orKeysRecent: any[] = [];
      if (!isNil(targetContactId))
        orKeysRecent.push({ contactId: targetContactId });
      if (targetLid)
        orKeysRecent.push({ lid: String(targetLid).toLowerCase() });
      if (targetJid)
        orKeysRecent.push({ jid: String(targetJid).toLowerCase() });

      ticket = await Ticket.findOne({
        where: {
          updatedAt: {
            [Op.between]: [
              +sub(new Date(), {
                minutes: Number(timeCreateNewTicket)
              }),
              +new Date()
            ]
          },
          companyId: resolvedCompanyId,
          whatsappId: whatsapp.id,
          ...(orKeysRecent.length > 0 ? { [Op.or]: orKeysRecent } : {})
        },
        order: [["updatedAt", "DESC"]]
      });
    }

    if (ticket && ticket.status !== "nps") {
      await ticket.update({
        status: "pending",
        unreadMessages,
        companyId: resolvedCompanyId,
        queueId: null,
        userId: null,
        useIntegration: false,
        integrationId: null,
        flowStopped: null,
        flowWebhook: false,
        lastFlowId: null,
        dataWebhook: null,
        hashFlowId: null,
        typebotSessionId: null,
        typebotStatus: false,
        typebotSessionTime: null
        // queueId: timeCreateNewTicket === 0 ? null : ticket.queueId
      });
    }
  }

  if (!ticket) {
    const ticketData: any = {
      contactId: groupContact ? groupContact.id : contact.id,
      status:
        !isImported &&
        !isNil(settings?.enableLGPD) &&
        openAsLGPD &&
        !groupContact
          ? // verifica se lgpd está habilitada e não é grupo e se tem a mensagem e link da política
            "lgpd" // abre como LGPD caso habilitado parâmetro
          : // se lgpd estiver desabilitado, verifica se é para tratar ticket como grupo ou se é contato normal
          whatsapp.groupAsTicket === "enabled" || !groupContact
          ? "pending" // caso é para tratar grupo como ticket ou não é grupo, abre como pendente
          : "group", // se não é para tratar grupo como ticket, vai direto para grupos
      isGroup: !!groupContact,
      unreadMessages,
      whatsappId: whatsapp.id,
      companyId: resolvedCompanyId,
      isBot: groupContact ? false : true,
      channel,
      imported: isImported ? new Date() : null,
      isActiveDemand: false,
      // ===== ADIÇÃO: persistir lid/jid no ticket criado =====
      lid: targetLid ? String(targetLid).toLowerCase() : null,
      jid: targetJid ? String(targetJid).toLowerCase() : null
      // =====================================================
    };

    if (DirectTicketsToWallets && contact.id) {
      const wallet: any = contact;
      const wallets = await wallet.getWallets();
      if (wallets && wallets[0]?.id) {
        ticketData.status =
          !isImported &&
          !isNil(settings?.enableLGPD) &&
          openAsLGPD &&
          !groupContact
            ? "lgpd"
            : whatsapp.groupAsTicket === "enabled" || !groupContact
            ? "open"
            : "group";
        ticketData.userId = wallets[0].id;
      }
    }

    try {
      ticket = await Ticket.create(ticketData);
    } catch (error: any) {
      const isUniqueByChatKey =
        error?.name === "SequelizeUniqueConstraintError" &&
        (error?.parent?.constraint === "tickets_company_whats_chatkey_uq" ||
          String(error?.parent?.detail || "").includes("COALESCE(lid, jid)"));

      if (!isUniqueByChatKey) {
        throw error;
      }

      // Outro processo pode ter criado/reativado o ticket no mesmo chat key.
      // Faz fallback buscando por (companyId + whatsappId + lid/jid), independente do status.
      const whereByChatKey: any = {
        companyId: resolvedCompanyId,
        whatsappId: whatsapp.id
      };

      const chatKeyOr: any[] = [];
      if (targetLid) chatKeyOr.push({ lid: String(targetLid).toLowerCase() });
      if (targetJid) chatKeyOr.push({ jid: String(targetJid).toLowerCase() });
      if (chatKeyOr.length > 0) whereByChatKey[Op.or] = chatKeyOr;

      ticket = await Ticket.findOne({
        where: whereByChatKey,
        order: [["id", "DESC"]]
      });

      if (!ticket) {
        throw error;
      }

      await ticket.update({
        status: "pending",
        unreadMessages,
        isBot: groupContact ? false : true,
        contactId: groupContact ? groupContact.id : contact.id,
        queueId: null,
        userId: null,
        useIntegration: false,
        integrationId: null,
        flowStopped: null,
        flowWebhook: false,
        lastFlowId: null,
        dataWebhook: null,
        hashFlowId: null,
        typebotSessionId: null,
        typebotStatus: false,
        typebotSessionTime: null
      });
    }

    // await FindOrCreateATicketTrakingService({
    //   ticketId: ticket.id,
    //   companyId: resolvedCompanyId,
    //   whatsappId: whatsapp.id,
    //   userId: userId ? userId : ticket.userId
    // });
  }

  if (queueId != 0 && !isNil(queueId)) {
    // Determina qual a fila esse ticket pertence.
    await ticket.update({ queueId: queueId });
  }

  if (userId != 0 && !isNil(userId)) {
    // Determina qual o usuário responsável.
    await ticket.update({ userId: userId });
  }

  ticket = await ShowTicketService(ticket.id, resolvedCompanyId);

  await CreateLogTicketService({
    ticketId: ticket.id,
    type: openAsLGPD ? "lgpd" : "create"
  });

  return ticket;
};

export default FindOrCreateTicketService;
