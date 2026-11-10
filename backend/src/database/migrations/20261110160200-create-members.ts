import { QueryInterface, DataTypes } from "sequelize";

// Cadastro de Associados (módulo add-on genérico — Plan.useMembers): quem é
// filiado/sócio/aluno da empresa, independente de `Contact` (atendimento via
// WhatsApp) e de `FinanceCustomer` (venda/conta a receber) — pode
// opcionalmente ser vinculado a um Contact já existente, mesmo padrão já
// usado em FinanceCustomer.contactId/WeaponDispatchClient.contactId.
//
// `code` (sequencial "00001", "00002"... por empresa, mesmo padrão de
// FinanceCustomer/Sale — ver docs/MANUAL_TECNICO.md) também serve de número
// da carteirinha digital (fase futura).
//
// `status`: "pending" (cadastro incompleto — falta documento/foto/etc.,
// equivalente ao "Dados Pendentes" do sistema de referência) | "active" |
// "inactive". Novo cadastro sempre nasce "pending" até ter documento e foto.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("Members", {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      code: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      document: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      rg: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      birthDate: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      whatsapp: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      // Texto livre ("atirador", "sócio", "aluno"...) — não é enum fixo de
      // propósito, o módulo é genérico pra qualquer tipo de clube/
      // associação, cada empresa define suas próprias categorias.
      category: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "pending"
      },
      zipCode: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      street: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      number: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      complement: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      neighborhood: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      city: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      state: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      photoUrl: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      contactId: {
        type: DataTypes.INTEGER,
        references: { model: "Contacts", key: "id" },
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
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    // Índice único parcial — "document" pode ficar vazio enquanto o
    // cadastro está "pending" (várias linhas com "" convivem sem conflito),
    // mas não pode repetir quando preenchido de verdade. Mesmo padrão já
    // usado em FinanceWeaponUnit.serialNumber (docs/MANUAL_TECNICO.md,
    // seção 11).
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "members_company_document_unique"
      ON "Members" ("companyId", "document")
      WHERE "document" IS NOT NULL AND "document" <> '';
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("Members");
  }
};
