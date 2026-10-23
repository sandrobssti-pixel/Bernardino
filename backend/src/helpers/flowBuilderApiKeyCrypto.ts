import { encryptApiKey, decryptApiKey } from "../utils/promptApiKeyCrypto";

// v2.3.197 — o FlowBuilder guarda uma CÓPIA própria da configuração do
// Assistente IA (incluindo a API key) dentro do JSON de cada nó "openai"
// de um fluxo salvo (`node.data.typebotIntegration.apiKey`), separada da
// tabela `Prompts` (que já ficou cifrada na v2.3.196, ver
// promptApiKeyCrypto.ts). Esse helper aplica a mesma cifra/decifra em
// TODOS os nós de um fluxo de uma vez, reaproveitando as mesmas funções
// — um valor já cifrado passando de novo por `encryptApiKey` não é
// cifrado de novo (ver `isEncryptedApiKey`), e um valor em texto puro
// passando por `decryptApiKey` não quebra (devolve como está) — seguro
// de rodar em fluxos salvos antes dessa mudança, sem migration de dados
// separada pro FlowBuilder (diferente da tabela Prompts): cada fluxo só
// fica cifrado na próxima vez que for salvo pela tela.
const transformNodesApiKeys = (nodes: unknown, transform: (apiKey: string) => string): unknown => {
  if (!Array.isArray(nodes)) return nodes;

  return nodes.map((node: any) => {
    const apiKey = node?.data?.typebotIntegration?.apiKey;
    if (!apiKey || typeof apiKey !== "string") return node;

    return {
      ...node,
      data: {
        ...node.data,
        typebotIntegration: {
          ...node.data.typebotIntegration,
          apiKey: transform(apiKey)
        }
      }
    };
  });
};

export const encryptFlowNodesApiKeys = (nodes: unknown): unknown =>
  transformNodesApiKeys(nodes, encryptApiKey);

export const decryptFlowNodesApiKeys = (nodes: unknown): unknown =>
  transformNodesApiKeys(nodes, decryptApiKey);
