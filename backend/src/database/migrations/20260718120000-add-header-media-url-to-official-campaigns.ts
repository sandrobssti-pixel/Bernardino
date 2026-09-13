module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("OfficialCampaigns", "headerMediaUrl", {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  down: async queryInterface => {
    await queryInterface.removeColumn("OfficialCampaigns", "headerMediaUrl");
  }
};
