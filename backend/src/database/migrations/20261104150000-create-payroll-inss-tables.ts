import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Tabela de INSS (RH — Fase 2, ver docs/MANUAL_TECNICO.md) — GLOBAL, sem
// companyId: é lei federal, igual pra toda empresa do sistema. Versionada
// por `effectiveFrom` (nunca edita uma versão existente — cadastra uma
// nova quando a Receita Federal/Previdência muda os valores, preservando
// o histórico de cálculos antigos corretos). Editável só por Master
// (`user.super`), ver PayrollController.
//
// Seed inicial: Portaria Interministerial MPS/MF nº 13, de 09/01/2026,
// vigente desde a competência janeiro/2026. Cálculo progressivo por
// faixa: desconto = salário × alíquota − parcela a deduzir, capado no
// teto de contribuição.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const existingTables: ExistingTables = await queryInterface.showAllTables();

    if (!existingTables.includes("PayrollInssTables")) {
      await queryInterface.createTable("PayrollInssTables", {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        effectiveFrom: { type: DataTypes.DATEONLY, allowNull: false },
        // Teto de contribuição — acima deste salário, o desconto fica
        // fixo neste valor (não extrapola a última faixa).
        ceilingValue: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
        sourceReference: { type: DataTypes.STRING, allowNull: true },
        createdAt: { type: DataTypes.DATE(6), allowNull: false },
        updatedAt: { type: DataTypes.DATE(6), allowNull: false }
      });
    }

    if (!existingTables.includes("PayrollInssBrackets")) {
      await queryInterface.createTable("PayrollInssBrackets", {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        inssTableId: {
          type: DataTypes.INTEGER,
          references: { model: "PayrollInssTables", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          allowNull: false
        },
        minSalary: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
        // NULL = sem limite superior (última faixa).
        maxSalary: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
        rate: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
        deduction: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
        sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        createdAt: { type: DataTypes.DATE(6), allowNull: false },
        updatedAt: { type: DataTypes.DATE(6), allowNull: false }
      });
    }

    // Seed — idempotente: só insere se ainda não existir nenhuma versão.
    const [existingRows]: any = await queryInterface.sequelize.query(
      `SELECT id FROM "PayrollInssTables" LIMIT 1`
    );
    if (existingRows.length > 0) return;

    const [inserted]: any = await queryInterface.sequelize.query(
      `INSERT INTO "PayrollInssTables" ("effectiveFrom", "ceilingValue", "sourceReference", "createdAt", "updatedAt")
       VALUES ('2026-01-01', 988.09, 'Portaria Interministerial MPS/MF nº 13, de 09/01/2026', NOW(), NOW())
       RETURNING id`
    );
    const inssTableId = inserted[0].id;

    const brackets = [
      { min: 0, max: 1621.0, rate: 7.5, deduction: 0, order: 1 },
      { min: 1621.01, max: 2902.84, rate: 9, deduction: 24.32, order: 2 },
      { min: 2902.85, max: 4354.27, rate: 12, deduction: 111.4, order: 3 },
      { min: 4354.28, max: 8475.55, rate: 14, deduction: 198.49, order: 4 }
    ];

    for (const b of brackets) {
      await queryInterface.sequelize.query(
        `INSERT INTO "PayrollInssBrackets"
           ("inssTableId", "minSalary", "maxSalary", "rate", "deduction", "sortOrder", "createdAt", "updatedAt")
         VALUES (:inssTableId, :min, :max, :rate, :deduction, :order, NOW(), NOW())`,
        {
          replacements: {
            inssTableId,
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
    await queryInterface.dropTable("PayrollInssBrackets");
    await queryInterface.dropTable("PayrollInssTables");
  }
};
