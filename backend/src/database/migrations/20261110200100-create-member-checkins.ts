import { QueryInterface, DataTypes } from "sequelize";

// Registro de presença (Controle de Acesso / Secretaria do Gerenciador
// CAC) — Decreto nº 11.615/2023, art. 38, §5º, III (redação dada pelo
// Decreto nº 12.345/2024): entidades de tiro desportivo devem reportar a
// relação de quem frequentou, obtida por biometria/reconhecimento facial.
// Ver docs/MANUAL_TECNICO.md.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("MemberCheckIns", {
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
      checkedInAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      matchDistance: {
        type: DataTypes.FLOAT,
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
    await queryInterface.dropTable("MemberCheckIns");
  }
};
