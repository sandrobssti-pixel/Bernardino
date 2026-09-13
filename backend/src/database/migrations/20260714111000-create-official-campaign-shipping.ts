module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("OfficialCampaignShipping", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      jobId: {
        type: Sequelize.STRING,
        allowNull: true
      },
      number: {
        type: Sequelize.STRING,
        allowNull: true
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "PENDENTE"
      },
      preview: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      error: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      deliveredAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      ticketId: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      contactId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "ContactListItems", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      officialCampaignId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "OfficialCampaigns", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    await queryInterface.addConstraint("OfficialCampaignShipping", {
      fields: ["officialCampaignId", "contactId"],
      type: "unique",
      name: "official_campaign_shipping_campaign_contact_unique"
    });
  },

  down: async queryInterface => {
    await queryInterface.dropTable("OfficialCampaignShipping");
  }
};
