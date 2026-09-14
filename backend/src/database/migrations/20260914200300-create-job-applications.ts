import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Candidaturas a vagas (Fase 5 — módulo de RH), ver docs/MANUAL_TECNICO.md,
// seção 6.2. `hiredUserId` fica preenchido quando a candidatura é efetivada
// (vira um User da empresa).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "JobApplications";
    const existingTables: ExistingTables = await queryInterface.showAllTables();

    if (!existingTables.includes(table)) {
      return queryInterface.createTable(table, {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        candidateName: {
          type: DataTypes.STRING,
          allowNull: false
        },
        candidateEmail: {
          type: DataTypes.STRING,
          allowNull: false
        },
        candidatePhone: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        coverLetter: {
          type: DataTypes.TEXT,
          allowNull: false,
          defaultValue: ""
        },
        resumeUrl: {
          type: DataTypes.TEXT,
          allowNull: false,
          defaultValue: ""
        },
        // "received" | "screening" | "interview" | "approved" | "rejected"
        status: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "received"
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: false,
          defaultValue: ""
        },
        rating: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        jobPostingId: {
          type: DataTypes.INTEGER,
          references: { model: "JobPostings", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          allowNull: false
        },
        hiredUserId: {
          type: DataTypes.INTEGER,
          references: { model: "Users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
          allowNull: true
        },
        companyId: {
          type: DataTypes.INTEGER,
          references: { model: "Companies", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          allowNull: false
        },
        createdAt: {
          type: DataTypes.DATE(6),
          allowNull: false
        },
        updatedAt: {
          type: DataTypes.DATE(6),
          allowNull: false
        }
      });
    }
  },
  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("JobApplications");
  }
};
