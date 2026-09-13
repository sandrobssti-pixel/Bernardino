import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("MetaConnections", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      channel: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "meta"
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      appId: {
        type: DataTypes.STRING,
        allowNull: true
      },
      appSecret: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      verifyToken: {
        type: DataTypes.STRING,
        allowNull: false
      },
      pageId: {
        type: DataTypes.STRING,
        allowNull: true
      },
      pageAccessToken: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      instagramBusinessAccountId: {
        type: DataTypes.STRING,
        allowNull: true
      },
      businessId: {
        type: DataTypes.STRING,
        allowNull: true
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "DISCONNECTED"
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true
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

    await queryInterface.addIndex("MetaConnections", ["companyId"], {
      name: "meta_connections_company_id_idx"
    });
    await queryInterface.addIndex("MetaConnections", ["companyId", "channel"], {
      name: "meta_connections_company_channel_idx"
    });
    await queryInterface.addIndex("MetaConnections", ["companyId", "pageId"], {
      name: "meta_connections_company_page_idx"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex("MetaConnections", "meta_connections_company_page_idx");
    await queryInterface.removeIndex("MetaConnections", "meta_connections_company_channel_idx");
    await queryInterface.removeIndex("MetaConnections", "meta_connections_company_id_idx");
    await queryInterface.dropTable("MetaConnections");
  }
};
