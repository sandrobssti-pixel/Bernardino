import { QueryInterface } from "sequelize";

// Migração de DADOS (v2.3.197) — cifra a API key de todo nó "openai" já
// salvo dentro de um fluxo do FlowBuilder (`FlowBuilders.flow.nodes[].
// data.typebotIntegration.apiKey`), mesma cópia embutida que o editor e
// a execução em tempo real passam a cifrar/decifrar a partir de agora
// (ver flowBuilderApiKeyCrypto.ts e FlowUpdateDataService.ts/
// GetFlowBuilderService.ts/wbotMessageListener.ts/ActionsWebhookService.ts).
// Idempotente — `encryptFlowNodesApiKeys` não mexe num valor que já
// estiver cifrado (mesmo `isEncryptedApiKey` usado em
// promptApiKeyCrypto.ts), rodar de novo não corrompe nada.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { encryptFlowNodesApiKeys } = require("../../helpers/flowBuilderApiKeyCrypto");

    const [rows] = await queryInterface.sequelize.query(
      `SELECT id, flow FROM "FlowBuilders" WHERE flow IS NOT NULL`
    );

    for (const row of rows as Array<{ id: number; flow: any }>) {
      const flow = row.flow;
      if (!flow || !Array.isArray(flow.nodes)) continue;

      const encryptedNodes = encryptFlowNodesApiKeys(flow.nodes);
      // Só grava de novo se alguma API key realmente mudou (evita UPDATE
      // desnecessário em fluxo sem nó de IA nenhum).
      if (JSON.stringify(encryptedNodes) === JSON.stringify(flow.nodes)) continue;

      const updatedFlow = { ...flow, nodes: encryptedNodes };
      await queryInterface.sequelize.query(
        `UPDATE "FlowBuilders" SET flow = :flow WHERE id = :id`,
        { replacements: { flow: JSON.stringify(updatedFlow), id: row.id } }
      );
    }
  },
  down: async () => {
    // Não desfaz — mesma lógica da migration irmã (encrypt-existing-
    // prompt-api-keys): decifrar em massa de volta reintroduziria o
    // problema. O sistema já decifra sozinho ao carregar/usar.
  }
};
