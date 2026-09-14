import { QueryInterface, DataTypes } from "sequelize";

// Módulo fiscal (Vendas com itens, NF-e/NFC-e/NFS-e — Fase 3 do roadmap, ver
// docs/MANUAL_TECNICO.md, seção 6.2) é um add-on separado, além do módulo
// Financeiro (`useFinancial`). O Master decide, por plano, se ele inclui o
// fiscal — permite vender um plano com Financeiro mas sem Fiscal (ou
// vice-versa não faz sentido: fiscal sempre exige Financeiro ativo também,
// checado em EnsureFiscalAccess).
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Plans", "useFiscal", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Plans", "useFiscal");
  }
};
