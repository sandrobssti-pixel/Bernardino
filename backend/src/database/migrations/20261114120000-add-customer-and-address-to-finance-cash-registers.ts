import { QueryInterface, DataTypes } from "sequelize";

// "Caixa Registradora" virou um mini frente de caixa (pedido do cliente,
// v2.3.292): cada lançamento agora também guarda quem foi atendido
// (nome/CPF) e o endereço completo — mesmos nomes de coluna já usados em
// FinanceCustomer (zipCode/street/number/complement/neighborhood/city/
// state), pra manter consistência com o resto do Financeiro.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      // Cadastro de cliente único (pedido do cliente: "o cadastro do
      // cliente continuar sendo único, ao digitar o nome ou cpf já
      // preenche todos os campo igual a vendas") — liga no MESMO
      // cadastro de FinanceCustomer já usado em Vendas/Contas a
      // Receber, nunca duplica um cadastro à parte. Opcional (nem todo
      // lançamento tem um cliente cadastrado — ex.: venda avulsa em
      // dinheiro, sem identificação).
      queryInterface.addColumn("FinanceCashRegisters", "customerId", {
        type: DataTypes.INTEGER,
        references: { model: "FinanceCustomers", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      }),
      queryInterface.addColumn("FinanceCashRegisters", "name", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: ""
      }),
      queryInterface.addColumn("FinanceCashRegisters", "document", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: ""
      }),
      queryInterface.addColumn("FinanceCashRegisters", "zipCode", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: ""
      }),
      queryInterface.addColumn("FinanceCashRegisters", "street", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: ""
      }),
      queryInterface.addColumn("FinanceCashRegisters", "number", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: ""
      }),
      queryInterface.addColumn("FinanceCashRegisters", "complement", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: ""
      }),
      queryInterface.addColumn("FinanceCashRegisters", "neighborhood", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: ""
      }),
      queryInterface.addColumn("FinanceCashRegisters", "city", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: ""
      }),
      queryInterface.addColumn("FinanceCashRegisters", "state", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: ""
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("FinanceCashRegisters", "customerId"),
      queryInterface.removeColumn("FinanceCashRegisters", "name"),
      queryInterface.removeColumn("FinanceCashRegisters", "document"),
      queryInterface.removeColumn("FinanceCashRegisters", "zipCode"),
      queryInterface.removeColumn("FinanceCashRegisters", "street"),
      queryInterface.removeColumn("FinanceCashRegisters", "number"),
      queryInterface.removeColumn("FinanceCashRegisters", "complement"),
      queryInterface.removeColumn("FinanceCashRegisters", "neighborhood"),
      queryInterface.removeColumn("FinanceCashRegisters", "city"),
      queryInterface.removeColumn("FinanceCashRegisters", "state")
    ]);
  }
};
