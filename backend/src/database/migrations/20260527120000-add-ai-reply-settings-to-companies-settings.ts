import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("CompaniesSettings", "aiReplyEnabled", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "disabled"
    });

    await queryInterface.addColumn("CompaniesSettings", "aiReplyProvider", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "openai"
    });

    await queryInterface.addColumn("CompaniesSettings", "aiReplyApiKey", {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: ""
    });

    await queryInterface.addColumn("CompaniesSettings", "aiReplyPrompt", {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: ""
    });

    await queryInterface.addColumn("CompaniesSettings", "aiReplyMaxTokens", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 300
    });

    await queryInterface.addColumn("CompaniesSettings", "aiReplyTemperature", {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0.4
    });

    await queryInterface.addColumn("CompaniesSettings", "aiReplyModel", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "gpt-4.1-mini"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("CompaniesSettings", "aiReplyModel");
    await queryInterface.removeColumn("CompaniesSettings", "aiReplyTemperature");
    await queryInterface.removeColumn("CompaniesSettings", "aiReplyMaxTokens");
    await queryInterface.removeColumn("CompaniesSettings", "aiReplyPrompt");
    await queryInterface.removeColumn("CompaniesSettings", "aiReplyApiKey");
    await queryInterface.removeColumn("CompaniesSettings", "aiReplyProvider");
    await queryInterface.removeColumn("CompaniesSettings", "aiReplyEnabled");
  }
};
