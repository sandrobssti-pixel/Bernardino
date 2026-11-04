import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// 13º Salário (RH, v2.3.252) — registro ANUAL (não mensal, diferente
// de PayrollEntry) por funcionário/ano, resultado do cálculo de
// INSS/IRRF/FGTS sobre a gratificação natalina (ver
// PayrollCalculationService.calculate13thSalary). Só CLT/Menor
// Aprendiz (PJ/Estagiário não têm 13º). Guarda SNAPSHOT dos dados
// usados no cálculo (`grossValue`, `monthsWorked`) — o cadastro do
// funcionário pode mudar depois sem afetar 13ºs já calculados.
// Recalcular o mesmo ano faz UPSERT (índice único
// employeeId+year), não duplica.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "Payroll13thSalaries";
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
      year: { type: DataTypes.INTEGER, allowNull: false },

      // Avos (meses trabalhados no ano, fração >=15 dias conta como mês
      // integral — CLT art. 487 §1º/Lei 4.090/1962) e o salário usado na
      // conta — snapshot, não recalcula sozinho se o cadastro mudar.
      monthsWorked: { type: DataTypes.INTEGER, allowNull: false },
      grossSalarySnapshot: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      grossValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },

      // 1ª parcela (até 30/11): metade do valor bruto, SEM desconto.
      // 2ª parcela (até 20/12): o restante, COM INSS/IRRF já descontados.
      firstInstallmentValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      secondInstallmentValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },

      // INSS/IRRF incidem sobre o valor INTEGRAL do 13º (não fracionado
      // entre as parcelas), calculados SEPARADOS do salário mensal
      // normal — tributação exclusiva na fonte.
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

      fgtsValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      netValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },

      calculatedAt: { type: DataTypes.DATE(6), allowNull: false },
      createdAt: { type: DataTypes.DATE(6), allowNull: false },
      updatedAt: { type: DataTypes.DATE(6), allowNull: false }
    });

    await queryInterface.addIndex(table, ["employeeId", "year"], {
      unique: true,
      name: "payroll_13th_salaries_employee_year_unique"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("Payroll13thSalaries");
  }
};
