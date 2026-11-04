import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Tabela de IRRF (RH — Fase 2, ver docs/MANUAL_TECNICO.md) — GLOBAL, sem
// companyId, versionada por `effectiveFrom`, mesmo espírito da tabela de
// INSS (ver 20261104150000-create-payroll-inss-tables.ts).
//
// Seed inicial: Receita Federal, tabela de incidência mensal vigente
// desde janeiro/2026. Base de cálculo = salário bruto − INSS descontado
// − (dependentDeductionValue × número de dependentes). Cálculo
// progressivo por faixa: imposto = base × alíquota − parcela a deduzir.
//
// LIMITAÇÃO CONHECIDA: a Lei 15.270/2025 criou um redutor adicional do
// IRRF pra quem ganha até R$7.350/mês (isenção efetiva até R$5.000,
// redução decrescente até R$7.350), em vigor desde janeiro/2026. Esse
// redutor NÃO está implementado aqui — a pesquisa encontrou divergência
// entre fontes secundárias sobre a base de cálculo exata usada pela
// fórmula (rendimento tributável do mês vs. base já líquida de INSS) e
// não foi possível confirmar contra o texto oficial da lei (planalto.gov.br
// bloqueado no ambiente de desenvolvimento). Implementar esse redutor
// exige antes confirmar o texto oficial (Lei 15.270/2025, que altera a
// Lei 9.250/1995) — até lá, o cálculo usa só a tabela progressiva
// tradicional abaixo, o que SUBESTIMA o líquido de quem ganha até
// R$7.350/mês (desconta IRRF a mais do que o devido por lei).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const existingTables: ExistingTables = await queryInterface.showAllTables();

    if (!existingTables.includes("PayrollIrrfTables")) {
      await queryInterface.createTable("PayrollIrrfTables", {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        effectiveFrom: { type: DataTypes.DATEONLY, allowNull: false },
        dependentDeductionValue: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
        sourceReference: { type: DataTypes.STRING, allowNull: true },
        createdAt: { type: DataTypes.DATE(6), allowNull: false },
        updatedAt: { type: DataTypes.DATE(6), allowNull: false }
      });
    }

    if (!existingTables.includes("PayrollIrrfBrackets")) {
      await queryInterface.createTable("PayrollIrrfBrackets", {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        irrfTableId: {
          type: DataTypes.INTEGER,
          references: { model: "PayrollIrrfTables", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          allowNull: false
        },
        minBase: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
        // NULL = sem limite superior (última faixa).
        maxBase: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
        rate: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
        deduction: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
        sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        createdAt: { type: DataTypes.DATE(6), allowNull: false },
        updatedAt: { type: DataTypes.DATE(6), allowNull: false }
      });
    }

    const [existingRows]: any = await queryInterface.sequelize.query(
      `SELECT id FROM "PayrollIrrfTables" LIMIT 1`
    );
    if (existingRows.length > 0) return;

    const [inserted]: any = await queryInterface.sequelize.query(
      `INSERT INTO "PayrollIrrfTables" ("effectiveFrom", "dependentDeductionValue", "sourceReference", "createdAt", "updatedAt")
       VALUES ('2026-01-01', 189.59, 'Receita Federal — tabela de incidência mensal do IRRF vigente desde jan/2026; dedução por dependente conforme Lei 9.250/1995, art. 4º, III', NOW(), NOW())
       RETURNING id`
    );
    const irrfTableId = inserted[0].id;

    const brackets = [
      { min: 0, max: 2428.8, rate: 0, deduction: 0, order: 1 },
      { min: 2428.81, max: 2826.65, rate: 7.5, deduction: 182.16, order: 2 },
      { min: 2826.66, max: 3751.05, rate: 15, deduction: 394.16, order: 3 },
      { min: 3751.06, max: 4664.68, rate: 22.5, deduction: 675.49, order: 4 },
      { min: 4664.69, max: null, rate: 27.5, deduction: 908.73, order: 5 }
    ];

    for (const b of brackets) {
      await queryInterface.sequelize.query(
        `INSERT INTO "PayrollIrrfBrackets"
           ("irrfTableId", "minBase", "maxBase", "rate", "deduction", "sortOrder", "createdAt", "updatedAt")
         VALUES (:irrfTableId, :min, :max, :rate, :deduction, :order, NOW(), NOW())`,
        {
          replacements: {
            irrfTableId,
            min: b.min,
            max: b.max,
            rate: b.rate,
            deduction: b.deduction,
            order: b.order
          }
        }
      );
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("PayrollIrrfBrackets");
    await queryInterface.dropTable("PayrollIrrfTables");
  }
};
