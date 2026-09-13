import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface) {
    await queryInterface.createTable("PushSubscriptions", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      endpoint: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true
      },
      p256dh: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      auth: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      expirationTime: {
        type: DataTypes.STRING,
        allowNull: true
      },
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      lastSeenAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      createdAt: {
        allowNull: false,
        type: DataTypes.DATE
      },
      updatedAt: {
        allowNull: false,
        type: DataTypes.DATE
      }
    });

    await queryInterface.addIndex("PushSubscriptions", ["companyId"], {
      name: "idx_push_subscriptions_company_id"
    });
    await queryInterface.addIndex("PushSubscriptions", ["userId"], {
      name: "idx_push_subscriptions_user_id"
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.dropTable("PushSubscriptions");
  }
};
