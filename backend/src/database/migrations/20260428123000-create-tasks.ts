import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface) {
    await queryInterface.createTable("Tasks", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      title: {
        allowNull: false,
        type: DataTypes.STRING
      },
      description: {
        allowNull: false,
        defaultValue: "",
        type: DataTypes.TEXT
      },
      comments: {
        allowNull: false,
        defaultValue: "",
        type: DataTypes.TEXT
      },
      dueDate: {
        allowNull: false,
        defaultValue: "",
        type: DataTypes.STRING
      },
      status: {
        allowNull: false,
        defaultValue: "pending",
        type: DataTypes.STRING
      },
      priority: {
        allowNull: false,
        defaultValue: "medium",
        type: DataTypes.STRING
      },
      sortOrder: {
        allowNull: false,
        defaultValue: 0,
        type: DataTypes.INTEGER
      },
      companyId: {
        allowNull: false,
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      responsibleUserId: {
        allowNull: false,
        type: DataTypes.INTEGER,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      responsibleUserName: {
        allowNull: false,
        defaultValue: "Usuário",
        type: DataTypes.STRING
      },
      createdByUserId: {
        allowNull: false,
        type: DataTypes.INTEGER,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      createdByUserName: {
        allowNull: false,
        defaultValue: "Usuário",
        type: DataTypes.STRING
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

    await queryInterface.addIndex("Tasks", ["companyId"]);
    await queryInterface.addIndex("Tasks", ["responsibleUserId"]);
    await queryInterface.addIndex("Tasks", ["status"]);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.dropTable("Tasks");
  }
};
