import AppError from "../../errors/AppError";
import { tryGetWbot } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import Ticket from "../../models/Ticket";
import CompaniesSettings from "../../models/CompaniesSettings";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import { digitsOf } from "../../helpers/CheckGroupAdmin";
import logger from "../../utils/logger";

interface Request {
  whatsappId: string | number;
  companyId: string | number;
}

interface Response {
  totalGroups: number;
  created: number;
  alreadyExisted: number;
}

// A aba "Grupos" (dentro de Atendimento) só listava grupos que já tinham
// trocado alguma mensagem com a conexão (Contact/Ticket criados por
// wbotMessageListener). Isso deixava a aba vazia mesmo quando a conexão já
// participa de vários grupos — e, por consequência, também deixava esses
// grupos fora da campanha (que só oferece grupo com ticket/contato já
// existente indiretamente, via aba Grupos). Esta ação sincroniza de uma vez
// só, buscando a lista real de grupos direto do WhatsApp (Baileys) e
// garantindo Contact + Ticket pra cada um, igual aconteceria naturalmente
// se o grupo tivesse mandado uma mensagem (ver docs/MANUAL_TECNICO.md).
const SyncWhatsappGroupsService = async ({
  whatsappId,
  companyId
}: Request): Promise<Response> => {
  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId, companyId: Number(companyId) }
  });

  if (!whatsapp) {
    throw new AppError("ERR_NO_DEFAULT_WHATSAPP", 404);
  }

  if (!whatsapp.allowGroup) {
    throw new AppError(
      "Habilite \"Permitir grupos\" na edição desta conexão antes de sincronizar.",
      400
    );
  }

  const wbot = tryGetWbot(Number(whatsappId), Number(companyId));

  if (!wbot) {
    throw new AppError("ERR_WAPP_NOT_INITIALIZED", 400);
  }

  const groups = await wbot.groupFetchAllParticipating();
  const settings = await CompaniesSettings.findOne({
    where: { companyId: Number(companyId) }
  });

  let created = 0;
  let alreadyExisted = 0;

  for (const group of Object.values(groups || {}) as any[]) {
    const groupId = digitsOf(String(group?.id || ""));
    if (!groupId) continue;

    const contact = await CreateOrUpdateContactService({
      name: group?.subject || groupId,
      number: groupId,
      isGroup: true,
      companyId: Number(companyId),
      whatsappId: whatsapp.id,
      remoteJid: `${groupId}@g.us`,
      wbot
    });

    try {
      const existingTicket = await Ticket.findOne({
        where: {
          contactId: contact.id,
          companyId: Number(companyId),
          whatsappId: whatsapp.id
        }
      });

      await FindOrCreateTicketService(
        contact,
        whatsapp,
        0,
        Number(companyId),
        null,
        null,
        contact,
        "whatsapp",
        false,
        false,
        settings
      );

      if (existingTicket) {
        alreadyExisted += 1;
      } else {
        created += 1;
      }
    } catch (error: any) {
      logger.error(
        `[SyncWhatsappGroups] falha ao garantir ticket do grupo ${groupId}: ${error?.message}`
      );
    }
  }

  return {
    totalGroups: Object.keys(groups || {}).length,
    created,
    alreadyExisted
  };
};

export default SyncWhatsappGroupsService;
