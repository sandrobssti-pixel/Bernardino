import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Folha de pró-labore dos Sócios (RH, v2.3.249) — mesmo espírito de
// `PayrollEntries` (snapshot por competência, upsert por
// partnerId+mês+ano), mas em tabela PRÓPRIA em vez de reaproveitar
// `PayrollEntries`: sócio não é Funcionário (sem `workRegime`, sem
// FGTS, sem desconto de VT, INSS com fórmula diferente — ver
// PayrollCalculationService.calculatePartnerPayroll), misturar os dois
// na mesma tabela exigiria `employeeId` virar nullable e uma coluna a
// mais só pra dizer "é funcionário ou sócio", sem ganho real. Mesma
// decisão de manter Employee/CompanyPartner em tabelas separadas (ver
// seção 218 do manual técnico).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "PayrollPartnerEntries";
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
      partnerId: {
        type: DataTypes.INTEGER,
        references: { model: "CompanyPartners", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      competencyMonth: { type: DataTypes.INTEGER, allowNull: false },
      competencyYear: { type: DataTypes.INTEGER, allowNull: false },

      // Snapshot do pró-labore no momento do cálculo.
      prolaboreSnapshot: { type: DataTypes.DECIMAL(12, 2), allowNull: true },

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

    await queryInterface.addIndex(table, ["partnerId", "competencyMonth", "competencyYear"], {
      unique: true,
      name: "payroll_partner_entries_partner_competency_unique"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("PayrollPartnerEntries");
  }
};
