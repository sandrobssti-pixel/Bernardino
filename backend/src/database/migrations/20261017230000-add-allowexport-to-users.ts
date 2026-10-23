import { QueryInterface, DataTypes } from "sequelize";

// Permissão nova, separada de `allowImport` (migration anterior) — pedido
// do cliente: imprimir/exportar PDF/Excel das listas do Financeiro é uma
// ação diferente de importar planilha (só lê dado já carregado na tela,
// não grava nada), então tem seu próprio toggle em vez de reusar o mesmo.
// Admin/Master sempre tem acesso, independente desse campo. Diferente de
// `allowImport`, essa permissão não precisa de checagem no backend — é
// 100% client-side (window.print()/XLSX direto no navegador, sem endpoint
// novo), então só é lida pelo frontend pra decidir se mostra os botões.
// Ver docs/MANUAL_TECNICO.md.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Users", "allowExport", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "disabled"
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Users", "allowExport");
  }
};
