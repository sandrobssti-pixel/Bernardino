import { QueryInterface, DataTypes } from "sequelize";

/**
 * Adiciona lid/jid (opcionais) em ContactListItems, espelhando as colunas já
 * existentes em Contacts/Tickets, para permitir que campanhas resolvam o
 * destino de envio via lid/jid quando o "number" não for suficiente
 * (ex.: contato conhecido apenas por LID).
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDesc: any = await queryInterface.describeTable("ContactListItems");

    if (!tableDesc.lid) {
      await queryInterface.addColumn("ContactListItems", "lid", {
        type: DataTypes.STRING,
        allowNull: true
      });
    }

    if (!tableDesc.jid) {
      await queryInterface.addColumn("ContactListItems", "jid", {
        type: DataTypes.STRING,
        allowNull: true
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const tableDesc: any = await queryInterface.describeTable("ContactListItems");
    if (tableDesc.lid) {
      await queryInterface.removeColumn("ContactListItems", "lid");
    }
    if (tableDesc.jid) {
      await queryInterface.removeColumn("ContactListItems", "jid");
    }
  }
};
