import { QueryInterface, DataTypes } from "sequelize";

// Cobrança de filiação/anuidade do associado — "etiqueta" em cima de um
// FinanceReceivable já existente do módulo Financeiro (reaproveitado
// por pedido do cliente), guardando o período que essa cobrança
// específica cobre ("Cobre o período de X até Y", tela de referência).
// Quando o FinanceReceivable vinculado fica "received", um hook
// (FinanceReceivable.ts) estende Member.filiationValidUntil até
// "coverageEnd" desta linha. Ver docs/MANUAL_TECNICO.md.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("MemberMembershipCharges", {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      memberId: {
        type: DataTypes.INTEGER,
        references: { model: "Members", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      receivableId: {
        type: DataTypes.INTEGER,
        references: { model: "FinanceReceivables", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      periodMonths: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 12
      },
      coverageStart: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      coverageEnd: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("MemberMembershipCharges");
  }
};
