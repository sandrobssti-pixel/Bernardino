import { QueryInterface, DataTypes } from "sequelize";

// distanceMeters: distância calculada entre a localização enviada e a
// coordenada do clube, no momento do check-in (só quando a empresa tem
// geofencing configurado) — ajuda o Admin a revisar mais rápido, mesmo
// quando a aprovação continua manual. validationMethod distingue quem
// aprovou: "manual" (Admin, como sempre foi) ou "auto_geofence"
// (sistema, automaticamente, porque a localização bateu dentro do
// raio) — nunca apaga o rastro de quem/como aprovou. Ver
// docs/MANUAL_TECNICO.md.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.addColumn("MemberCheckIns", "distanceMeters", {
        type: DataTypes.FLOAT,
        allowNull: true
      }),
      queryInterface.addColumn("MemberCheckIns", "validationMethod", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "manual"
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("MemberCheckIns", "distanceMeters"),
      queryInterface.removeColumn("MemberCheckIns", "validationMethod")
    ]);
  }
};
