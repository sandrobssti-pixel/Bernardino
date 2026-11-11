import { QueryInterface, DataTypes } from "sequelize";

// Auditoria de LEITURA (uso) do certificado digital da entidade —
// mesmo padrão de WeaponDispatchGovPasswordAccessLog: toda vez que
// CompanyCertificateService.getForSigning é chamado (ou seja, toda vez
// que o certificado é de fato usado pra assinar alguma coisa), grava
// uma linha aqui antes. Nunca grava o certificado/senha aqui (nem
// cifrado) — só QUEM, QUANDO, POR QUÊ. Ver docs/MANUAL_TECNICO.md.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("CompanyCertificateAccessLogs", {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      companyId: {
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      accessedAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      reason: {
        type: DataTypes.STRING,
        allowNull: true
      },
      accessedByUserId: {
        type: DataTypes.INTEGER,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("CompanyCertificateAccessLogs");
  }
};
