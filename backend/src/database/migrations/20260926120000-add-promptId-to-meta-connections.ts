import { QueryInterface, DataTypes } from "sequelize";

// Agente de IA do Instagram/Facebook: prompt (tela /prompts) que responde
// automaticamente as mensagens recebidas pela conexão Meta. É copiado para as
// conexões "sombra" (Whatsapps channel=instagram/facebook) no sync da conexão.
// Ver docs/MANUAL_TECNICO.md, seção 68.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("MetaConnections", "promptId", {
      type: DataTypes.INTEGER,
      references: { model: "Prompts", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      allowNull: true
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("MetaConnections", "promptId");
  }
};
