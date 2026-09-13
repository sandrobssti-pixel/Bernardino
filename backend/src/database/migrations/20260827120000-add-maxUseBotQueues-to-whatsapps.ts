import { QueryInterface, DataTypes } from "sequelize";

// Corrige uma inconsistência pré-existente: o modelo Whatsapp já declarava o
// campo "maxUseBotQueues" (@Default(3)), mas nenhuma migration criava essa
// coluna no banco — qualquer SELECT no modelo (ex.: ListWhatsAppsService,
// usado pela tela de Conexões e pelo boot do servidor) quebrava com
// "column Whatsapp.maxUseBotQueues does not exist".
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Whatsapps", "maxUseBotQueues", {
      type: DataTypes.INTEGER,
      defaultValue: 3,
      allowNull: false
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Whatsapps", "maxUseBotQueues");
  }
};
