/** 
 * @TercioSantos-0 |
 * serviço/atualizar 1 configuração da empresa |
 * @params:companyId/column(name)/data
 */
import CompaniesSettings from "../../models/CompaniesSettings";

type Params = {
  companyId: number,
  column:string,
  data:string
};

const UpdateCompanySettingsService = async ({companyId, column, data}:Params): Promise<any> => {
  const allowedColumns = new Set([
    "hoursCloseTicketsAuto",
    "chatBotType",
    "acceptCallWhatsapp",
    "userRandom",
    "sendGreetingMessageOneQueues",
    "sendSignMessage",
    "sendFarewellWaitingTicket",
    "userRating",
    "sendGreetingAccepted",
    "CheckMsgIsGroup",
    "sendQueuePosition",
    "scheduleType",
    "acceptAudioMessageContact",
    "sendMsgTransfTicket",
    "enableLGPD",
    "requiredTag",
    "lgpdDeleteMessage",
    "lgpdHideNumber",
    "lgpdConsent",
    "lgpdLink",
    "lgpdMessage",
    "DirectTicketsToWallets",
    "closeTicketOnTransfer",
    "transferMessage",
    "greetingAcceptedMessage",
    "AcceptCallWhatsappMessage",
    "AcceptAudioMessageContactMessage",
    "sendQueuePositionMessage",
    "showNotificationPending",
    "aiReplyEnabled",
    "aiReplyProvider",
    "aiReplyApiKey",
    "aiReplyPrompt",
    "aiReplyMaxTokens",
    "aiReplyTemperature",
    "aiReplyModel"
  ]);

  if (!allowedColumns.has(column)) {
    throw new Error(`Invalid column for company settings update: ${column}`);
  }

  await CompaniesSettings.update(
    { [column]: data } as any,
    { where: { companyId } }
  );

  const updated = await CompaniesSettings.findOne({ where: { companyId } });
  return updated;
};

export default UpdateCompanySettingsService;
