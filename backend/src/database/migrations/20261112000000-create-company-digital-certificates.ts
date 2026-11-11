import { QueryInterface, DataTypes } from "sequelize";

// Certificado digital A1 (.pfx/.p12) da ENTIDADE (um por empresa, nunca
// por associado) — usado pra assinar digitalmente a Declaração de
// Filiação (Anexo B, Decreto 11.615/2023) e outros documentos
// oficiais que a entidade precisa assinar. O arquivo em si e a senha
// SEMPRE ficam criptografados (AES-256-GCM, ver
// utils/companyCertificateCrypto.ts) — nunca em texto puro, nunca
// expostos em resposta de API. Ver docs/MANUAL_TECNICO.md.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("CompanyDigitalCertificates", {
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
        allowNull: false,
        unique: true
      },
      pfxEncrypted: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      passwordEncrypted: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      fileName: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      subjectName: {
        type: DataTypes.STRING,
        allowNull: true
      },
      validUntil: {
        type: DataTypes.DATE,
        allowNull: true
      },
      uploadedByUserId: {
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
    await queryInterface.dropTable("CompanyDigitalCertificates");
  }
};
