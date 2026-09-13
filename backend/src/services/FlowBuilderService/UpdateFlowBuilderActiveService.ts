import AppError from "../../errors/AppError";
import { FlowBuilderModel } from "../../models/FlowBuilder";

interface Request {
  companyId: number;
  flowId: number;
  active: boolean;
}

const UpdateFlowBuilderActiveService = async ({
  companyId,
  flowId,
  active
}: Request): Promise<FlowBuilderModel> => {
  const flow = await FlowBuilderModel.findOne({
    where: {
      id: flowId,
      company_id: companyId
    }
  });

  if (!flow) {
    throw new AppError("Fluxo não encontrado", 404);
  }

  await flow.update({ active });

  return flow;
};

export default UpdateFlowBuilderActiveService;
