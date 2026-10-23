import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "WeaponArmoryServices";
    const tables = await queryInterface.showAllTables();
    if (tables.includes(table)) return;

    await queryInterface.createTable(table, {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      contactId: {
        type: DataTypes.INTEGER,
        references: { model: "Contacts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      clientName: { type: DataTypes.STRING, allowNull: false },
      clientCpf: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
      clientRg: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
      clientProfession: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
      clientAddress: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
      clientPhone: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
      clientEmail: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },

      weaponType: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
      weaponBrand: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
      weaponModel: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
      weaponCaliber: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
      weaponSerialNumber: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
      weaponCapacity: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
      weaponFinish: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
      weaponCountryOfOrigin: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
      accessoriesMagazineQty: { type: DataTypes.STRING, allowNull: false, defaultValue: "0" },
      accessoriesCase: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      accessoriesHolster: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      accessoriesOther: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },

      crafNumber: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
      crafExpiry: { type: DataTypes.DATEONLY, allowNull: true },
      trafficGuideNumber: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
      trafficGuideExpiry: { type: DataTypes.DATEONLY, allowNull: true },
      trafficGuideIssuer: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
      authorizationType: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
      authorizationNumber: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
      authorizationExpiry: { type: DataTypes.DATEONLY, allowNull: true },

      serviceRequested: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
      defectReported: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
      conservationState: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
      workPerformedDescription: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },

      photosBefore: { type: DataTypes.TEXT, allowNull: false, defaultValue: "[]" },
      photosAfter: { type: DataTypes.TEXT, allowNull: false, defaultValue: "[]" },

      status: { type: DataTypes.STRING, allowNull: false, defaultValue: "received" },
      receivedAt: { type: DataTypes.DATE, allowNull: true },
      returnedAt: { type: DataTypes.DATE, allowNull: true },

      companyId: {
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      createdAt: { type: DataTypes.DATE(6), allowNull: false },
      updatedAt: { type: DataTypes.DATE(6), allowNull: false }
    });
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("WeaponArmoryServices");
  }
};
