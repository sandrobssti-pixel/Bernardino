import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Painel de Desempenho (RH — Fase 3 de 3, ver docs/MANUAL_TECNICO.md) —
// avaliações do gestor, OKRs, feedback 1:1 e matriz de prontidão pra
// promoção. Acesso restrito a Admin/Master e ao `managerId` do
// funcionário (ver EmployeeService/PerformanceAccessService) — nem todo
// usuário com acesso ao RH enxerga, só quem gerencia aquele funcionário
// específico (premissa fechada com o cliente já na Fase 1, seção 215).
//
// TABELA ÚNICA pros 4 tipos (`recordType`), não 4 tabelas separadas —
// mesmo raciocínio já usado em `Employees` (tabela larga por regime de
// trabalho, ver seção 215): os 4 tipos são registros pontuais do
// mesmo conceito ("um momento de acompanhamento de desempenho"), a
// maioria dos campos é específica de um tipo só (`allowNull: true`), e
// o formulário decide o que mostrar conforme `recordType` — evita 4x o
// número de migrations/models/services/controllers pra um ganho
// arquitetural que não existe aqui (não são conceitos que precisam de
// relações/queries independentes entre si).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "PerformanceRecords";
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
      // "evaluation" | "okr" | "feedback_1_1" | "promotion_readiness"
      recordType: { type: DataTypes.STRING, allowNull: false },
      recordDate: { type: DataTypes.DATEONLY, allowNull: false },
      createdByUserId: {
        type: DataTypes.INTEGER,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      notes: { type: DataTypes.TEXT, allowNull: true },

      // Avaliação do gestor.
      overallRating: { type: DataTypes.INTEGER, allowNull: true },
      strengths: { type: DataTypes.TEXT, allowNull: true },
      improvementAreas: { type: DataTypes.TEXT, allowNull: true },
      goals: { type: DataTypes.TEXT, allowNull: true },

      // OKR — objetivo + até 3 resultados-chave (limite fixo, evita UI
      // de lista aberta pra um painel interno; cobre a prática comum de
      // 2-4 key results por objetivo).
      objective: { type: DataTypes.TEXT, allowNull: true },
      keyResult1: { type: DataTypes.TEXT, allowNull: true },
      kr1Progress: { type: DataTypes.INTEGER, allowNull: true },
      keyResult2: { type: DataTypes.TEXT, allowNull: true },
      kr2Progress: { type: DataTypes.INTEGER, allowNull: true },
      keyResult3: { type: DataTypes.TEXT, allowNull: true },
      kr3Progress: { type: DataTypes.INTEGER, allowNull: true },
      overallProgress: { type: DataTypes.INTEGER, allowNull: true },

      // Feedback 1:1.
      topics: { type: DataTypes.TEXT, allowNull: true },
      actionItems: { type: DataTypes.TEXT, allowNull: true },
      nextMeetingDate: { type: DataTypes.DATEONLY, allowNull: true },

      // Matriz de prontidão pra promoção.
      targetRole: { type: DataTypes.STRING, allowNull: true },
      technicalSkillScore: { type: DataTypes.INTEGER, allowNull: true },
      leadershipScore: { type: DataTypes.INTEGER, allowNull: true },
      communicationScore: { type: DataTypes.INTEGER, allowNull: true },
      resultsScore: { type: DataTypes.INTEGER, allowNull: true },
      // "not_ready" | "developing" | "ready_soon" | "ready_now"
      readinessLevel: { type: DataTypes.STRING, allowNull: true },

      createdAt: { type: DataTypes.DATE(6), allowNull: false },
      updatedAt: { type: DataTypes.DATE(6), allowNull: false }
    });

    await queryInterface.addIndex(table, ["employeeId", "recordType"], {
      name: "performance_records_employee_type_idx"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("PerformanceRecords");
  }
};
