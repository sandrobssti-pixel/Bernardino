import { FlowBuilderModel } from "../../models/FlowBuilder";
import { WebhookModel } from "../../models/Webhook";
import { randomString } from "../../utils/randomCode";
import { encryptFlowNodesApiKeys } from "../../helpers/flowBuilderApiKeyCrypto";

interface node {
    id: string,
    position: { x: number, y: number },
    data: { 
        label: string
        sec?: number
        title?: string
        text?: string
    },
    type: string,
    style: { backgroundColor: string, color: string }
}

interface body {
    nodes : node
    idFlow: number
    connections: any
    settings?: any
}


interface Request {
  companyId: number;
  bodyData: body;
}

const FlowUpdateDataService = async ({
  companyId,
  bodyData
}: Request): Promise<String> => {
  try {
    const currentFlow = await FlowBuilderModel.findOne({
      where: { id: bodyData.idFlow, company_id: companyId }
    });

    const currentSettings = (currentFlow?.flow as any)?.settings || null;

    // v2.3.197 — cifra a API key de qualquer nó "openai" antes de gravar
    // (ver flowBuilderApiKeyCrypto.ts) — o editor manda a API key em
    // texto puro (ele não sabe nada sobre cifra), só o backend cifra na
    // hora de salvar, igual já acontece com a tabela Prompts.
    const flow = await FlowBuilderModel.update({
        flow: {
            nodes: encryptFlowNodesApiKeys(bodyData.nodes),
            connections: bodyData.connections,
            settings: bodyData.settings ?? currentSettings
        }
    },{
      where: {id: bodyData.idFlow, company_id: companyId}
    });

    return 'ok';
  } catch (error) {
    console.error("Erro ao inserir o usuário:", error);

    return error
  }
};

export default FlowUpdateDataService;
