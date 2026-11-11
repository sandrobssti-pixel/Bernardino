import { QueryInterface, DataTypes } from "sequelize";

// Checklist de documentos do associado (CPF, RG, CNH, Comprovante de
// Endereço, Certidão de Antecedentes Criminais, CR, CRAF por arma
// própria/ativa, Histórico Disciplinar, documentos de concessão/
// revalidação de CR, documentos avulsos) — referência real do
// clube-atirador.techsofttecnologia.com.br (tela "Documentos").
// "documentType" é a CHAVE do catálogo (ver
// frontend/pages/Members/memberDocumentsConfig.js) — texto, não enum de
// banco, pra poder adicionar novo tipo de documento sem migration nova.
// "weaponId" só preenchido pro CRAF (documento é POR arma própria/
// ativa, não do associado em geral). Ver docs/MANUAL_TECNICO.md.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("MemberDocuments", {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      memberId: {
        type: DataTypes.INTEGER,
        references: { model: "Members", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      documentType: {
        type: DataTypes.STRING,
        allowNull: false
      },
      weaponId: {
        type: DataTypes.INTEGER,
        references: { model: "MemberWeapons", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: true
      },
      label: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      fileUrl: {
        type: DataTypes.STRING,
        allowNull: false
      },
      fileName: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      uploadedAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
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
    await queryInterface.dropTable("MemberDocuments");
  }
};
