import { QueryInterface, DataTypes } from "sequelize";

// Logo da empresa-cliente, usada no cabeçalho de relatórios impressos
// (ex.: Termo de Cautela do Serviço Armaria) — nunca hardcoded no código,
// porque o AtendeFlow é vendido pra várias empresas-cliente diferentes.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Companies", "logoUrl", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: ""
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Companies", "logoUrl");
  }
};
