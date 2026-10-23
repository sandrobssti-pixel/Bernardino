import { QueryInterface, DataTypes } from "sequelize";

// Despachante Bélico (gestão de processo CAC/Sigma e Posse/Porte/Sinarm) é
// um add-on separado, mesmo padrão de `useFiscal`/`usePayment`/
// `useFlowbuilder` — o Master decide, por plano, se o cliente paga por
// esse módulo. Ver docs/MANUAL_TECNICO.md.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Plans", "useWeaponDispatch", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Plans", "useWeaponDispatch");
  }
};
