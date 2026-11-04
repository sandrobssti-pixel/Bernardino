import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Folha Mensal (RH — Fase 2, ver docs/MANUAL_TECNICO.md) — um registro
// persistido por funcionário/competência (mês/ano), resultado do cálculo
// de INSS/IRRF/FGTS/VT (ver PayrollCalculationService). Guarda um
// SNAPSHOT dos dados usados no cálculo (salário, regime, nº de
// dependentes) — o cadastro do funcionário pode mudar depois sem afetar
// folhas já calculadas. `inssTableId`/`irrfTableId` guardam qual versão
// da tabela foi usada, pra rastreabilidade/auditoria.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "PayrollEntries";
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
      competencyMonth: { type: DataTypes.INTEGER, allowNull: false },
      competencyYear: { type: DataTypes.INTEGER, allowNull: false },

      // Snapshot do funcionário no momento do cálculo.
      workRegimeSnapshot: { type: DataTypes.STRING, allowNull: false },
      grossSalarySnapshot: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      dependentsCountSnapshot: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

      inssBase: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      inssValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      inssTableId: {
        type: DataTypes.INTEGER,
        references: { model: "PayrollInssTables", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },

      irrfBase: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      irrfValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      irrfTableId: {
        type: DataTypes.INTEGER,
        references: { model: "PayrollIrrfTables", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },

      fgtsValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      vtDiscount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      netSalary: { type: DataTypes.DECIMAL(12, 2), allowNull: true },

      calculatedAt: { type: DataTypes.DATE(6), allowNull: false },
      createdAt: { type: DataTypes.DATE(6), allowNull: false },
      updatedAt: { type: DataTypes.DATE(6), allowNull: false }
    });

    await queryInterface.addIndex(table, ["employeeId", "competencyMonth", "competencyYear"], {
      unique: true,
      name: "payroll_entries_employee_competency_unique"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("PayrollEntries");
  }
};
