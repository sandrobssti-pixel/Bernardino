import { QueryInterface, DataTypes } from "sequelize";

// Redutor adicional de IRRF da Lei 15.270/2025 (RH, ver
// docs/MANUAL_TECNICO.md, seção 217/219) — em vigor desde janeiro/2026.
// Campos na MESMA tabela de IRRF (não uma tabela separada) porque o
// redutor é parte do mesmo cálculo mensal de IRRF e deve ser versionado
// junto com as faixas (se um dia a lei mudar os valores, cadastra-se uma
// nova versão de PayrollIrrfTable com faixas E redutor atualizados
// juntos).
//
// Mecanismo (confirmado contra fonte da Receita Federal — ver
// PayrollCalculationService.ts):
// - Rendimento BRUTO mensal (não a base já líquida de INSS) ≤
//   `lei15270Tier1Limit` (R$5.000,00): redução = min(IRRF pela tabela
//   tradicional, `lei15270MaxReduction` [R$312,89]).
// - Rendimento bruto entre `lei15270Tier1Limit` e `lei15270Tier2Limit`
//   (R$7.350,00): redução = min(IRRF pela tabela tradicional,
//   `lei15270FormulaConstant` [R$978,62] − `lei15270FormulaRate`
//   [0,133145] × rendimento bruto).
// - Acima de `lei15270Tier2Limit`: sem redução.
// - IRRF final = IRRF pela tabela tradicional − redução (nunca negativo).
//
// Valores DEFAULT aplicados automaticamente na versão de IRRF já
// existente (seed de 2026-01-01, v2.3.244) — não precisa de backfill
// manual.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = await queryInterface.describeTable("PayrollIrrfTables");

    const addColumnIfMissing = async (
      column: string,
      definition: Record<string, unknown>
    ): Promise<void> => {
      if (table[column]) return;
      await queryInterface.addColumn("PayrollIrrfTables", column, definition as any);
    };

    await addColumnIfMissing("lei15270Tier1Limit", {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 5000.0
    });
    await addColumnIfMissing("lei15270Tier2Limit", {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 7350.0
    });
    await addColumnIfMissing("lei15270MaxReduction", {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 312.89
    });
    await addColumnIfMissing("lei15270FormulaConstant", {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 978.62
    });
    await addColumnIfMissing("lei15270FormulaRate", {
      type: DataTypes.DECIMAL(10, 6),
      allowNull: false,
      defaultValue: 0.133145
    });
  },

  down: async (queryInterface: QueryInterface) => {
    const columns = [
      "lei15270Tier1Limit",
      "lei15270Tier2Limit",
      "lei15270MaxReduction",
      "lei15270FormulaConstant",
      "lei15270FormulaRate"
    ];
    for (const column of columns) {
      await queryInterface.removeColumn("PayrollIrrfTables", column);
    }
  }
};
