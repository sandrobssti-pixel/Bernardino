module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("WhatsAppOfficialTemplates", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      whatsappId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      templateIdMeta: {
        type: Sequelize.STRING,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      language: {
        type: Sequelize.STRING,
        allowNull: false
      },
      status: {
        type: Sequelize.STRING,
        allowNull: true
      },
      category: {
        type: Sequelize.STRING,
        allowNull: true
      },
      components: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      lastSyncedAt: {
        type: Sequelize.DATE,
        allowNull: true
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

    await queryInterface.addConstraint("WhatsAppOfficialTemplates", {
      fields: ["whatsappId", "templateIdMeta"],
      type: "unique",
      name: "whatsapp_official_templates_whatsappId_templateIdMeta_unique"
    });

    await queryInterface.addIndex("WhatsAppOfficialTemplates", ["whatsappId"], {
      name: "whatsapp_official_templates_whatsappId_idx"
    });
  },

  down: async queryInterface => {
    await queryInterface.dropTable("WhatsAppOfficialTemplates");
  }
};
