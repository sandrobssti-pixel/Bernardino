import { QueryInterface, DataTypes } from "sequelize";

// Guarda o valor da redução da Lei 15.270/2025 separado do IRRF final
// (RH, ver docs/MANUAL_TECNICO.md seção 219) — transparência/auditoria:
// dá pra ver quanto foi IRRF "cheio" pela tabela tradicional e quanto
// foi abatido pelo redutor, em vez de só o valor final já líquido.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = await queryInterface.describeTable("PayrollEntries");
    if ((table as any).irrfReductionValue) return;

    await queryInterface.addColumn("PayrollEntries", "irrfReductionValue", {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("PayrollEntries", "irrfReductionValue");
  }
};
