import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Announcements", "displayMode", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "popover"
    });

    await queryInterface.addColumn("Announcements", "backgroundColor", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await queryInterface.sequelize.query(
      `UPDATE "Announcements" SET "displayMode" = 'popover' WHERE "displayMode" IS NULL;`
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Announcements", "backgroundColor");
    await queryInterface.removeColumn("Announcements", "displayMode");
  }
};
