import { WebhookModel } from "../../models/Webhook";
import User from "../../models/User";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import { decryptFlowNodesApiKeys } from "../../helpers/flowBuilderApiKeyCrypto";

interface Request {
  companyId: number;
  idFlow: number
}

interface Response {
  flow: FlowBuilderModel
}

const GetFlowBuilderService = async ({
  companyId,
  idFlow
}: Request): Promise<Response> => {
  
    try {
    
        // Realiza a consulta com paginação usando findAndCountAll
        const { count, rows } = await FlowBuilderModel.findAndCountAll({
          where: {
            company_id: companyId,
            id: idFlow
          }
        });
        let flow = rows[0]

        // v2.3.197 — devolve a API key dos nós "openai" já decifrada
        // (tela do editor precisa mostrar o valor real, não o texto
        // cifrado) — ver flowBuilderApiKeyCrypto.ts.
        if (flow?.flow && (flow.flow as any).nodes) {
          (flow.flow as any).nodes = decryptFlowNodesApiKeys((flow.flow as any).nodes);
        }

        return {
            flow: flow
        }
      } catch (error) {
        console.error('Erro ao consultar usuários:', error);
      }
};

export default GetFlowBuilderService;
