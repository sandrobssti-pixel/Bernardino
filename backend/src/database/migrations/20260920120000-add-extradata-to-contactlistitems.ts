import { QueryInterface, DataTypes } from "sequelize";

// Guarda, em JSON, todas as colunas extras de uma planilha importada que não
// são nome/número/e-mail (ex.: cpf, vigência, mês, status) — uso só interno
// (visualização/organização da lista), nunca vai pra campanha (a campanha só
// usa o número de WhatsApp normalizado). Ver docs/MANUAL_TECNICO.md.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("ContactListItems", "extraData", {
      type: DataTypes.JSON,
      allowNull: true
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("ContactListItems", "extraData");
  }
};
