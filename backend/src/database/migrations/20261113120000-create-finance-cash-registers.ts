import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// "Caixa Registradora" — pedido do cliente: lembrete de valores físicos
// dentro da empresa (dinheiro em espécie, promissórias, cheques), SEM
// nenhum vínculo com o resto do Financeiro (não vira Conta a Pagar/
// Receber sozinho — se o valor for usado, o usuário cadastra a Conta a
// Pagar manualmente e remove esta linha). Ver docs/MANUAL_TECNICO.md.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "FinanceCashRegisters";
    const existingTables: ExistingTables = await queryInterface.showAllTables();

    if (!existingTables.includes(table)) {
      return queryInterface.createTable(table, {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        type: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "physical_cash"
        },
        value: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "0"
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: false,
          defaultValue: ""
        },
        companyId: {
          type: DataTypes.INTEGER,
          references: { model: "Companies", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          allowNull: false
        },
        createdAt: {
          type: DataTypes.DATE(6),
          allowNull: false
        },
        updatedAt: {
          type: DataTypes.DATE(6),
          allowNull: false
        }
      });
    }
  },
  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("FinanceCashRegisters");
  }
};
