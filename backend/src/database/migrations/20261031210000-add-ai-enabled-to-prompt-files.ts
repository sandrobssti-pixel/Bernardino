import { QueryInterface, DataTypes } from "sequelize";

// v2.3.228 — botão dedicado "a IA envia esse arquivo automaticamente?"
// em Arquivos da IA (verde = ligado, cinza = desligado), independente
// de "Permitir visão"/"Permitir editar" da Mensagem Rápida de origem
// (esses dois só controlam se o item ENTRA no catálogo — nunca houve um
// jeito de desativar um item específico sem removê-lo do catálogo).
// Default `true` preserva o comportamento atual de todo item já
// cadastrado (nada deixa de ser enviado pela IA só por causa desta
// migration). Ver OpenAiService.ts (filtro do fileCatalog).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = await queryInterface.describeTable("PromptFiles");
    if (table["aiEnabled"]) return;

    await queryInterface.addColumn("PromptFiles", "aiEnabled", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("PromptFiles", "aiEnabled");
  }
};
