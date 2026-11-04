import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Rescisão de Contrato / Verbas Rescisórias (RH, v2.3.253) — UM
// registro por funcionário (não recorrente como PayrollEntry) — o
// momento único de desligamento. Ver
// PayrollCalculationService.calculateTermination e
// docs/MANUAL_TECNICO.md seção 226 pro raciocínio completo. Calcular
// a rescisão também atualiza `Employee.terminationDate`/
// `contractStatus` — é o ato que registra oficialmente o
// desligamento, não uma simulação separada.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "PayrollTerminations";
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

      // "resignation" | "dismissal_without_cause" | "dismissal_with_cause" | "mutual_agreement"
      terminationType: { type: DataTypes.STRING, allowNull: false },
      terminationDate: { type: DataTypes.DATEONLY, allowNull: false },
      // Aviso prévio foi efetivamente TRABALHADO (não indenizado) —
      // nesse caso `noticeValue` fica 0 (já coberto pelo salário normal
      // desses dias, fora do escopo da rescisão).
      noticeWorked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      yearsOfService: { type: DataTypes.INTEGER, allowNull: true },

      balanceSalaryDays: { type: DataTypes.INTEGER, allowNull: true },
      balanceSalaryGross: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      balanceSalaryInss: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      balanceSalaryIrrf: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      balanceSalaryIrrfReduction: { type: DataTypes.DECIMAL(12, 2), allowNull: true },

      noticeDays: { type: DataTypes.DECIMAL(5, 1), allowNull: true },
      noticeValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },

      thirteenthMonthsWorked: { type: DataTypes.INTEGER, allowNull: true },
      thirteenthGrossValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      thirteenthInssValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      thirteenthIrrfValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      thirteenthIrrfReductionValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },

      vacationMonthsWorked: { type: DataTypes.INTEGER, allowNull: true },
      vacationGrossValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      vacationBonusValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },

      // Saldo de FGTS — sugerido (soma do que o PRÓPRIO sistema já
      // calculou ao longo do vínculo) vs. usado de fato no cálculo da
      // multa (editável — ver comentário em
      // PayrollCalculationService.ts sobre a limitação de não ter o
      // extrato oficial da Caixa).
      fgtsSystemCalculatedBalance: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      fgtsBalanceUsed: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      fgtsFineRate: { type: DataTypes.DECIMAL(4, 2), allowNull: true },
      fgtsFineValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },

      netValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },

      calculatedAt: { type: DataTypes.DATE(6), allowNull: false },
      createdAt: { type: DataTypes.DATE(6), allowNull: false },
      updatedAt: { type: DataTypes.DATE(6), allowNull: false }
    });

    await queryInterface.addIndex(table, ["employeeId"], {
      unique: true,
      name: "payroll_terminations_employee_unique"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("PayrollTerminations");
  }
};
