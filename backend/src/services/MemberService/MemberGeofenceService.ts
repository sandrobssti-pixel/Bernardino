import AppError from "../../errors/AppError";
import Company from "../../models/Company";

// Coordenada + raio do clube — Gerenciador CAC, Fase 4 (API de check-in
// com geofencing): permite aprovar automaticamente a entrada de
// habitualidade quando a localização enviada pelo associado está
// dentro do raio configurado, sem precisar que o Admin confira cada
// uma manualmente. Ver docs/MANUAL_TECNICO.md.

export interface GeofenceSettings {
  configured: boolean;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
}

const DEFAULT_RADIUS_METERS = 150;
const MIN_RADIUS_METERS = 20;
const MAX_RADIUS_METERS = 5000;

export const getSettings = async (companyId: number): Promise<GeofenceSettings> => {
  const company = await Company.findByPk(companyId, {
    attributes: ["geofenceLatitude", "geofenceLongitude", "geofenceRadiusMeters"]
  });
  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  const { geofenceLatitude, geofenceLongitude, geofenceRadiusMeters } = company;
  const configured =
    geofenceLatitude != null && geofenceLongitude != null && geofenceRadiusMeters != null;

  return {
    configured,
    latitude: geofenceLatitude ?? null,
    longitude: geofenceLongitude ?? null,
    radiusMeters: geofenceRadiusMeters ?? null
  };
};

interface UpdateSettingsRequest {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
}

export const updateSettings = async (
  companyId: number,
  { latitude, longitude, radiusMeters = DEFAULT_RADIUS_METERS }: UpdateSettingsRequest
): Promise<GeofenceSettings> => {
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new AppError("ERR_MEMBER_GEOFENCE_INVALID_COORDINATES");
  }
  if (
    typeof radiusMeters !== "number" ||
    Number.isNaN(radiusMeters) ||
    radiusMeters < MIN_RADIUS_METERS ||
    radiusMeters > MAX_RADIUS_METERS
  ) {
    throw new AppError("ERR_MEMBER_GEOFENCE_INVALID_RADIUS");
  }

  const company = await Company.findByPk(companyId);
  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  company.geofenceLatitude = latitude;
  company.geofenceLongitude = longitude;
  company.geofenceRadiusMeters = Math.round(radiusMeters);
  await company.save();

  return getSettings(companyId);
};

export const removeSettings = async (companyId: number): Promise<void> => {
  const company = await Company.findByPk(companyId);
  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  company.geofenceLatitude = null as any;
  company.geofenceLongitude = null as any;
  company.geofenceRadiusMeters = null as any;
  await company.save();
};
