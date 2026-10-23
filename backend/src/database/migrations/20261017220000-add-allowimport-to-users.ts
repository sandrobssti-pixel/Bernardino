import { QueryInterface, DataTypes } from "sequelize";

// Permissão nova (pedido do cliente): usuário comum ("user") não vê/consegue
// usar nenhum botão "Importar planilha" do sistema (Clientes/Fornecedores/
// Produtos no Financeiro, Vendas) a menos que essa permissão seja ligada
// explicitamente no cadastro dele — mesmo padrão já usado pra
// allowConnections/allowRealTime/showDashboard (string "enabled"/"disabled",
// não booleano). Admin sempre tem acesso, independente desse campo — ver
// `isAuth.ts`/controllers de importação. Ver docs/MANUAL_TECNICO.md.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Users", "allowImport", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "disabled"
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Users", "allowImport");
  }
};
