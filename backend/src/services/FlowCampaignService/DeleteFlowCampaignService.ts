import AppError from "../../errors/AppError";
import { FlowCampaignModel } from "../../models/FlowCampaign";

interface Request {
  id: number;
  companyId: number;
}

const DeleteFlowCampaignService = async ({
  id,
  companyId
}: Request): Promise<FlowCampaignModel> => {
  const flow = await FlowCampaignModel.findOne({
    where: {
      id,
      companyId
    }
  });

  if (!flow) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  await flow.destroy();

  return flow;
};

export default DeleteFlowCampaignService;
