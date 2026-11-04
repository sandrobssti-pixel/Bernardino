import { QueryInterface, DataTypes } from "sequelize";

// Benefícios (Plano de Saúde, Vale Alimentação, valor do Vale Refeição já
// existente) e Banco de Horas (RH — extensão da Fase 1, pedido do cliente).
// Só fazem sentido pra CLT/Menor Aprendiz — formulário decide a visibilidade
// (ver frontend/src/pages/Employees/employeeConfig.js), coluna fica
// allowNull pra qualquer regime. Idempotente via describeTable.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = await queryInterface.describeTable("Employees");

    const addColumnIfMissing = async (
      column: string,
      definition: Record<string, unknown>
    ): Promise<void> => {
      if (table[column]) return;
      await queryInterface.addColumn("Employees", column, definition as any);
    };

    await addColumnIfMissing("healthInsurance", {
      type: DataTypes.BOOLEAN,
      allowNull: true
    });
    await addColumnIfMissing("healthInsuranceValue", {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    });
    await addColumnIfMissing("foodVoucher", {
      type: DataTypes.BOOLEAN,
      allowNull: true
    });
    await addColumnIfMissing("foodVoucherValue", {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    });
    // Vale Refeição (mealVoucher) já existia como boolean desde a criação da
    // tabela (v2.3.242) — só o valor é novo.
    await addColumnIfMissing("mealVoucherValue", {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    });

    // Banco de horas — "hour_bank_paid" (remunerado) |
    // "hour_bank_time_off" (folga, não remunerado) | "paid_overtime"
    // (pagar hora extra direto, sem banco).
    await addColumnIfMissing("overtimePolicy", {
      type: DataTypes.STRING,
      allowNull: true
    });
    // Valor da hora extra (R$) — relevante quando a política envolve
    // dinheiro (hour_bank_paid ou paid_overtime).
    await addColumnIfMissing("overtimeHourValue", {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    });
    // Saldo atual do banco de horas (em horas) — relevante quando a
    // política é um banco de horas de verdade (hour_bank_paid ou
    // hour_bank_time_off).
    await addColumnIfMissing("overtimeHoursBalance", {
      type: DataTypes.DECIMAL(7, 2),
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    const columns = [
      "healthInsurance",
      "healthInsuranceValue",
      "foodVoucher",
      "foodVoucherValue",
      "mealVoucherValue",
      "overtimePolicy",
      "overtimeHourValue",
      "overtimeHoursBalance"
    ];
    for (const column of columns) {
      await queryInterface.removeColumn("Employees", column);
    }
  }
};
