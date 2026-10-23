import { QueryInterface, DataTypes } from "sequelize";

// v2.3.198 — prepara PromptFiles (catálogo "Arquivos da IA") pra poder
// espelhar Mensagens Rápidas "geral": path vira opcional (item de texto
// puro não tem arquivo físico), textContent guarda esse texto, e
// sourceQuickMessageId amarra o item à mensagem rápida de origem (pra
// sincronização ficar idempotente e saber o que é espelho x cadastro
// manual). Ver quickMessagePromptFileSync.ts / SyncFromQuickMessageService.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.changeColumn("PromptFiles", "path", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await queryInterface.addColumn("PromptFiles", "textContent", {
      type: DataTypes.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn("PromptFiles", "sourceQuickMessageId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "QuickMessages", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("PromptFiles", "sourceQuickMessageId");
    await queryInterface.removeColumn("PromptFiles", "textContent");
  }
};
