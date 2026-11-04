import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Dependentes do Funcionário (RH — Fase 2, ver docs/MANUAL_TECNICO.md) —
// cadastro completo (não só contador), usado pra dedução do IRRF
// (R$ por dependente × quantidade) e informativo de RH em geral.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "EmployeeDependents";
    const existingTables: ExistingTables = await queryInterface.showAllTables();
    if (existingTables.includes(table)) return;

    await queryInterface.createTable(table, {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      employeeId: {
        type: DataTypes.INTEGER,
        references: { model: "Employees", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      name: { type: DataTypes.STRING, allowNull: false },
      cpf: { type: DataTypes.STRING, allowNull: true },
      birthDate: { type: DataTypes.DATEONLY, allowNull: true },
      createdAt: { type: DataTypes.DATE(6), allowNull: false },
      updatedAt: { type: DataTypes.DATE(6), allowNull: false }
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("EmployeeDependents");
  }
};
