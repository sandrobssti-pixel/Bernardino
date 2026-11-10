import { QueryInterface, DataTypes } from "sequelize";

// Campo opcional, SEPARADO do "category" livre (que continua genérico,
// pra qualquer tipo de clube/associação) — classificação legal CAC
// (Colecionador/Atirador/Caçador) definida no Decreto nº 11.615/2023,
// art. 2º, incisos XVII a XIX e XXV, e no Decreto nº 12.345/2024, art.
// 2º, inciso XXXVI (Atirador Desportivo de Alto Rendimento). Ver
// docs/MANUAL_TECNICO.md.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    // Default "none" (não "" vazio) de propósito: um <select> do MUI com
    // valor "" selecionado tem um bug de exibição já batido neste projeto
    // (FinanceRecordList, seção 236 do manual) — evitado aqui simplesmente
    // nunca usando "" como valor de verdade armazenado.
    return queryInterface.addColumn("Members", "cacCategory", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "none"
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Members", "cacCategory");
  }
};
