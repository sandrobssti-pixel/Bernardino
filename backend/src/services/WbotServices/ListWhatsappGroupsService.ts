import AppError from "../../errors/AppError";
import { tryGetWbot } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import { digitsOf } from "../../helpers/CheckGroupAdmin";

interface Request {
  whatsappId: string | number;
  companyId: string | number;
}

interface GroupOption {
  number: string; // id numérico do grupo (sem "@g.us"), pronto pro ContactListItem
  name: string;
  participantsCount: number;
}

// Lista TODOS os grupos que a conexão participa, direto do WhatsApp
// (Baileys `groupFetchAllParticipating`) — diferente da lista de Contacts
// (isGroup=true), que só contém grupos que já trocaram alguma mensagem com
// essa conexão. Usado pelo seletor de destinatário da campanha, pra não
// exigir que o grupo "converse" antes de poder ser escolhido pra campanha
// (ver docs/MANUAL_TECNICO.md).
const ListWhatsappGroupsService = async ({
  whatsappId,
  companyId
}: Request): Promise<GroupOption[]> => {
  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId, companyId: Number(companyId) }
  });

  if (!whatsapp) {
    throw new AppError("ERR_NO_DEFAULT_WHATSAPP", 404);
  }

  const wbot = tryGetWbot(Number(whatsappId), Number(companyId));

  if (!wbot) {
    throw new AppError("ERR_WAPP_NOT_INITIALIZED", 400);
  }

  const groups = await wbot.groupFetchAllParticipating();

  return Object.values(groups || {})
    .map((group: any) => ({
      number: digitsOf(String(group?.id || "")),
      name: group?.subject || digitsOf(String(group?.id || "")),
      participantsCount: Array.isArray(group?.participants)
        ? group.participants.length
        : 0
    }))
    .filter(group => group.number)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
};

export default ListWhatsappGroupsService;
