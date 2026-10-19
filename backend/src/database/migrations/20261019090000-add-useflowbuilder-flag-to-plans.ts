import { QueryInterface, DataTypes } from "sequelize";

// Flowbuilder (criar/editar fluxo de automação) é um add-on separado, mesmo
// padrão de `useFiscal`/`usePayment` — o Master decide, por plano, se o
// cliente paga por esse módulo. IMPORTANTE: isso trava só a TELA/API de
// criar e editar fluxo (`flowBuilderRoutes.ts`, ver EnsureFlowbuilderAccess)
// — a EXECUÇÃO de um fluxo já configurado continua rodando normalmente pra
// qualquer empresa, mesmo sem esse add-on, porque `wbotMessageListener.ts`
// (e os listeners equivalentes de Facebook/Instagram/Webchat/API Oficial)
// leem `FlowBuilderModel`/`FlowCampaignModel`/`FlowDefaultModel` direto do
// banco, sem passar por essas rotas — confirmado antes de implementar,
// porque desligar a execução quebraria resposta automática/mensagem de
// boas-vindas de quem já tem fluxo configurado (`Whatsapp.flowIdWelcome`/
// `flowIdNotPhrase`). Ver docs/MANUAL_TECNICO.md.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Plans", "useFlowbuilder", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Plans", "useFlowbuilder");
  }
};
