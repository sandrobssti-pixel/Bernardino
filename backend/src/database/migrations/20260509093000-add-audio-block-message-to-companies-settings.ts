"use strict";
export {};

const TABLE = "CompaniesSettings";
const COLUMN = "AcceptAudioMessageContactMessage";
const DEFAULT_MESSAGE = "Infelizmente não conseguimos escutar nem enviar áudios por este canal de atendimento, por favor, envie uma mensagem de texto.";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable(TABLE);

    if (!table[COLUMN]) {
      await queryInterface.addColumn(TABLE, COLUMN, {
        type: Sequelize.DataTypes.TEXT,
        allowNull: false,
        defaultValue: DEFAULT_MESSAGE
      });
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeColumn(TABLE, COLUMN);
    } catch {}
  }
};
