import { QueryInterface, DataTypes } from "sequelize";

// Endereços ADICIONAIS do associado (rural, comercial, local de guarda
// de armas...) — complementares ao endereço principal (que continua
// nos campos já existentes de Member). Referência real do
// clube-atirador.techsofttecnologia.com.br (tela "Endereço", seção
// "Endereços adicionais"). Ver docs/MANUAL_TECNICO.md.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("MemberAddresses", {
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
      addressType: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      description: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
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
    await queryInterface.dropTable("MemberAddresses");
  }
};
