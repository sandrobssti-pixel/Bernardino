import { QueryInterface, DataTypes } from "sequelize";

// Permite que o Admin de uma empresa conceda/revogue, usuário a usuário, o
// acesso ao módulo Vendas — INDEPENDENTE do Financeiro (financialAccess
// continua dando acesso a Vendas também, por compatibilidade com quem já
// usa hoje; salesAccess é um caminho A MAIS, só pra quem precisa de Vendas
// sem o resto do Financeiro). Só tem efeito quando o plano da empresa
// inclui o módulo fiscal (Plan.useFinancial + Plan.useFiscal). Mesmo
// padrão de financialAccess/hrAccess. Ver EnsureFiscalAccess.ts e
// docs/MANUAL_TECNICO.md.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Users", "salesAccess", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Users", "salesAccess");
  }
};
