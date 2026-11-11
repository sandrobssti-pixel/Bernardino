import { QueryInterface, DataTypes } from "sequelize";

// Arma PESSOAL do associado (diferente de FinanceWeaponUnit, que é o
// estoque/armaria do CLUBE) — pedido do cliente a partir da referência
// real do clube-atirador.techsofttecnologia.com.br (tela "Editar
// Arma"). "usageType"/"storageLocation" ficam como texto livre de
// propósito (mesmo motivo de Member.category): não dá pra saber pela
// tela de referência quais eram as opções reais do <select>, e travar
// um enum errado é pior que deixar livre. "sigmaRegistrationNumber"
// usa o MESMO nome de campo de FinanceWeaponUnit, por consistência.
// Ver docs/MANUAL_TECNICO.md.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("MemberWeapons", {
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
      usageType: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      storageLocation: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      brand: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      model: {
        type: DataTypes.STRING,
        allowNull: false
      },
      weaponType: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      caliber: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      serialNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      sigmaRegistrationNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
      },
      crafValidUntil: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      notes: {
        type: DataTypes.TEXT,
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
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("MemberWeapons");
  }
};
