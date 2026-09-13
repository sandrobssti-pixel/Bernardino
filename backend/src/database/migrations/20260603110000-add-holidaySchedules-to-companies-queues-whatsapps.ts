module.exports = {
  up: async queryInterface => {
    await queryInterface.addColumn("Companies", "holidaySchedules", {
      type: "JSONB",
      allowNull: true
    });

    await queryInterface.addColumn("Queues", "holidaySchedules", {
      type: "JSONB",
      allowNull: true
    });

    await queryInterface.addColumn("Whatsapps", "holidaySchedules", {
      type: "JSONB",
      allowNull: true
    });
  },

  down: async queryInterface => {
    await queryInterface.removeColumn("Whatsapps", "holidaySchedules");
    await queryInterface.removeColumn("Queues", "holidaySchedules");
    await queryInterface.removeColumn("Companies", "holidaySchedules");
  }
};
