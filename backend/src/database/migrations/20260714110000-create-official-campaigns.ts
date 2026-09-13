module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("OfficialCampaigns", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "INATIVA"
      },
      scheduledAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      companyId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      contactListId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "ContactLists", key: "id" },
        onUpdate: "SET NULL",
        onDelete: "SET NULL"
      },
      whatsappId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "SET NULL",
        onDelete: "SET NULL"
      },
      templateIdMeta: {
        type: Sequelize.STRING,
        allowNull: false
      },
      templateName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      templateLanguage: {
        type: Sequelize.STRING,
        allowNull: false
      },
      templateCategory: {
        type: Sequelize.STRING,
        allowNull: true
      },
      templateComponents: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      headerVariables: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      bodyVariables: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      statusTicket: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "closed"
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

    await queryInterface.addIndex("OfficialCampaigns", ["companyId"], {
      name: "official_campaigns_company_id_idx"
    });

    await queryInterface.addIndex("OfficialCampaigns", ["status", "scheduledAt"], {
      name: "official_campaigns_status_scheduled_at_idx"
    });
  },

  down: async queryInterface => {
    await queryInterface.dropTable("OfficialCampaigns");
  }
};
