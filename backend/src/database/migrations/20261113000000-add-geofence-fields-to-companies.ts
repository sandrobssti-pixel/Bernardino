import { QueryInterface, DataTypes } from "sequelize";

// Coordenada + raio do clube, usados pra validar automaticamente a
// localização enviada na entrada de habitualidade (Fase 4 — API de
// check-in com geofencing). Null = geofencing desativado pra essa
// empresa (toda entrada continua exigindo aprovação manual do Admin,
// como já era antes). Ver docs/MANUAL_TECNICO.md.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.addColumn("Companies", "geofenceLatitude", {
        type: DataTypes.DOUBLE,
        allowNull: true
      }),
      queryInterface.addColumn("Companies", "geofenceLongitude", {
        type: DataTypes.DOUBLE,
        allowNull: true
      }),
      queryInterface.addColumn("Companies", "geofenceRadiusMeters", {
        type: DataTypes.INTEGER,
        allowNull: true
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("Companies", "geofenceLatitude"),
      queryInterface.removeColumn("Companies", "geofenceLongitude"),
      queryInterface.removeColumn("Companies", "geofenceRadiusMeters")
    ]);
  }
};
