import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Users", "birthDate", {
      type: DataTypes.DATEONLY,
      allowNull: true
    });

    await queryInterface.addColumn("Contacts", "birthDate", {
      type: DataTypes.DATEONLY,
      allowNull: true
    });

    await queryInterface.addIndex("Users", ["birthDate"], {
      name: "idx_users_birth_date"
    });

    await queryInterface.addIndex("Contacts", ["birthDate"], {
      name: "idx_contacts_birth_date"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex("Users", "idx_users_birth_date");
    await queryInterface.removeIndex("Contacts", "idx_contacts_birth_date");
    await queryInterface.removeColumn("Users", "birthDate");
    await queryInterface.removeColumn("Contacts", "birthDate");
  }
};
