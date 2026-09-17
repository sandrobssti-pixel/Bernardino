import { QueryInterface, DataTypes } from "sequelize";

// Cadastro obrigatório de cliente novo (ou que trocou de número) antes de
// fechar o atendimento — ver docs/MANUAL_TECNICO.md, seção 14.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Contacts", "document", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: ""
    });
    await queryInterface.addColumn("Contacts", "address", {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: ""
    });
    await queryInterface.addColumn("Contacts", "contact2", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: ""
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Contacts", "document");
    await queryInterface.removeColumn("Contacts", "address");
    await queryInterface.removeColumn("Contacts", "contact2");
  }
};
