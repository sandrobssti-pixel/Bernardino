import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Whatsapps", "webchatWidgetId", {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: true,
      unique: true
    });

    await queryInterface.addColumn("Whatsapps", "webchatAllowedDomains", {
      type: DataTypes.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn("Whatsapps", "webchatSettings", {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    });

    await queryInterface.addColumn("Whatsapps", "webchatActive", {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Whatsapps", "webchatActive");
    await queryInterface.removeColumn("Whatsapps", "webchatSettings");
    await queryInterface.removeColumn("Whatsapps", "webchatAllowedDomains");
    await queryInterface.removeColumn("Whatsapps", "webchatWidgetId");
  }
};
