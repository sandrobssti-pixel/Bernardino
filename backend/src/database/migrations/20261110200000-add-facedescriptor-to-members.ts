import { QueryInterface, DataTypes } from "sequelize";

// Descritor facial (128 números, JSON-stringificado) calculado no
// NAVEGADOR (face-api.js) a partir da foto já cadastrada — o backend
// nunca processa imagem, só guarda/compara os números. Ver
// docs/MANUAL_TECNICO.md.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Members", "faceDescriptor", {
      type: DataTypes.TEXT,
      allowNull: true
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Members", "faceDescriptor");
  }
};
