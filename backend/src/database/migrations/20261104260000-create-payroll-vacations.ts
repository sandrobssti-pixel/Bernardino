import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Férias GOZADAS (RH, v2.3.254) — registro POR PERÍODO AQUISITIVO
// (não mensal, nem único por funcionário — um funcionário acumula um
// registro por ciclo de 12 meses, ver PayrollCalculationService.
// calculateVacation e docs/MANUAL_TECNICO.md seção 227). Índice único
// employeeId+periodNumber: recalcular o mesmo período faz upsert, não
// duplica. Sem fracionamento nesta versão — um único gozo cobre o
// período inteiro (dias gozados + dias vendidos somam sempre os 30
// dias de direito assumidos, já que o sistema não rastreia faltas).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "PayrollVacations";
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

      // N-ésimo período aquisitivo (1-based) desde a admissão.
      periodNumber: { type: DataTypes.INTEGER, allowNull: false },
      periodStart: { type: DataTypes.DATEONLY, allowNull: true },
      periodEnd: { type: DataTypes.DATEONLY, allowNull: true },

      // Simplificação documentada: sempre 30 (não rastreia faltas
      // injustificadas / escala de redução do art. 130 da CLT).
      daysEntitled: { type: DataTypes.INTEGER, allowNull: true },
      daysTaken: { type: DataTypes.INTEGER, allowNull: true },
      daysSold: { type: DataTypes.INTEGER, allowNull: true },
      vacationStartDate: { type: DataTypes.DATEONLY, allowNull: true },
      vacationEndDate: { type: DataTypes.DATEONLY, allowNull: true },

      grossSalarySnapshot: { type: DataTypes.DECIMAL(12, 2), allowNull: true },

      // Dias efetivamente gozados + 1/3 — SOFREM INSS/IRRF (diferente
      // da férias proporcional da Rescisão, que é indenizatória e
      // isenta).
      vacationGrossValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      vacationBonusValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },

      // Abono pecuniário (venda de até 1/3): o valor vendido é isento
      // de INSS/IRRF; o 1/3 sobre o abono é isento de INSS (prática
      // majoritária) mas sofre IRRF pela Solução de Consulta COSIT
      // 209/2021 — por isso soldBonusValue entra na base do IRRF
      // calculado abaixo, mas não na do INSS.
      soldValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      soldBonusValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },

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
      irrfReductionValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      irrfTableId: {
        type: DataTypes.INTEGER,
        references: { model: "PayrollIrrfTables", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },

      netValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },

      calculatedAt: { type: DataTypes.DATE(6), allowNull: false },
      createdAt: { type: DataTypes.DATE(6), allowNull: false },
      updatedAt: { type: DataTypes.DATE(6), allowNull: false }
    });

    await queryInterface.addIndex(table, ["employeeId", "periodNumber"], {
      unique: true,
      name: "payroll_vacations_employee_period_unique"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("PayrollVacations");
  }
};
