import { FlowBuilderModel } from "../../models/FlowBuilder";
import { FlowCampaignModel } from "../../models/FlowCampaign";
import { WebhookModel } from "../../models/Webhook";
import { randomString } from "../../utils/randomCode";

interface Request {
  userId: number;
  name: string;
  companyId: number
  flowId: number;
  phrase: string;
  whatsappId?: number | string | null;
}

const CreateFlowCampaignService = async ({
  userId,
  name,
  companyId,
  phrase,
  whatsappId,
  flowId
}: Request): Promise<FlowCampaignModel> => {
  try {
    const normalizedWhatsappId =
      whatsappId !== undefined && whatsappId !== null && whatsappId !== ""
        ? Number(whatsappId)
        : null;

    const flow = await FlowCampaignModel.create({
      userId: userId,
      companyId: companyId,
      name: name,
      phrase: phrase,
      flowId: flowId,
      whatsappId: normalizedWhatsappId
    });

    return flow;
  } catch (error) {
    console.error("Erro ao inserir o usuário:", error);

    return error
  }
};

export default CreateFlowCampaignService;
