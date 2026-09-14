import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Vagas de emprego (Fase 5 — módulo de RH, ver docs/MANUAL_TECNICO.md,
// seção 6.2).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "JobPostings";
    const existingTables: ExistingTables = await queryInterface.showAllTables();

    if (!existingTables.includes(table)) {
      return queryInterface.createTable(table, {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        title: {
          type: DataTypes.STRING,
          allowNull: false
        },
        department: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: false,
          defaultValue: ""
        },
        requirements: {
          type: DataTypes.TEXT,
          allowNull: false,
          defaultValue: ""
        },
        // "clt" | "pj" | "estagio" | "temporario"
        employmentType: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "clt"
        },
        // "presencial" | "remoto" | "hibrido"
        workMode: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "presencial"
        },
        salaryRange: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        location: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        // "open" | "closed"
        status: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "open"
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
    return queryInterface.dropTable("JobPostings");
  }
};
