import { QueryInterface, DataTypes } from "sequelize";

// Boolean simples que espelha "faceDescriptor preenchido ou não" — exposto
// normalmente ao frontend (o descritor em si, dado biométrico sensível,
// nunca é). Ver comentário no model Member.ts.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Members", "faceEnrolled", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Members", "faceEnrolled");
  }
};
